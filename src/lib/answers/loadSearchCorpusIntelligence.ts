import { buildSearchQuestionFocus } from "../../answering/search/questionFocus";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { parseMeltwaterCsv } from "../../ingestion/adapters/meltwaterAdapter";
import { getDiseaseProfile } from "../../ingestion/profiles";
import { classifyCorpusAudience } from "../../ingestion/classifyCorpusAudience";
import { buildPersonaIntelligence, type PersonaRecord, type PersonaIntelligenceSummary } from "../../answering/personas/buildPersonaIntelligence";
import { buildCorpusCharts } from "../../answering/personas/buildCorpusCharts";
import type { CanonicalFinding } from "../../answering/models/finding";
import { normalizeTherapeuticAreaId } from "../analytics/coverage";
import { getCanonicalCorpusSourceFiles } from "./loadCanonicalFindingsForAsk";
import { classifyGlp1Audience } from "../../ingestion/glp1Audience";
type CorpusBundle = { summary: PersonaIntelligenceSummary; records: PersonaRecord[]; findingRecords: PersonaRecord[] };
const cache = new Map<string, CorpusBundle>();

/** Full input corpus, before query filtering/ranking. CSV source rows include
 * excluded content; curated corpora use their complete canonical records. */
function loadCorpusBundle(therapeuticArea: string, findings: CanonicalFinding[]): CorpusBundle {
  const area = normalizeTherapeuticAreaId(therapeuticArea);
  type SourceFinding = CanonicalFinding & { id?: string; title?: string; country?: string; persona?: string | string[]; platform?: string; sourceType?: string; };
  const sourceFindings = findings as SourceFinding[];
  const files = getCanonicalCorpusSourceFiles(therapeuticArea);
  const key = area + createHash("sha256").update(JSON.stringify(findings)).update(JSON.stringify(files.map(file => [file, fs.statSync(file).mtimeMs]))).digest("hex");
  const existing = cache.get(key);
  if (existing) return existing;
  const profile = getDiseaseProfile(area, therapeuticArea);
  const records: PersonaRecord[] = [];
  const idFor = (fields: Record<string, unknown>) => String(fields["Document ID"] || fields.URL || "");
  const retained = new Set(findings.map(finding => idFor(finding.rawMetadata?.fields || {})).filter(Boolean));
  for (const file of files) {
    const rows = parseMeltwaterCsv(file);
    rows.forEach((fields, index) => records.push({
      findingId: area === "glp_1" ? `glp1-source-row-${index + 2}` : `${file.split("/").pop()}:row-${index + 2}`,
      rawMetadata: { fields },
      audienceClassification: area === "glp_1" ? classifyGlp1Audience(fields) : classifyCorpusAudience(fields, profile, { retained: retained.has(idFor(fields)) }),
    }));
  }
  const additional = files.length ? findings.filter(finding => !finding.rawMetadata?.fields || !Object.keys(finding.rawMetadata.fields).length) : findings;
  for (const finding of additional) {
    const source = finding as SourceFinding;
    const fields = finding.rawMetadata?.fields || {
      Title: source.title || finding.canonicalClaim || "", "Hit Sentence": finding.summary || "",
      URL: finding.evidence?.[0]?.url || "", "Source Type": source.platform || finding.platforms?.[0] || source.sourceType || finding.evidence?.[0]?.sourceType || "",
    };
    records.push({ findingId: finding.findingId || source.id, summary: finding.summary, rawMetadata: { fields }, audienceClassification: finding.audienceClassification || classifyCorpusAudience(fields, profile, { retained: true, persona: finding.personas || (Array.isArray(source.persona) ? source.persona : source.persona ? [source.persona] : []) }) });
  }
  const summary = buildPersonaIntelligence(records, { scope: "full_corpus", analyticalCount: findings.length });
  if (area !== "glp_1") {
    summary.recordUnit = additional.some(finding => (finding as SourceFinding).sourceType === "curated" || finding.evidence?.some(evidence => evidence.sourceType === "curated")) ? "records" : "posts";
    summary.additionalExclusionLabel = `other filtered ${summary.recordUnit}`;
  }
  summary.corpusCharts = buildCorpusCharts(sourceFindings.map(finding => ({ symptoms: finding.symptoms, country: finding.countries?.[0] || (Array.isArray(finding.country) ? finding.country[0] : finding.country) })));
  const bySourceId = new Map(records.filter(record => idFor(record.rawMetadata?.fields || {})).map(record => [idFor(record.rawMetadata?.fields || {}), record]));
  const byFindingId = new Map(records.map(record => [record.findingId, record]));
  const findingRecords = sourceFindings.map(finding => {
    const sourceRecord = bySourceId.get(idFor(finding.rawMetadata?.fields || {})) || byFindingId.get(finding.findingId || finding.id);
    return { ...finding, ...sourceRecord, audienceClassification: sourceRecord?.audienceClassification || finding.audienceClassification };
  });
  const bundle = { summary, records, findingRecords };
  cache.set(key, bundle);
  // Avoid retaining arbitrary custom corpora indefinitely in a warm worker.
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return bundle;
}


export function selectSearchCorpusForQuestion(therapeuticArea: string, findings: CanonicalFinding[], question = ""): { summary: PersonaIntelligenceSummary; findings: CanonicalFinding[] } {
  const bundle = loadCorpusBundle(therapeuticArea, findings);
  if (!question.trim()) return { summary: structuredClone(bundle.summary), findings };
  const profile = getDiseaseProfile(normalizeTherapeuticAreaId(therapeuticArea), therapeuticArea);
  const focus = buildSearchQuestionFocus(question, profile, [...bundle.records, ...bundle.findingRecords]);
  if (!focus.labels.length) return { summary: structuredClone(bundle.summary), findings };
  const matchingSource = bundle.records.filter(focus.matches);
  const matchingFindings = findings.filter((_, index) => focus.matches(bundle.findingRecords[index]));
  const summary = buildPersonaIntelligence(matchingSource, { scope: "question_corpus", analyticalCount: matchingFindings.length });
  summary.recordUnit = bundle.summary.recordUnit;
  summary.additionalExclusionLabel = bundle.summary.additionalExclusionLabel;
  summary.corpusCharts = buildCorpusCharts(matchingFindings.map(finding => ({ symptoms: finding.symptoms, country: finding.countries?.[0] || (finding as CanonicalFinding & { country?: string }).country })));
  summary.queryContext = { question, filters: focus.labels, fullSourceCount: bundle.summary.denominator, fullAnalyticalCount: findings.length };
  summary.fullCorpus = structuredClone(bundle.summary);
  return { summary, findings: matchingFindings };
}

export function loadSearchCorpusIntelligence(therapeuticArea: string, findings: CanonicalFinding[], question = ""): PersonaIntelligenceSummary {
  return selectSearchCorpusForQuestion(therapeuticArea, findings, question).summary;
}


/** Apply the same question predicate to supplemental curated insight cards. */
export function filterSearchInsightsForQuestion(therapeuticArea: string, findings: CanonicalFinding[], question: string, insights: any[]): any[] {
  const bundle = loadCorpusBundle(therapeuticArea, findings);
  const profile = getDiseaseProfile(normalizeTherapeuticAreaId(therapeuticArea), therapeuticArea);
  const focus = buildSearchQuestionFocus(question, profile, [...bundle.records, ...bundle.findingRecords]);
  if (!focus.labels.length) return insights;
  return insights.filter(insight => {
    const fields = {
      Title: String(insight.title || ""), "Opening Text": [insight.summary, insight.description, insight.insight, insight.insight_text, insight.content].filter(value => typeof value === "string").join(" "),
      "Hit Sentence": Array.isArray(insight.evidence_quotes) ? insight.evidence_quotes.join(" ") : "",
      Country: String(insight.country || ""), URL: String(insight.url || ""),
    };
    const audienceClassification = classifyCorpusAudience(fields, profile, { retained: true, persona: insight.persona ? [String(insight.persona)] : [] });
    return focus.matches({ rawMetadata: { fields }, audienceClassification });
  });
}
