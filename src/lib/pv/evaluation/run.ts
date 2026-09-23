import { createHash } from "node:crypto";
import { recognizeBotulinumToxinPvMention } from "../recognition";
import { finalAdjudicationFor } from "./adjudication";
import { getBotulinumPvEvaluationConfiguration } from "./config";
import { calculateBinaryMetrics, reviewerLabelToBinary } from "./metrics";
import { PV_EVALUATION_SLICES, type PvAdjudicationLedger, type PvBinaryTruth, type PvEvaluationReport, type PvGoldCandidateRecord, type PvMetricBasis, type PvModelDecisionSnapshot, type PvReviewerLabel } from "./types";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function evaluateGoldCandidate(record: PvGoldCandidateRecord, evaluatedAt: string): PvModelDecisionSnapshot {
  if (Number.isNaN(new Date(evaluatedAt).getTime())) throw new Error("A valid model evaluation timestamp is required.");
  const output = recognizeBotulinumToxinPvMention({
    original_mention: record.text,
    source: record.source.platform,
    source_url: record.source.url,
    source_id: record.source.id,
    original_timestamp: record.source.original_timestamp,
    collection_timestamp: record.source.collection_timestamp,
    algorithm_timestamp: evaluatedAt,
    author_identifier: record.source.author_identifier,
    language: "en",
  });
  const icsr = output.icsr_element_assessment;
  const base = {
    snapshot_id: `pvmodel_${hash(`${record.dataset_version}|${record.record_id}|${output.versions.classifier_version}|${evaluatedAt}`).slice(0, 24)}`,
    record_id: record.record_id,
    dataset_version: record.dataset_version,
    evaluated_at: evaluatedAt,
    classifier_version: output.versions.classifier_version,
    taxonomy_version: output.versions.taxonomy_version,
    model_decision: {
      routed_for_pv_review: output.human_review_status === "PV review required",
      pv_relevance: output.pv_relevance.level,
      human_review_route: output.human_review_routing.route,
      icsr_status: icsr.icsr_status,
      missing_elements: [...icsr.missing_elements],
    },
    structured_output: output,
  };
  return { ...base, immutable_hash: hash(base) };
}

function referenceFor(record: PvGoldCandidateRecord, basis: PvMetricBasis, ledger?: PvAdjudicationLedger): { label: PvReviewerLabel; truth: PvBinaryTruth } | null {
  const final = ledger ? finalAdjudicationFor(ledger, record.record_id) : null;
  if (basis === "ADJUDICATED_ONLY") {
    if (!final) return null;
    const truth = reviewerLabelToBinary(final.reviewer_decision);
    return truth ? { label: final.reviewer_decision, truth } : null;
  }
  if (basis === "HUMAN_WHEN_AVAILABLE" && final) {
    const truth = reviewerLabelToBinary(final.reviewer_decision);
    if (truth) return { label: final.reviewer_decision, truth };
  }
  return { label: record.provisional_reference_label, truth: record.provisional_binary_truth };
}

export function buildPvEvaluationReport(options: {
  records: PvGoldCandidateRecord[];
  snapshots: PvModelDecisionSnapshot[];
  regressions: PvGoldCandidateRecord[];
  regressionSnapshots: PvModelDecisionSnapshot[];
  basis: PvMetricBasis;
  generatedAt: string;
  ledger?: PvAdjudicationLedger;
}): PvEvaluationReport {
  const snapshotByRecord = new Map(options.snapshots.map((snapshot) => [snapshot.record_id, snapshot]));
  const rows = options.records.map((record) => {
    const snapshot = snapshotByRecord.get(record.record_id);
    if (!snapshot) throw new Error(`Missing model snapshot for ${record.record_id}.`);
    const reference = referenceFor(record, options.basis, options.ledger);
    return { record, snapshot, reference, model_positive: snapshot.model_decision.routed_for_pv_review, truth: reference?.truth || null };
  });
  const unadjudicated = options.records.filter((record) => !options.ledger || !finalAdjudicationFor(options.ledger, record.record_id)).map((record) => record.record_id);
  const slices = Object.fromEntries(PV_EVALUATION_SLICES.map((slice) => [slice, calculateBinaryMetrics(rows.filter((row) => row.record.slice_tags.includes(slice))) ])) as PvEvaluationReport["slices"];
  const regressionByRecord = new Map(options.regressionSnapshots.map((snapshot) => [snapshot.record_id, snapshot]));
  const regressionRequired = options.regressions.map((record) => record.record_id);
  const regressionPassed = regressionRequired.filter((recordId) => regressionByRecord.get(recordId)?.model_decision.routed_for_pv_review);
  const disagreements = rows.flatMap((row) => {
    if (!row.reference || row.model_positive === (row.reference.truth === "POSITIVE")) return [];
    return [{ record_id: row.record.record_id, model_decision: row.model_positive, reference_decision: row.reference.label, false_positive: row.model_positive, false_negative: !row.model_positive }];
  });
  const first = options.snapshots[0];
  if (!first) throw new Error("At least one model snapshot is required.");
  return {
    schema_version: "1.0.0",
    dataset_version: options.records[0]?.dataset_version || "unknown",
    classifier_version: first.classifier_version,
    taxonomy_version: first.taxonomy_version,
    generated_at: options.generatedAt,
    metric_basis: options.basis,
    qualification: options.basis === "ADJUDICATED_ONLY" && !unadjudicated.length
      ? "QUALIFIED_PV_ADJUDICATED_EVALUATION"
      : "PRELIMINARY_NOT_FOR_PRODUCTION_QUALIFICATION",
    overall: calculateBinaryMetrics(rows),
    slices,
    disagreements,
    unadjudicated_record_ids: unadjudicated,
    regression: { required_record_ids: regressionRequired, passed_record_ids: regressionPassed, failed_record_ids: regressionRequired.filter((recordId) => !regressionPassed.includes(recordId)) },
  };
}

export function runBotulinumPvEvaluation(options: { evaluatedAt?: string; basis?: PvMetricBasis; ledger?: PvAdjudicationLedger } = {}) {
  const configuration = getBotulinumPvEvaluationConfiguration();
  const evaluatedAt = options.evaluatedAt || new Date().toISOString();
  const snapshots = configuration.dataset.map((record) => evaluateGoldCandidate(record, evaluatedAt));
  const regressionSnapshots = configuration.regressions.map((record) => evaluateGoldCandidate(record, evaluatedAt));
  const report = buildPvEvaluationReport({
    records: configuration.dataset,
    snapshots,
    regressions: configuration.regressions,
    regressionSnapshots,
    basis: options.basis || "PROVISIONAL_BASELINE",
    generatedAt: evaluatedAt,
    ledger: options.ledger,
  });
  return { configuration: configuration.manifest, records: configuration.dataset, regressions: configuration.regressions, snapshots, regressionSnapshots, report };
}
