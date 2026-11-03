import { preserveRawMetadata } from "../../ingestion/metadata";
import type { CanonicalFinding } from "../models/finding";
import { analyzeEvidence } from "../evidence/analyzeEvidence";
import { sourcePassages, supportingPassage, acceptsTopicMatch } from "../evidence/sourcePassages";
import { searchRecordText, subjectsForQuestion, topicsForQuestion } from "./searchSubjects";
import { resolveQuestionGeography, sourceCountryLabel } from "./geography";

export type QuestionEvidence = {
  version: 7;
  narrativeVersion?: 1;
  treatmentLabel?: string;
  subjects: string[];
  topics: Array<{ id: string; label: string; count: number }>;
  examples: Array<{ id: string; excerpt: string; url?: string; topic: string; topicId: string; matchedTerms: string[]; country?: string; language?: string; sourceCategory?: string }>;
  marketCoverage?: Array<{ country: string; count: number; topics: string[] }>;
  observations: string[];
  researchUses: string[];
  limitations: string[];
};
const compact = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

export function buildQuestionEvidence(question: string, findings: CanonicalFinding[], diseaseTerms: string[] = [], options: { allExamples?: boolean; topicId?: string } = {}): QuestionEvidence | undefined {
  const subjects = subjectsForQuestion(question);
  const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const contextPattern = diseaseTerms.length ? new RegExp(diseaseTerms.map(escape).join("|"), "i") : undefined;
  if (!subjects.length) return undefined;
  const topics = subjects.flatMap(subject => topicsForQuestion(subject, question).map(t => ({ ...t, id: `${subject.id}:${t.id}` })));
  const quality = new Map<CanonicalFinding, ReturnType<typeof analyzeEvidence>>();
  const supportFor = (record: CanonicalFinding, topic: typeof topics[number]) => {
    if (!quality.has(record)) {
      const rawMetadata = record.rawMetadata && !record.rawMetadata.normalizedFields
        ? preserveRawMetadata(record.rawMetadata.fields, { adapter: record.rawMetadata.adapter || "source-evidence", sourceProvider: record.rawMetadata.sourceProvider || "retained-corpus" })
        : record.rawMetadata;
      quality.set(record, analyzeEvidence({ ...record, rawMetadata }));
    }
    const assessment = quality.get(record)!;
    if (assessment.isPromotional || ["clinic_marketing", "corporate_pr", "sponsored_content", "retail_or_product"].includes(assessment.evidenceClass)) return undefined;
    return supportingPassage(sourcePassages(record), topic.pattern, {
      context: /^english$/i.test(String(record.rawMetadata?.fields?.Language || "")) || !record.rawMetadata?.fields?.Language && /^[\x00-\x7F]/.test(String(record.rawMetadata?.fields?.["Opening Text"] || record.evidence?.[0]?.excerpt || "")) ? contextPattern : undefined,
      accept: (text, match, index) => acceptsTopicMatch(topic.id, text, match, index),
    });
  };
  const matches = topics.map(topic => ({ topic, records: findings.filter(record => supportFor(record, topic)) })).filter(item => item.records.length);
  matches.sort((a, b) => Number(a.topic.id.endsWith(":general_safety")) - Number(b.topic.id.endsWith(":general_safety")) || Number(!a.topic.pattern.test(question)) - Number(!b.topic.pattern.test(question)) || b.records.length - a.records.length || a.topic.id.localeCompare(b.topic.id));
  const examples: QuestionEvidence["examples"] = [];
  const geography = resolveQuestionGeography(question);
  const countryOf = (record: CanonicalFinding) => sourceCountryLabel(record.rawMetadata?.fields?.Country || record.countries?.[0] || (record as CanonicalFinding & { country?: string }).country);
  const marketCoverage = geography.labels.length ? [...new Set(findings.map(countryOf))].map(country => {
    const records = findings.filter(record => countryOf(record) === country);
    return { country, count: records.length, topics: topics.filter(topic => records.some(record => supportFor(record, topic))).map(topic => topic.label) };
  }).sort((a, b) => b.count - a.count || a.country.localeCompare(b.country)) : undefined;
  const counts = new Map<string, number>();
  for (const { topic, records } of matches) {
    const seen = new Set<string>();
    const ordered = [...records].sort((a, b) => {
      const score = (r: CanonicalFinding) => {
        const fields = r.rawMetadata?.fields || {};
        const text = compact(fields["Opening Text"] || fields["Hit Sentence"] || r.summary);
        const source = String(fields["Source Type"] || "");
        const title = compact(fields.Title);
        const directVoice = /\b(?:i(?:'m|'ve| am| have)?|my|we|our)\b.{0,80}\b(?:tak\w*|start\w*|prescription|insur\w*|afford\w*|paid|pay|nausea|side effects?|experienc\w*|dose|shortage)\b|맞았|맞고|복용|구토|내가|제가|服用|打った|私|吐き気|tomei|estou tomando/i.test(text);
        return (directVoice ? 3000 : 0) + (/^english$/i.test(String(fields.Language)) ? 700 : 0) + (r.audienceClassification?.patientContent ? 1200 : /forum|social network|comments/i.test(source) ? 200 : 0) + (topic.pattern.test(title) ? 150 : 0) + Math.min(text.length, 400);
      };
      return score(b) - score(a);
    });
    if (geography.labels.length && ordered.length > 1) {
      const otherCountry = ordered.findIndex(record => countryOf(record) !== countryOf(ordered[0]));
      if (otherCountry > 1) ordered.splice(1, 0, ...ordered.splice(otherCountry, 1));
    }
    for (const record of ordered) {
      const fields = record.rawMetadata?.fields || {};
      const support = supportFor(record, topic);
      const passage = support?.excerpt;
      if (!passage) continue;
      const excerpt = passage;
      const id = record.findingId || (record as CanonicalFinding & { id?: string }).id || String(fields["Document ID"] || "");
      const url = support?.url;
      if (!id || seen.has(id) || seen.has(excerpt) || (url && seen.has(url))) continue;
      seen.add(id); seen.add(excerpt); if (url) seen.add(url);
      counts.set(topic.id, (counts.get(topic.id) || 0) + 1);
      if (options.topicId && topic.id !== options.topicId || !options.allExamples && examples.filter(e => e.topicId === topic.id).length >= 2) continue;
      examples.push({ id, excerpt, url, topic: topic.label, topicId: topic.id, matchedTerms: support!.matchedTerms, country: countryOf(record), language: compact(fields.Language) || undefined, sourceCategory: compact(fields["Source Type"]) || undefined });
    }
  }
  const observations: string[] = [];
  const anyText = (pattern: RegExp) => findings.some(f => pattern.test(searchRecordText(f)));
  if (subjects.some(s => s.id === "access")) {
    if (anyText(/prior authori\w*|coverage deni\w*|insurance deni\w*|not covering|won.t cover/i)) observations.push("Coverage discussions include denials or authorization requirements.");
    if (anyText(/cannot afford|can.t afford|too expensive|high prices|비싸|高額/i)) observations.push("Some material explicitly raises affordability concerns, alongside references to treatment prices.");
  }
  const limitations: string[] = [];
  if (marketCoverage?.length) limitations.push("Markets reflect source-country metadata, which does not establish the country discussed in every post. Missing markets indicate no matching retained evidence, not an absence of local concerns.");
  if (/\b(percent(?:age)?|proportion|how many|how much|rates?|incidence|prevalence|quantif\w*|average|productivity|cost.effectiv\w*)\b/i.test(question)) limitations.push("These posts do not supply a representative patient denominator or structured resource-use measurements for estimating population rates, average costs or productivity losses.");
  if (findings.length > 0 && findings.length < 20) limitations.push("The matching evidence is limited. Treat these observations as illustrative examples rather than estimates of prevalence.");
  if (/\b(emerging|emerge|growing|changing|changed|trends?)\b/i.test(question)) limitations.push("Themes present in this corpus do not establish emergence or growth without a comparable time baseline.");
  if (/\b(why|reasons?|drivers?|caus\w*)\b/i.test(question)) limitations.push("Topic mentions alone do not establish motivations or causal relationships. Reasons require explicit supporting accounts.");
  return { version: 7, narrativeVersion: 1, treatmentLabel: diseaseTerms.some(term => /glp[ -]?1/i.test(term)) ? "GLP-1 treatments" : "treatment", subjects: subjects.map(s => s.label), topics: matches.map(({ topic }) => ({ id: topic.id, label: topic.label, count: counts.get(topic.id) || 0 })), examples, marketCoverage, observations, researchUses: [...new Set(subjects.map(s => s.researchUse))], limitations };
}

export function questionEvidenceAnswer(evidence: QuestionEvidence): string {
  const join = (items: string[]) => items.length > 2 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : items.join(" and ");
  const labels: Record<string, string> = {
    "insurance and coverage": "insurance coverage",
    "prices and affordability": "medication costs and affordability",
    "pharmacy and telehealth access": "access through pharmacies and telehealth services",
  };
  const topics = evidence.topics.filter(topic => topic.count > 0).slice(0, 4).map(topic => labels[topic.label] || topic.label);
  if (!topics.length) return "No interpretable evidence supports the requested subject in the retained corpus.";
  const countries = evidence.marketCoverage?.filter(market => market.topics.length && !/^(?:unknown|unspecified market)$/i.test(market.country)).map(market => market.country) || [];
  const origin = countries.length ? `Conversations originating in ${join(countries)}` : "The available conversations";
  const accessOnly = evidence.subjects.length === 1 && evidence.subjects[0] === "access and affordability";
  const introduction = `${origin} offer insight into questions surrounding ${accessOnly ? `the affordability and accessibility of ${evidence.treatmentLabel || "treatment"}` : join(evidence.subjects)}. Discussions touch on ${join(topics)}.`;
  const implications = accessOnly
    ? "These conversations can help identify potential barriers to access. Further research is needed to understand the extent to which costs and coverage limitations affect treatment decisions, affordability, or continuity of care."
    : evidence.researchUses.join(" ");
  const limitations = evidence.limitations.map(text => text.startsWith("Markets reflect source-country metadata")
    ? "Source locations indicate where conversations originate; individual posts may discuss other countries, and gaps in coverage do not rule out concerns elsewhere."
    : text);
  return [introduction, ...evidence.observations, implications, ...limitations].filter(Boolean).join(" ");
}
