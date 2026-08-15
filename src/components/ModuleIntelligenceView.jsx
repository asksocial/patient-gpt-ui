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
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setResult(null);
    setSelectedEvidence(null);
    setError("");
  }, [module.id, therapeuticArea]);

  useEffect(() => {
    if (!selectedEvidence) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setSelectedEvidence(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedEvidence]);

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
      {selectedEvidence ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Full module evidence mention"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEvidence(null);
          }}
        >
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/15 bg-[#080808] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-300/70">Full mention</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {selectedEvidence.mentionTitle || `${module.name} evidence`}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedEvidence(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06]">
                Close
              </button>
            </div>
            <blockquote className="mt-5 whitespace-pre-wrap border-l-2 border-cyan-300/40 pl-4 text-sm leading-7 text-white/75">
              {selectedEvidence.fullMention || selectedEvidence.quote}
            </blockquote>
            <div className="mt-5 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-white/30">Source</p><p className="mt-1 text-white/65">{selectedEvidence.sourceLabel}</p></div>
              <div><p className="text-white/30">Audience</p><p className="mt-1 text-white/65">{selectedEvidence.voice.replaceAll("_", " ")}</p></div>
              <div><p className="text-white/30">Evidence class</p><p className="mt-1 text-white/65">{selectedEvidence.evidenceClass.replaceAll("_", " ")}</p></div>
              <div><p className="text-white/30">Published</p><p className="mt-1 text-white/65">{selectedEvidence.publishedAt || "Not available"}</p></div>
            </div>
            {selectedEvidence.author ? <p className="mt-4 text-xs text-white/40">Author or account: <span className="text-white/65">{selectedEvidence.author}</span></p> : null}
            {selectedEvidence.url ? (
              <a href={selectedEvidence.url} target="_blank" rel="noreferrer noopener" className="mt-6 inline-flex items-center rounded-xl border border-cyan-300/35 bg-cyan-300/[0.10] px-5 py-3 text-sm font-semibold text-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.08)] transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.16] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
                Open original source ↗
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
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
              <button
                type="button"
                onClick={() => setSelectedEvidence(item)}
                aria-label={`View full mention from ${item.sourceLabel}`}
                className="block w-full rounded-lg text-left hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
              >
                <blockquote className="text-sm leading-6 text-cyan-100/65">“{item.quote}”</blockquote>
                <span className="mt-2 inline-block text-[11px] font-medium text-cyan-300/70">View full mention</span>
              </button>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.matchedSectionLabels.map((label) => (
                  <span key={label} className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-1 text-[10px] text-cyan-200/65">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/35">
                <span>{item.sourceLabel}</span>
                <span>{item.voice} voice</span>
                <span>{item.evidenceClass.replaceAll("_", " ")}</span>
                <span>quality {Math.round(item.qualityScore)}</span>
                {item.promotionalContext ? <span className="text-amber-200/65">promotional context</span> : null}
              </div>
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex rounded-lg border border-cyan-300/25 bg-cyan-300/[0.07] px-3 py-2 text-[11px] font-semibold text-cyan-200/85 transition hover:border-cyan-200/50 hover:bg-cyan-300/[0.12]">Open original source ↗</a> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
