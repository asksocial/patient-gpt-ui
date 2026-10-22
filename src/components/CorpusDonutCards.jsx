const COLORS = ["#11766b", "#3e73ba", "#e59a35", "#9360b5", "#d76063", "#829c38"];
const REMAINDER = "#dfe5e2";
const formatPercent = (count, total) => `${total ? Number((count / total * 100).toFixed(1)) : 0}%`;

function DonutCard({ title, chart, source }) {
  const circumference = 2 * Math.PI * 80;
  const segments = chart.segments.map((segment, index) => {
    const length = chart.denominator ? segment.count / chart.denominator * circumference : 0;
    const offset = chart.denominator ? chart.segments.slice(0, index).reduce((sum, s) => sum + s.count, 0) / chart.denominator * circumference : 0;
    return { ...segment, length, offset, color: segment.id === "remainder" || segment.excluded ? REMAINDER : COLORS[index % COLORS.length] };
  });
  const leading = segments.filter(segment => segment.id !== "remainder" && !segment.excluded).reduce((best, segment) => !best || segment.count > best.count ? segment : best, null);
  return (
    <section aria-label={`${title} chart`} className="min-w-0 rounded-[24px] border p-5 xl:p-6" style={{ background: "#f5f8f6", borderColor: "#d6e0db", color: "#123b32" }}>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">{title}</h3>
      <p className="mt-2 text-xs leading-5" style={{ color: "#73847d" }}>{source}</p>
      <div className="relative mx-auto my-7 w-full max-w-[280px] aspect-square">
        <svg viewBox="0 0 200 200" role="img" aria-label={`${title}: ${segments.map(s => `${s.label}, ${s.count.toLocaleString()} posts, ${formatPercent(s.count, chart.denominator)}`).join("; ")}`} className="h-full w-full">
          <circle cx="100" cy="100" r="80" fill="none" stroke={REMAINDER} strokeWidth="24" />
          {segments.filter(s => s.count > 0).map(s => <circle key={s.id} cx="100" cy="100" r="80" fill="none" stroke={s.color} strokeWidth="24" strokeDasharray={`${s.length} ${circumference - s.length}`} strokeDashoffset={-s.offset} transform="rotate(-90 100 100)">
            <title>{s.label}: {s.count.toLocaleString()} posts ({formatPercent(s.count, chart.denominator)})</title>
          </circle>)}
          <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fill="#123b32" fontSize="30" fontWeight="600" style={{ fontFamily: "inherit" }}>{formatPercent(leading?.count || 0, chart.denominator)}</text>
          <text x="100" y="121" textAnchor="middle" fill="#73847d" fontSize="8" style={{ fontFamily: "inherit" }}>
            {(leading?.label || "No findings").split(" ").reduce((lines, word) => {
              const last = lines[lines.length - 1];
              return last && `${last} ${word}`.length <= 26 ? [...lines.slice(0, -1), `${last} ${word}`] : [...lines, word];
            }, []).map((line, index) => <tspan key={index} x="100" dy={index ? "11" : "0"}>{line}</tspan>)}
          </text>
        </svg>
      </div>
      <ul>
        {segments.map(s => <li key={s.id} className="flex items-start gap-2.5 border-b py-3 text-[13px] leading-5" style={{ borderColor: "#dfe6e2", color: s.color === REMAINDER ? "#82928b" : "#354c43" }} title={`${s.count.toLocaleString()} of ${chart.denominator.toLocaleString()} posts`}>
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="min-w-0 flex-1">{s.label}</span>
          <strong className="shrink-0 tabular-nums">{formatPercent(s.count, chart.denominator)}</strong>
        </li>)}
      </ul>
      <p className="mt-3 text-[11px] leading-5" style={{ color: "#73847d" }}>Share of {chart.denominator.toLocaleString()} {title === "Persona Intelligence" ? "source corpus posts" : "validated analytical posts"}.{chart.note ? ` ${chart.note}` : ""}</p>
    </section>
  );
}

export default function CorpusDonutCards({ summary }) {
  if (!summary?.corpusCharts || summary.scope !== "full_corpus") return null;
  const patient = summary.clientGroups.find(g => g.id === "patients_circle");
  const persona = {
    denominator: summary.denominator,
    segments: [...summary.clientGroups].sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.count - a.count),
    highlightCount: patient?.count || 0,
    highlightLabel: "Patients & Their Circle",
  };
  return <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3" aria-label="Corpus overview charts">
    <DonutCard title="Most-Supported Burdens" chart={summary.corpusCharts.burdens} source="Derived from the validated analytical corpus" />
    <DonutCard title="Market Intelligence" chart={summary.corpusCharts.markets} source="Derived from the validated analytical corpus" />
    <DonutCard title="Persona Intelligence" chart={persona} source="Derived from the full source corpus" />
  </div>;
}
