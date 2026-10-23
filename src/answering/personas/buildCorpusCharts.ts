export type CorpusChart = {
  denominator: number;
  segments: Array<{ id: string; label: string; count: number }>;
  highlightCount: number;
  highlightLabel: string;
  note?: string;
};
export type CorpusCharts = { version: 1; burdens: CorpusChart; markets: CorpusChart };

/** Each donut partitions posts exactly once, including multi-burden posts. */
export function buildCorpusCharts(findings: Array<{ symptoms?: string[]; country?: string }>): CorpusCharts {
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
  const marketSegments = ranked(countries).slice(0, 3).map(([label, count]) => ({ id: label, label, count }));
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
  if (!leading.length) return "The corpus does not contain enough burden-specific signal to identify leading themes.";
  const themes = leading.map((label, index) => index ? label.charAt(0).toLowerCase() + label.slice(1) : label).join(" and ");
  const overlap = chart.segments.some(segment => segment.id === "overlap" && segment.count > 0);
  return `${themes} ${leading.length > 1 ? "are the most frequently identified burden themes" : "is the most frequently identified burden theme"} in the corpus.${overlap ? " Some posts discuss these themes together." : ""}`;
}


export function buildFocusedSearchAnswer(summary: import("./buildPersonaIntelligence").PersonaIntelligenceSummary): string {
  if (!summary.analyticalCount) return "No retained analytical evidence matches the requested focus in this corpus.";
  const focus = summary.queryContext?.filters.join("; ");
  const chart = summary.corpusCharts?.burdens;
  if (chart?.segments.some(segment => segment.id !== "remainder" && segment.count)) {
    const synthesis = buildCorpusBurdenAnswer(chart);
    return focus ? `For ${focus}, ${synthesis.charAt(0).toLowerCase() + synthesis.slice(1)}` : synthesis;
  }
  const conversations = new Map<string, number>();
  for (const group of summary.clientGroups) for (const subtype of group.subtypes) for (const item of subtype.conversations) conversations.set(item.label, (conversations.get(item.label) || 0) + item.count);
  const leading = [...conversations].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([label]) => label.toLowerCase());
  return `The matching conversations${focus ? ` about ${focus}` : ""} focus on ${leading.join(" and ") || "the requested topic"}.`;
}
