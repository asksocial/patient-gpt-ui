"use client";

import { useEffect, useState } from "react";
import ModuleShell from "./ModuleShell";
import Tooltip from "./ui/Tooltip";

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

function evidenceDisplayTitle(item, moduleName) {
  return item.mentionTitle || `${moduleName} evidence`;
}

function RecommendedActions({ actions = [] }) {
  if (!actions.length) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Recommended Actions</h3>
        <p className="mt-1 text-sm text-white/45">Suggested next moves based on the strongest current signals</p>
      </div>
      <div className="space-y-3">
        {actions.map((action, idx) => (
          <div key={`${action}-${idx}`} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <Tooltip content="A practical next step derived from the strongest current signals." delay={250} side="top" align="center">
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  <span className="whitespace-nowrap">Action {idx + 1}</span>
                </span>
              </Tooltip>
              <p className="text-sm leading-6 text-white/75">{action}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FullMentionDialog({ evidence, moduleName, onClose }) {
  if (!evidence) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Full module evidence mention"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/15 bg-[#080808] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300/70">Full mention</p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {evidenceDisplayTitle(evidence, moduleName)}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06]">
            Close
          </button>
        </div>
        <blockquote className="mt-5 whitespace-pre-wrap border-l-2 border-cyan-300/40 pl-4 text-sm leading-7 text-white/75">
          {evidence.fullMention || evidence.quote}
        </blockquote>
        <div className="mt-5 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-white/30">Source</p><p className="mt-1 text-white/65">{evidence.sourceLabel}</p></div>
          <div><p className="text-white/30">Audience</p><p className="mt-1 text-white/65">{evidence.voice.replaceAll("_", " ")}</p></div>
          <div><p className="text-white/30">Evidence class</p><p className="mt-1 text-white/65">{evidence.evidenceClass.replaceAll("_", " ")}</p></div>
          <div><p className="text-white/30">Published</p><p className="mt-1 text-white/65">{evidence.publishedAt || "Not available"}</p></div>
        </div>
        {evidence.author ? <p className="mt-4 text-xs text-white/40">Author or account: <span className="text-white/65">{evidence.author}</span></p> : null}
        {evidence.url ? (
          <a href={evidence.url} target="_blank" rel="noreferrer noopener" className="mt-6 inline-flex items-center rounded-xl border border-cyan-300/35 bg-cyan-300/[0.10] px-5 py-3 text-sm font-semibold text-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.08)] transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.16] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
            Open original source ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function ModuleIntelligenceView({ module, agents, workflows, therapeuticArea, workspaceId }) {
  const [result, setResult] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [evidenceBrowserOpen, setEvidenceBrowserOpen] = useState(false);
  const [evidenceCatalog, setEvidenceCatalog] = useState(null);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setResult(null);
    setSelectedEvidence(null);
    setEvidenceBrowserOpen(false);
    setEvidenceCatalog(null);
    setEvidenceQuery("");
    setEvidenceError("");
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

  async function loadEvidencePage(page = 1, queryOverride) {
    const query = typeof queryOverride === "string" ? queryOverride : evidenceQuery;
    setEvidenceLoading(true);
    setEvidenceError("");
    try {
      const search = new URLSearchParams({
        moduleId: module.id,
        therapeuticArea,
        page: String(page),
        pageSize: "25",
      });
      if (query.trim()) search.set("q", query.trim());
      const response = await fetch(`/api/module-intelligence/evidence?${search.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Evidence could not be loaded");
      setEvidenceCatalog(data.evidence);
    } catch (catalogError) {
      setEvidenceError(catalogError instanceof Error ? catalogError.message : "Evidence could not be loaded");
    } finally {
      setEvidenceLoading(false);
    }
  }

  function openEvidenceBrowser() {
    setEvidenceBrowserOpen(true);
    if (!evidenceCatalog) loadEvidencePage(1);
  }

  function clearEvidenceFilters() {
    setEvidenceQuery("");
    loadEvidencePage(1, "");
  }

  if (!result) {
    return (
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">{module.name} Intelligence</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{therapeuticArea}</h2>
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

  if (evidenceBrowserOpen) {
    return (
      <div className="space-y-5">
        <FullMentionDialog
          evidence={selectedEvidence}
          moduleName={module.name}
          onClose={() => setSelectedEvidence(null)}
        />

        <section className="min-h-[70vh] rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6" aria-label={`${module.name} evidence table`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/70">{module.name} Intelligence</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">All evidence</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Search and review every retained {therapeuticArea} mention. Select a label or mention to open the complete record.
              </p>
            </div>
            <button type="button" onClick={() => setEvidenceBrowserOpen(false)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/65 transition hover:bg-white/[0.06]">
              ← Back to {module.name}
            </button>
          </div>

          <form
            className="mt-6 flex flex-col gap-3 sm:flex-row"
            role="search"
            onSubmit={(event) => { event.preventDefault(); loadEvidencePage(1); }}
          >
            <label className="sr-only" htmlFor="module-evidence-search">Search evidence by keyword</label>
            <input
              id="module-evidence-search"
              type="search"
              value={evidenceQuery}
              onChange={(event) => setEvidenceQuery(event.target.value)}
              placeholder="Search mentions by keyword…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
            />
            <button type="submit" disabled={evidenceLoading} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40">
              {evidenceLoading ? "Searching…" : "Search"}
            </button>
            <button type="button" onClick={clearEvidenceFilters} disabled={evidenceLoading || !evidenceQuery} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/55 disabled:opacity-30">
              Clear
            </button>
          </form>

          {evidenceError ? <p className="mt-4 text-sm text-rose-300">{evidenceError}</p> : null}
          {evidenceLoading && !evidenceCatalog ? <p className="mt-6 text-sm text-white/40">Loading the retained evidence corpus…</p> : null}

          {evidenceCatalog ? (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
                <span>{evidenceCatalog.total.toLocaleString()} matching mentions · Page {evidenceCatalog.page} of {evidenceCatalog.pageCount}</span>
                {evidenceCatalog.relevancePolicy === "prequalified" ? <span className="rounded-full border border-cyan-300/20 px-2 py-1 text-cyan-200/70">Pre-qualified relevance · quality-ranked</span> : null}
              </div>

              <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/35 text-xs uppercase tracking-[0.12em] text-white/40">
                    <tr>
                      <th className="w-[24%] px-4 py-3 font-semibold">Label</th>
                      <th className="w-[30%] px-4 py-3 font-semibold">Mention</th>
                      <th className="w-[14%] px-4 py-3 font-semibold">Source</th>
                      <th className="w-[11%] px-4 py-3 font-semibold">Audience</th>
                      <th className="w-[12%] px-4 py-3 font-semibold">Evidence Class</th>
                      <th className="w-[9%] px-4 py-3 font-semibold">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {evidenceCatalog.items.map((item) => (
                      <tr key={item.id} className="align-top text-white/60 transition hover:bg-white/[0.025]">
                        <td className="px-4 py-4">
                          <button type="button" onClick={() => setSelectedEvidence(item)} className="line-clamp-2 text-left font-semibold leading-5 text-white/80 hover:text-cyan-200" title={evidenceDisplayTitle(item, module.name)}>
                            {evidenceDisplayTitle(item, module.name)}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <button type="button" onClick={() => setSelectedEvidence(item)} className="line-clamp-2 text-left leading-5 text-white/55 hover:text-white/75" title={item.quote}>
                            {item.quote}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer noopener" className="inline-flex font-medium text-cyan-300/85 underline decoration-cyan-300/30 underline-offset-4 hover:text-cyan-200">
                              {item.sourceLabel} ↗
                            </a>
                          ) : <span className="text-white/35">{item.sourceLabel || "Not available"}</span>}
                        </td>
                        <td className="px-4 py-4 capitalize">{item.voice.replaceAll("_", " ")}</td>
                        <td className="px-4 py-4 capitalize">{item.evidenceClass.replaceAll("_", " ")}</td>
                        <td className="px-4 py-4 text-xs leading-5 text-white/45">{item.publishedAt || "Not available"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!evidenceCatalog.items.length ? <p className="p-6 text-sm text-white/40">No evidence matches the current keyword search.</p> : null}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={() => loadEvidencePage(evidenceCatalog.page - 1)} disabled={evidenceLoading || evidenceCatalog.page <= 1} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 disabled:opacity-30">← Previous</button>
                <span className="text-xs text-white/35">Page {evidenceCatalog.page} of {evidenceCatalog.pageCount}</span>
                <button type="button" onClick={() => loadEvidencePage(evidenceCatalog.page + 1)} disabled={evidenceLoading || evidenceCatalog.page >= evidenceCatalog.pageCount} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 disabled:opacity-30">Next →</button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FullMentionDialog
        evidence={selectedEvidence}
        moduleName={module.name}
        onClose={() => setSelectedEvidence(null)}
      />
      <section className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.06] p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200/70">
          <span className="rounded-full border border-cyan-300/20 px-2 py-1">{result.dataQuality.assessment} coverage</span>
          {result.dataQuality.relevancePolicy === "prequalified" ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1">Meltwater relevance pre-qualified</span> : null}
          <span>{result.dataQuality.selectedFindingCount} selected findings</span>
          <span>{result.dataQuality.contextualEvidenceFindingCount} context-matched findings</span>
          <span>{result.dataQuality.corpusFindingCount} corpus findings</span>
          {result.dataQuality.lowQualityFindingCount ? <span>{result.dataQuality.lowQualityFindingCount} lower-quality mentions retained</span> : null}
          {result.dataQuality.unclassifiedFindingCount ? <span>{result.dataQuality.unclassifiedFindingCount} unclassified mentions retained</span> : null}
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

      <RecommendedActions actions={result.recommendations} />

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Representative module evidence</h3>
            <p className="mt-2 text-xs text-white/35">Ranked examples across the module taxonomy. Evidence quality is labeled and used for ordering.</p>
          </div>
          <button type="button" onClick={openEvidenceBrowser} className="rounded-xl border border-cyan-300/30 bg-cyan-300/[0.08] px-4 py-2.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-200/55 hover:bg-cyan-300/[0.14]">
            View all evidence
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {result.evidence.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <button
                type="button"
                onClick={() => setSelectedEvidence(item)}
                aria-label={`View full mention from ${item.sourceLabel}`}
                className="block w-full rounded-lg text-left hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
              >
                {module.id === "clinical_trials" ? (
                  <p className="line-clamp-2 text-sm font-semibold leading-6 text-white/80" title={evidenceDisplayTitle(item, module.name)}>
                    {evidenceDisplayTitle(item, module.name)}
                  </p>
                ) : (
                  <blockquote className="text-sm leading-6 text-cyan-100/65">“{item.quote}”</blockquote>
                )}
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
                <span>{item.qualityBand.replaceAll("_", " ")} quality · {Math.round(item.qualityScore)}</span>
                {item.promotionalContext ? <span className="text-amber-200/65">promotional context</span> : null}
              </div>
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex rounded-lg border border-cyan-300/25 bg-cyan-300/[0.07] px-3 py-2 text-[11px] font-semibold text-cyan-200/85 transition hover:border-cyan-200/50 hover:bg-cyan-300/[0.12]">Open original source ↗</a> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/70">Data-quality limitations</h3>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-white/45">
          {result.dataQuality.limitations.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </section>
    </div>
  );
}
