import { createHash } from "node:crypto";
import { getBotulinumProductRegistry, getOpenFdaRegulatoryMapping } from "./config";
import type { OpenFdaQueryDefinition, OpenFdaQueryKind } from "./types";

function quoteOpenFdaTerm(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function queryId(kind: OpenFdaQueryKind, field: string, term: string, suspectOnly: boolean) {
  return createHash("sha256").update(`${kind}:${field}:${term}:${suspectOnly}`).digest("hex").slice(0, 20);
}

function publicUrl(endpoint: string, searchExpression: string, pageSize: number, sort: string) {
  const url = new URL(endpoint);
  url.searchParams.set("search", searchExpression);
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("sort", sort);
  return url.toString();
}

export function buildBotulinumOpenFdaQueries(options: {
  suspectOnly?: boolean;
  products?: string[];
} = {}): OpenFdaQueryDefinition[] {
  const registry = getBotulinumProductRegistry();
  const mapping = getOpenFdaRegulatoryMapping();
  const selected = new Set((options.products || []).map((value) => value.trim().toUpperCase()).filter(Boolean));
  const requested = (value: string) => selected.size === 0 || selected.has(value.toUpperCase());
  const terms: Array<{ kind: OpenFdaQueryKind; term: string; fields: string[] }> = [];
  for (const family of registry.families) {
    for (const brand of family.brands) if (requested(brand)) terms.push({ kind: "brand", term: brand, fields: mapping.queryFields.brand });
    for (const activeIngredient of family.activeIngredients) {
      if (requested(activeIngredient)) terms.push({ kind: "active_ingredient", term: activeIngredient, fields: mapping.queryFields.activeIngredient });
    }
  }
  if (selected.size) {
    const configured = new Set(terms.map((item) => item.term.toUpperCase()));
    const unknown = [...selected].filter((value) => !configured.has(value));
    if (unknown.length) throw new Error(`Unknown botulinum product target(s): ${unknown.join(", ")}`);
  }
  return terms.flatMap(({ kind, term, fields }) => fields.map((field) => {
    const targetClause = `${field}:${quoteOpenFdaTerm(term)}`;
    const searchExpression = options.suspectOnly
      ? `${targetClause} AND ${mapping.queryFields.suspectDrugField}:${mapping.queryFields.suspectDrugCode}`
      : targetClause;
    return {
      queryId: queryId(kind, field, term, Boolean(options.suspectOnly)),
      kind,
      productSearched: term,
      field,
      suspectOnly: Boolean(options.suspectOnly),
      searchExpression,
      publicUrl: publicUrl(mapping.endpoint, searchExpression, mapping.paging.pageSize, mapping.paging.sort),
    };
  }));
}

export function withOpenFdaApiKey(publicUrl: string, apiKey?: string) {
  if (!apiKey?.trim()) return publicUrl;
  const url = new URL(publicUrl);
  url.searchParams.set("api_key", apiKey.trim());
  return url.toString();
}

export function redactOpenFdaApiKey(value: string) {
  const url = new URL(value);
  url.searchParams.delete("api_key");
  return url.toString();
}
