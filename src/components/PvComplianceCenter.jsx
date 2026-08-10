"use client";

import { useEffect, useMemo, useState } from "react";

const TABS = [
  ["overview", "Compliance Overview"],
  ["queue", "Review Queue"],
  ["screening", "Screening Status"],
  ["transfers", "Transfers"],
  ["reconciliation", "Reconciliation"],
  ["sources", "Source Registry"],
  ["configuration", "PV Configuration"],
];

const CLASSIFICATIONS = [
  "adverse_event", "product_quality_complaint", "pregnancy", "medication_error",
  "lack_of_efficacy", "overdose", "misuse_abuse", "other",
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function ToneBadge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-white/55",
    healthy: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    approaching: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    breached: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    complete: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone] || tones.neutral}`}>{children}</span>;
}

function Card({ title, subtitle, children, actions }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white">{title}</h2>{subtitle ? <p className="mt-1 text-sm leading-6 text-white/40">{subtitle}</p> : null}</div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ label: metricLabel, value, detail, tone = "neutral" }) {
  const border = tone === "warning" ? "border-amber-400/20 bg-amber-400/[0.05]" : tone === "danger" ? "border-rose-400/20 bg-rose-400/[0.05]" : "border-white/10 bg-black/30";
  return <div className={`rounded-2xl border p-4 ${border}`}><p className="text-xs text-white/40">{metricLabel}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p>{detail ? <p className="mt-1 text-xs text-white/30">{detail}</p> : null}</div>;
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-white/35">{children}</div>;
}

export default function PvComplianceCenter({ initialTab = "overview" }) {
  const [tab, setTab] = useState(initialTab);
  const [overview, setOverview] = useState(null);
  const [records, setRecords] = useState([]);
  const [sources, setSources] = useState([]);
  const [screenings, setScreenings] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAll() {
    setError("");
    try {
      const endpoints = ["overview", "records", "sources", "screenings", "transfers", "reconciliation", "library"];
      const responses = await Promise.all(endpoints.map((endpoint) => fetch(`/api/pv/${endpoint}`, { cache: "no-store" })));
      const payloads = await Promise.all(responses.map((response) => response.json()));
      const failed = payloads.find((payload) => !payload.ok);
      if (failed) throw new Error(failed.error || "PV Compliance could not be loaded.");
      setOverview(payloads[0].overview);
      setRecords(payloads[1].records || []);
      setSources(payloads[2].sources || []);
      setScreenings(payloads[3].runs || []);
      setTransfers(payloads[4].transfers || []);
      setReconciliations(payloads[5].runs || []);
      setLibraries(payloads[6].libraries || []);
      setConcepts(payloads[6].concepts || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "PV Compliance could not be loaded.");
    }
  }

  useEffect(() => { const timer = window.setTimeout(loadAll, 0); return () => window.clearTimeout(timer); }, []);

  async function openRecord(recordId) {
    setBusy(`record:${recordId}`);
    const response = await fetch(`/api/pv/records/${recordId}`, { cache: "no-store" });
    const data = await response.json();
    setBusy("");
    if (!response.ok || !data.ok) return setMessage(data.error || "Unable to open the PV record.");
    setSelectedRecord(data);
  }

  async function mutate(path, body, busyKey, success) {
    setBusy(busyKey); setMessage("");
    const response = await fetch(path, { method: body.method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body.payload) });
    const data = await response.json();
    setBusy("");
    if (!response.ok || !data.ok) { setMessage(data.error || "PV operation failed."); return null; }
    setMessage(success);
    await loadAll();
    return data;
  }

  const metricData = overview?.metrics || {};

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] via-white/[0.03] to-violet-400/[0.06] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2"><ToneBadge tone="complete">Human review required</ToneBadge><ToneBadge>Potential records, not AE determinations</ToneBadge></div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">PV Compliance Operations</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">A governed workflow for source screening, potential safety-content detection, structured review, sponsor transfer, provenance, clocks, and reconciliation. Conversational intelligence remains available separately for analysis.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs leading-5 text-white/45"><span className="font-medium text-white/70">North star:</span> every signal is explainable, every decision is retained, and every transfer is reconcilable.</div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="PV Compliance sections">
        {TABS.map(([id, text]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition ${tab === id ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"}`}>{text}</button>)}
      </div>

      {message ? <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100/75">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}<p className="mt-1 text-xs text-rose-200/60">Apply the PV Supabase migration before using persistent workflow features.</p></div> : null}

      {tab === "overview" ? <Overview metrics={metricData} statusCounts={overview?.statusCounts || {}} /> : null}
      {tab === "queue" ? <ReviewQueue records={records} selected={selectedRecord} busy={busy} onOpen={openRecord} onMutate={mutate} onRefreshRecord={openRecord} /> : null}
      {tab === "screening" ? <ScreeningStatus sources={sources} screenings={screenings} busy={busy} onMutate={mutate} /> : null}
      {tab === "transfers" ? <Transfers transfers={transfers} busy={busy} onMutate={mutate} /> : null}
      {tab === "reconciliation" ? <Reconciliation runs={reconciliations} busy={busy} onMutate={mutate} /> : null}
      {tab === "sources" ? <SourceRegistry sources={sources} busy={busy} onMutate={mutate} /> : null}
      {tab === "configuration" ? <Configuration libraries={libraries} concepts={concepts} busy={busy} onMutate={mutate} /> : null}
    </div>
  );
}

function Overview({ metrics, statusCounts }) {
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Screening compliance" value={`${metrics.screeningCompliance ?? 100}%`} detail="Sources screened within cadence" />
      <Metric label="Sources due" value={metrics.sourcesDue ?? 0} detail="Requires screening action" tone={metrics.sourcesDue ? "warning" : "neutral"} />
      <Metric label="Awaiting review" value={metrics.awaitingReview ?? 0} detail="New or in review" tone={metrics.awaitingReview ? "warning" : "neutral"} />
      <Metric label="Approaching SLA" value={metrics.approachingSla ?? 0} detail="80% or more of clock consumed" tone={metrics.approachingSla ? "danger" : "neutral"} />
      <Metric label="Transferred" value={metrics.transferred ?? 0} detail="Current operational period" />
      <Metric label="Unacknowledged" value={metrics.unacknowledged ?? 0} detail="Sponsor response pending" tone={metrics.unacknowledged ? "warning" : "neutral"} />
      <Metric label="Nil returns" value={metrics.nilReturns ?? 0} detail="Screened with zero potential records" />
      <Metric label="Reconciliation" value={`${metrics.reconciliationCompletion ?? 100}%`} detail="Objective: zero unexplained records" />
    </div>
    <Card title="PV record lifecycle" subtitle="Content never disappears when it is closed as not relevant.">
      <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">{["new", "in_review", "not_relevant", "ready_for_transfer", "transferred", "acknowledged", "reconciled"].map((status, index) => <div key={status} className="rounded-xl border border-white/10 bg-black/30 p-3"><p className="text-xs text-white/65">{label(status)}</p><p className="mt-2 text-xl font-semibold text-white">{statusCounts[status] || 0}</p>{index < 6 ? <p className="mt-1 text-[10px] text-white/20">Next governed state →</p> : null}</div>)}</div>
    </Card>
  </div>;
}

function ReviewQueue({ records, selected, busy, onOpen, onMutate, onRefreshRecord }) {
  return <div className="space-y-5"><Card title="Potential PV Review Queue" subtitle="Prioritized by detection context and compliance timing—not presented as confirmed adverse events.">
    {records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-white/10 text-white/35"><tr>{["Status", "Product", "Potential event", "Source", "Posted", "Identified", "Score", "Reviewer", ""].map((head) => <th key={head} className="px-3 py-3 font-medium">{head}</th>)}</tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-white/[0.06] text-white/60"><td className="px-3 py-3"><ToneBadge tone={record.status === "not_relevant" ? "neutral" : record.status === "acknowledged" || record.status === "reconciled" ? "complete" : "approaching"}>{label(record.status)}</ToneBadge></td><td className="px-3 py-3 text-white/80">{record.product_name || "Unresolved"}</td><td className="px-3 py-3">{record.potential_event || "Review required"}</td><td className="px-3 py-3">{record.source_type}</td><td className="px-3 py-3">{formatDate(record.posted_at)}</td><td className="px-3 py-3">{formatDate(record.identified_at)}</td><td className="px-3 py-3">{record.detection_score}</td><td className="px-3 py-3">{record.assigned_reviewer_id || "Unassigned"}</td><td className="px-3 py-3"><button type="button" onClick={() => onOpen(record.id)} disabled={busy === `record:${record.id}`} className="text-cyan-300 disabled:opacity-40">{busy === `record:${record.id}` ? "Opening…" : "Open"}</button></td></tr>)}</tbody></table></div> : <Empty>No potential PV records are awaiting review.</Empty>}
  </Card>{selected ? <RecordWorkbench key={selected.record.id} detail={selected} busy={busy} onMutate={onMutate} onRefresh={() => onRefreshRecord(selected.record.id)} /> : null}</div>;
}

function RecordWorkbench({ detail, busy, onMutate, onRefresh }) {
  const { record, clock, reviews, transfers, audit } = detail;
  const [productMention, setProductMention] = useState("unclear");
  const [healthExperience, setHealthExperience] = useState("unclear");
  const [selectedClasses, setSelectedClasses] = useState(record.proposed_classifications || []);
  const [rationale, setRationale] = useState("");
  const [destination, setDestination] = useState("");
  const [transferMethod, setTransferMethod] = useState("manual_export");
  const proposedOntology = record.ae_ontology || {};
  const [ontologyReview, setOntologyReview] = useState({
    productProcedure: proposedOntology.productProcedures?.[0]?.value || record.product_name || "",
    adverseEvent: proposedOntology.adverseEvents?.[0]?.value || record.potential_event || "",
    seriousness: proposedOntology.seriousness?.value || "unclear",
    outcome: proposedOntology.outcomes?.[0]?.category || "unknown",
    timeToOnset: proposedOntology.timeToOnset?.category || "unknown",
    timeToOnsetDetail: proposedOntology.timeToOnset?.value || "",
    severity: proposedOntology.severity?.value || "unclear",
    unexpectedness: proposedOntology.unexpectedness?.value || "unclear",
    causalityType: proposedOntology.causality?.[0]?.value || "temporal_association",
    causalityLanguage: proposedOntology.causality?.[0]?.phrase || "",
  });
  function validatedOntology() {
    return {
      ...proposedOntology,
      productProcedures: ontologyReview.productProcedure ? [{ value: ontologyReview.productProcedure, evidence: proposedOntology.productProcedures?.[0]?.evidence || "Reviewer confirmed", confidence: 1 }] : [],
      adverseEvents: ontologyReview.adverseEvent ? [{ value: ontologyReview.adverseEvent, evidence: proposedOntology.adverseEvents?.[0]?.evidence || "Reviewer confirmed", confidence: 1 }] : [],
      seriousness: { ...(proposedOntology.seriousness || {}), value: ontologyReview.seriousness, confidence: ontologyReview.seriousness === "unclear" ? 0 : 1 },
      outcomes: ontologyReview.outcome === "unknown" ? [] : [{ category: ontologyReview.outcome, value: ontologyReview.outcome, evidence: proposedOntology.outcomes?.[0]?.evidence || "Reviewer confirmed", confidence: 1 }],
      timeToOnset: { category: ontologyReview.timeToOnset, value: ontologyReview.timeToOnsetDetail || undefined, evidence: proposedOntology.timeToOnset?.evidence, confidence: ontologyReview.timeToOnset === "unknown" ? 0 : 1 },
      severity: { ...(proposedOntology.severity || {}), value: ontologyReview.severity, confidence: ontologyReview.severity === "unclear" ? 0 : 1 },
      unexpectedness: { ...(proposedOntology.unexpectedness || {}), value: ontologyReview.unexpectedness, confidence: ontologyReview.unexpectedness === "unclear" ? 0 : 1 },
      causality: ontologyReview.causalityLanguage ? [{ value: ontologyReview.causalityType, phrase: ontologyReview.causalityLanguage, evidence: ontologyReview.causalityLanguage, confidence: 1 }] : [],
      ontologyVersion: proposedOntology.ontologyVersion || record.ontology_version,
      reviewedByHuman: true,
    };
  }
  function toggleClassification(value) { setSelectedClasses((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }
  async function review(decision) {
    const data = await onMutate(`/api/pv/records/${record.id}`, { method: "PATCH", payload: { action: "review", productMention, healthExperience, classifications: selectedClasses, rationale, decision, ontologyReview: validatedOntology() } }, `review:${decision}`, decision === "escalate" ? "Record marked ready for sponsor transfer." : "Record retained and closed as not PV relevant.");
    if (data) onRefresh();
  }
  async function transfer() {
    const data = await onMutate(`/api/pv/records/${record.id}`, { method: "PATCH", payload: { action: "transfer", destination, transferMethod } }, "transfer", "Sponsor transfer package created with immutable payload hash.");
    if (data) onRefresh();
  }
  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <Card title={`PV Record ${record.id.slice(0, 8)}`} subtitle="Original evidence is immutable. Translations, review decisions, and workflow events are stored separately.">
        <div className="space-y-4"><div className="rounded-xl border border-white/10 bg-black/40 p-4"><div className="flex flex-wrap items-center gap-2"><ToneBadge>{record.source_type}</ToneBadge><ToneBadge>{record.original_language}</ToneBadge><ToneBadge tone={record.priority === "critical" ? "breached" : record.priority === "high" ? "approaching" : "neutral"}>{record.priority} priority</ToneBadge></div><blockquote className="mt-4 border-l-2 border-cyan-300/40 pl-4 text-sm leading-7 text-white/75">{record.original_verbatim}</blockquote><div className="mt-4 flex flex-wrap gap-4 text-xs text-white/35"><span>Posted {formatDate(record.posted_at)}</span><span>Ingested {formatDate(record.ingested_at)}</span><span>Identified {formatDate(record.identified_at)}</span><a href={record.source_url} target="_blank" rel="noreferrer" className="text-cyan-300">Open source ↗</a></div><p className="mt-3 break-all text-[10px] text-white/20">Evidence hash {record.evidence_hash}</p></div>
        <div className="grid gap-3 md:grid-cols-4"><Metric label="PV detection score" value={`${record.detection_score}/100`} /><Metric label="Product confidence" value={`${record.product_confidence}%`} /><Metric label="Health experience" value={`${record.health_experience_confidence}%`} /><Metric label="Evidence origin" value={label(record.data_origin || "unknown")} /></div>
        <ProposedOntology ontology={proposedOntology} />
        <div><p className="text-xs font-medium text-white/55">Why AskSocial surfaced this</p><div className="mt-2 space-y-2">{(record.detection_rationale || []).map((reason, index) => <p key={index} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/40">{reason}</p>)}</div></div>
        <div><p className="text-xs font-medium text-white/55">Matched concepts</p><div className="mt-2 flex flex-wrap gap-2">{(record.matched_concepts || []).map((match) => <ToneBadge key={`${match.conceptId}-${match.matchedTerm}`}>{label(match.category)} · {match.matchedTerm}</ToneBadge>)}</div></div></div>
      </Card>
      <Card title="Compliance clock" subtitle={`Clock stage: ${label(clock.stage)}`}><div className="rounded-2xl border border-white/10 bg-black/30 p-5"><div className="flex items-center justify-between"><ToneBadge tone={clock.state}>{label(clock.state)}</ToneBadge><span className="text-xs text-white/35">{clock.percentConsumed}% consumed</span></div><p className="mt-5 text-3xl font-semibold text-white">{Math.floor(clock.elapsedMinutes / 60)}h {clock.elapsedMinutes % 60}m</p><p className="mt-1 text-xs text-white/35">Elapsed in current stage</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${clock.state === "breached" ? "bg-rose-400" : clock.state === "approaching" ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, clock.percentConsumed)}%` }} /></div><dl className="mt-5 space-y-2 text-xs"><div className="flex justify-between"><dt className="text-white/35">Started</dt><dd className="text-white/65">{formatDate(clock.startedAt)}</dd></div><div className="flex justify-between"><dt className="text-white/35">Due</dt><dd className="text-white/65">{formatDate(clock.dueAt)}</dd></div><div className="flex justify-between"><dt className="text-white/35">Remaining</dt><dd className="text-white/65">{clock.remainingMinutes ?? 0} min</dd></div></dl></div></Card>
    </div>
    {!['transferred', 'acknowledged', 'reconciled'].includes(record.status) ? <PvOntologyReview value={ontologyReview} onChange={setOntologyReview} /> : null}
    {!["transferred", "acknowledged", "reconciled"].includes(record.status) ? <Card title="Structured human review" subtitle="AI proposes relevance; a qualified reviewer makes and documents the workflow decision."><div className="grid gap-5 xl:grid-cols-2"><div className="space-y-4"><DecisionSelect labelText="Does the content mention or reasonably imply a sponsor product?" value={productMention} onChange={setProductMention} /><DecisionSelect labelText="Does it describe a health experience or potential special situation?" value={healthExperience} onChange={setHealthExperience} /><div><p className="text-xs font-medium text-white/55">Classification</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{CLASSIFICATIONS.map((classification) => <label key={classification} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55"><input type="checkbox" checked={selectedClasses.includes(classification)} onChange={() => toggleClassification(classification)} />{label(classification)}</label>)}</div></div></div><div><label className="text-xs font-medium text-white/55">Reviewer rationale</label><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={9} placeholder="Document the evidence and reasoning supporting this decision." className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy.startsWith("review:") || !rationale.trim()} onClick={() => review("escalate")} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{busy === "review:escalate" ? "Saving…" : "Escalate to Sponsor"}</button><button type="button" disabled={busy.startsWith("review:") || !rationale.trim()} onClick={() => review("close_not_relevant")} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 disabled:opacity-40">Close as Not Relevant</button></div></div></div></Card> : null}
    {record.status === "ready_for_transfer" ? <Card title="Sponsor transfer service" subtitle="AskSocial constructs the handoff package from immutable evidence, review decisions, and provenance."><div className="grid gap-3 md:grid-cols-3"><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Sponsor destination" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none" /><select value={transferMethod} onChange={(event) => setTransferMethod(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"><option value="manual_export">Manual secure export</option><option value="secure_api">Secure API</option><option value="sftp">SFTP</option><option value="secure_email">Secure email</option></select><button type="button" disabled={busy === "transfer" || !destination.trim()} onClick={transfer} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{busy === "transfer" ? "Creating package…" : "Transfer to Sponsor"}</button></div></Card> : null}
    <div className="grid gap-5 xl:grid-cols-2"><Card title="Workflow history"><div className="space-y-2">{[...reviews.map((item) => ({ id: item.id, title: `Review: ${label(item.decision)}`, at: item.reviewed_at, detail: item.rationale })), ...transfers.map((item) => ({ id: item.id, title: `Transfer: ${label(item.status)}`, at: item.transferred_at || item.created_at, detail: `${item.transfer_method} to ${item.destination}` }))].sort((a, b) => new Date(b.at) - new Date(a.at)).map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="flex justify-between gap-3"><p className="text-xs font-medium text-white/65">{item.title}</p><p className="text-[11px] text-white/25">{formatDate(item.at)}</p></div><p className="mt-1 text-xs leading-5 text-white/35">{item.detail}</p></div>)}</div></Card><Card title="Audit / provenance chain"><div className="space-y-2">{audit.map((event) => <div key={event.id} className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="flex justify-between"><p className="text-xs text-white/65">{label(event.action)}</p><ToneBadge>{event.outcome}</ToneBadge></div><p className="mt-2 text-[10px] text-white/25">Actor {event.actor_id} · {formatDate(event.occurred_at)}</p><p className="mt-1 break-all text-[9px] text-white/15">{event.event_hash}</p></div>)}</div></Card></div>
  </div>;
}

function DecisionSelect({ labelText, value, onChange }) { return <fieldset><legend className="text-xs font-medium text-white/55">{labelText}</legend><div className="mt-2 flex gap-2">{["yes", "no", "unclear"].map((option) => <label key={option} className={`rounded-lg border px-3 py-2 text-xs ${value === option ? "border-white bg-white text-black" : "border-white/10 text-white/50"}`}><input className="sr-only" type="radio" value={option} checked={value === option} onChange={() => onChange(option)} />{label(option)}</label>)}</div></fieldset>; }

function ProposedOntology({ ontology }) {
  const fields = [
    ["Product / procedure", ontology.productProcedures?.map((item) => item.value).join(", ")],
    ["Adverse event", ontology.adverseEvents?.map((item) => item.value).join(", ")],
    ["Seriousness", ontology.seriousness?.value],
    ["Outcome", ontology.outcomes?.map((item) => item.category).join(", ")],
    ["Time to onset", ontology.timeToOnset?.value || ontology.timeToOnset?.category],
    ["Severity", ontology.severity?.value],
    ["Unexpectedness", ontology.unexpectedness?.value],
    ["Causality language", ontology.causality?.map((item) => item.phrase).join(", ")],
  ];
  return <div><p className="text-xs font-medium text-white/55">Proposed adverse-event ontology</p><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{fields.map(([name, value]) => <div key={name} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/25">{name}</p><p className="mt-1 text-xs text-white/60">{value ? label(value) : "Unclear"}</p></div>)}</div><p className="mt-2 text-[11px] leading-5 text-white/30">Machine-proposed fields support triage only. A qualified reviewer must confirm seriousness, expectedness, outcome, and reporter-attributed causality.</p></div>;
}

function PvOntologyReview({ value, onChange }) {
  function field(key) { return { value: value[key], onChange: (event) => onChange((current) => ({ ...current, [key]: event.target.value })) }; }
  return <Card title="Adverse-event ontology review" subtitle="Confirm or correct every extracted field against the verbatim and applicable reference label before escalation."><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><OntologyText labelText="Product / procedure" {...field("productProcedure")} /><OntologyText labelText="Adverse event" {...field("adverseEvent")} /><OntologySelect labelText="Seriousness" options={["unclear", "serious", "non_serious"]} {...field("seriousness")} /><OntologySelect labelText="Outcome" options={["unknown", "recovered", "ongoing", "hospitalization", "permanent_injury", "fatal"]} {...field("outcome")} /><OntologySelect labelText="Time to onset" options={["unknown", "immediate", "hours", "days", "weeks", "months"]} {...field("timeToOnset")} /><OntologyText labelText="Onset detail" {...field("timeToOnsetDetail")} /><OntologySelect labelText="Severity" options={["unclear", "mild", "moderate", "severe"]} {...field("severity")} /><OntologySelect labelText="Unexpectedness" options={["unclear", "expected_label_event", "emerging_signal"]} {...field("unexpectedness")} /><OntologySelect labelText="Causality type" options={["temporal_association", "possible_attribution", "reported_attribution", "denied"]} {...field("causalityType")} /><OntologyText labelText="Causality language" {...field("causalityLanguage")} /></div></Card>;
}

function OntologyText({ labelText, value, onChange }) { return <label className="text-xs text-white/40">{labelText}<input value={value} onChange={onChange} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" /></label>; }
function OntologySelect({ labelText, options, value, onChange }) { return <label className="text-xs text-white/40">{labelText}<select value={value} onChange={onChange} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">{options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</select></label>; }

function ScreeningStatus({ sources, screenings, busy, onMutate }) {
  const [sourceId, setSourceId] = useState("");
  const [items, setItems] = useState(0);
  const [potential, setPotential] = useState(0);
  const now = new Date().toISOString();
  async function submit(event) { event.preventDefault(); await onMutate("/api/pv/screenings", { payload: { sourceId, screenedFrom: new Date(Date.now() - 86400000).toISOString(), screenedUntil: now, itemsScreened: items, potentialRecords: potential, nilReturn: potential === 0 } }, "screening", "Screening run and nil-return status recorded."); }
  return <div className="space-y-5"><Card title="Screening Status" subtitle="Cadence is tied to the governed source registry; every completed run records records found or an explicit nil return."><div className="overflow-x-auto">{sources.length ? <table className="w-full min-w-[760px] text-left text-xs"><thead className="text-white/35"><tr>{["Source", "Ownership", "Cadence", "Products", "Markets", "Status"].map((item) => <th className="px-3 py-3" key={item}>{item}</th>)}</tr></thead><tbody>{sources.map((source) => <tr key={source.id} className="border-t border-white/[0.06] text-white/55"><td className="px-3 py-3 text-white/75">{source.name}</td><td className="px-3 py-3">{label(source.ownership_classification)}</td><td className="px-3 py-3">Every {source.cadence_minutes} min</td><td className="px-3 py-3">{source.products?.join(", ") || "—"}</td><td className="px-3 py-3">{source.markets?.join(", ") || "—"}</td><td className="px-3 py-3"><ToneBadge tone={source.active ? "healthy" : "neutral"}>{source.active ? "Active" : "Inactive"}</ToneBadge></td></tr>)}</tbody></table> : <Empty>Add a governed source before recording screening runs.</Empty>}</div></Card><Card title="Record screening outcome" subtitle="A nil return documents that the agreed source was screened and no content required PV review."><form onSubmit={submit} className="grid gap-3 md:grid-cols-4"><select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"><option value="">Select source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select><input type="number" min="0" value={items} onChange={(event) => setItems(Number(event.target.value))} placeholder="Items screened" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input type="number" min="0" value={potential} onChange={(event) => setPotential(Number(event.target.value))} placeholder="Potential records" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><button disabled={!sourceId || busy === "screening"} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{busy === "screening" ? "Recording…" : potential === 0 ? "Record nil return" : "Complete screening"}</button></form><div className="mt-5 space-y-2">{screenings.slice(0, 12).map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs"><div><p className="text-white/65">{run.pv_sources?.name || run.source_id}</p><p className="mt-1 text-white/30">{run.items_screened} screened · {run.potential_records} routed · {formatDate(run.completed_at)}</p></div><ToneBadge tone={run.status === "completed" ? "healthy" : "breached"}>{run.nil_return ? "Nil return" : label(run.status)}</ToneBadge></div>)}</div></Card></div>;
}

function Transfers({ transfers, busy, onMutate }) {
  const [references, setReferences] = useState({});
  async function acknowledge(transfer) { await onMutate(`/api/pv/transfers/${transfer.id}`, { method: "PATCH", payload: { acknowledgmentReference: references[transfer.id] || "" } }, `ack:${transfer.id}`, "Sponsor acknowledgment recorded and linked to the transfer package."); }
  return <Card title="Sponsor Transfers" subtitle="Payloads are versioned and hash-verified; acknowledgment completes the dual-record handoff loop.">{transfers.length ? <div className="space-y-3">{transfers.map((transfer) => <div key={transfer.id} className="rounded-xl border border-white/10 bg-black/30 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="text-sm font-medium text-white/75">{transfer.pv_records?.product_name || "PV record"} · {transfer.pv_records?.potential_event || "Potential event"}</p><ToneBadge tone={transfer.status === "acknowledged" ? "complete" : transfer.status === "failed" ? "breached" : "approaching"}>{label(transfer.status)}</ToneBadge></div><p className="mt-2 text-xs text-white/35">{label(transfer.transfer_method)} to {transfer.destination} · {formatDate(transfer.transferred_at || transfer.created_at)}</p><p className="mt-2 break-all text-[10px] text-white/20">Payload hash {transfer.payload_hash}</p></div>{transfer.status === "delivered" ? <div className="flex gap-2"><input value={references[transfer.id] || ""} onChange={(event) => setReferences((current) => ({ ...current, [transfer.id]: event.target.value }))} placeholder="Sponsor acknowledgment ID" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white" /><button type="button" onClick={() => acknowledge(transfer)} disabled={busy === `ack:${transfer.id}` || !(references[transfer.id] || "").trim()} className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-40">Acknowledge</button></div> : null}</div></div>)}</div> : <Empty>No sponsor transfer packages have been created.</Empty>}</Card>;
}

function Reconciliation({ runs, busy, onMutate }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const bounds = useMemo(() => { const start = new Date(`${month}-01T00:00:00.000Z`); const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999)); return { start: start.toISOString(), end: end.toISOString() }; }, [month]);
  return <div className="space-y-5"><Card title="Monthly Reconciliation" subtitle="Compare detected and reviewed records against transfers, acknowledgments, screening runs, and nil returns." actions={<ToneBadge tone="complete">Objective: zero unexplained records</ToneBadge>}><div className="flex flex-wrap items-end gap-3"><label className="text-xs text-white/45">Reconciliation month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-2 block rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" /></label><button type="button" onClick={() => onMutate("/api/pv/reconciliation", { payload: { periodStart: bounds.start, periodEnd: bounds.end } }, "reconcile", "Reconciliation completed and exceptions were retained for resolution.")} disabled={busy === "reconcile"} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{busy === "reconcile" ? "Reconciling…" : "Run reconciliation"}</button></div></Card><Card title="Reconciliation history">{runs.length ? <div className="grid gap-3 md:grid-cols-2">{runs.map((run) => <div key={run.id} className="rounded-xl border border-white/10 bg-black/30 p-4"><div className="flex justify-between"><div><p className="text-sm text-white/75">{new Date(run.period_start).toLocaleDateString()} – {new Date(run.period_end).toLocaleDateString()}</p><p className="mt-1 text-xs text-white/30">Prepared by {run.prepared_by}</p></div><ToneBadge tone={run.status === "reconciled" || run.status === "approved" ? "complete" : "approaching"}>{label(run.status)}</ToneBadge></div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><div><p className="text-lg text-white">{run.record_count}</p><p className="text-[10px] text-white/30">Records</p></div><div><p className="text-lg text-white">{run.transfer_count}</p><p className="text-[10px] text-white/30">Transfers</p></div><div><p className="text-lg text-white">{run.acknowledgment_count}</p><p className="text-[10px] text-white/30">Ack.</p></div><div><p className="text-lg text-white">{run.issue_count}</p><p className="text-[10px] text-white/30">Issues</p></div></div></div>)}</div> : <Empty>No reconciliation periods have been run.</Empty>}</Card></div>;
}

function SourceRegistry({ sources, busy, onMutate }) {
  const [form, setForm] = useState({ name: "", sourceType: "social", sourceUrl: "", ownershipClassification: "controlled", sponsorName: "", businessOwner: "", products: "", markets: "US", languages: "en", cadenceMinutes: 1440 });
  function field(key) { return { value: form[key], onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value })) }; }
  async function submit(event) { event.preventDefault(); const data = await onMutate("/api/pv/sources", { payload: { ...form, cadenceMinutes: Number(form.cadenceMinutes), products: form.products.split(",").map((item) => item.trim()).filter(Boolean), markets: form.markets.split(",").map((item) => item.trim()).filter(Boolean), languages: form.languages.split(",").map((item) => item.trim()).filter(Boolean) } }, "source", "Source added to the governed PV monitoring scope."); if (data) setForm((current) => ({ ...current, name: "", sourceUrl: "" })); }
  return <div className="space-y-5"><Card title="Authoritative Source Registry" subtitle="The governed answer to exactly what AskSocial agreed to monitor, for whom, where, and how often.">{sources.length ? <div className="grid gap-3 lg:grid-cols-2">{sources.map((source) => <div key={source.id} className="rounded-xl border border-white/10 bg-black/30 p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium text-white/75">{source.name}</p><p className="mt-1 text-xs text-white/30">{source.source_type} · {label(source.ownership_classification)}</p></div><ToneBadge tone={source.active ? "healthy" : "neutral"}>{source.active ? "Active" : "Inactive"}</ToneBadge></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-white/25">Sponsor</dt><dd className="mt-1 text-white/55">{source.sponsor_name || "—"}</dd></div><div><dt className="text-white/25">Business owner</dt><dd className="mt-1 text-white/55">{source.business_owner || "—"}</dd></div><div><dt className="text-white/25">Products</dt><dd className="mt-1 text-white/55">{source.products?.join(", ") || "—"}</dd></div><div><dt className="text-white/25">Cadence</dt><dd className="mt-1 text-white/55">Every {source.cadence_minutes} min</dd></div></dl></div>)}</div> : <Empty>No governed PV sources have been registered.</Empty>}</Card><Card title="Register source" subtitle="Scope changes are auditable and should be approved through sponsor governance."><form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input {...field("name")} placeholder="Source name" required className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input {...field("sourceUrl")} placeholder="Source URL" required className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input {...field("sponsorName")} placeholder="Sponsor" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input {...field("businessOwner")} placeholder="Business owner" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input {...field("products")} placeholder="Products, comma separated" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input {...field("markets")} placeholder="Markets" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><select {...field("ownershipClassification")} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"><option value="controlled">Controlled</option><option value="owned">Owned</option><option value="discovered">Discovered</option></select><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white/40">Cadence <input type="number" min="1" {...field("cadenceMinutes")} className="w-24 bg-transparent text-sm text-white" /> min</label><button disabled={busy === "source"} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{busy === "source" ? "Registering…" : "Register source"}</button></form></Card></div>;
}

function Configuration({ libraries, concepts, busy, onMutate }) {
  const [libraryForm, setLibraryForm] = useState({ name: "", sponsorName: "", productId: "", market: "US", language: "en", detectionThreshold: 55, expectedEventTerms: "" });
  const [conceptForm, setConceptForm] = useState({ libraryId: "", category: "product", canonicalTerm: "", terms: "", exclusions: "", language: "en", market: "US", weight: 60 });
  function libraryField(key) { return { value: libraryForm[key], onChange: (event) => setLibraryForm((current) => ({ ...current, [key]: event.target.value })) }; }
  function conceptField(key) { return { value: conceptForm[key], onChange: (event) => setConceptForm((current) => ({ ...current, [key]: event.target.value })) }; }
  return <div className="space-y-5"><Card title="PV Detection Library" subtitle="Configured concepts trigger evaluation—not an adverse-event determination. Active libraries require controlled approval and version history.">{libraries.length ? <div className="grid gap-3 md:grid-cols-2">{libraries.map((library) => <div key={library.id} className="rounded-xl border border-white/10 bg-black/30 p-4"><div className="flex justify-between"><div><p className="text-sm text-white/75">{library.name}</p><p className="mt-1 text-xs text-white/30">{library.sponsor_name || "No sponsor"} · {library.market || "All markets"} · {library.language}</p></div><ToneBadge tone={library.status === "active" ? "healthy" : "neutral"}>{label(library.status)} v{library.version}</ToneBadge></div><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-white/40">Detection threshold {library.detection_threshold}/100 · {concepts.filter((concept) => concept.library_id === library.id).length} concepts · {library.expected_event_terms?.length || 0} expected label events</p>{library.status === "draft" ? <button type="button" onClick={() => onMutate("/api/pv/library", { method: "PATCH", payload: { action: "activate", libraryId: library.id } }, `activate:${library.id}`, "PV Detection Library approved and activated.")} disabled={busy === `activate:${library.id}`} className="text-xs text-cyan-300 disabled:opacity-40">Approve & activate</button> : null}</div></div>)}</div> : <Empty>Create a sponsor-specific detection library to begin configuration.</Empty>}</Card><div className="grid gap-5 xl:grid-cols-2"><Card title="Create detection library"><form onSubmit={(event) => { event.preventDefault(); onMutate("/api/pv/library", { payload: { ...libraryForm, expectedEventTerms: libraryForm.expectedEventTerms.split(",").map((item) => item.trim()).filter(Boolean), detectionThreshold: Number(libraryForm.detectionThreshold) } }, "library", "PV Detection Library created in draft status."); }} className="space-y-3"><input {...libraryField("name")} placeholder="Library name" required className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><div className="grid gap-3 sm:grid-cols-2"><input {...libraryField("sponsorName")} placeholder="Sponsor" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input {...libraryField("productId")} placeholder="Product identifier" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input {...libraryField("market")} placeholder="Market" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white/40">Threshold <input type="number" min="1" max="100" {...libraryField("detectionThreshold")} className="w-16 bg-transparent text-white" /></label></div><input {...libraryField("expectedEventTerms")} placeholder="Expected label events, comma separated" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><p className="text-[11px] leading-5 text-white/30">Versioned label references support expectedness proposals. Without one, expectedness remains unclear unless explicitly described.</p><button disabled={busy === "library"} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">Create library</button></form></Card><Card title="Add detection concept"><form onSubmit={(event) => { event.preventDefault(); onMutate("/api/pv/library", { payload: { resource: "concept", ...conceptForm, weight: Number(conceptForm.weight), terms: conceptForm.terms.split(",").map((item) => item.trim()).filter(Boolean), exclusions: conceptForm.exclusions.split(",").map((item) => item.trim()).filter(Boolean) } }, "concept", "Detection concept added with versioned provenance."); }} className="space-y-3"><select {...conceptField("libraryId")} required className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"><option value="">Select detection library</option>{libraries.map((library) => <option value={library.id} key={library.id}>{library.name}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><select {...conceptField("category")} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white">{["product", "adverse_experience", "severity", "treatment_change", "lack_of_efficacy", "medication_error", "overdose", "pregnancy", "misuse_abuse", "product_quality"].map((category) => <option key={category} value={category}>{label(category)}</option>)}</select><input {...conceptField("canonicalTerm")} placeholder="Canonical term" required className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /></div><input {...conceptField("terms")} placeholder="Terms, synonyms, misspellings, phrases" required className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input {...conceptField("exclusions")} placeholder="Exclusion phrases" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><label className="flex items-center gap-2 text-xs text-white/40">Severity weight <input type="number" min="0" max="100" {...conceptField("weight")} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-white" /></label><button disabled={busy === "concept"} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">Add concept</button></form></Card></div><Card title="Configured concepts">{concepts.length ? <div className="grid gap-2 md:grid-cols-2">{concepts.map((concept) => <div key={concept.id} className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="flex justify-between"><p className="text-xs font-medium text-white/65">{concept.canonical_term}</p><ToneBadge>{label(concept.category)}</ToneBadge></div><p className="mt-2 text-xs text-white/35">{concept.terms?.join(", ")}</p>{concept.exclusions?.length ? <p className="mt-1 text-[11px] text-rose-300/50">Excludes: {concept.exclusions.join(", ")}</p> : null}</div>)}</div> : <Empty>No detection concepts configured.</Empty>}</Card></div>;
}
