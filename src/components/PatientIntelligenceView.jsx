"use client";

import { useEffect, useState } from "react";
import EvidenceMentionCard from "./EvidenceMentionCard";

function SignalList({ title, signals = [], evidenceCount, onOpenEvidence }) {
  const content = (
    <>
      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{title}</span>
      <span className="mt-4 block space-y-3">
        {signals.length ? signals.map((signal) => (
          <span key={signal.id} className="block">
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/70">{signal.label}</span>
              <span className="text-white/40">{signal.prevalencePercent}% · {signal.confidence}</span>
            </span>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/5">
              <span className="block h-full rounded-full bg-cyan-300/70" style={{ width: `${Math.min(100, signal.prevalencePercent)}%` }} />
            </span>
          </span>
        )) : <span className="block text-sm text-white/35">No supported signals in the current patient-voice subset.</span>}
      </span>
      {onOpenEvidence ? (
        <span className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-cyan-200/75">
          <span>{evidenceCount.toLocaleString()} supporting mention{evidenceCount === 1 ? "" : "s"}</span>
          <span>View evidence →</span>
        </span>
      ) : null}
    </>
  );

  if (onOpenEvidence) {
    return (
      <button
        type="button"
        onClick={onOpenEvidence}
        aria-label={`View all evidence supporting ${title}`}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
      >
        {content}
      </button>
    );
  }

  return <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">{content}</section>;
}

function patientEvidenceTitle(item) {
  return item.mentionTitle || item.matchedSignalLabels?.[0] || "Patient evidence";
}

function readableLabel(value, fallback = "Not available") {
  const normalized = String(value || "").trim();
  return normalized ? normalized.replaceAll("_", " ") : fallback;
}

function PatientEvidenceDialog({ evidence, onClose }) {
  if (!evidence) return null;
  const supportingSignals = Array.isArray(evidence.matchedSignalLabels) && evidence.matchedSignalLabels.length
    ? evidence.matchedSignalLabels.join(", ")
    : "Not classified";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Full patient evidence mention" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/15 bg-[#080808] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs uppercase tracking-[0.16em] text-cyan-300/70">Full mention</p><h2 className="mt-2 text-xl font-semibold text-white">{patientEvidenceTitle(evidence)}</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06]">Close</button>
        </div>
        <blockquote className="mt-5 whitespace-pre-wrap border-l-2 border-cyan-300/40 pl-4 text-sm leading-7 text-white/75">{evidence.fullMention || evidence.quote}</blockquote>
        <div className="mt-5 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-5">
          <div><p className="text-white/30">Source</p><p className="mt-1 text-white/65">{evidence.sourceLabel}</p></div>
          <div><p className="text-white/30">Resolved audience</p><p className="mt-1 capitalize text-white/65">{readableLabel(evidence.audienceLabel || evidence.voice)}</p></div>
          <div><p className="text-white/30">Patient-evidence tier</p><p className="mt-1 text-cyan-200/80">{evidence.evidenceTierLabel || "Direct patient evidence"}</p></div>
          <div><p className="text-white/30">Supporting signals</p><p className="mt-1 text-white/65">{supportingSignals}</p></div>
          <div><p className="text-white/30">Published</p><p className="mt-1 text-white/65">{evidence.publishedAt || "Not available"}</p></div>
        </div>
        {evidence.classificationRationale ? <p className="mt-4 text-xs leading-5 text-white/40">Classification rationale: <span className="text-white/65">{evidence.classificationRationale}</span> · {Math.round((evidence.classificationConfidence || 0) * 100)}% confidence</p> : null}
        {evidence.author ? <p className="mt-4 text-xs text-white/40">Author or account: <span className="text-white/65">{evidence.author}</span></p> : null}
        {evidence.url ? <a href={evidence.url} target="_blank" rel="noreferrer noopener" className="mt-6 inline-flex items-center rounded-xl border border-cyan-300/35 bg-cyan-300/[0.10] px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.16]">Open original source ↗</a> : null}
      </div>
    </div>
  );
}

export default function PatientIntelligenceView({ therapeuticArea, workspaceId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [evidenceDimension, setEvidenceDimension] = useState(null);
  const [evidenceCatalog, setEvidenceCatalog] = useState(null);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  useEffect(() => {
    setResult(null);
    setEvidenceDimension(null);
    setEvidenceCatalog(null);
    setEvidenceQuery("");
    setEvidenceError("");
    setSelectedEvidence(null);
  }, [therapeuticArea]);

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

  async function loadEvidencePage(dimension, page = 1, queryOverride) {
    const query = typeof queryOverride === "string" ? queryOverride : evidenceQuery;
    setEvidenceLoading(true);
    setEvidenceError("");
    try {
      const search = new URLSearchParams({
        therapeuticArea,
        dimension,
        page: String(page),
        pageSize: "20",
      });
      if (query.trim()) search.set("q", query.trim());
      const response = await fetch(`/api/patient-intelligence?${search.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Patient evidence could not be loaded");
      setEvidenceCatalog(data.evidence);
    } catch (catalogError) {
      setEvidenceError(catalogError instanceof Error ? catalogError.message : "Patient evidence could not be loaded");
    } finally {
      setEvidenceLoading(false);
    }
  }

  function openEvidenceBrowser(dimension, label) {
    const nextDimension = { id: dimension, label };
    setEvidenceDimension(nextDimension);
    setEvidenceCatalog(null);
    setEvidenceQuery("");
    setEvidenceError("");
    setSelectedEvidence(null);
    void loadEvidencePage(dimension, 1, "");
  }

  function closeEvidenceBrowser() {
    setEvidenceDimension(null);
    setEvidenceCatalog(null);
    setEvidenceQuery("");
    setEvidenceError("");
    setSelectedEvidence(null);
  }

  function evidenceCount(dimension) {
    return result?.evidenceDimensions?.find((item) => item.id === dimension)?.findingCount || 0;
  }

  if (!result) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">Patient Intelligence</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{therapeuticArea}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/50">Analyze journey stages, treatment barriers, emotional burden, treatments, and unmet needs using the evidence-qualified patient and caregiver subset.</p>
        <button onClick={runAnalysis} disabled={loading || !therapeuticArea} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40">
          {loading ? "Analyzing…" : "Generate Patient Intelligence"}
        </button>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>
    );
  }

  if (evidenceDimension) {
    return (
      <div className="space-y-5">
        <PatientEvidenceDialog evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
        <section className="min-h-[70vh] rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6" aria-label={`${evidenceDimension.label} patient evidence table`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/70">Patient Intelligence</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{evidenceDimension.label} evidence</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">Every retained patient or caregiver mention supporting this dimension for {therapeuticArea}. Select a mention to review the complete evidence.</p>
            </div>
            <button type="button" onClick={closeEvidenceBrowser} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/65 transition hover:bg-white/[0.06]">← Back to Patient Intelligence</button>
          </div>

          <form className="mt-6 flex flex-col gap-3 sm:flex-row" role="search" onSubmit={(event) => { event.preventDefault(); void loadEvidencePage(evidenceDimension.id, 1); }}>
            <label className="sr-only" htmlFor="patient-evidence-search">Search patient evidence by keyword</label>
            <input id="patient-evidence-search" type="search" value={evidenceQuery} onChange={(event) => setEvidenceQuery(event.target.value)} placeholder={`Search ${evidenceDimension.label.toLowerCase()} mentions…`} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40" />
            <button type="submit" disabled={evidenceLoading} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40">{evidenceLoading ? "Searching…" : "Search"}</button>
            <button type="button" onClick={() => { setEvidenceQuery(""); void loadEvidencePage(evidenceDimension.id, 1, ""); }} disabled={evidenceLoading || !evidenceQuery} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/55 disabled:opacity-30">Clear</button>
          </form>

          {evidenceError ? <p className="mt-4 text-sm text-rose-300">{evidenceError}</p> : null}
          {evidenceLoading && !evidenceCatalog ? <p className="mt-6 text-sm text-white/40">Loading supporting patient evidence…</p> : null}

          {evidenceCatalog ? (
            <>
              <div className="mt-6 text-xs text-white/40">{evidenceCatalog.total.toLocaleString()} supporting mention{evidenceCatalog.total === 1 ? "" : "s"} · Page {evidenceCatalog.page} of {evidenceCatalog.pageCount}</div>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/35 text-xs uppercase tracking-[0.12em] text-white/40">
                    <tr><th className="w-[20%] px-4 py-3 font-semibold">Label</th><th className="w-[27%] px-4 py-3 font-semibold">Mention</th><th className="w-[12%] px-4 py-3 font-semibold">Source</th><th className="w-[9%] px-4 py-3 font-semibold">Audience</th><th className="w-[14%] px-4 py-3 font-semibold">Evidence tier</th><th className="w-[12%] px-4 py-3 font-semibold">Supporting Signals</th><th className="w-[6%] px-4 py-3 font-semibold">Quality</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {evidenceCatalog.items.map((item) => (
                      <tr key={item.id} className="align-top text-white/60 transition hover:bg-white/[0.025]">
                        <td className="px-4 py-4"><button type="button" onClick={() => setSelectedEvidence(item)} className="line-clamp-2 text-left font-semibold leading-5 text-white/80 hover:text-cyan-200">{patientEvidenceTitle(item)}</button></td>
                        <td className="px-4 py-4"><button type="button" onClick={() => setSelectedEvidence(item)} className="line-clamp-2 text-left leading-5 text-white/55 hover:text-white/75">{item.quote}</button></td>
                        <td className="px-4 py-4">{item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="font-medium text-cyan-300/85 underline decoration-cyan-300/30 underline-offset-4 hover:text-cyan-200">{item.sourceLabel} ↗</a> : <span className="text-white/35">{item.sourceLabel}</span>}</td>
                        <td className="px-4 py-4 capitalize">{readableLabel(item.audienceLabel || item.voice)}</td>
                        <td className="px-4 py-4 text-xs leading-5 text-cyan-200/75">{item.evidenceTierLabel || "Direct patient evidence"}<span className="mt-1 block text-white/30">{Math.round((item.classificationConfidence || 0) * 100)}% confidence</span></td>
                        <td className="px-4 py-4 text-xs leading-5">{item.matchedSignalLabels.join(", ")}</td>
                        <td className="px-4 py-4">{Math.round(item.qualityScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!evidenceCatalog.items.length ? <p className="p-6 text-sm text-white/40">No supporting evidence matches the current keyword search.</p> : null}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={() => void loadEvidencePage(evidenceDimension.id, evidenceCatalog.page - 1)} disabled={evidenceLoading || evidenceCatalog.page <= 1} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 disabled:opacity-30">← Previous</button>
                <span className="text-xs text-white/35">Page {evidenceCatalog.page} of {evidenceCatalog.pageCount}</span>
                <button type="button" onClick={() => void loadEvidencePage(evidenceDimension.id, evidenceCatalog.page + 1)} disabled={evidenceLoading || evidenceCatalog.page >= evidenceCatalog.pageCount} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 disabled:opacity-30">Next →</button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PatientEvidenceDialog evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
      <section className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.06] p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200/70">
          <span className="rounded-full border border-cyan-300/20 px-2 py-1">{result.dataQuality.assessment} coverage</span>
          <span>{result.dataQuality.patientVoiceFindingCount} patient/caregiver records</span>
          <span>{(Number(result.dataQuality.confirmedPatientFindingCount || 0) + Number(result.dataQuality.confirmedCaregiverFindingCount || 0)).toLocaleString()} direct</span>
          <span>{(Number(result.dataQuality.likelyPatientFindingCount || 0) + Number(result.dataQuality.likelyCaregiverFindingCount || 0)).toLocaleString()} likely</span>
          <span>{result.dataQuality.patientVoiceCoveragePercent}% of corpus</span>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">{result.headline}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-white/65">{result.executiveSummary}</p>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <SignalList title="Patient journey" signals={result.journeyStages} evidenceCount={evidenceCount("journey")} onOpenEvidence={() => openEvidenceBrowser("journey", "Patient journey")} />
        <SignalList title="Treatment barriers" signals={result.treatmentBarriers} evidenceCount={evidenceCount("treatment_barriers")} onOpenEvidence={() => openEvidenceBrowser("treatment_barriers", "Treatment barriers")} />
        <SignalList title="Emotional burden" signals={result.emotionalBurden} evidenceCount={evidenceCount("emotional_burden")} onOpenEvidence={() => openEvidenceBrowser("emotional_burden", "Emotional burden")} />
        <SignalList title="Unmet needs" signals={result.unmetNeeds} evidenceCount={evidenceCount("unmet_needs")} onOpenEvidence={() => openEvidenceBrowser("unmet_needs", "Unmet needs")} />
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
            <EvidenceMentionCard
              key={item.id}
              eyebrow="Patient evidence"
              badge={item.evidenceTierLabel || "Direct patient evidence"}
              title={patientEvidenceTitle(item)}
              preview={item.fullMention || item.quote}
              tags={item.matchedSignalLabels || []}
              metrics={[
                { label: "Source", value: item.sourceLabel },
                { label: "Audience", value: readableLabel(item.audienceLabel || item.voice), capitalize: true },
                { label: "Classification", value: `${Math.round((item.classificationConfidence || 0) * 100)}% confidence` },
                { label: "Evidence quality", value: Math.round(item.qualityScore) },
              ]}
              url={item.url}
              onOpen={() => setSelectedEvidence(item)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
