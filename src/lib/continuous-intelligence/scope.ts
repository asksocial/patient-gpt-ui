import type { CanonicalFinding } from "../../answering/models/finding";
import { sourceCountryCode, sourceGeographyOptions, sourceRegionCountryCodes } from "../../answering/search/geography";

export { sourceGeographyOptions };
export type MonitoringCriteria = { keywords: string[]; keywordMatch: "any" | "all"; geographies: string[] };

function terms(value: unknown, label: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(term => typeof term !== "string")) throw new Error(`${label} must be a list of text values.`);
  const result = [...new Map(value.map(term => term.trim().normalize("NFKC")).filter(Boolean).map(term => [term.toLowerCase(), term])).values()];
  if (result.length > 30 || result.some(term => term.length > 120)) throw new Error(`Use up to 30 ${label.toLowerCase()}, each at most 120 characters.`);
  return result;
}

export function normalizeMonitoringCriteria(input: unknown): MonitoringCriteria {
  if (input != null && (typeof input !== "object" || Array.isArray(input))) throw new Error("Monitoring criteria must be an object.");
  const raw = (input || {}) as Record<string, unknown>;
  const keywords = terms(raw.keywords, "Keywords");
  if (raw.keywordMatch != null && raw.keywordMatch !== "any" && raw.keywordMatch !== "all") throw new Error("Choose any or all keywords.");
  const geographies = terms(raw.geographies, "Geographies").map(value => {
    const option = sourceGeographyOptions.find(option => option.value.toLowerCase() === value.toLowerCase() || option.label.toLowerCase() === value.toLowerCase());
    if (option) return option.value;
    const code = sourceCountryCode(value);
    if (code && sourceGeographyOptions.some(option => option.kind === "country" && option.value === code)) return code;
    throw new Error(`Unrecognized geography: ${value}. Choose a country or region from the list.`);
  });
  return { keywords, keywordMatch: raw.keywordMatch === "all" ? "all" : "any", geographies: [...new Set(geographies)] };
}

const normalizeText = (value: unknown) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
function containsTerm(text: string, term: string) {
  const escaped = normalizeText(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(text);
}

/** Explicit criteria are applied before analysis, using source text and source-country metadata. */
export function filterMonitoringFindings(findings: CanonicalFinding[], input: unknown) {
  const criteria = normalizeMonitoringCriteria(input);
  const selectedCodes = new Set(criteria.geographies.flatMap(value => sourceRegionCountryCodes(value) || [value]));
  return findings.filter(finding => {
    const fields = finding.rawMetadata?.fields;
    const countries = fields?.Country ? [fields.Country] : finding.countries || [];
    if (selectedCodes.size && !countries.some(country => selectedCodes.has(sourceCountryCode(country) || ""))) return false;
    if (!criteria.keywords.length) return true;
    // Source fields take precedence over derived analytical wording.
    const sourceText = fields
      ? [fields.Title, fields["Opening Text"], fields["Hit Sentence"], fields.Content, fields.Text, fields.Description].filter(Boolean).join(" ")
      : finding.evidence?.map(evidence => evidence.excerpt).join(" ") || finding.canonicalClaim;
    const text = normalizeText(sourceText);
    return criteria.keywordMatch === "all" ? criteria.keywords.every(term => containsTerm(text, term)) : criteria.keywords.some(term => containsTerm(text, term));
  });
}
