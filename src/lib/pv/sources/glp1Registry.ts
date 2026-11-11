import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseMeltwaterCsv, type MeltwaterRow } from "../../../ingestion/adapters/meltwaterAdapter";

const GENERIC_NAMES = new Set(["forums", "blogs", "comments", "reviews"]);
function tally(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value || "Unspecified", (counts.get(value || "Unspecified") || 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
function httpUrl(value: string) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url : null; } catch { return null; }
}

/** Historical source presence is evidence of corpus coverage, not a monitoring agreement. */
export function buildGlp1SourceRegistry(rows: MeltwaterRow[], revision: string) {
  const domains = new Map<string, MeltwaterRow[]>();
  let unattributedCount = 0;
  for (const row of rows) {
    const declared = String(row["Source Domain"] || "").trim();
    const domain = (httpUrl(`https://${declared}`)?.hostname || httpUrl(String(row.URL || ""))?.hostname || "").toLowerCase().replace(/^www\./, "");
    if (!domain) { unattributedCount++; continue; }
    const sources = domains.get(domain) || [];
    sources.push(row);
    domains.set(domain, sources);
  }
  const sources = [...domains].map(([domain, records]) => {
    const names = tally(records.map(row => String(row["Source Name"] || "").trim()).filter(Boolean));
    const specificNames = names.filter(item => !GENERIC_NAMES.has(item.value.toLowerCase()));
    const name = specificNames.length === 1 ? specificNames[0].value : domain;
    const dates = records.map(row => String(row.Date || "")).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
    const exampleUrls = [...new Set(records.map(row => httpUrl(String(row.URL || ""))?.href).filter((url): url is string => Boolean(url)))].slice(0, 3);
    return {
      id: domain, name, domain, sourceUrl: `https://${domain}/`, mentionCount: records.length,
      sourceNames: names, sourceTypes: tally(records.map(row => String(row["Source Type"] || "").trim())),
      markets: tally(records.map(row => String(row.Country || "").trim())),
      languages: tally(records.map(row => String(row.Language || "").trim())),
      firstMentionDate: dates[0] || null, lastMentionDate: dates.at(-1) || null, exampleUrls,
      scope: "corpus_inventory" as const, monitoringStatus: "not_configured" as const,
    };
  }).sort((a, b) => b.mentionCount - a.mentionCount || a.domain.localeCompare(b.domain));
  return { therapeuticArea: "GLP-1", sourceFile: "data/glp-1.csv", revision, recordCount: rows.length, sourceCount: sources.length, unattributedCount, sources };
}

let cached: ReturnType<typeof buildGlp1SourceRegistry> | undefined;
export function loadGlp1SourceRegistry() {
  const file = path.resolve(process.cwd(), "data/glp-1.csv");
  const revision = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (cached?.revision !== revision) cached = buildGlp1SourceRegistry(parseMeltwaterCsv(file), revision);
  return cached;
}
