"use client";

import { useState } from "react";
import styles from "./CorpusDonutCards.module.css";

const COLORS = ["#11766b", "#3e73ba", "#e59a35", "#9360b5", "#d76063", "#829c38"];
const REMAINDER = "#dfe5e2";
const formatPercent = (count, total) => `${total ? Number((count / total * 100).toFixed(1)) : 0}%`;

function DonutCard({ title, chart, source, unit = "posts", focused = false }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const activeId = hoveredId ?? focusedId;
  const circumference = 2 * Math.PI * 80;
  const segments = chart.segments.map((segment, index) => {
    const length = chart.denominator ? segment.count / chart.denominator * circumference : 0;
    const offset = chart.denominator ? chart.segments.slice(0, index).reduce((sum, s) => sum + s.count, 0) / chart.denominator * circumference : 0;
    return { ...segment, length, offset, color: segment.id === "remainder" || segment.excluded ? REMAINDER : COLORS[index % COLORS.length] };
  });
  const leading = segments.filter(segment => segment.id !== "remainder" && !segment.excluded).reduce((best, segment) => !best || segment.count > best.count ? segment : best, null);
  const active = segments.find(segment => segment.id === activeId);
  const displayed = active || leading;
  return (
    <section aria-label={`${title} chart`} className="min-w-0 rounded-[24px] border p-5 xl:p-6" style={{ background: "#f5f8f6", borderColor: "#d6e0db", color: "#123b32" }}>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">{title}</h3>
      <p className="mt-2 text-xs leading-5" style={{ color: "#73847d" }}>{source}</p>
      <div className="relative mx-auto my-7 w-full max-w-[280px] aspect-square">
        <svg viewBox="0 0 200 200" role="group" aria-label={`${title} interactive chart`} className="h-full w-full" onPointerLeave={() => setHoveredId(null)}>
          <circle cx="100" cy="100" r="80" fill="none" stroke={REMAINDER} strokeWidth="24" />
          {segments.filter(s => s.count > 0).map(s => (
            <g
              key={s.id}
              tabIndex={0}
              role="img"
              aria-label={`${s.label}: ${s.count.toLocaleString()} ${unit} (${formatPercent(s.count, chart.denominator)})`}
              className={styles.segment}
              data-active={s.id === activeId}
              onPointerEnter={() => setHoveredId(s.id)}
              onPointerLeave={() => setHoveredId(null)}
              onFocus={() => setFocusedId(s.id)}
              onBlur={() => setFocusedId(null)}
            >
              {/* Keep the hit area stationary while the visible segment lifts. */}
              <circle cx="100" cy="100" r="80" fill="none" stroke="transparent" strokeWidth="28" strokeDasharray={`${s.length} ${circumference - s.length}`} strokeDashoffset={-s.offset} transform="rotate(-90 100 100)" pointerEvents="stroke" />
              <g className={styles.segmentVisual} pointerEvents="none">
                <circle cx="100" cy="100" r="80" fill="none" stroke={s.color} strokeWidth="24" strokeDasharray={`${s.length} ${circumference - s.length}`} strokeDashoffset={-s.offset} transform="rotate(-90 100 100)" />
              </g>
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-[24%] flex flex-col items-center justify-center text-center" role="status" aria-live="polite" aria-atomic="true">
          <strong className="text-[28px] font-semibold leading-tight" style={{ color: "#123b32" }}>{formatPercent(displayed?.count || 0, chart.denominator)}</strong>
          <span className="mt-1 text-[11px] leading-tight" style={{ color: "#73847d" }}>{displayed?.label || "No findings"}</span>
          {active ? <span className="mt-1 text-[10px] leading-tight tabular-nums" style={{ color: "#354c43" }}>{active.count.toLocaleString()} {unit}</span> : null}
        </div>
      </div>
      <ul>
        {segments.map(s => <li key={s.id} className="flex items-start gap-2.5 border-b py-3 text-[13px] leading-5" style={{ borderColor: "#dfe6e2", color: s.color === REMAINDER ? "#82928b" : "#354c43" }} title={`${s.count.toLocaleString()} of ${chart.denominator.toLocaleString()} ${unit}`}>
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="min-w-0 flex-1">{s.label}</span>
          <strong className="shrink-0 tabular-nums">{formatPercent(s.count, chart.denominator)}</strong>
        </li>)}
      </ul>
      <p className="mt-3 text-[11px] leading-5" style={{ color: "#73847d" }}>{focused ? "Share of matching" : "Share of"} {chart.denominator.toLocaleString()} {title === "Persona Intelligence" ? `source corpus ${unit}` : `validated analytical ${unit}`}.{chart.note ? ` ${chart.note}` : ""}</p>
    </section>
  );
}

export default function CorpusDonutCards({ summary }) {
  if (!summary?.corpusCharts || !["full_corpus", "question_corpus"].includes(summary.scope)) return null;
  const focused = summary.scope === "question_corpus";
  const unit = summary.recordUnit || "posts";
  const patient = summary.clientGroups.find(g => g.id === "patients_circle");
  const persona = {
    denominator: summary.denominator,
    segments: [...summary.clientGroups].sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.count - a.count),
    highlightCount: patient?.count || 0,
    highlightLabel: "Patients & Their Circle",
  };
  return <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3" aria-label="Corpus overview charts">
    <DonutCard focused={focused} unit={unit} title={summary.questionEvidence ? "Topics in This Question" : "Most-Supported Burdens"} chart={summary.corpusCharts.burdens} source={focused ? "Derived from matching analytical records" : "Derived from the validated analytical corpus"} />
    <DonutCard focused={focused} unit={unit} title="Market Intelligence" chart={summary.corpusCharts.markets} source={focused ? "Derived from matching analytical records" : "Derived from the validated analytical corpus"} />
    <DonutCard focused={focused} unit={unit} title="Persona Intelligence" chart={persona} source={focused ? "Derived from matching source records" : "Derived from the full source corpus"} />
  </div>;
}
