import { createHash } from "node:crypto";
import { reviewerLabelToBinary } from "./metrics";
import { PV_REVIEWER_LABELS, type PvAdjudicationEvent, type PvAdjudicationLedger, type PvAdjudicationStage, type PvModelDecisionSnapshot, type PvReviewerLabel } from "./types";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateTimestamp(value: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) throw new Error("A valid adjudication timestamp is required.");
}

function modelPositive(snapshot: PvModelDecisionSnapshot) {
  return snapshot.model_decision.routed_for_pv_review;
}

export function createAdjudicationLedger(datasetVersion: string, modelSnapshots: PvModelDecisionSnapshot[]): PvAdjudicationLedger {
  if (!datasetVersion.trim() || !modelSnapshots.length) throw new Error("A dataset version and model snapshots are required.");
  const snapshotIds = new Set<string>();
  for (const snapshot of modelSnapshots) {
    if (snapshotIds.has(snapshot.snapshot_id)) throw new Error(`Duplicate model snapshot: ${snapshot.snapshot_id}`);
    snapshotIds.add(snapshot.snapshot_id);
    if (hash({ ...snapshot, immutable_hash: undefined }) !== snapshot.immutable_hash) throw new Error(`Model snapshot integrity check failed: ${snapshot.snapshot_id}`);
  }
  return { schema_version: "1.0.0", dataset_version: datasetVersion, model_snapshots: structuredClone(modelSnapshots), events: [] };
}

export function appendAdjudicationEvent(ledger: PvAdjudicationLedger, input: {
  record_id: string;
  model_snapshot_id: string;
  stage: PvAdjudicationStage;
  reviewer_id: string;
  reviewer_qualification_attested: boolean;
  reviewer_decision: PvReviewerLabel;
  reviewer_notes: string;
  adjudication_timestamp: string;
}): PvAdjudicationLedger {
  if (!PV_REVIEWER_LABELS.includes(input.reviewer_decision)) throw new Error("Unsupported reviewer decision.");
  if (!input.reviewer_id.trim() || !input.reviewer_notes.trim()) throw new Error("Reviewer identity and notes are required.");
  if (!input.reviewer_qualification_attested) throw new Error("PV reviewer qualification attestation is required.");
  validateTimestamp(input.adjudication_timestamp);
  const snapshot = ledger.model_snapshots.find((item) => item.snapshot_id === input.model_snapshot_id && item.record_id === input.record_id);
  if (!snapshot) throw new Error("The immutable model snapshot was not found for this record.");
  const history = ledger.events.filter((item) => item.record_id === input.record_id);
  if (input.stage === "PRIMARY_REVIEW" && history.length) throw new Error("A primary review already exists; append a second review or final adjudication instead.");
  if (input.stage !== "PRIMARY_REVIEW" && !history.some((item) => item.stage === "PRIMARY_REVIEW")) throw new Error("Primary review is required first.");
  if (input.stage === "SECOND_REVIEW" && history.some((item) => item.stage === "SECOND_REVIEW")) throw new Error("A second review already exists.");
  if (input.stage === "SECOND_REVIEW" && history.some((item) => item.stage === "PRIMARY_REVIEW" && item.reviewer_id === input.reviewer_id)) throw new Error("Second review must be completed by a different qualified reviewer.");
  if (input.stage === "FINAL_ADJUDICATION") {
    if (input.reviewer_decision === "NEEDS_SECOND_REVIEW") throw new Error("A final adjudication cannot remain NEEDS_SECOND_REVIEW.");
    if (history.some((item) => item.stage === "FINAL_ADJUDICATION")) throw new Error("A final adjudication is immutable and already exists.");
    const primary = history.find((item) => item.stage === "PRIMARY_REVIEW");
    const needsSecond = primary?.reviewer_decision === "NEEDS_SECOND_REVIEW"
      || input.reviewer_decision !== primary?.reviewer_decision
      || history.some((item) => item.stage === "SECOND_REVIEW" && item.reviewer_decision !== primary?.reviewer_decision);
    if (needsSecond && !history.some((item) => item.stage === "SECOND_REVIEW")) throw new Error("A second review is required before final adjudication.");
  }
  const priorReview = [...history].reverse().find((item) => item.stage !== "FINAL_ADJUDICATION");
  const previousEventHash = ledger.events.at(-1)?.event_hash || "GENESIS";
  const modelDecisionAtReview = structuredClone(snapshot.model_decision);
  const binaryReview = reviewerLabelToBinary(input.reviewer_decision);
  const payload = {
    record_id: input.record_id,
    model_snapshot_id: input.model_snapshot_id,
    stage: input.stage,
    reviewer_id: input.reviewer_id,
    reviewer_qualification_attested: true as const,
    reviewer_decision: input.reviewer_decision,
    reviewer_notes: input.reviewer_notes,
    adjudication_timestamp: input.adjudication_timestamp,
    classifier_version: snapshot.classifier_version,
    taxonomy_version: snapshot.taxonomy_version,
    model_decision_at_review: modelDecisionAtReview,
    disagreement_with_model: binaryReview !== null && (binaryReview === "POSITIVE") !== modelPositive(snapshot),
    disagreement_with_prior_review: Boolean(priorReview && priorReview.reviewer_decision !== input.reviewer_decision),
    previous_event_hash: previousEventHash,
  };
  const eventHash = hash(payload);
  const event: PvAdjudicationEvent = { event_id: `pvadj_${eventHash.slice(0, 24)}`, ...payload, event_hash: eventHash };
  return { ...ledger, model_snapshots: structuredClone(ledger.model_snapshots), events: [...ledger.events, event] };
}

export function finalAdjudicationFor(ledger: PvAdjudicationLedger, recordId: string) {
  return ledger.events.find((item) => item.record_id === recordId && item.stage === "FINAL_ADJUDICATION") || null;
}

export function adjudicationAuditTrail(ledger: PvAdjudicationLedger, recordId: string) {
  const snapshot = ledger.model_snapshots.find((item) => item.record_id === recordId);
  if (!snapshot) throw new Error("Record has no model snapshot.");
  return [
    { stage: "ORIGINAL_MODEL_DECISION" as const, timestamp: snapshot.evaluated_at, snapshot_id: snapshot.snapshot_id, decision: snapshot.model_decision },
    ...ledger.events.filter((item) => item.record_id === recordId).map((item) => ({ stage: item.stage, timestamp: item.adjudication_timestamp, event_id: item.event_id, decision: item.reviewer_decision, notes: item.reviewer_notes })),
  ];
}

export function validateAdjudicationLedger(ledger: PvAdjudicationLedger) {
  let previous = "GENESIS";
  for (const event of ledger.events) {
    if (event.previous_event_hash !== previous) throw new Error(`Broken adjudication audit chain at ${event.event_id}.`);
    const { event_id: _eventId, event_hash: eventHash, ...payload } = event;
    if (hash(payload) !== eventHash) throw new Error(`Adjudication event integrity check failed at ${event.event_id}.`);
    previous = event.event_hash;
  }
  return true;
}
