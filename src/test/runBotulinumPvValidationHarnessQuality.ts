import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  PV_EVALUATION_SLICES,
  adjudicationAuditTrail,
  appendAdjudicationEvent,
  appendAdjudicationEventFile,
  buildPvEvaluationReport,
  calculateBinaryMetrics,
  createAdjudicationLedger,
  getBotulinumPvEvaluationConfiguration,
  runBotulinumPvEvaluation,
  validateAdjudicationLedger,
  writePvEvaluationRun,
} from "../lib/pv";

const evaluatedAt = "2026-09-17T16:00:00.000Z";

function main() {
  const configured = getBotulinumPvEvaluationConfiguration();
  assert.equal(configured.manifest.status, "candidate_pending_qualified_pv_adjudication");
  assert.equal(configured.dataset.length, 36);
  assert.equal(configured.dataset.filter((item) => item.provisional_binary_truth === "POSITIVE").length, 18);
  assert.equal(configured.dataset.filter((item) => item.provisional_binary_truth === "NEGATIVE").length, 18);
  assert(configured.dataset.every((item) => item.adjudication_status === "PENDING_PV_REVIEW"));
  assert(configured.dataset.every((item) => item.reference_label_source === "SEEDED_EVALUATION_DESIGN"));
  for (const slice of PV_EVALUATION_SLICES) assert(configured.dataset.some((item) => item.slice_tags.includes(slice)), `Missing evaluation slice ${slice}.`);
  assert.equal(configured.regressions.length, 9);
  assert(configured.regressions.every((item) => item.reference_label_source === "KNOWN_FALSE_NEGATIVE_REGRESSION"));

  const knownMetrics = calculateBinaryMetrics([
    { model_positive: true, truth: "POSITIVE" },
    { model_positive: true, truth: "POSITIVE" },
    { model_positive: false, truth: "NEGATIVE" },
    { model_positive: true, truth: "NEGATIVE" },
    { model_positive: false, truth: "POSITIVE" },
    { model_positive: false, truth: null },
  ]);
  assert.deepEqual(knownMetrics.confusion_matrix, { true_positive: 2, true_negative: 1, false_positive: 1, false_negative: 1 });
  assert.equal(knownMetrics.sensitivity_recall, 0.666667);
  assert.equal(knownMetrics.specificity, 0.5);
  assert.equal(knownMetrics.precision, 0.666667);
  assert.equal(knownMetrics.false_positive_rate, 0.5);
  assert.equal(knownMetrics.false_negative_rate, 0.333333);
  assert.equal(knownMetrics.f1, 0.666667);
  assert.equal(knownMetrics.excluded_records, 1);

  const run = runBotulinumPvEvaluation({ evaluatedAt });
  assert.equal(run.snapshots.length, 36);
  assert.equal(run.regressionSnapshots.length, 9);
  assert.equal(run.report.overall.evaluated_records, 36);
  assert.equal(run.report.metric_basis, "PROVISIONAL_BASELINE");
  assert.equal(run.report.qualification, "PRELIMINARY_NOT_FOR_PRODUCTION_QUALIFICATION");
  assert.equal(run.report.unadjudicated_record_ids.length, 36);
  assert.equal(run.report.regression.failed_record_ids.length, 0, "Locked false-negative regression examples must remain routed for PV review.");
  assert.equal(run.report.regression.passed_record_ids.length, 9);
  for (const slice of PV_EVALUATION_SLICES) {
    const metrics = run.report.slices[slice];
    assert(metrics.evaluated_records > 0, `${slice} must have separately reported performance.`);
    assert.equal(metrics.evaluated_records, Object.values(metrics.confusion_matrix).reduce((sum, count) => sum + count, 0));
  }
  for (const snapshot of [...run.snapshots, ...run.regressionSnapshots]) {
    assert.equal(snapshot.structured_output.original_mention.length > 0, true);
    assert.equal(snapshot.classifier_version, run.configuration.classifierVersion);
    assert.equal(snapshot.taxonomy_version, run.configuration.taxonomyVersion);
    assert.equal(snapshot.immutable_hash.length, 64);
  }

  const originalSnapshotJson = JSON.stringify(run.snapshots[0]);
  let ledger = createAdjudicationLedger(run.configuration.datasetVersion, run.snapshots);
  ledger = appendAdjudicationEvent(ledger, {
    record_id: run.snapshots[0].record_id,
    model_snapshot_id: run.snapshots[0].snapshot_id,
    stage: "PRIMARY_REVIEW",
    reviewer_id: "pv-reviewer-1",
    reviewer_qualification_attested: true,
    reviewer_decision: "NON_CASE",
    reviewer_notes: "Manual review found that the text does not describe an observed event for this test scenario.",
    adjudication_timestamp: "2026-09-18T10:00:00.000Z",
  });
  assert.equal(ledger.events[0].disagreement_with_model, true);
  assert.equal(ledger.events[0].classifier_version, run.snapshots[0].classifier_version);
  assert.equal(ledger.events[0].taxonomy_version, run.snapshots[0].taxonomy_version);
  assert.equal(ledger.events[0].reviewer_notes.length > 0, true);
  assert.equal(JSON.stringify(run.snapshots[0]), originalSnapshotJson, "Human review must not overwrite the historical model decision.");
  ledger = appendAdjudicationEvent(ledger, {
    record_id: run.snapshots[0].record_id,
    model_snapshot_id: run.snapshots[0].snapshot_id,
    stage: "FINAL_ADJUDICATION",
    reviewer_id: "pv-adjudicator-1",
    reviewer_qualification_attested: true,
    reviewer_decision: "NON_CASE",
    reviewer_notes: "Final adjudication confirms NON_CASE for harness workflow validation.",
    adjudication_timestamp: "2026-09-18T11:00:00.000Z",
  });

  const secondReviewSnapshot = run.snapshots[1];
  ledger = appendAdjudicationEvent(ledger, {
    record_id: secondReviewSnapshot.record_id,
    model_snapshot_id: secondReviewSnapshot.snapshot_id,
    stage: "PRIMARY_REVIEW",
    reviewer_id: "pv-reviewer-1",
    reviewer_qualification_attested: true,
    reviewer_decision: "NEEDS_SECOND_REVIEW",
    reviewer_notes: "The fragmented serious-event language requires a second qualified reviewer.",
    adjudication_timestamp: "2026-09-18T12:00:00.000Z",
  });
  assert.throws(() => appendAdjudicationEvent(ledger, {
    record_id: secondReviewSnapshot.record_id,
    model_snapshot_id: secondReviewSnapshot.snapshot_id,
    stage: "FINAL_ADJUDICATION",
    reviewer_id: "pv-adjudicator-1",
    reviewer_qualification_attested: true,
    reviewer_decision: "TRUE_PV_CANDIDATE",
    reviewer_notes: "Premature final decision.",
    adjudication_timestamp: "2026-09-18T12:30:00.000Z",
  }), /second review is required/i);
  ledger = appendAdjudicationEvent(ledger, {
    record_id: secondReviewSnapshot.record_id,
    model_snapshot_id: secondReviewSnapshot.snapshot_id,
    stage: "SECOND_REVIEW",
    reviewer_id: "pv-reviewer-2",
    reviewer_qualification_attested: true,
    reviewer_decision: "TRUE_PV_CANDIDATE",
    reviewer_notes: "Second review confirms a candidate serious observed event requiring human PV assessment.",
    adjudication_timestamp: "2026-09-18T13:00:00.000Z",
  });
  ledger = appendAdjudicationEvent(ledger, {
    record_id: secondReviewSnapshot.record_id,
    model_snapshot_id: secondReviewSnapshot.snapshot_id,
    stage: "FINAL_ADJUDICATION",
    reviewer_id: "pv-adjudicator-1",
    reviewer_qualification_attested: true,
    reviewer_decision: "TRUE_PV_CANDIDATE",
    reviewer_notes: "Final adjudication accepts the serious-event candidate label.",
    adjudication_timestamp: "2026-09-18T14:00:00.000Z",
  });
  assert.equal(validateAdjudicationLedger(ledger), true);
  assert.deepEqual(adjudicationAuditTrail(ledger, run.snapshots[0].record_id).map((item) => item.stage), ["ORIGINAL_MODEL_DECISION", "PRIMARY_REVIEW", "FINAL_ADJUDICATION"]);
  assert.deepEqual(adjudicationAuditTrail(ledger, secondReviewSnapshot.record_id).map((item) => item.stage), ["ORIGINAL_MODEL_DECISION", "PRIMARY_REVIEW", "SECOND_REVIEW", "FINAL_ADJUDICATION"]);

  const adjudicatedReport = buildPvEvaluationReport({ records: run.records, snapshots: run.snapshots, regressions: run.regressions, regressionSnapshots: run.regressionSnapshots, basis: "ADJUDICATED_ONLY", generatedAt: "2026-09-18T15:00:00.000Z", ledger });
  assert.equal(adjudicatedReport.overall.evaluated_records, 2);
  assert.equal(adjudicatedReport.overall.excluded_records, 34);
  assert.equal(adjudicatedReport.unadjudicated_record_ids.length, 34);
  assert.equal(adjudicatedReport.qualification, "PRELIMINARY_NOT_FOR_PRODUCTION_QUALIFICATION");

  const tampered = structuredClone(ledger);
  tampered.events[0].reviewer_notes = "tampered";
  assert.throws(() => validateAdjudicationLedger(tampered), /integrity check failed/);
  assert.throws(() => createAdjudicationLedger(run.configuration.datasetVersion, [{ ...run.snapshots[0], model_decision: { ...run.snapshots[0].model_decision, routed_for_pv_review: false } }]), /integrity check failed/);
  assert.throws(() => appendAdjudicationEvent(createAdjudicationLedger(run.configuration.datasetVersion, run.snapshots), {
    record_id: run.snapshots[0].record_id,
    model_snapshot_id: run.snapshots[0].snapshot_id,
    stage: "PRIMARY_REVIEW",
    reviewer_id: "unqualified-reviewer",
    reviewer_qualification_attested: false,
    reviewer_decision: "TRUE_PV_CANDIDATE",
    reviewer_notes: "Attempted unqualified review.",
    adjudication_timestamp: "2026-09-18T16:00:00.000Z",
  }), /qualification attestation is required/);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asksocial-pv-validation-"));
  try {
    const outputDirectory = path.join(temporaryRoot, "evaluation-snapshot");
    writePvEvaluationRun({ outputDirectory, snapshots: run.snapshots, regressionSnapshots: run.regressionSnapshots, report: run.report });
    for (const fileName of ["model-decisions.jsonl", "false-negative-regression-decisions.jsonl", "evaluation-report.json", "adjudication-worksheet.csv", "run-manifest.json"]) assert(fs.existsSync(path.join(outputDirectory, fileName)));
    const worksheet = fs.readFileSync(path.join(outputDirectory, "adjudication-worksheet.csv"), "utf8");
    for (const column of ["model_routed_for_pv_review", "reviewer_decision", "reviewer_notes", "adjudication_timestamp", "classifier_version", "taxonomy_version"]) assert(worksheet.split("\n")[0].includes(column));
    assert.throws(() => writePvEvaluationRun({ outputDirectory, snapshots: run.snapshots, regressionSnapshots: run.regressionSnapshots, report: run.report }), /already exists/);
    const eventFile = path.join(outputDirectory, "adjudication-events.jsonl");
    appendAdjudicationEventFile(eventFile, ledger.events[0]);
    appendAdjudicationEventFile(eventFile, ledger.events[1]);
    assert.equal(fs.readFileSync(eventFile, "utf8").trim().split("\n").length, 2, "Adjudication persistence must append rather than replace prior events.");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  console.log(JSON.stringify({
    datasetVersion: run.configuration.datasetVersion,
    goldCandidatesPendingReview: run.records.length,
    positiveSeededReferences: 18,
    negativeSeededReferences: 18,
    metricSlices: PV_EVALUATION_SLICES.length,
    falseNegativeRegressions: run.regressions.length,
    falseNegativeRegressionsPassing: run.report.regression.passed_record_ids.length,
    appendOnlyAdjudication: true,
    immutableModelSnapshots: true,
    preliminaryMetrics: run.report.overall,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
