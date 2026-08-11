"use client";

import { useState } from "react";

function SignalList({ title, signals = [] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{title}</h3>
      <div className="mt-4 space-y-3">
        {signals.length ? signals.map((signal) => (
          <div key={signal.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/70">{signal.label}</span>
              <span className="text-white/40">{signal.prevalencePercent}% · {signal.confidence}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${Math.min(100, signal.prevalencePercent)}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-white/35">No supported signals in the current patient-voice subset.</p>}
      </div>
    </section>
  );
}

export default function PatientIntelligenceView({ therapeuticArea, workspaceId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/patient-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapeuticArea, workspaceId: workspaceId || undefined }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Analysis failed");
      setResult(data.intelligence);
    } catch (analysisError) {
      setError(analysisError.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  if (!result) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">Patient Intelligence</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{therapeuticArea} patient experience</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/50">Analyze journey stages, treatment barriers, emotional burden, treatments, and unmet needs using the evidence-qualified patient and caregiver subset.</p>
        <button onClick={runAnalysis} disabled={loading || !therapeuticArea} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40">
          {loading ? "Analyzing…" : "Generate Patient Intelligence"}
        </button>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.06] p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200/70">
          <span className="rounded-full border border-cyan-300/20 px-2 py-1">{result.dataQuality.assessment} coverage</span>
          <span>{result.dataQuality.patientVoiceFindingCount} patient records</span>
          <span>{result.dataQuality.patientVoiceCoveragePercent}% of corpus</span>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">{result.headline}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-white/65">{result.executiveSummary}</p>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <SignalList title="Patient journey" signals={result.journeyStages} />
        <SignalList title="Treatment barriers" signals={result.treatmentBarriers} />
        <SignalList title="Emotional burden" signals={result.emotionalBurden} />
        <SignalList title="Unmet needs" signals={result.unmetNeeds} />
        <SignalList title="Treatment signals" signals={result.treatmentSignals} />
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Recommendations</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/65">
            {result.recommendations.map((recommendation) => <li key={recommendation} className="flex gap-3"><span className="text-cyan-300">→</span><span>{recommendation}</span></li>)}
          </ul>
        </section>
      </div>
      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/70">Data-quality limitations</h3>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-white/45">{result.dataQuality.limitations.map((item) => <li key={item}>• {item}</li>)}</ul>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Patient evidence</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {result.evidence.slice(0, 12).map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <blockquote className="text-sm leading-6 text-white/65">“{item.quote}”</blockquote>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/35">
                {item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="text-cyan-300 underline">{item.sourceLabel}</a> : <span>{item.sourceLabel}</span>}
                <span>{item.voice} voice</span><span>quality {Math.round(item.qualityScore)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
