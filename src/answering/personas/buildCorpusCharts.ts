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
