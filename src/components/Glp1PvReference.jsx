"use client";

import { useEffect, useState } from "react";

export default function Glp1PvReference({ libraries, busy, onMutate, onConfiguration }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const library = libraries.find((item) => item.therapeutic_area === "GLP-1" && item.name === "GLP-1 FAERS-informed PV detection library" && item.status !== "retired");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pv/corpora/glp-1", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || "GLP-1 reference could not be loaded."); return result; })
      .then(setData).catch((failure) => { if (failure.name !== "AbortError") setError(failure.message); });
    return () => controller.abort();
  }, []);
  const reference = data?.reference;
  const corpus = data?.corpus;
  return <section aria-label="GLP-1 FAERS reference and screening" className="rounded-2xl border border-cyan-300/15 bg-white/[0.025] p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h3 className="text-base font-semibold text-white">GLP-1 FAERS reference & screening</h3><p className="mt-2 max-w-3xl text-xs leading-5 text-white/50">FDA reports inform the reference vocabulary. Social detections enter the existing human review, case assessment, sponsor handoff, and reconciliation workflow.</p></div>
      <span className="rounded-lg border border-amber-300/20 px-3 py-1.5 text-xs text-amber-200">{reference ? reference.status === "complete" ? "Reference retrieval complete" : "Partial reference snapshot" : "Loading reference…"}</span>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
    {reference ? <>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">{[["Retained FDA reports", reference.uniqueReports], ["Source reaction terms", reference.reactions.length], ["Queries attempted", reference.queryRuns.length], ["Retrieved", new Date(reference.retrievedAt).toLocaleDateString()]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/40">{label}</p><p className="mt-1 text-lg text-white/80">{typeof value === "number" ? value.toLocaleString() : value}</p></div>)}</div>
      <p className="mt-3 text-xs leading-5 text-white/45">{reference.truncated ? `${reference.pageSize} recent reports per exact-field query, before suspect-role filtering and deduplication. Further pages remain outside this snapshot. ` : ""}Reports may contain multiple drugs and reactions. Counts do not establish causality, incidence, label expectedness, or final reportability. FDA reference reports do not enter the social review queue.</p>
      <details className="mt-4 text-xs text-white/60"><summary className="cursor-pointer">View source reaction terms and query coverage</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Source reaction term</th><th>Retained reports mentioning term</th><th>FDA source example</th></tr></thead><tbody>{reference.reactions.slice(0, 15).map((reaction) => <tr key={reaction.term} className="border-t border-white/10"><td className="py-2">{reaction.term}</td><td>{reaction.reportCount}</td><td>{reaction.sampleReportIds[0] ? <a target="_blank" rel="noreferrer" className="text-cyan-200 underline" href={`https://api.fda.gov/drug/event.json?search=${encodeURIComponent(`safetyreportid:"${reaction.sampleReportIds[0]}"`)}&limit=1`}>View report</a> : "—"}</td></tr>)}</tbody></table></div><p className="mt-3 text-white/40">Terms such as “No adverse event” are preserved as FDA source vocabulary and do not become adverse-event rules.</p><ul className="mt-3 grid gap-1 sm:grid-cols-2">{reference.queryRuns.map((query) => <li key={query.queryId}><a target="_blank" rel="noreferrer" className="text-cyan-200/70 underline" href={query.query}>{query.product}</a> · {query.error ? "Retrieval failed" : query.completed ? "All pages retrieved" : "Page limit reached"}{query.apiLastUpdated ? ` · FDA updated ${query.apiLastUpdated}` : ""}</li>)}</ul></details>
      <a href={reference.sourceDocumentation} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-cyan-200 underline">FDA FAERS documentation</a>
    </> : null}
    {corpus ? <div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs leading-5 text-white/60">Social corpus: {corpus.rowCount.toLocaleString()} source rows · {corpus.screenableCount.toLocaleString()} eligible English social rows · {corpus.heldCount.toLocaleString()} held for language, source scope, or missing links · {corpus.parseFailureCount} parse failures. Bundled rules propose {corpus.candidateCount} candidates ({corpus.candidateSegments?.ae_adr ?? 0} for the Review Queue; {corpus.candidateSegments?.health_experience ?? 0} for Health Experience Detection); approved library settings determine persisted results.</p><p className="mt-2 text-xs text-white/40">{corpus.sourceTimestampPolicy} Non-English and unknown-language rows require a qualified language workflow. Updated audience labels do not establish safety cases; comment screening uses the commenter’s text, with parent titles retained only as source context.</p><details className="mt-3 text-xs text-white/50"><summary className="cursor-pointer">Source coverage and audience composition</summary><p className="mt-2">{Object.entries(corpus.holdCounts || {}).map(([reason, count]) => `${reason.replaceAll("_", " ")}: ${count.toLocaleString()}`).join(" · ")}</p><p className="mt-2">{Object.entries(corpus.audienceCounts || {}).map(([audience, count]) => `${audience.replaceAll("_", " ")}: ${count.toLocaleString()}`).join(" · ")}</p><p className="mt-2">Composition covers all source records. Candidate counts are a preview of bundled rules; queue totals reflect persisted records and reviewer decisions. Rescreening preserves existing case decisions.</p></details></div> : null}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {!library ? <button disabled={Boolean(busy)} onClick={() => onMutate("/api/pv/corpora/glp-1", { payload: { action: "setup" } }, "glp1-setup", "GLP-1 library created in draft. Review its concepts and approve it in Configuration before screening.")} className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black disabled:opacity-40">Set up GLP-1 detection library</button> : null}
      {library?.status === "active" ? <button disabled={Boolean(busy)} onClick={() => onMutate("/api/pv/corpora/glp-1", { payload: { action: "screen" } }, "glp1-screen", "GLP-1 social screening completed. Review the held-row counts and potential detections; existing case decisions were preserved.")} className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black disabled:opacity-40">{busy === "glp1-screen" ? "Screening…" : "Screen GLP-1 social corpus"}</button> : null}
      {library && library.status !== "active" ? <><p className="text-xs text-amber-200">Library awaiting approval</p><button type="button" onClick={onConfiguration} className="cursor-pointer text-xs text-cyan-200 underline">Review library configuration</button></> : null}
    </div>
  </section>;
}
