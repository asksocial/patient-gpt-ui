import type { DiseaseProfile } from "../../ingestion/profiles/types";
import type { PersonaRecord } from "../personas/buildPersonaIntelligence";

type SearchRecord = PersonaRecord & { country?: string; countries?: string[]; platforms?: string[]; title?: string; canonicalClaim?: string; symptoms?: string[]; treatments?: string[] };
export type SearchQuestionFocus = { labels: string[]; matches: (record: SearchRecord) => boolean };
const normalized = (value: unknown) => String(value || "").normalize("NFKC").toLowerCase().replace(/[_-]+/g, " ");
const has = (text: string, phrase: string) => {
  const term = normalized(phrase).trim();
  if (!term) return false;
  let index = text.indexOf(term);
  while (index >= 0) {
    if (!/[a-z0-9]/.test(term[0]) || ((!index || !/[a-z0-9]/.test(text[index - 1])) && (index + term.length === text.length || !/[a-z0-9]/.test(text[index + term.length])))) return true;
    index = text.indexOf(term, index + 1);
  }
  return false;
};
const textOf = (record: SearchRecord) => normalized([record.title, record.summary, record.canonicalClaim, ...(record.symptoms || []), ...(record.treatments || []), ...Object.entries(record.rawMetadata?.fields || {}).filter(([key]) => /title|headline|opening text|hit sentence|document tags/i.test(key)).map(([, value]) => value)].filter(Boolean).join(" "));
const FACETS: Array<[string, RegExp, string[]]> = [
  ["access and affordability", /\b(cost|costs|price|pricing|afford\w*|insurance|coverage|access|availability|shortage\w*)\b/i, ["cost", "costs", "price", "pricing", "afford", "insurance", "coverage", "access", "availability", "shortage", "expensive", "prescription denied"]],
  ["safety and side effects", /\b(safety|side effects?|adverse|risks?|tolerability)\b/i, ["safety", "side effect", "adverse", "risk", "tolerability", "nausea", "vomit", "complication", "reaction"]],
  ["education and confusion", /\b(education|educational|confusion|confused|misinformation|awareness|knowledge gaps?)\b/i, ["education", "confusion", "confused", "misinformation", "awareness", "understand", "information", "questions", "learn", "explained"]],
  ["treatment benefits and outcomes", /\b(benefits?|outcomes?|effectiveness|effective|improvement|improved)\b/i, ["benefit", "outcome", "effective", "improved", "helped", "worked", "recovered", "weight loss"]],
  ["research and evidence", /\b(research|studies|study|trials?|scientific|clinical evidence)\b/i, ["research", "study", "studies", "trial", "scientific", "clinical evidence", "efficacy"]],
  ["policy and regulation", /\b(policy|regulat\w*|approval|approved|fda|ema)\b/i, ["policy", "regulat", "approval", "approved", "fda", "ema", "legislation"]],
  ["market and commercial discussion", /\b(investment|investors?|commercial|sales|revenue|demand)\b/i, ["market", "invest", "commercial", "sales", "revenue", "demand", "earnings", "launch", "stock"]],
];

/** Apply explicit question facets to every corpus record before ranking.
 * Multiple values within one dimension are alternatives; dimensions combine. */
export function buildSearchQuestionFocus(question: string, profile: DiseaseProfile, records: SearchRecord[]): SearchQuestionFocus {
  const query = normalized(question);
  const checks: Array<(record: SearchRecord) => boolean> = [];
  const labels: string[] = [];
  const topicTerms = [...profile.diseaseNames, profile.therapeuticArea, profile.profileId].map(normalized);
  const countries = [...new Set(records.flatMap(record => [record.country, ...(record.countries || []), record.rawMetadata?.fields?.Country].filter(Boolean).map(String)))];
  const selectedCountries = countries.filter(country => has(query, country) || country === "United States" && (/\bUSA?\b/.test(question) || /\b(?:united states|american)\b|\b(?:in|from|across|the|between|versus|vs)\s+u\.?s\.?a?\b/i.test(question)) || country === "United Kingdom" && /\b(?:uk|britain|british)\b/i.test(question));
  if (selectedCountries.length) {
    labels.push(selectedCountries.join(" or "));
    checks.push(record => selectedCountries.some(country => [record.country, ...(record.countries || []), record.rawMetadata?.fields?.Country].some(value => normalized(value) === normalized(country))));
  }
  const genericTerms = new Set(["symptom", "symptoms", "treatment", "treatments", "therapy", "medication", "medicine", "drug", "procedure", normalized(profile.therapeuticArea), normalized(profile.profileId)]);
  for (const patterns of [profile.symptomPatterns, profile.treatmentPatterns || {}]) {
    const terms = new Set<string>();
    for (const [category, values] of Object.entries(patterns)) {
      if (!genericTerms.has(normalized(category)) && has(query, category)) values.forEach(value => terms.add(value));
      for (const value of values) if (!genericTerms.has(normalized(value)) && has(query, value)) terms.add(value);
    }
    if (terms.size) {
      labels.push([...terms].filter(term => has(query, term)).slice(0, 3).join(" or ") || "requested burden theme");
      checks.push(record => [...terms].some(term => has(textOf(record), term)));
    }
  }
  const facets = FACETS.filter(([, trigger]) => trigger.test(question));
  if (facets.length) {
    labels.push(...facets.map(([label]) => label));
    checks.push(record => facets.some(([, , terms]) => terms.some(term => textOf(record).includes(term))));
  }
  const audience = /\b(patients?|caregivers?|family|families)\b/i.test(question) ? "patients" : /\b(doctors?|physicians?|nurses?|hcp|clinicians?|healthcare professionals?)\b/i.test(question) ? "clinical" : /\b(news|media|journalists?)\b/i.test(question) ? "media" : null;
  if (audience) {
    labels.push(audience === "patients" ? "patient-related conversations" : audience === "clinical" ? "healthcare voices" : "media voices");
    checks.push(record => audience === "patients" ? Boolean(record.audienceClassification?.patientContent) : audience === "clinical" ? ["provider_hcp", "clinic_telehealth", "researcher", "public_authority"].includes(record.audienceClassification?.audience || "") : ["news_media", "media_or_research", "advocacy"].includes(record.audienceClassification?.audience || ""));
  }
  const platforms = ["reddit", "twitter", "instagram", "facebook", "youtube", "tiktok"].filter(platform => has(query, platform));
  if (platforms.length) {
    labels.push(platforms.join(" or "));
    checks.push(record => platforms.some(platform => normalized([record.rawMetadata?.fields?.URL, record.rawMetadata?.fields?.["Source Type"], ...(record.platforms || [])].join(" ")).includes(platform) || platform === "twitter" && /https?:\/\/(?:www\.)?x\.com\//i.test(String(record.rawMetadata?.fields?.URL || ""))));
  }
  // Unknown specific concepts must produce an honest empty result, not silently
  // fall back to the same corpus-wide chart. Broad overview prompts stay broad.
  if (!checks.length) {
    const stop = new Set("they them he she his her it its all any some should would could need needs know important signals signal mean means give provide summary summarize intelligence insights key dominant understand learn which who where when whose have having country countries landscape overall trend trends what whats are is the a an people saying say now right currently latest emerging conversations conversation discussion discussions themes theme most main supported burdens burden about across compare comparing different differences between tell show please social online today explain how why does do can you me us we our their in on of and or for to with from this that these those happening driving changes changed since last report question overview current available corpus data topic treatment treatments medication medications health patient patients".split(" "));
    const tokens = query.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(word => word.length > 3 && !stop.has(word) && !topicTerms.some(term => term.split(" ").includes(word)));
    const broadOverview = /\b(?:overview|summary|summarize|themes?|signals?|leadership|emerging|changes?|changing)\b/i.test(question);
    const explicitSubject = /\b(?:about|regarding|concerning|related to)\b/i.test(question);
    if (tokens.length && (!broadOverview || explicitSubject)) { labels.push(tokens.join(" or ")); checks.push(record => tokens.some(term => has(textOf(record), term))); }
  }
  return { labels, matches: record => checks.every(check => check(record)) };
}
