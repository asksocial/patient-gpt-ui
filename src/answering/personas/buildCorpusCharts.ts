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
  const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
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

/** Use the same exclusive slices and precision as the donut legend. */
export function buildCorpusBurdenAnswer(chart: CorpusChart): string {
  const share = (count: number) => `${chart.denominator ? Number((count / chart.denominator * 100).toFixed(1)) : 0}%`;
  const named = chart.segments.filter(segment => segment.id !== "remainder");
  if (!named.length) return `No leading burden labels were identified across ${chart.denominator.toLocaleString()} analytical posts.`;
  const leading = named.filter(segment => segment.id !== "overlap").map(segment => `${segment.label} accounts for ${segment.count.toLocaleString()} posts (${share(segment.count)})`).join("; ");
  const overlap = named.find(segment => segment.id === "overlap");
  return `Across all ${chart.denominator.toLocaleString()} validated analytical posts, ${leading.charAt(0).toLowerCase() + leading.slice(1)}.${overlap ? ` Another ${overlap.count.toLocaleString()} posts (${share(overlap.count)}) mention both leading burdens.` : ""} Together, the leading burdens appear in ${chart.highlightCount.toLocaleString()} unique posts (${share(chart.highlightCount)}). Posts are counted once, matching the donut slices.`;
}
