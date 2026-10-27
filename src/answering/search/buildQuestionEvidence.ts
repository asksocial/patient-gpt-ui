import type { CanonicalFinding } from "../models/finding";
import { searchRecordText, subjectsForQuestion, topicsForQuestion } from "./searchSubjects";

export type QuestionEvidence = {
  version: 4;
  subjects: string[];
  topics: Array<{ id: string; label: string; count: number }>;
  examples: Array<{ id: string; excerpt: string; url?: string; topic: string; language?: string; sourceCategory?: string }>;
  observations: string[];
  researchUses: string[];
  limitations: string[];
};
const compact = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

export function buildQuestionEvidence(question: string, findings: CanonicalFinding[], diseaseTerms: string[] = []): QuestionEvidence | undefined {
  const subjects = subjectsForQuestion(question);
  const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const contextPattern = diseaseTerms.length ? new RegExp(diseaseTerms.map(escape).join("|"), "i") : undefined;
  if (!subjects.length) return undefined;
  const topics = subjects.flatMap(subject => topicsForQuestion(subject, question).map(t => ({ ...t, id: `${subject.id}:${t.id}` })));
  const matches = topics.map(topic => ({ topic, records: findings.filter(record => topic.pattern.test(searchRecordText(record))) })).filter(item => item.records.length);
  matches.sort((a, b) => Number(!a.topic.pattern.test(question)) - Number(!b.topic.pattern.test(question)) || Number(a.topic.id.endsWith(":general_safety")) - Number(b.topic.id.endsWith(":general_safety")) || b.records.length - a.records.length || a.topic.id.localeCompare(b.topic.id));
  const examples: QuestionEvidence["examples"] = [];
  const seen = new Set<string>();
  for (const { topic, records } of matches) {
    const ordered = [...records].sort((a, b) => {
      const score = (r: CanonicalFinding) => {
        const fields = r.rawMetadata?.fields || {};
        const text = compact(fields["Opening Text"] || fields["Hit Sentence"] || r.summary);
        const source = String(fields["Source Type"] || "");
        const title = compact(fields.Title);
        return (/^english$/i.test(String(fields.Language)) ? 2000 : 0) + (r.audienceClassification?.patientContent ? 1200 : /forum|social network|comments/i.test(source) ? 200 : 0) + (topic.pattern.test(title) ? 150 : 0) + Math.min(text.length, 400);
      };
      return score(b) - score(a);
    });
    for (const record of ordered) {
      if (examples.filter(e => e.topic === topic.label).length >= 2 || examples.length >= 6) break;
      const fields = record.rawMetadata?.fields || {};
      // Preserve original-language source wording, never generated canonical claims.
      const original = [fields["Opening Text"], fields["Hit Sentence"], fields.Title].filter(Boolean);
      const parts = (original.length ? original : [...(record.evidence || []).map(e => e.excerpt), record.summary]).filter(Boolean).map(compact);
      const english = /^english$/i.test(String(fields.Language)) || (!fields.Language && /^[\x00-\x7F]/.test(parts.join(" ")));
      const passage = parts.map(text => {
        const hits = [...text.matchAll(new RegExp(topic.pattern.source, "gi"))];
        const contexts = contextPattern && english ? [...text.matchAll(new RegExp(contextPattern.source, "gi"))] : [];
        if (contextPattern && english && !contexts.length) return null;
        for (const hit of hits) {
          const context = contexts.length ? contexts.reduce((best, c) => Math.abs(c.index - hit.index) < Math.abs(best.index - hit.index) ? c : best) : hit;
          if (Math.abs(context.index - hit.index) > 280) continue;
          const start = Math.max(0, Math.min(hit.index, context.index) - 70);
          const end = Math.min(text.length, Math.max(hit.index + hit[0].length, context.index + context[0].length) + 180);
          return (start ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
        }
        return null;
      }).find(Boolean);
      if (!passage) continue;
      const excerpt = passage;
      const id = record.findingId || (record as CanonicalFinding & { id?: string }).id || String(fields["Document ID"] || "");
      const url = compact(fields.URL || record.evidence?.find(e => e.url)?.url);
      if (!id || seen.has(id) || seen.has(excerpt)) continue;
      seen.add(id); seen.add(excerpt);
      examples.push({ id, excerpt, url: /^https?:\/\//i.test(url) ? url : undefined, topic: topic.label, language: compact(fields.Language) || undefined, sourceCategory: compact(fields["Source Type"]) || undefined });
    }
  }
  const observations: string[] = [];
  const anyText = (pattern: RegExp) => findings.some(f => pattern.test(searchRecordText(f)));
  if (subjects.some(s => s.id === "access")) {
    if (anyText(/prior authori\w*|coverage deni\w*|insurance deni\w*|not covering|won.t cover/i)) observations.push("Coverage discussions include denials or authorization requirements.");
    if (anyText(/cannot afford|can.t afford|too expensive|high prices|비싸|高額/i)) observations.push("Some material explicitly raises affordability concerns, alongside references to treatment prices.");
  }
  const limitations: string[] = [];
  if (/\b(percent(?:age)?|proportion|how many|how much|rates?|incidence|prevalence|quantif\w*|average|productivity|cost.effectiv\w*)\b/i.test(question)) limitations.push("These posts do not supply a representative patient denominator or structured resource-use measurements for estimating population rates, average costs or productivity losses.");
  if (findings.length > 0 && findings.length < 20) limitations.push("The matching evidence is limited. Treat these observations as illustrative examples rather than estimates of prevalence.");
  if (/\b(emerging|emerge|growing|changing|changed|trends?)\b/i.test(question)) limitations.push("Themes present in this corpus do not establish emergence or growth without a comparable time baseline.");
  if (/\b(why|reasons?|drivers?|caus\w*)\b/i.test(question)) limitations.push("Topic mentions alone do not establish motivations or causal relationships. Reasons require explicit supporting accounts.");
  return { version: 4, subjects: subjects.map(s => s.label), topics: matches.map(({ topic, records }) => ({ id: topic.id, label: topic.label, count: records.length })), examples, observations, researchUses: [...new Set(subjects.map(s => s.researchUse))], limitations };
}

export function questionEvidenceAnswer(evidence: QuestionEvidence): string {
  const topics = evidence.topics.slice(0, 4).map(t => t.label);
  const list = topics.length > 1 ? `${topics.slice(0, -1).join(", ")} and ${topics.at(-1)}` : topics[0];
  return [list ? `The matching material on ${evidence.subjects.join(" and ")} discusses ${list}.` : "No interpretable evidence supports the requested subject in the retained corpus.", ...evidence.observations, ...evidence.limitations, ...evidence.researchUses].join(" ");
}
