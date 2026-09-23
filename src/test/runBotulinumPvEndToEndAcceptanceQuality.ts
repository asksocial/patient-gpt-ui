import assert from "node:assert/strict";
import {
  getBotulinumPvEndToEndAcceptanceManifest,
  runBotulinumPvEndToEndAcceptance,
} from "../lib/pv";

const report = runBotulinumPvEndToEndAcceptance({ generatedAt: "2026-09-17T20:00:00.000Z" });
const manifest = getBotulinumPvEndToEndAcceptanceManifest();

assert(report.counts.input_examples >= manifest.minimumSyntheticExamples);
assert.equal(report.counts.input_examples, report.counts.output_examples, "No synthetic source record may disappear.");
assert.equal(report.cases.length, report.counts.input_examples);
assert.equal(new Set(report.cases.map((item) => item.id)).size, report.cases.length);
assert(manifest.requiredProducts.every((product) => report.cases.some((item) => item.tags.includes(product))));
assert(manifest.requiredConcepts.every((concept) => report.cases.some((item) => item.meddra_candidate.some((candidate) => candidate.meddra_pt_candidate === concept)) || report.failures.some((failure) => "evidence" in failure && String(failure.evidence).includes(concept))), "Every required concept must be exercised or explicitly surfaced as a failure.");
for (const item of report.cases) {
  for (const requiredField of [
    "raw_mention", "detected_product", "detected_event", "normalized_event", "meddra_candidate",
    "negation_status", "hypothetical_status", "temporal_evidence", "causality_evidence", "P_status",
    "R_status", "D_status", "E_status", "pv_relevance", "icsr_candidate_status",
    "human_review_routing", "e2b_r3_fields_populated", "missing_fields", "client_notification_fields",
    "explanation_and_evidence_spans",
  ]) assert(requiredField in item, `${item.id} is missing requested output ${requiredField}.`);
  assert.equal(item.raw_mention.length > 0, true);
  assert.equal(item.human_review_queue.retained, true);
  assert.equal(item.human_review_queue.final_regulatory_disposition, null);
  assert.equal(item.provenance.source.original_timestamp.length > 0, true);
  assert.equal(item.provenance.versions.classifier_version.length > 0, true);
  for (const field of item.e2b_r3_fields_populated) assert(["SOURCE", "AI_NORMALIZED", "HUMAN_REVIEWED"].includes(field.value_source));
}
for (const criterion of report.acceptance_criteria) assert(["PASS", "FAIL"].includes(criterion.status));
assert(report.failures.every((failure) => failure.scope === "acceptance" || failure.scope === "example"));
assert(report.remediation_recommendations.length > 0);
assert(report.technical_debt.length > 0);
assert(report.production_readiness.includes("HUMAN-REVIEW") || report.production_readiness.includes("PV_APPROVAL"));

console.log(JSON.stringify({
  acceptanceSuiteVersion: report.acceptance_suite_version,
  overallStatus: report.overall_status,
  counts: report.counts,
  acceptanceCriteria: Object.fromEntries(report.acceptance_criteria.map((item) => [item.id, item.status])),
  failureCount: report.failures.length,
  productionReadiness: report.production_readiness,
}, null, 2));
