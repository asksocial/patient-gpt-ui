"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Tooltip from "./ui/Tooltip";

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

const AE_ONTOLOGY_OPTIONS = {
  seriousness: ["unclear", "serious", "non_serious"],
  outcome: ["unknown", "recovered", "ongoing", "hospitalization", "permanent_injury", "fatal"],
  timeToOnset: ["unknown", "immediate", "hours", "days", "weeks", "months"],
  severity: ["unclear", "mild", "moderate", "severe"],
  unexpectedness: ["unclear", "expected_label_event", "emerging_signal"],
  causalityLanguage: ["", "after", "following", "possibly due to", "think it was from", "caused by", "related to", "worsened after", "no relationship reported"],
};

const PV_LIFECYCLE_TOOLTIPS = {
  new: "Potential PV content detected by AskSocial and waiting for a qualified reviewer to begin assessment.",
  in_review: "A qualified reviewer has started assessing the evidence, classifications, and adverse-event ontology.",
  not_relevant: "The reviewer determined that the content does not require PV escalation. The record and rationale remain retained.",
  ready_for_transfer: "The reviewer confirmed that the record should be prepared for governed sponsor handoff.",
  transferred: "A versioned handoff package has been sent to the sponsor and is awaiting acknowledgment.",
  acknowledged: "The sponsor confirmed receipt and the acknowledgment reference is retained with the transfer.",
  reconciled: "The record has been accounted for in reconciliation with no unresolved workflow discrepancy.",
};

const PV_REVIEW_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;
const PV_SCORE_TOOLTIP = "AskSocial’s 0–100 screening score combines product-reference and health-experience signals to prioritize qualified human review. It is not an adverse-event determination or a measure of clinical seriousness.";
const PV_QUEUE_HEADERS = [
  { key: "status", label: "Status" },
  { key: "product", label: "Product" },
  { key: "event", label: "Potential event" },
  { key: "mention", label: "Full mention" },
  { key: "source", label: "Source" },
  { key: "publication", label: "Publication timestamp", tooltip: "When the author originally posted the mention online. This preserves source chronology and does not govern day zero for this external-platform workflow." },
  { key: "collection", label: "Collection timestamp", tooltip: "When the listening system accessed or ingested the mention, establishing when the ODCS acquired the content." },
  { key: "algorithm", label: "Algorithm timestamp", tooltip: "When AskSocial’s automated processing flagged and classified the mention for potential PV review." },
  { key: "review", label: "Review timestamp", tooltip: "When the MAH or authorized third party identified the potential AE/ADR with enough information to assess reporting criteria. This timestamp starts the day-zero clock." },
  { key: "escalation", label: "Escalation timestamp", tooltip: "When the information was escalated into the designated PV workflow, documenting the vendor-to-PV handoff." },
  { key: "day-zero", label: "Day-zero clock", tooltip: "The remaining time in the 15-day triage window, calculated from the Review timestamp." },
  { key: "score", label: "Score" },
  { key: "reviewer", label: "Reviewer" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function evidenceOriginLabel(record) {
  return record.import_batch_id ? "Social" : label(record.data_origin || "unknown");
}

function sourceLabel(record) {
  const sourceType = String(record.source_type || "").toLowerCase();
  return record.import_batch_id || sourceType === "csv" || sourceType.endsWith("_csv")
    ? "Social"
    : label(record.source_type || "unknown");
}

function reviewCountdown(record, nowMs) {
  if (typeof nowMs !== "number") return { label: "Calculating…", tone: "neutral" };
  const reviewTimestamp = new Date(record.review_timestamp || "").getTime();
  if (Number.isNaN(reviewTimestamp)) return { label: "Not started", tone: "neutral" };
  if (["not_relevant", "ready_for_transfer", "transferred", "acknowledged", "reconciled"].includes(record.status)) {
    return { label: "Triaged", tone: "complete" };
  }
  const millisecondsRemaining = reviewTimestamp + PV_REVIEW_WINDOW_MS - nowMs;
  const totalMinutes = Math.max(0, Math.ceil(Math.abs(millisecondsRemaining) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (millisecondsRemaining <= 0) return { label: `Overdue · ${hours}h ${minutes}m`, tone: "breached" };
  return {
    label: `${hours}h ${minutes}m left`,
    tone: millisecondsRemaining <= 24 * 60 * 60 * 1000 ? "approaching" : "healthy",
  };
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

function Metric({ label: metricLabel, value, detail, tooltip, tone = "neutral" }) {
  const border = tone === "warning" ? "border-amber-400/20 bg-amber-400/[0.05]" : tone === "danger" ? "border-rose-400/20 bg-rose-400/[0.05]" : "border-white/10 bg-black/30";
  return <div className={`rounded-2xl border p-4 ${border}`}><div className="text-xs text-white/40">{tooltip ? <Tooltip content={tooltip} delay={200} side="bottom" align="start"><button type="button" aria-label={`${metricLabel}: ${tooltip}`} className="inline-flex cursor-help items-center gap-1.5 text-left transition-colors hover:text-white/65 focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-cyan-400/60"><span>{metricLabel}</span><span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/50">?</span></button></Tooltip> : metricLabel}</div><p className="mt-2 text-2xl font-semibold text-white">{value}</p>{detail ? <p className="mt-1 text-xs text-white/30">{detail}</p> : null}</div>;
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-white/35">{children}</div>;
}

export default function PvComplianceCenter({ initialTab = "overview", therapeuticArea = "", workspaceId = "", workspaces = [], onRefreshWorkspaces }) {
  const [tab, setTab] = useState(initialTab);
  const [overview, setOverview] = useState(null);
  const [records, setRecords] = useState([]);
  const [sources, setSources] = useState([]);
  const [screenings, setScreenings] = useState([]);
  const [reviewLists, setReviewLists] = useState([]);
  const [sponsorCases, setSponsorCases] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const endpoints = ["overview", "records", "sources", "screenings", "transfers", "reconciliation", "library", "review-lists", "sponsor-reports"];
      const scopedEndpoints = new Set(["overview", "records", "review-lists", "sponsor-reports"]);
      const scope = therapeuticArea ? `?therapeuticArea=${encodeURIComponent(therapeuticArea)}` : "";
      const responses = await Promise.all(endpoints.map((endpoint) => fetch(`/api/pv/${endpoint}${scopedEndpoints.has(endpoint) ? scope : ""}`, { cache: "no-store" })));
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
      setReviewLists(payloads[7].lists || []);
      setSponsorCases(payloads[8].cases || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "PV Compliance could not be loaded.");
    }
  }, [therapeuticArea]);

  useEffect(() => { const timer = window.setTimeout(loadAll, 0); return () => window.clearTimeout(timer); }, [loadAll]);

  async function openRecord(recordId) {
    setBusy(`record:${recordId}`);
    const response = await fetch(`/api/pv/records/${recordId}`, { cache: "no-store" });
    const data = await response.json();
    setBusy("");
    if (!response.ok || !data.ok) return setMessage(data.error || "Unable to open the PV record.");
    setSelectedRecord(data);
  }

  function continueStructuredReview() {
    setTab("screening");
    window.setTimeout(() => document.getElementById("pv-screening-structured-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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
      {tab === "queue" ? <ReviewQueue therapeuticArea={therapeuticArea} workspaceId={workspaceId} workspaces={workspaces} onRefreshWorkspaces={onRefreshWorkspaces} records={records} reviewLists={reviewLists} selected={selectedRecord} busy={busy} onOpen={openRecord} onContinueReview={continueStructuredReview} onMutate={mutate} /> : null}
      {tab === "screening" ? <ScreeningStatus therapeuticArea={therapeuticArea} sponsorCases={sponsorCases} sources={sources} screenings={screenings} selected={selectedRecord} busy={busy} onMutate={mutate} onRefreshRecord={openRecord} onReturnToQueue={() => setTab("queue")} /> : null}
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
      <Metric label="Flagged records" value={metrics.totalRecords ?? 0} detail="All potential PV records" tooltip="Every potential PV record detected within the selected therapeutic area, across all current lifecycle states. These are screening candidates and not confirmed adverse events." />
      <Metric label="Human review completed" value={metrics.reviewedRecords ?? 0} detail="Escalated or closed records" tooltip="Unique records with a retained human-review decision, including records escalated for sponsor transfer and records closed as not relevant." />
      <Metric label="Screening compliance" value={`${metrics.screeningCompliance ?? 100}%`} detail="Records assigned or reviewed" tooltip="The percentage of all flagged records that have either been assigned for qualified human review or already received a retained human-review decision." />
      <Metric label="Unassigned records with active clocks" value={metrics.unassignedActiveClock ?? 0} detail="Not reviewed or assigned" tooltip="Potential adverse-event records whose day-zero review clock is still active and that have neither received a human-review decision nor been assigned through a governed review list." tone={metrics.unassignedActiveClock ? "warning" : "neutral"} />
      <Metric label="Potential records awaiting human review" value={metrics.awaitingReview ?? 0} detail="New or in review" tooltip="All unreviewed potential PV records currently in New or In Review status, whether unassigned or already assigned to a reviewer. These are candidates for qualified human assessment, not confirmed adverse events." tone={metrics.awaitingReview ? "warning" : "neutral"} />
      <Metric label="Approaching SLA" value={metrics.approachingSla ?? 0} detail="At risk or breached" tooltip="Open records whose current review, transfer, or acknowledgment clock has consumed at least 80% of its configured allowance, including breached clocks." tone={metrics.approachingSla ? "danger" : "neutral"} />
      <Metric label="Transferred" value={metrics.transferred ?? 0} detail="Sponsor handoff completed" tooltip="Unique records with a delivered sponsor handoff. The count remains intact after sponsor acknowledgment or reconciliation instead of disappearing as the lifecycle advances." />
      <Metric label="Unacknowledged" value={metrics.unacknowledged ?? 0} detail="Sponsor response pending" tooltip="Transferred PV records for which AskSocial has not yet recorded the sponsor's receipt acknowledgment." tone={metrics.unacknowledged ? "warning" : "neutral"} />
      <Metric label="Nil returns" value={metrics.nilReturns ?? 0} detail="Screened with zero potential records" tooltip="Completed screening runs that found no content requiring PV review. Nil returns document that the scheduled screening still occurred." />
      <Metric label="Reconciliation" value={`${metrics.reconciliationCompletion ?? 100}%`} detail="Objective: zero unexplained records" tooltip="The percentage of PV records accounted for through reconciliation. The operational objective is no unexplained difference between detected, reviewed, transferred, and acknowledged records." />
    </div>
    <Card title="PV record lifecycle" subtitle="Content never disappears when it is closed as not relevant.">
      <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">{["new", "in_review", "not_relevant", "ready_for_transfer", "transferred", "acknowledged", "reconciled"].map((status, index) => <div key={status} className="rounded-xl border border-white/10 bg-black/30 p-3"><Tooltip content={PV_LIFECYCLE_TOOLTIPS[status]} delay={200} side="bottom" align="start"><button type="button" aria-label={`${label(status)}: ${PV_LIFECYCLE_TOOLTIPS[status]}`} className="inline-flex cursor-help items-center gap-1.5 text-left text-xs text-white/65 transition-colors hover:text-white focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-cyan-400/60"><span>{label(status)}</span><span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/50">?</span></button></Tooltip><p className="mt-2 text-xl font-semibold text-white">{statusCounts[status] || 0}</p>{index < 6 ? <p className="mt-1 text-[10px] text-white/20">Next governed state →</p> : null}</div>)}</div>
    </Card>
  </div>;
}

function ReviewQueue({ therapeuticArea, workspaceId, workspaces, onRefreshWorkspaces, records, reviewLists, selected, busy, onOpen, onContinueReview, onMutate }) {
  const pageSize = 20;
  const pendingRecords = useMemo(() => records.filter((record) => ["new", "in_review"].includes(record.status)), [records]);
  const writableWorkspaces = useMemo(
    () => workspaces.filter((workspace) => !workspace.archivedAt && workspace.role !== "viewer"),
    [workspaces]
  );
  const initialWorkspaceId = writableWorkspaces.some((workspace) => workspace.id === workspaceId)
    ? workspaceId
    : writableWorkspaces[0]?.id || "";
  const [page, setPage] = useState(1);
  const [scoreSortDirection, setScoreSortDirection] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [listWorkspaceId, setListWorkspaceId] = useState(initialWorkspaceId);
  const [listAssignments, setListAssignments] = useState({});
  const [shareEmails, setShareEmails] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [nowMs, setNowMs] = useState(null);
  const sortedRecords = useMemo(() => {
    if (!scoreSortDirection) return pendingRecords;
    const direction = scoreSortDirection === "desc" ? -1 : 1;
    return [...pendingRecords].sort((left, right) => {
      const leftScore = Number(left.detection_score);
      const rightScore = Number(right.detection_score);
      const leftHasScore = left.detection_score !== null && left.detection_score !== undefined && left.detection_score !== "" && Number.isFinite(leftScore);
      const rightHasScore = right.detection_score !== null && right.detection_score !== undefined && right.detection_score !== "" && Number.isFinite(rightScore);
      if (!leftHasScore && !rightHasScore) return 0;
      if (!leftHasScore) return 1;
      if (!rightHasScore) return -1;
      return (leftScore - rightScore) * direction;
    });
  }, [pendingRecords, scoreSortDirection]);
  const pageCount = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const availableRecordIds = useMemo(() => new Set(pendingRecords.map((record) => record.id)), [pendingRecords]);
  const validSelectedIds = selectedIds.filter((id) => availableRecordIds.has(id));
  const pageRecords = sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageIds = pageRecords.map((record) => record.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => validSelectedIds.includes(id));

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  function openMention(recordId) { setPreviewOpen(true); onOpen(recordId); }
  function sortByScore() {
    setScoreSortDirection((current) => current === "desc" ? "asc" : "desc");
    setPage(1);
  }
  function toggleRecord(recordId) { setSelectedIds((current) => current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]); }
  function togglePage() {
    setSelectedIds((current) => allPageSelected
      ? current.filter((id) => !pageIds.includes(id))
      : [...new Set([...current, ...pageIds])]);
  }
  async function openSaveDialog() {
    if (!validSelectedIds.length) return;
    const refreshedWorkspaces = typeof onRefreshWorkspaces === "function" ? await onRefreshWorkspaces() : null;
    const currentWorkspaces = refreshedWorkspaces || workspaces;
    const currentWritableWorkspaces = currentWorkspaces.filter((workspace) => !workspace.archivedAt && workspace.role !== "viewer");
    const currentWorkspaceId = currentWritableWorkspaces.some((workspace) => workspace.id === workspaceId)
      ? workspaceId
      : currentWritableWorkspaces[0]?.id || "";
    setListWorkspaceId(currentWritableWorkspaces.some((workspace) => workspace.id === listWorkspaceId) ? listWorkspaceId : currentWorkspaceId);
    setSaveOpen(true);
  }
  async function createList(event) {
    event.preventDefault();
    const generatedName = `${therapeuticArea || "PV"} review list · ${new Date().toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
    const data = await onMutate(
      "/api/pv/review-lists",
      { payload: { name: generatedName, workspaceId: listWorkspaceId, therapeuticArea, recordIds: validSelectedIds } },
      "review-list:create",
      "Selected mentions saved to the chosen workspace as a governed PV review list."
    );
    if (data) {
      setSelectedIds([]);
      setSaveOpen(false);
    }
  }
  async function assignList(list) {
    await onMutate(`/api/pv/review-lists/${list.id}`, { method: "PATCH", payload: { assignedTo: listAssignments[list.id] ?? list.assigned_to ?? "" } }, `review-list:assign:${list.id}`, "PV review list assignment saved.");
  }
  async function shareList(list) {
    const email = String(shareEmails[list.id] || "").trim();
    const data = await onMutate(`/api/pv/review-lists/${list.id}`, { method: "PATCH", payload: { sharedEmail: email } }, `review-list:share:${list.id}`, "Email share recorded in the PV audit trail.");
    if (data) {
      const subject = encodeURIComponent(`AskSocial PV review list: ${list.name}`);
      const body = encodeURIComponent(`${list.name} contains ${list.items?.length || 0} potential PV mentions for ${list.therapeutic_area}.\n\nOpen AskSocial Workspaces to review the governed list: ${window.location.origin}/workspace`);
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
    }
  }

  return <div className="space-y-5">
    {saveOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Save PV review list" onMouseDown={(event) => { if (event.target === event.currentTarget && busy !== "review-list:create") setSaveOpen(false); }}>
        <form onSubmit={createList} className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#080808] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs uppercase tracking-[0.16em] text-cyan-300/70">Save review list</p><p className="mt-2 text-sm text-white/45">{validSelectedIds.length} selected mentions will be saved together in the chosen workspace.</p></div>
            <button type="button" onClick={() => setSaveOpen(false)} disabled={busy === "review-list:create"} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 disabled:opacity-40">Close</button>
          </div>
          <label className="mt-6 block text-xs font-medium text-white/55" htmlFor="pv-review-list-workspace">Save to workspace</label>
          <select id="pv-review-list-workspace" autoFocus value={listWorkspaceId} onChange={(event) => setListWorkspaceId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white">
            <option value="">Select a workspace</option>
            {writableWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          {!writableWorkspaces.length ? <p className="mt-2 text-xs text-amber-200/70">Create a workspace before saving a list</p> : null}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setSaveOpen(false)} disabled={busy === "review-list:create"} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/55 disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={!listWorkspaceId || busy === "review-list:create"} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{busy === "review-list:create" ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    ) : null}

    {selected && previewOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Full PV mention"><div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/15 bg-[#080808] p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-cyan-300/70">Full mention</p><h2 className="mt-2 text-xl font-semibold text-white">{selected.record.product_name || "Potential PV record"} · {selected.record.potential_event || "Review required"}</h2></div><button type="button" onClick={() => setPreviewOpen(false)} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60">Close</button></div><blockquote className="mt-5 whitespace-pre-wrap border-l-2 border-cyan-300/40 pl-4 text-sm leading-7 text-white/75">{selected.record.original_verbatim}</blockquote><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Original post date" value={formatDate(selected.record.posted_at)} /><Metric label="Content available to AskSocial" value={formatDate(selected.record.identified_at)} /><Metric label="Detection score" value={`${selected.record.detection_score}/100`} /></div><div className="mt-5 flex flex-wrap gap-3">{String(selected.record.source_url || "").startsWith("http") ? <a href={selected.record.source_url} target="_blank" rel="noreferrer" className="cursor-pointer rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] px-4 py-2.5 text-sm font-semibold text-cyan-300">Open original source ↗</a> : null}<button type="button" onClick={() => { setPreviewOpen(false); onContinueReview(); }} className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black">Continue to structured review</button></div></div></div> : null}

    <Card title="Potential PV Review Queue" subtitle="Click any mention to view the full source text. Select multiple mentions across pages to save a governed aggregate review list.">
      {pendingRecords.length ? <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2100px] text-left text-xs">
            <thead className="border-b border-white/10 text-white/35">
              <tr>
                <th className="px-3 py-3">
                  <input type="checkbox" aria-label="Select all PV mentions on this page" checked={allPageSelected} onChange={togglePage} />
                </th>
                {PV_QUEUE_HEADERS.map((head) => (
                  <th
                    key={head.key}
                    className="px-3 py-3 font-medium"
                    aria-sort={head.key === "score" ? scoreSortDirection === "desc" ? "descending" : scoreSortDirection === "asc" ? "ascending" : "none" : undefined}
                  >
                    {head.key === "score" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={sortByScore}
                          aria-label={`Sort by score ${scoreSortDirection === "desc" ? "lowest to highest" : "highest to lowest"}`}
                          className="inline-flex cursor-pointer items-center gap-1 text-left transition-colors hover:text-cyan-200 focus:outline-none focus-visible:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                        >
                          <span>Score</span>
                          <span aria-hidden="true" className={scoreSortDirection ? "text-cyan-300" : "text-white/30"}>
                            {scoreSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        </button>
                        <Tooltip content={PV_SCORE_TOOLTIP} delay={200} side="bottom" align="start">
                          <button type="button" aria-label={`About score: ${PV_SCORE_TOOLTIP}`} className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/20 text-[10px] text-white/50 transition-colors hover:text-white focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-cyan-400/60">?</button>
                        </Tooltip>
                      </div>
                    ) : head.tooltip ? (
                      <Tooltip content={head.tooltip} delay={200} side="bottom" align="start">
                        <button type="button" aria-label={`${head.label}: ${head.tooltip}`} className="inline-flex cursor-help items-center gap-1.5 text-left transition-colors hover:text-white/65 focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-cyan-400/60">
                          <span>{head.label}</span>
                          <span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/50">?</span>
                        </button>
                      </Tooltip>
                    ) : head.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRecords.map((record) => {
                const countdown = reviewCountdown(record, nowMs);
                return <tr key={record.id} className={`border-b border-white/[0.06] text-white/60 ${selectedIds.includes(record.id) ? "bg-cyan-400/[0.05]" : ""}`}><td className="px-3 py-3"><input type="checkbox" aria-label={`Select mention ${record.id}`} checked={selectedIds.includes(record.id)} onChange={() => toggleRecord(record.id)} /></td><td className="px-3 py-3"><ToneBadge tone={record.status === "not_relevant" ? "neutral" : record.status === "acknowledged" || record.status === "reconciled" ? "complete" : "approaching"}>{label(record.status)}</ToneBadge></td><td className="px-3 py-3 text-white/80">{record.product_name || "Unresolved"}</td><td className="px-3 py-3">{record.potential_event || "Review required"}</td><td className="max-w-[360px] px-3 py-3"><button type="button" onClick={() => openMention(record.id)} disabled={busy === `record:${record.id}`} className="line-clamp-3 cursor-pointer text-left leading-5 text-cyan-100/65 hover:text-cyan-200 disabled:opacity-40">{busy === `record:${record.id}` ? "Opening full mention…" : record.original_verbatim}</button></td><td className="px-3 py-3">{sourceLabel(record)}</td><td className="px-3 py-3">{formatDate(record.publication_timestamp)}</td><td className="px-3 py-3">{formatDate(record.collection_timestamp)}</td><td className="px-3 py-3">{formatDate(record.algorithm_timestamp)}</td><td className="px-3 py-3 font-medium text-cyan-100/70">{formatDate(record.review_timestamp)}</td><td className="px-3 py-3">{formatDate(record.escalation_timestamp)}</td><td className="px-3 py-3"><ToneBadge tone={countdown.tone}>{countdown.label}</ToneBadge></td><td className="px-3 py-3">{record.detection_score}</td><td className="px-3 py-3">{record.assigned_reviewer_id || "Unassigned"}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40"><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, pendingRecords.length)} of {pendingRecords.length} mentions awaiting review</span><div className="flex items-center gap-2"><button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-white/55 disabled:cursor-not-allowed disabled:opacity-30">← Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" onClick={() => setPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-white/55 disabled:cursor-not-allowed disabled:opacity-30">Next →</button></div></div>
      </> : <Empty>No potential PV records are awaiting review.</Empty>}
      <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium text-white/60">Save selected mentions</p><p className="mt-1 text-[11px] text-white/30">{validSelectedIds.length} selected across the review queue</p></div><button type="button" onClick={openSaveDialog} disabled={!validSelectedIds.length || busy === "review-list:create"} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">Save review list</button></div></div>
    </Card>

    <Card title="Saved aggregate review lists" subtitle="Lists are also available in their selected workspace for governed assignment and email sharing.">{reviewLists.length ? <div className="space-y-3">{reviewLists.map((list) => <div key={list.id} className="rounded-xl border border-white/10 bg-black/30 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-white/75">{list.name}</p><p className="mt-1 text-xs text-white/35">{list.items?.length || 0} mentions · {list.therapeutic_area} · Assigned to {list.assigned_to || "nobody"}</p></div><div className="flex gap-2"><ToneBadge tone={list.status === "exported" ? "complete" : "neutral"}>{label(list.status)}</ToneBadge><a href={`/api/pv/review-lists/${list.id}/export`} download className="rounded-lg border border-white/10 px-3 py-2 text-xs text-cyan-300">Download CSV</a></div></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto]"><input value={listAssignments[list.id] ?? list.assigned_to ?? ""} onChange={(event) => setListAssignments((current) => ({ ...current, [list.id]: event.target.value }))} placeholder="Assignee email or user ID" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white" /><button type="button" onClick={() => assignList(list)} disabled={busy === `review-list:assign:${list.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60">Assign</button><input type="email" value={shareEmails[list.id] || ""} onChange={(event) => setShareEmails((current) => ({ ...current, [list.id]: event.target.value }))} placeholder="Recipient email" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white" /><button type="button" onClick={() => shareList(list)} disabled={!String(shareEmails[list.id] || "").trim() || busy === `review-list:share:${list.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-cyan-300">Share by email</button></div></div>)}</div> : <Empty>No aggregate PV review lists have been saved.</Empty>}</Card>
  </div>;
}

function RecordWorkbench({ detail, busy, onMutate, onRefresh }) {
  const { record, clock, reviews, transfers, audit } = detail;
  const retainedOntology = reviews.find((review) => review.decision === "escalate")?.validated_ae_ontology;
  const [productMention, setProductMention] = useState("unclear");
  const [healthExperience, setHealthExperience] = useState("unclear");
  const [selectedClasses, setSelectedClasses] = useState(record.proposed_classifications || []);
  const [rationale, setRationale] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [destination, setDestination] = useState("");
  const [transferMethod, setTransferMethod] = useState("manual_export");
  const proposedOntology = retainedOntology && Object.keys(retainedOntology).length ? retainedOntology : record.ae_ontology || {};
  const retainedIcsr = proposedOntology.icsrAssessment || {};
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
  const [e2dReview, setE2dReview] = useState({
    reportType: retainedIcsr.reportType || "undetermined",
    primarySourceType: retainedIcsr.primarySourceType || "unknown",
    patientIdentifiable: retainedIcsr.minimumCriteria?.identifiablePatient?.status || "unclear",
    patientIdentifierBasis: retainedIcsr.minimumCriteria?.identifiablePatient?.evidence || "",
    reporterIdentifiable: retainedIcsr.minimumCriteria?.identifiableReporter?.status || "unclear",
    reporterIdentifierBasis: retainedIcsr.minimumCriteria?.identifiableReporter?.evidence || "",
    seriousnessCriteria: retainedIcsr.seriousnessCriteria || proposedOntology.seriousness?.criteria || [],
    patientCharacteristics: retainedIcsr.clinicalNarrative?.patientCharacteristics || "",
    therapyDetails: retainedIcsr.clinicalNarrative?.therapyDetails || "",
    medicalHistory: retainedIcsr.clinicalNarrative?.medicalHistory || "",
    concurrentConditions: retainedIcsr.clinicalNarrative?.concurrentConditions || "",
    clinicalCourse: retainedIcsr.clinicalNarrative?.clinicalCourse || "",
    diagnosisAndLaboratoryEvidence: retainedIcsr.clinicalNarrative?.diagnosisAndLaboratoryEvidence || "",
    alternativeCausesAndConfounders: retainedIcsr.clinicalNarrative?.alternativeCausesAndConfounders || "",
    followUpNeeded: retainedIcsr.followUp?.needed || "unclear",
    followUpQuestions: retainedIcsr.followUp?.questions || "",
    duplicateStatus: retainedIcsr.duplicateAssessment?.status || "not_checked",
    duplicateReference: retainedIcsr.duplicateAssessment?.reference || "",
    regionalReportingAssessment: retainedIcsr.regionalReportingAssessment || "",
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
      icsrAssessment: {
        reportType: e2dReview.reportType,
        primarySourceType: e2dReview.primarySourceType,
        minimumCriteria: {
          suspectProduct: { status: productMention, evidence: ontologyReview.productProcedure || record.product_name || "" },
          adverseEventOrObservation: { status: healthExperience, evidence: ontologyReview.adverseEvent || record.potential_event || selectedClasses.join(", ") },
          identifiablePatient: { status: e2dReview.patientIdentifiable, evidence: e2dReview.patientIdentifierBasis },
          identifiableReporter: { status: e2dReview.reporterIdentifiable, evidence: e2dReview.reporterIdentifierBasis },
        },
        seriousnessCriteria: e2dReview.seriousnessCriteria,
        clinicalNarrative: {
          patientCharacteristics: e2dReview.patientCharacteristics,
          therapyDetails: e2dReview.therapyDetails,
          medicalHistory: e2dReview.medicalHistory,
          concurrentConditions: e2dReview.concurrentConditions,
          clinicalCourse: e2dReview.clinicalCourse,
          diagnosisAndLaboratoryEvidence: e2dReview.diagnosisAndLaboratoryEvidence,
          alternativeCausesAndConfounders: e2dReview.alternativeCausesAndConfounders,
        },
        followUp: { needed: e2dReview.followUpNeeded, questions: e2dReview.followUpQuestions },
        duplicateAssessment: { status: e2dReview.duplicateStatus, reference: e2dReview.duplicateReference },
        regionalReportingAssessment: e2dReview.regionalReportingAssessment,
      },
    };
  }
  function toggleClassification(value) { setSelectedClasses((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }
  async function review(decision) {
    if (!rationale.trim()) {
      setReviewError("Enter a reviewer rationale before saving this PV decision.");
      return;
    }
    if (decision === "escalate") {
      const minimumStatuses = [productMention, healthExperience, e2dReview.patientIdentifiable, e2dReview.reporterIdentifiable];
      if (!minimumStatuses.every((status) => status === "yes")) {
        setReviewError("Confirm Yes for the suspect product, AE/ADR or observation, identifiable patient, and identifiable reporter before escalating. This confirmation starts Day Zero.");
        return;
      }
    }
    setReviewError("");
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
        <div className="space-y-4"><div className="rounded-xl border border-white/10 bg-black/40 p-4"><div className="flex flex-wrap items-center gap-2"><ToneBadge>{sourceLabel(record)}</ToneBadge><ToneBadge>{record.original_language}</ToneBadge><ToneBadge tone={record.priority === "critical" ? "breached" : record.priority === "high" ? "approaching" : "neutral"}>{record.priority} priority</ToneBadge></div><blockquote className="mt-4 border-l-2 border-cyan-300/40 pl-4 text-sm leading-7 text-white/75">{record.original_verbatim}</blockquote><div className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/25">Original post date</p><p className="mt-1 text-white/65">{formatDate(record.posted_at)}</p><p className="mt-1 text-[10px] text-white/25">{record.posted_at_source_column ? `CSV date column: ${record.posted_at_source_column}${record.posted_at_raw_value ? ` · Raw: ${record.posted_at_raw_value}` : ""}` : "Captured from the source record"}</p></div><div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/25">Content availability</p><p className="mt-1 text-white/65">{formatDate(record.identified_at)}</p><p className="mt-1 text-[10px] text-white/25">{record.import_batch_id ? "Server time when the CSV became available to this AskSocial tenant" : "Timestamp when AskSocial made the content available for review"}</p></div><div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/25">Ingested</p><p className="mt-1 text-white/65">{formatDate(record.ingested_at)}</p>{record.import_batch_id ? <p className="mt-1 text-[10px] text-white/25">Batch {record.import_batch_id.slice(0, 8)} · CSV row {record.source_row_number}</p> : null}</div><div className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/45">Reportability review / Day Zero</p><p className="mt-1 text-cyan-100/75">{record.reportability_identified_at ? formatDate(record.reportability_identified_at) : "Not started"}</p><p className="mt-1 text-[10px] leading-4 text-white/25">{record.day_zero_reason || "Starts only when a qualified reviewer confirms all four minimum ICSR criteria."}</p></div></div>{String(record.source_url || "").startsWith("http") ? <a href={record.source_url} target="_blank" rel="noreferrer" className="inline-block cursor-pointer rounded-lg border border-cyan-300/20 px-3 py-2 text-xs font-semibold text-cyan-300">Open original source ↗</a> : null}<p className="mt-3 break-all text-[10px] text-white/20">Evidence hash {record.evidence_hash}</p></div>
        <div className="grid gap-3 md:grid-cols-4"><Metric label="PV detection score" value={`${record.detection_score}/100`} tooltip="AskSocial's combined screening score based on product, health-experience, context, and configured detection signals. It prioritizes the record for human review and is not an adverse-event determination." /><Metric label="Product confidence" value={`${record.product_confidence}%`} tooltip="AskSocial's confidence that the mention refers to the relevant product or procedure. A qualified reviewer must confirm the product relationship against the source evidence." /><Metric label="Health experience" value={`${record.health_experience_confidence}%`} tooltip="AskSocial's confidence that the mention describes a health experience or potential safety-relevant situation. This score supports triage and does not establish an adverse event." /><Metric label="Evidence origin" value={evidenceOriginLabel(record)} tooltip="Where the evidence entered AskSocial. Mentions ingested from CSV social-data files are labeled Social; other origins retain their governed provenance label. Origin provides provenance and does not indicate evidence quality or causality." /></div>
        {!['transferred', 'acknowledged', 'reconciled'].includes(record.status) ? <><PvOntologyReview value={ontologyReview} onChange={setOntologyReview} /><E2dCaseAssessment value={e2dReview} onChange={setE2dReview} /></> : null}
        <div><p className="text-xs font-medium text-white/55">Why AskSocial surfaced this</p><div className="mt-2 space-y-2">{(record.detection_rationale || []).map((reason, index) => <p key={index} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/40">{reason}</p>)}</div></div>
        <div><p className="text-xs font-medium text-white/55">Matched concepts</p><div className="mt-2 flex flex-wrap gap-2">{(record.matched_concepts || []).map((match) => <ToneBadge key={`${match.conceptId}-${match.matchedTerm}`}>{label(match.category)} · {match.matchedTerm}</ToneBadge>)}</div></div></div>
      </Card>
      <Card title="Compliance clock" subtitle={`Clock stage: ${label(clock.stage)}`}><div className="rounded-2xl border border-white/10 bg-black/30 p-5"><div className="flex items-center justify-between"><ToneBadge tone={clock.state}>{label(clock.state)}</ToneBadge><span className="text-xs text-white/35">{clock.state === "not_started" ? "Awaiting reportability determination" : `${clock.percentConsumed}% consumed`}</span></div><div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/45">Governing clock</p><p className="mt-1 text-sm font-medium text-cyan-100/75">{clock.governingClock === "reportability_identified_at" ? "Qualified reportability review" : clock.governingClock === "identified_at" ? "Reviewer identification" : label(clock.governingClock)}</p><p className="mt-1 text-xs text-white/35">Day zero: {formatDate(clock.governingTimestamp)}</p></div>{clock.state === "not_started" ? <p className="mt-5 text-sm leading-6 text-white/45">Day Zero has not started. Confirm all four minimum ICSR criteria and escalate the record to establish the governed review timestamp.</p> : <><p className="mt-5 text-3xl font-semibold text-white">{Math.floor(clock.elapsedMinutes / 60)}h {clock.elapsedMinutes % 60}m</p><p className="mt-1 text-xs text-white/35">Elapsed in current stage</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${clock.state === "breached" ? "bg-rose-400" : clock.state === "approaching" ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, clock.percentConsumed)}%` }} /></div><dl className="mt-5 space-y-2 text-xs"><div className="flex justify-between"><dt className="text-white/35">Stage started</dt><dd className="text-white/65">{formatDate(clock.startedAt)}</dd></div><div className="flex justify-between"><dt className="text-white/35">Due</dt><dd className="text-white/65">{formatDate(clock.dueAt)}</dd></div><div className="flex justify-between"><dt className="text-white/35">Remaining</dt><dd className="text-white/65">{clock.remainingMinutes ?? 0} min</dd></div></dl></>}</div></Card>
    </div>
    {!["transferred", "acknowledged", "reconciled"].includes(record.status) ? (
      <Card title="Structured human review" subtitle="AI proposes relevance; a qualified reviewer makes and documents the workflow decision.">
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-4">
            <DecisionSelect labelText="Does the content mention or reasonably imply a sponsor product?" value={productMention} onChange={setProductMention} />
            <DecisionSelect labelText="Does it describe a health experience or potential special situation?" value={healthExperience} onChange={setHealthExperience} />
            <div>
              <p className="text-xs font-medium text-white/55">Classification</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">{CLASSIFICATIONS.map((classification) => <label key={classification} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55"><input type="checkbox" checked={selectedClasses.includes(classification)} onChange={() => toggleClassification(classification)} />{label(classification)}</label>)}</div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-white/55">Reviewer rationale</label>
            <textarea value={rationale} onChange={(event) => { setRationale(event.target.value); if (reviewError) setReviewError(""); }} rows={9} placeholder="Document the evidence and reasoning supporting this decision." className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none" />
            {reviewError ? <p role="alert" className="mt-2 text-xs text-amber-300">{reviewError}</p> : <p className="mt-2 text-[11px] text-white/30">A rationale is required when the decision is submitted.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy.startsWith("review:")} onClick={() => review("escalate")} className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40">{busy === "review:escalate" ? "Saving…" : "Confirm reportability & escalate"}</button>
              <button type="button" disabled={busy.startsWith("review:")} onClick={() => review("close_not_relevant")} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 disabled:opacity-40">{busy === "review:close_not_relevant" ? "Saving…" : "Close as Not Relevant"}</button>
            </div>
          </div>
        </div>
      </Card>
    ) : null}
    {record.status === "ready_for_transfer" ? <Card title="Sponsor transfer service" subtitle="AskSocial constructs the handoff package from immutable evidence, review decisions, provenance, and the final reviewer-approved adverse-event ontology."><div className="grid gap-3 md:grid-cols-3"><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Sponsor destination" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none" /><select value={transferMethod} onChange={(event) => setTransferMethod(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"><option value="manual_export">Manual secure export</option><option value="secure_api">Secure API</option><option value="sftp">SFTP</option><option value="secure_email">Secure email</option></select><button type="button" disabled={busy === "transfer" || !destination.trim()} onClick={transfer} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{busy === "transfer" ? "Creating package…" : "Transfer to Sponsor"}</button></div></Card> : null}
    <div className="grid gap-5 xl:grid-cols-2"><Card title="Workflow history"><div className="space-y-2">{[...reviews.map((item) => ({ id: item.id, title: `Review: ${label(item.decision)}`, at: item.reviewed_at, detail: item.rationale })), ...transfers.map((item) => ({ id: item.id, title: `Transfer: ${label(item.status)}`, at: item.transferred_at || item.created_at, detail: `${item.transfer_method} to ${item.destination}` }))].sort((a, b) => new Date(b.at) - new Date(a.at)).map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="flex justify-between gap-3"><p className="text-xs font-medium text-white/65">{item.title}</p><p className="text-[11px] text-white/25">{formatDate(item.at)}</p></div><p className="mt-1 text-xs leading-5 text-white/35">{item.detail}</p></div>)}</div></Card><Card title="Audit / provenance chain"><div className="space-y-2">{audit.map((event) => <div key={event.id} className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="flex justify-between"><p className="text-xs text-white/65">{label(event.action)}</p><ToneBadge>{event.outcome}</ToneBadge></div><p className="mt-2 text-[10px] text-white/25">Actor {event.actor_id} · {formatDate(event.occurred_at)}</p><p className="mt-1 break-all text-[9px] text-white/15">{event.event_hash}</p></div>)}</div></Card></div>
  </div>;
}

function DecisionSelect({ labelText, value, onChange }) { return <fieldset><legend className="text-xs font-medium text-white/55">{labelText}</legend><div className="mt-2 flex gap-2">{["yes", "no", "unclear"].map((option) => <label key={option} className={`rounded-lg border px-3 py-2 text-xs ${value === option ? "border-white bg-white text-black" : "border-white/10 text-white/50"}`}><input className="sr-only" type="radio" value={option} checked={value === option} onChange={() => onChange(option)} />{label(option)}</label>)}</div></fieldset>; }

function PvOntologyReview({ value, onChange }) {
  function field(key) { return { value: value[key], onChange: (event) => onChange((current) => ({ ...current, [key]: event.target.value })) }; }
  const causalityLanguageOptions = AE_ONTOLOGY_OPTIONS.causalityLanguage.includes(value.causalityLanguage)
    ? AE_ONTOLOGY_OPTIONS.causalityLanguage
    : [...AE_ONTOLOGY_OPTIONS.causalityLanguage, value.causalityLanguage];
  return <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/75">Adverse-event ontology review</h3><p className="mt-1 text-xs leading-5 text-white/35">Confirm or correct every extracted field against the verbatim and applicable reference label before escalation. These reviewer-approved values become the final ontology in the sponsor package.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><OntologyText labelText="Product / procedure" {...field("productProcedure")} /><OntologyText labelText="Adverse event" {...field("adverseEvent")} /><OntologySelect labelText="Seriousness" options={AE_ONTOLOGY_OPTIONS.seriousness} {...field("seriousness")} /><OntologySelect labelText="Outcome" options={AE_ONTOLOGY_OPTIONS.outcome} {...field("outcome")} /><OntologySelect labelText="Time to onset" options={AE_ONTOLOGY_OPTIONS.timeToOnset} {...field("timeToOnset")} /><OntologyText labelText="Onset detail" {...field("timeToOnsetDetail")} /><OntologySelect labelText="Severity" options={AE_ONTOLOGY_OPTIONS.severity} {...field("severity")} /><OntologySelect labelText="Unexpectedness" options={AE_ONTOLOGY_OPTIONS.unexpectedness} {...field("unexpectedness")} /><OntologySelect labelText="Causality type" options={["temporal_association", "possible_attribution", "reported_attribution", "denied"]} {...field("causalityType")} /><OntologySelect labelText="Causality language" options={causalityLanguageOptions} emptyLabel="Not stated / unclear" {...field("causalityLanguage")} /></div></section>;
}

function E2dCaseAssessment({ value, onChange }) {
  const seriousnessCriteria = ["death", "life_threatening", "hospitalization", "disability_or_incapacity", "congenital_anomaly_or_birth_defect", "important_medical_event"];
  function field(key) { return { value: value[key], onChange: (event) => onChange((current) => ({ ...current, [key]: event.target.value })) }; }
  function toggleCriterion(criterion) {
    onChange((current) => ({
      ...current,
      seriousnessCriteria: current.seriousnessCriteria.includes(criterion)
        ? current.seriousnessCriteria.filter((item) => item !== criterion)
        : [...current.seriousnessCriteria, criterion],
    }));
  }
  return <section className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] p-4">
    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-100/75">ICH E2D(R1) case assessment</h3>
    <p className="mt-1 text-xs leading-5 text-white/35">Document minimum ICSR criteria, clinical narrative inputs, follow-up gaps, and duplicate assessment. Unknown information remains explicitly missing and is never inferred from a social handle or unverified post.</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <OntologySelect labelText="Report type" options={["undetermined", "spontaneous", "solicited"]} {...field("reportType")} />
      <OntologySelect labelText="Primary source type" options={["unknown", "consumer", "healthcare_professional", "other"]} {...field("primarySourceType")} />
      <DecisionSelect labelText="Identifiable patient?" value={value.patientIdentifiable} onChange={(patientIdentifiable) => onChange((current) => ({ ...current, patientIdentifiable }))} />
      <DecisionSelect labelText="Identifiable reporter?" value={value.reporterIdentifiable} onChange={(reporterIdentifiable) => onChange((current) => ({ ...current, reporterIdentifiable }))} />
      <OntologyText labelText="Patient identifier basis" {...field("patientIdentifierBasis")} />
      <OntologyText labelText="Reporter identifier basis" {...field("reporterIdentifierBasis")} />
      <OntologySelect labelText="Follow-up needed" options={["unclear", "yes", "no"]} {...field("followUpNeeded")} />
      <OntologySelect labelText="Duplicate assessment" options={["not_checked", "no_match", "potential_duplicate", "confirmed_duplicate"]} {...field("duplicateStatus")} />
      <OntologyText labelText="Duplicate / linked-case reference" {...field("duplicateReference")} />
    </div>
    <fieldset className="mt-5"><legend className="text-xs font-medium text-white/55">Seriousness criteria (select every criterion supported by the source)</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{seriousnessCriteria.map((criterion) => <label key={criterion} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55"><input type="checkbox" checked={value.seriousnessCriteria.includes(criterion)} onChange={() => toggleCriterion(criterion)} />{label(criterion)}</label>)}</div></fieldset>
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <E2dTextArea labelText="Patient characteristics" {...field("patientCharacteristics")} placeholder="Age/category, sex, gestational age, initials or another permitted identifier, if reported." />
      <E2dTextArea labelText="Therapy details" {...field("therapyDetails")} placeholder="Product, dose, route, indication, treatment dates, concomitant therapy, if reported." />
      <E2dTextArea labelText="Medical history" {...field("medicalHistory")} placeholder="Relevant history reported by the source." />
      <E2dTextArea labelText="Concurrent conditions" {...field("concurrentConditions")} placeholder="Concurrent conditions reported by the source." />
      <E2dTextArea labelText="Clinical course" {...field("clinicalCourse")} placeholder="Chronological course, interventions and outcome; the source verbatim remains separately preserved." />
      <E2dTextArea labelText="Diagnosis / laboratory evidence" {...field("diagnosisAndLaboratoryEvidence")} placeholder="Diagnosis, tests, laboratory findings and normal ranges, if reported." />
      <E2dTextArea labelText="Alternative causes / confounders" {...field("alternativeCausesAndConfounders")} placeholder="Alternative explanations or confounders considered during review." />
      <E2dTextArea labelText="Targeted follow-up questions" {...field("followUpQuestions")} placeholder="Specific missing information to request where follow-up is permissible and feasible." />
      <E2dTextArea labelText="Regional / local reporting assessment" {...field("regionalReportingAssessment")} placeholder="Document applicable reporting conclusion or retain as pending sponsor assessment." className="md:col-span-2" />
    </div>
  </section>;
}

function OntologyText({ labelText, value, onChange }) { return <label className="text-xs text-white/40">{labelText}<input value={value} onChange={onChange} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" /></label>; }
function OntologySelect({ labelText, options, value, onChange, emptyLabel = "Unclear" }) { return <label className="text-xs text-white/40">{labelText}<select value={value} onChange={onChange} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">{options.map((option) => <option key={option || "empty"} value={option}>{option ? label(option) : emptyLabel}</option>)}</select></label>; }
function E2dTextArea({ labelText, value, onChange, placeholder, className = "" }) { return <label className={`text-xs text-white/40 ${className}`}>{labelText}<textarea value={value} onChange={onChange} rows={3} placeholder={placeholder} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" /></label>; }

function ScreeningStatus({ therapeuticArea, sponsorCases, sources, screenings, selected, busy, onMutate, onRefreshRecord, onReturnToQueue }) {
  const [sourceId, setSourceId] = useState("");
  const [items, setItems] = useState(0);
  const [potential, setPotential] = useState(0);
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const now = new Date().toISOString();
  const sponsorReportScope = therapeuticArea ? `?therapeuticArea=${encodeURIComponent(therapeuticArea)}` : "";
  async function submit(event) { event.preventDefault(); await onMutate("/api/pv/screenings", { payload: { sourceId, screenedFrom: new Date(Date.now() - 86400000).toISOString(), screenedUntil: now, itemsScreened: items, potentialRecords: potential, nilReturn: potential === 0 } }, "screening", "Screening run and nil-return status recorded."); }
  async function shareSponsorReport() {
    const recipientEmail = sponsorEmail.trim();
    const data = await onMutate("/api/pv/sponsor-reports", { payload: { therapeuticArea, recipientEmail } }, "sponsor-report:share", "Sponsor report share recorded in the governed PV audit trail.");
    setShareConfirmOpen(false);
    if (!data || data.delivery === "provider") return;
    const download = document.createElement("a");
    download.href = `/api/pv/sponsor-reports/export${sponsorReportScope}`;
    download.download = data.fileName || "asksocial-pv-sponsor-screening-report.pdf";
    document.body.appendChild(download);
    download.click();
    download.remove();
    const subject = encodeURIComponent(`AskSocial PV sponsor screening report - ${therapeuticArea || "All therapeutic areas"}`);
    const body = encodeURIComponent(`Attached is the AskSocial ICH E2D(R1) sponsor screening report containing ${data.caseCount} escalated mention${data.caseCount === 1 ? "" : "s"}.\n\nThe PDF has been downloaded to this device. Please attach it before sending. This working document supports PV intake and does not replace qualified medical review or applicable regional reporting requirements.`);
    window.location.href = `mailto:${encodeURIComponent(recipientEmail)}?subject=${subject}&body=${body}`;
  }
  async function openSponsorCase(recordId) {
    await onRefreshRecord(recordId);
    window.setTimeout(() => document.getElementById("pv-screening-structured-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
  return <div className="space-y-5">
    {shareConfirmOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Confirm sponsor report handoff"><div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#080808] p-6 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/70">Confirm sponsor handoff</p><h2 className="mt-2 text-xl font-semibold text-white">Share {sponsorCases.length} screened assessment{sponsorCases.length === 1 ? "" : "s"}?</h2><p className="mt-3 text-sm leading-6 text-white/45">The ICH E2D(R1) PDF will be prepared for <span className="font-medium text-white/75">{sponsorEmail.trim()}</span>. If governed email delivery is configured, this confirmation sends the attachment and records the transfer. Otherwise, AskSocial downloads the PDF and opens a draft email for your final review.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShareConfirmOpen(false)} disabled={busy === "sponsor-report:share"} className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 disabled:cursor-not-allowed disabled:opacity-40">Cancel</button><button type="button" onClick={shareSponsorReport} disabled={busy === "sponsor-report:share"} className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{busy === "sponsor-report:share" ? "Sending…" : "Confirm & continue"}</button></div></div></div> : null}
    {selected ? <section id="pv-screening-structured-review" className="space-y-5 scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Screening Status · Structured review</p><p className="mt-1 text-sm text-white/45">Confirm the extracted safety ontology, record the reviewer decision, and preserve the governed audit trail.</p></div><button type="button" onClick={onReturnToQueue} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60">Return to Review Queue</button></div>
      <RecordWorkbench key={selected.record.id} detail={selected} busy={busy} onMutate={onMutate} onRefresh={() => onRefreshRecord(selected.record.id)} />
    </section> : null}
    <Card title="Escalated sponsor assessments" subtitle="Every Escalate to Sponsor decision is aggregated here. The PDF preserves the source verbatim, review provenance, all available ICH E2D(R1) case data, and clearly marks information that requires follow-up." actions={<ToneBadge tone={sponsorCases.length ? "complete" : "neutral"}>{sponsorCases.length} screened mention{sponsorCases.length === 1 ? "" : "s"}</ToneBadge>}>
      {sponsorCases.length ? <div className="space-y-4">
        <div className="max-h-[30rem] overflow-auto rounded-xl border border-white/10"><table className="w-full min-w-[1080px] text-left text-xs"><thead className="sticky top-0 bg-[#090909] text-white/35"><tr>{["Product / procedure", "Adverse event", "Day-zero timestamp", "Reviewer", "Minimum criteria", "Transfer status", "QA action"].map((item) => <th key={item} className="px-3 py-3">{item}</th>)}</tr></thead><tbody>{sponsorCases.map((item) => {
          const ontology = item.review?.validated_ae_ontology || {};
          const criteria = ontology.icsrAssessment?.minimumCriteria || {};
          const criteriaMet = [criteria.suspectProduct, criteria.adverseEventOrObservation, criteria.identifiablePatient, criteria.identifiableReporter].every((criterion) => criterion?.status === "yes");
          return <tr key={item.id} className="border-t border-white/[0.06] text-white/55"><td className="px-3 py-3 text-white/75">{ontology.productProcedures?.[0]?.value || item.record.product_name || "Unspecified"}</td><td className="px-3 py-3">{ontology.adverseEvents?.[0]?.value || item.record.potential_event || "Unspecified"}</td><td className="px-3 py-3">{formatDate(item.record.reportability_identified_at || item.review.reviewed_at)}</td><td className="px-3 py-3">{item.review.reviewer_id}</td><td className="px-3 py-3"><ToneBadge tone={criteriaMet ? "healthy" : "approaching"}>{criteriaMet ? "Complete" : "Follow-up needed"}</ToneBadge></td><td className="px-3 py-3">{label(item.transfer?.status || "not_transferred")}</td><td className="px-3 py-3"><button type="button" onClick={() => openSponsorCase(item.record.id)} disabled={busy === `record:${item.record.id}`} className="cursor-pointer rounded-lg border border-cyan-300/20 px-3 py-2 text-xs font-semibold text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">{busy === `record:${item.record.id}` ? "Opening…" : "Review assessment"}</button></td></tr>;
        })}</tbody></table></div>
        <div className="grid gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4 lg:grid-cols-[auto_1fr_auto] lg:items-end">
          <a href={`/api/pv/sponsor-reports/export${sponsorReportScope}`} download className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black">Create PDF</a>
          <label className="text-xs text-white/40">Sponsor email<input type="email" value={sponsorEmail} onChange={(event) => setSponsorEmail(event.target.value)} placeholder="pv@sponsor.com" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /></label>
          <button type="button" onClick={() => setShareConfirmOpen(true)} disabled={!sponsorEmail.trim() || busy === "sponsor-report:share"} className="cursor-pointer rounded-xl border border-cyan-300/25 px-4 py-2.5 text-sm font-semibold text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">Review email handoff</button>
        </div>
        <p className="text-[11px] leading-5 text-white/30">If a governed email provider is configured, AskSocial sends the PDF as an attachment. Otherwise, the PDF downloads and your email client opens with a prepared message so you can attach and send it.</p>
      </div> : <Empty>Escalated structured reviews will appear here as sponsor-ready assessments.</Empty>}
    </Card>
    <Card title="Screening Status" subtitle="Cadence is tied to the governed source registry; every completed run records records found or an explicit nil return."><div className="overflow-x-auto">{sources.length ? <table className="w-full min-w-[760px] text-left text-xs"><thead className="text-white/35"><tr>{["Source", "Ownership", "Cadence", "Products", "Markets", "Status"].map((item) => <th className="px-3 py-3" key={item}>{item}</th>)}</tr></thead><tbody>{sources.map((source) => <tr key={source.id} className="border-t border-white/[0.06] text-white/55"><td className="px-3 py-3 text-white/75">{source.name}</td><td className="px-3 py-3">{label(source.ownership_classification)}</td><td className="px-3 py-3">Every {source.cadence_minutes} min</td><td className="px-3 py-3">{source.products?.join(", ") || "—"}</td><td className="px-3 py-3">{source.markets?.join(", ") || "—"}</td><td className="px-3 py-3"><ToneBadge tone={source.active ? "healthy" : "neutral"}>{source.active ? "Active" : "Inactive"}</ToneBadge></td></tr>)}</tbody></table> : <Empty>Add a governed source before recording screening runs.</Empty>}</div></Card>
    <Card title="Record screening outcome" subtitle="A nil return documents that the agreed source was screened and no content required PV review."><form onSubmit={submit} className="grid gap-3 md:grid-cols-4"><select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"><option value="">Select source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select><input type="number" min="0" value={items} onChange={(event) => setItems(Number(event.target.value))} placeholder="Items screened" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><input type="number" min="0" value={potential} onChange={(event) => setPotential(Number(event.target.value))} placeholder="Potential records" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /><button disabled={!sourceId || busy === "screening"} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{busy === "screening" ? "Recording…" : potential === 0 ? "Record nil return" : "Complete screening"}</button></form><div className="mt-5 space-y-2">{screenings.slice(0, 12).map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs"><div><p className="text-white/65">{run.pv_sources?.name || run.source_id}</p><p className="mt-1 text-white/30">{run.items_screened} screened · {run.potential_records} routed · {formatDate(run.completed_at)}</p></div><ToneBadge tone={run.status === "completed" ? "healthy" : "breached"}>{run.nil_return ? "Nil return" : label(run.status)}</ToneBadge></div>)}</div></Card>
  </div>;
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
