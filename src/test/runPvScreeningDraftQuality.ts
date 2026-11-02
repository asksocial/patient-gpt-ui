import assert from "node:assert/strict";
import { buildR3AlignedCase } from "../lib/pv/icsr/case";
import { transitionIcsrSnapshot } from "../lib/pv/icsr/workflow";
import { assertScreeningDraftRecord, screeningDraftFingerprint } from "../lib/pv/icsr/screeningDraft";
import { validateIcsrReview } from "../lib/pv/icsr/review";
import { retainedReviewSegmentation, screeningReviewAccess, validateObservationForward } from "../lib/pv/screeningWorkflow";
import type { IcsrSnapshot } from "../lib/pv/icsr/types";

const timestamp = "2026-10-29T14:00:00.000Z";
const record = { id: "synthetic-screening", status: "in_review", updated_at: timestamp, original_verbatim: "A mention refers to semaglutide and nausea. No patient or reporter details were retained.", product_name: "semaglutide", potential_event: "nausea", source_type: "synthetic", source_url: "https://example.invalid/qa", identified_at: timestamp, posted_at: timestamp };
const extracted = buildR3AlignedCase(record);
const original: IcsrSnapshot = { revision: 0, originalExtraction: extracted, caseData: structuredClone(extracted), email: null };
const screening = {
  recordUpdatedAt: timestamp, productMention: "unclear", healthExperience: "unclear", selectedClasses: [], rationale: "QA unfinished assessment — no clinical disposition.", followUpOwner: "", followUpDueAt: "", identificationTime: "", patientEvidenceConfirmed: false,
  ontologyReview: { productProcedure: "semaglutide", adverseEvent: "nausea", seriousness: "unclear", outcome: "unknown", timeToOnset: "unknown", timeToOnsetDetail: "", severity: "unclear", unexpectedness: "unclear", causalityLanguage: "" },
  e2dReview: Object.fromEntries(["reportType", "primarySourceType", "patientIdentifierBasis", "patientAssociation", "patientExistenceStatus", "patientVerificationEvidence", "patientFollowUpFeasibility", "patientFollowUpStatus", "reporterIdentifierBasis", "reporterRelationship", "reporterExistenceStatus", "reporterVerificationEvidence", "reporterFollowUpFeasibility", "reporterFollowUpStatus", "patientCharacteristics", "therapyDetails", "medicalHistory", "concurrentConditions", "clinicalCourse", "diagnosisAndLaboratoryEvidence", "alternativeCausesAndConfounders", "followUpNeeded", "followUpQuestions", "duplicateStatus", "duplicateReference", "regionalReportingAssessment"].map(key => [key, ""])),
};
Object.assign(screening.e2dReview, { patientCharacteristicTypes: [], seriousnessCriteria: [] });
const saved = transitionIcsrSnapshot(original, { action: "save_screening", screening }, "qa-reviewer", timestamp);
assert.equal(saved.revision, 1);
assert.equal(saved.screeningDraft?.savedBy, "qa-reviewer");
assert.equal(saved.screeningDraft?.rationale, screening.rationale);
assert.deepEqual(saved.caseData, original.caseData, "Draft save must not alter case facts, criteria, approval or email status.");
assert.deepEqual(saved.originalExtraction, original.originalExtraction);
assert.equal(saved.email, null);
assert(validateIcsrReview(saved.caseData).issues.length > 0);
assert.throws(() => transitionIcsrSnapshot(saved, { action: "approve" }, "qa-reviewer", timestamp));
assert.throws(() => transitionIcsrSnapshot(saved, { action: "generate" }, "qa-reviewer", timestamp));
const reloaded = JSON.parse(JSON.stringify(saved));
assert.equal(reloaded.screeningDraft.rationale, screening.rationale);
const { savedAt: _at, savedBy: _by, ...fields } = reloaded.screeningDraft;
assert.equal(screeningDraftFingerprint(fields), screeningDraftFingerprint(screening), "Field key order must not make a restored draft appear unsaved.");
assert.throws(() => transitionIcsrSnapshot(saved, { action: "save_screening", screening: { ...screening, selectedClasses: ["invented"] } }, "qa", timestamp));
assert.throws(() => transitionIcsrSnapshot(saved, { action: "save_screening", screening: { ...screening, rationale: "x".repeat(10001) } }, "qa", timestamp));
assertScreeningDraftRecord(record, timestamp);
assert.throws(() => assertScreeningDraftRecord(record, "2026-10-29T15:00:00Z"), /Reload/);
for (const status of ["ready_for_transfer", "transferred", "acknowledged", "reconciled"]) assert.throws(() => assertScreeningDraftRecord({ ...record, status }, timestamp));
for (const status of ["new", "in_review"]) assert(screeningReviewAccess(status).canStart);
for (const status of ["health_experience", "not_relevant"]) assert(screeningReviewAccess(status).canReopen);
assert(!screeningReviewAccess("transferred").canReopen);
const reclassified = { reviewer_detection_segment: "health_experience", reviewer_health_experience_tags: ["other_observation"], segment_reclassified_at: timestamp, segment_reclassified_by: "qualified-reviewer" };
assert.deepEqual(retainedReviewSegmentation(reclassified), reclassified, "Closing or forwarding must preserve the prior Health Experience pathway and attribution.");
const observation = { productMention: "yes", healthExperience: "yes", classifications: ["other"], followUpOwner: "qualified-reviewer", followUpDueAt: "2026-10-30T14:00:00Z" };
validateObservationForward(observation, Date.parse(timestamp));
for (const patch of [{ productMention: "unclear" }, { healthExperience: "no" }, { classifications: [] }, { followUpOwner: "" }, { followUpDueAt: timestamp }, { followUpDueAt: "invalid" }]) assert.throws(() => validateObservationForward({ ...observation, ...patch }, Date.parse(timestamp)));
console.log("Pass: incomplete draft retention, provenance, unchanged criteria/approval, guarded ICSR handoff, stale/terminal record protection, Health Experience access and preserved segmentation, observation follow-up validation.");
