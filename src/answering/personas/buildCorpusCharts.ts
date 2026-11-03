import { topicNarrative } from "../narrative/clientNarrative";
import { questionEvidenceAnswer } from "../search/buildQuestionEvidence";
export type CorpusChart = {
  denominator: number;
  segments: Array<{ id: string; label: string; count: number }>;
  highlightCount: number;
  highlightLabel: string;
  note?: string;
};
export type CorpusCharts = { version: 1; burdens: CorpusChart; markets: CorpusChart };

/** Each donut partitions posts exactly once, including multi-burden posts. */
export function buildCorpusCharts(findings: Array<{ symptoms?: string[]; country?: string }>, options: { showAllMarkets?: boolean } = {}): CorpusCharts {
  const denominator = findings.length;
  const symptoms = new Map<string, number>();
  const countries = new Map<string, number>();
  const normalized = findings.map(f => ({ symptoms: [...new Set((f.symptoms || []).map(s => s.trim().toLowerCase()).filter(Boolean))], country: f.country?.trim() || "" }));
  for (const f of normalized) {
    for (const symptom of f.symptoms) symptoms.set(symptom, (symptoms.get(symptom) || 0) + 1);
    if (f.country) countries.set(f.country, (countries.get(f.country) || 0) + 1);
  }
  const ranked = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked(symptoms).slice(0, 2).map(([name]) => name);
  const title = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)).replaceAll("_", " ");
  const counts = top.map(() => 0);
  let overlap = 0;
  for (const f of normalized) {
    const hits = top.map(s => f.symptoms.includes(s));
    if (hits.every(Boolean) && hits.length === 2) overlap++;
    else hits.forEach((hit, index) => { if (hit) counts[index]++; });
  }
  const matched = counts.reduce((sum, n) => sum + n, overlap);
  const burdenSegments = top.map((name, index) => ({ id: name, label: title(name) + (overlap ? " only" : ""), count: counts[index] }));
  if (overlap) burdenSegments.push({ id: "overlap", label: "Both leading burdens", count: overlap });
  burdenSegments.push({ id: "remainder", label: "All other findings", count: denominator - matched });
  const marketSegments = ranked(countries).slice(0, options.showAllMarkets ? undefined : 3).map(([label, count]) => ({ id: label, label, count }));
  const leading = marketSegments[0];
  marketSegments.push({ id: "remainder", label: "Other markets / unspecified", count: denominator - marketSegments.reduce((sum, s) => sum + s.count, 0) });
  return {
    version: 1,
    burdens: { denominator, segments: burdenSegments, highlightCount: matched, highlightLabel: "of findings", note: overlap ? "Posts mentioning both leading burdens appear in the overlap slice and are counted once." : undefined },
    markets: { denominator, segments: marketSegments, highlightCount: leading?.count || 0, highlightLabel: leading?.label || "No market specified", note: "Market reflects source country metadata." },
  };
}

/** Qualitative synthesis of the corpus themes; numeric shares stay in charts. */
export function buildCorpusBurdenAnswer(chart: CorpusChart): string {
  const leading = chart.segments.filter(segment => !["remainder", "overlap"].includes(segment.id) && segment.count > 0).map(segment => segment.label.replace(/ only$/, ""));
  const overlap = chart.segments.some(segment => segment.id === "overlap" && segment.count > 0);
  return topicNarrative({
    themes: leading,
    observations: overlap ? ["Some posts discuss these experiences together, offering context for how concerns may overlap."] : [],
    significance: "These accounts can help focus further research into the day-to-day experiences described in the discussion.",
    limitation: "The findings reflect the available conversations; further research is needed to establish how common these experiences are and how they affect individual treatment decisions.",
  });
}


export function buildFocusedSearchAnswer(summary: import("./buildPersonaIntelligence").PersonaIntelligenceSummary): string {
  if (!summary.analyticalCount) return "The available sources do not yet provide evidence that answers this question within the selected scope. Reviewing additional relevant sources or broadening the question may help; this gap does not mean the concerns are absent.";
  if (summary.questionEvidence) return questionEvidenceAnswer(summary.questionEvidence);
  const focus = summary.queryContext?.filters.join("; ");
  const temporalNote = /\b(emerging|emerge|growing|changing|changed|trends?)\b/i.test(summary.queryContext?.question || "") ? " These are themes present in the available corpus; a time comparison is needed to establish which are newly emerging or changing." : "";
  const chart = summary.corpusCharts?.burdens;
  if (chart?.segments.some(segment => segment.id !== "remainder" && segment.count)) {
    const synthesis = buildCorpusBurdenAnswer(chart);
    return focus ? `For ${focus}, ${synthesis.charAt(0).toLowerCase() + synthesis.slice(1)}` + temporalNote : synthesis + temporalNote;
  }
  const conversations = new Map<string, number>();
  for (const group of summary.clientGroups) for (const subtype of group.subtypes) for (const item of subtype.conversations) conversations.set(item.label, (conversations.get(item.label) || 0) + item.count);
  const leading = [...conversations].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([label]) => label.toLowerCase());
  return topicNarrative({
    themes: leading,
    context: focus ? `within the selected scope (${focus})` : undefined,
    significance: "These discussions offer a starting point for exploring the questions and experiences raised by the available sources.",
    limitation: "Further qualitative review is needed before drawing conclusions about how widely these views are shared." + temporalNote,
  });
}
