import type { CanonicalFinding } from "../models/finding";
import { searchRecordText, subjectsForQuestion, topicsForQuestion } from "./searchSubjects";

export type QuestionEvidence = {
  version: 1;
  subjects: string[];
  topics: Array<{ id: string; label: string; count: number }>;
  examples: Array<{ id: string; excerpt: string; url?: string; topic: string; language?: string; sourceCategory?: string }>;
  observations: string[];
  researchUses: string[];
  limitations: string[];
};
const compact = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

export function buildQuestionEvidence(question: string, findings: CanonicalFinding[]): QuestionEvidence | undefined {
  const subjects = subjectsForQuestion(question);
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
        return (/^english$/i.test(String(fields.Language)) ? 2000 : 0) + (/forum|social network|comments/i.test(source) ? 500 : 0) + (topic.pattern.test(title) ? 150 : 0) + Math.min(text.length, 400);
      };
      return score(b) - score(a);
    });
    for (const record of ordered) {
      if (examples.filter(e => e.topic === topic.label).length >= 2 || examples.length >= 6) break;
      const fields = record.rawMetadata?.fields || {};
      // Preserve original-language source wording, never generated canonical claims.
      const parts = [fields["Opening Text"], fields["Hit Sentence"], fields.Title, ...(record.evidence || []).map(e => e.excerpt), record.summary].filter(Boolean).map(compact);
      const text = parts.find(part => topic.pattern.test(part));
      if (!text) continue;
      const hit = topic.pattern.exec(text);
      const start = Math.max(0, (hit?.index || 0) - 90);
      const excerpt = (start ? "…" : "") + text.slice(start, start + 420) + (text.length > start + 420 ? "…" : "");
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
  return { version: 1, subjects: subjects.map(s => s.label), topics: matches.map(({ topic, records }) => ({ id: topic.id, label: topic.label, count: records.length })), examples, observations, researchUses: [...new Set(subjects.map(s => s.researchUse))], limitations };
}

export function questionEvidenceAnswer(evidence: QuestionEvidence): string {
  const topics = evidence.topics.slice(0, 4).map(t => t.label);
  const list = topics.length > 1 ? `${topics.slice(0, -1).join(", ")} and ${topics.at(-1)}` : topics[0];
  return [list ? `The matching material on ${evidence.subjects.join(" and ")} discusses ${list}.` : "No interpretable evidence supports the requested subject in the retained corpus.", ...evidence.observations, ...evidence.limitations, ...evidence.researchUses].join(" ");
}
