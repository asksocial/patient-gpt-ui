"use client";

import { useEffect, useState } from "react";
import ModuleShell from "./ModuleShell";

function SignalCard({ section }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white/80">{section.label}</h3>
          <p className="mt-2 text-xs leading-5 text-white/40">{section.description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/45">
          {section.confidence}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-2xl font-semibold text-white">{section.prevalencePercent}%</span>
        <span className="text-xs text-white/35">{section.findingCount} findings</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${Math.min(100, section.prevalencePercent)}%` }} />
      </div>
    </section>
  );
}

function CountList({ title, items }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
            <span className="text-white/60">{item.label.replaceAll("_", " ")}</span>
            <span className="text-white/35">{item.count}</span>
          </div>
        )) : <p className="text-sm text-white/35">No supported signals were identified.</p>}
      </div>
    </section>
  );
}

export default function ModuleIntelligenceView({ module, agents, workflows, therapeuticArea, workspaceId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setResult(null);
    setError("");
  }, [module.id, therapeuticArea]);

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/module-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: module.id,
          therapeuticArea,
          workspaceId: workspaceId || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Analysis failed");
      setResult(data.intelligence);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  if (!result) {
    return (
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">{module.name} Intelligence</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{therapeuticArea} {module.name.toLowerCase()} intelligence</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/50">
            Generate evidence-qualified {module.description.charAt(0).toLowerCase() + module.description.slice(1)} The analysis applies this module’s audience, source, taxonomy, and decision lens.
          </p>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading || !therapeuticArea}
            className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            {loading ? "Analyzing…" : `Generate ${module.name} Intelligence`}
          </button>
          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        </section>
        <ModuleShell module={module} agents={agents} workflows={workflows} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.06] p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200/70">
          <span className="rounded-full border border-cyan-300/20 px-2 py-1">{result.dataQuality.assessment} coverage</span>
          <span>{result.dataQuality.selectedFindingCount} selected findings</span>
          <span>{result.dataQuality.contextualEvidenceFindingCount} context-matched findings</span>
          <span>{result.dataQuality.corpusFindingCount} corpus findings</span>
          {result.dataQuality.promotionalContextCount ? <span>{result.dataQuality.promotionalContextCount} promotional context records</span> : null}
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">{result.headline}</h2>
        <p className="mt-3 max-w-5xl text-sm leading-6 text-white/65">{result.executiveSummary}</p>
        <button type="button" onClick={runAnalysis} disabled={loading} className="mt-5 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-white/65 hover:bg-white/[0.06] disabled:opacity-40">
          {loading ? "Refreshing…" : `Regenerate ${module.name} Intelligence`}
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {result.sections.map((section) => <SignalCard key={section.id} section={section} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CountList title="Audience coverage" items={result.audienceSignals} />
        <CountList title="Evidence classes" items={result.sourceSignals} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Recommended actions</h3>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-white/65">
          {result.recommendations.map((item) => <li key={item} className="flex gap-3"><span className="text-cyan-300">→</span><span>{item}</span></li>)}
        </ul>
      </section>

      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/70">Data-quality limitations</h3>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-white/45">
          {result.dataQuality.limitations.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Module evidence</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {result.evidence.slice(0, 12).map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <blockquote className="text-sm leading-6 text-white/65">“{item.quote}”</blockquote>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.matchedSectionLabels.map((label) => (
                  <span key={label} className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-1 text-[10px] text-cyan-200/65">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/35">
                {item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="text-cyan-300 underline">{item.sourceLabel}</a> : <span>{item.sourceLabel}</span>}
                <span>{item.voice} voice</span>
                <span>{item.evidenceClass.replaceAll("_", " ")}</span>
                <span>quality {Math.round(item.qualityScore)}</span>
                {item.promotionalContext ? <span className="text-amber-200/65">promotional context</span> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
