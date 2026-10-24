"use client";
import { useEffect, useState } from "react";
const ENDPOINT = "/api/pv/corpora/glp-1/triage";
const STATUS = {
  eligible_english_candidate: "Active-rule English candidates",
  eligible_source_candidate: "Source-reaction review candidates",
  related_source_excerpt: "Related source excerpt (not another case)",
  language_review_required: "Language review required",
  context_review_required: "Context review required",
  source_repair_required: "Source evidence repair required",
  excluded_content: "Off-topic / promotional content",
  no_rule_signal: "No matched rule signal",
  library_approval_required: "Library approval required",
};
export default function Glp1HeldTriage({ busy, onMutate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [signalOnly, setSignalOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const [rationale, setRationale] = useState("");
  const [translation, setTranslation] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [qualified, setQualified] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${ENDPOINT}?page=${page}&status=${status}&signalOnly=${signalOnly}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "Held-source triage failed."); return payload; })
      .then(payload => { setData(payload); setError(""); }).catch(failure => { if (failure.name !== "AbortError") setError(failure.message); });
    return () => controller.abort();
  }, [page, status, signalOnly, revision]);
  const assessment = data?.assessment;
  const rows = data?.rows || [];
  const eligible = rows.filter(row => ["eligible_english_candidate", "eligible_source_candidate"].includes(row.status));
  function open(row) {
    setSelected(row); setScopeConfirmed(false); setRationale(""); setTranslation(""); setLanguageCode(row.languageCode || ""); setQualified(false); setError("");
  }
  async function include(rowNumbers, verifiedTranslation) {
    setError("");
    if (!scopeConfirmed || rationale.trim().length < 10) { setError("Confirm source eligibility and enter a rationale of at least 10 characters."); return; }
    const result = await onMutate(ENDPOINT, { payload: { action: "include", assessmentHash: assessment.assessmentHash, rowNumbers, sourceScopeConfirmed: scopeConfirmed, rationale, ...(verifiedTranslation ? { translation: { text: translation, languageCode, verifiedByQualifiedReviewer: qualified } } : {}) } }, "glp1-held-include", "Eligible held-source candidates included in PV Compliance. Existing records and decisions were preserved.");
    if (result) { setRevision(value => value + 1); setSelected(null); setScopeConfirmed(false); setRationale(""); }
  }
  return <section aria-label="GLP-1 held-source triage" className="mt-5 rounded-xl border border-white/15 p-4">
    <h4 className="text-sm font-semibold text-white">Held-source assessment & inclusion</h4>
    <p className="mt-2 text-xs leading-5 text-white/55">Every held row is assessed for source completeness, product cues, and the FDA reaction vocabulary. Localized cues prioritize language review; they do not establish an event, validated translation, causality, or expectedness. No matched cue is not a negative safety determination.</p>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
    {!assessment ? <p className="mt-3 text-xs text-white/50">Loading held-source assessment…</p> : <>
      <div className="mt-3 grid gap-2 sm:grid-cols-3"><p className="rounded-lg border border-white/10 p-3 text-xs text-white/65"><strong className="block text-lg text-white">{assessment.assessedHeldCount.toLocaleString()}</strong>Held rows assessed</p><p className="rounded-lg border border-white/10 p-3 text-xs text-white/65"><strong className="block text-lg text-white">{assessment.statusCounts.eligible_english_candidate + assessment.statusCounts.eligible_source_candidate}</strong>Eligible English candidates</p><p className="rounded-lg border border-white/10 p-3 text-xs text-white/65"><strong className="block text-lg text-white">{assessment.prioritizedCount}</strong>Product/reaction matches prioritized</p></div>
      <p className="mt-2 text-xs text-white/45">{assessment.ruleBasis === "approved_library" ? `Active library v${assessment.libraryVersion}` : "Bundled preview; an approved library is required for inclusion"} · {assessment.triageVersion}. Historical source holds remain preserved; eligibility can change after review.</p>
      <button type="button" disabled={Boolean(busy)} onClick={async () => { const result = await onMutate(ENDPOINT, { payload: { action: "assess" } }, "glp1-held-assess", "All held-source rows assessed and the triage summary retained in the audit trail."); if (result) setRevision(value => value + 1); }} className="mt-3 cursor-pointer rounded-lg border border-white/20 px-3 py-2 text-xs text-white disabled:opacity-40">{busy === "glp1-held-assess" ? "Assessing…" : "Assess all held rows & retain audit"}</button>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/65"><label>Disposition <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); setSelected(null); }} className="ml-2 rounded border border-white/20 bg-black px-2 py-1"><option value="all">All dispositions</option>{Object.entries(STATUS).map(([value, title]) => <option key={value} value={value}>{title} ({assessment.statusCounts[value] || 0})</option>)}</select></label><label className="flex items-center gap-2"><input type="checkbox" checked={signalOnly} onChange={event => { setSignalOnly(event.target.checked); setPage(1); setSelected(null); }} />Product/reaction matches only</label></div>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs text-white/60"><thead><tr><th className="p-2">Source row / language</th><th className="p-2">Disposition</th><th className="p-2">Matched original text → FDA source term</th><th className="p-2">Review</th></tr></thead><tbody>{rows.map(row => <tr key={row.rowNumber} className="border-t border-white/10"><td className="p-2">{row.rowNumber} · {row.language}<span className="mt-1 block text-white/40">{row.sourceType}</span></td><td className="p-2">{STATUS[row.status]}<span className="mt-1 block text-white/40">{row.productCues.slice(0, 3).join(", ") || "No product cue"}</span></td><td className="max-w-md p-2">{row.reactionCues.length ? row.reactionCues.map(cue => `${cue.matchedText} → ${cue.sourceTerm}${cue.referenceOnly ? " (reference only)" : cue.basis === "localized_triage_cue" ? " (language verification required)" : ""}`).join("; ") : "No vocabulary cue; clinical absence not established"}</td><td className="p-2"><button type="button" onClick={() => open(row)} className="cursor-pointer text-cyan-200 underline">Review row {row.rowNumber}</button></td></tr>)}</tbody></table>{!rows.length ? <p className="py-3 text-xs text-white/50">No rows match these filters.</p> : null}</div>
      <div className="mt-3 flex items-center gap-3 text-xs text-white/60"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value-1)} className="cursor-pointer disabled:opacity-30">Previous</button><span>Page {page} · {data.matchedCount.toLocaleString()} matching held rows</span><button type="button" disabled={page*25 >= data.matchedCount} onClick={() => setPage(value => value+1)} className="cursor-pointer disabled:opacity-30">Next</button></div>
      {selected ? <div className="mt-4 rounded-xl border border-cyan-300/20 p-4"><h5 className="text-sm text-white">Source row {selected.rowNumber}: {STATUS[selected.status]}</h5><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/65">{selected.verbatim || "No source text"}</p>{/^https?:\/\//i.test(selected.sourceUrl) ? <a className="mt-2 inline-block text-xs text-cyan-200 underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">Open original source</a> : null}<p className="mt-2 text-xs text-white/40">Original hold: {selected.holdReason}. Blockers: {selected.blockers.join(", ") || "none"}. {selected.relatedToRow ? `Related excerpt: review primary row ${selected.relatedToRow}; this is not another unique case.` : selected.relatedSourceRows?.length ? `Related identical excerpts retained at rows ${selected.relatedSourceRows.join(", ")}.` : ""}</p>
        {selected.status === "language_review_required" ? <div className="mt-3 space-y-2"><label className="block text-xs text-white/65">Verified source language code <input value={languageCode} onChange={event => setLanguageCode(event.target.value)} placeholder="e.g. ko, ja, pt" className="ml-2 rounded border border-white/20 bg-black px-2 py-1" /></label><label className="block text-xs text-white/65">English translation verified against this original<textarea value={translation} onChange={event => setTranslation(event.target.value)} rows={5} maxLength={50000} className="mt-2 block w-full rounded border border-white/20 bg-black p-2 text-white" /></label><label className="flex items-start gap-2 text-xs text-white/65"><input type="checkbox" checked={qualified} onChange={event => setQualified(event.target.checked)} />I am qualified to review the source language and verified this translation against the original.</label></div> : null}
        {["eligible_english_candidate", "eligible_source_candidate", "language_review_required"].includes(selected.status) ? <><label className="mt-3 flex items-start gap-2 text-xs text-white/65"><input type="checkbox" checked={scopeConfirmed} onChange={event => setScopeConfirmed(event.target.checked)} />I confirm this source is eligible for this PV review workflow.</label><label className="mt-3 block text-xs text-white/65">Source eligibility rationale<textarea value={rationale} onChange={event => setRationale(event.target.value)} rows={2} maxLength={4000} className="mt-2 block w-full rounded border border-white/20 bg-black p-2 text-white" /></label><button type="button" disabled={Boolean(busy) || !scopeConfirmed || rationale.trim().length < 10 || selected.status === "language_review_required" && (!qualified || !translation.trim())} onClick={() => include([selected.rowNumber], selected.status === "language_review_required")} className="mt-3 cursor-pointer rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">Check eligibility & include potential PV record</button>{["eligible_english_candidate", "eligible_source_candidate"].includes(selected.status) && eligible.length > 1 ? <button type="button" disabled={Boolean(busy) || !scopeConfirmed || rationale.trim().length < 10} onClick={() => include(eligible.map(row => row.rowNumber), false)} className="ml-3 mt-3 cursor-pointer text-xs text-cyan-200 underline disabled:opacity-40">Include {eligible.length} eligible English rows on this page using this scope rationale</button> : null}</> : <p className="mt-3 text-xs text-amber-200">This row cannot enter the case workflow under the current rules. Retain it for evidence repair, context review, or a revised approved detection configuration.</p>}
      </div> : null}
      <details className="mt-4 text-xs text-white/45"><summary className="cursor-pointer">Triage provenance and vocabulary sources</summary><p className="mt-2 break-all">Assessment {assessment.assessmentHash} · original source SHA-256 {assessment.sourceFileHash} · FDA snapshot {assessment.faersRetrievedAt}</p>{Object.entries(assessment.vocabularySources).map(([lang, url]) => <a key={lang} href={url} target="_blank" rel="noreferrer" className="mr-3 mt-2 inline-block text-cyan-200 underline">{lang} vocabulary reference</a>)}<p className="mt-2">Localized aliases are provisional retrieval cues. No validated multilingual recall is claimed. Inclusion uses approved English rules or the separately identified provisional source-episode triage path. Other languages require a qualified reviewer’s verified English translation. Source-episode candidates have no calibrated screening score and no inferred clinical determinations. Original text and prior review decisions remain preserved.</p></details>
    </>}
  </section>;
}
