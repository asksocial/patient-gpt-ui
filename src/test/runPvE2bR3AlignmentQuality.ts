import assert from "node:assert/strict";
import { buildPvClientNotification, buildPvE2bAlignedCase, escapePvEmailHtml, getActivePvE2bMapping, getActivePvE2bManifest, getActivePvEmailMapping, getActivePvIchCodeLists, renderPvClientNotificationHtml, validatePvE2bCase } from "../lib/pv/e2b";

const record = {
  id: "case-001", external_id: "source-001", principal_id: "client-001", status: "in_review",
  source_type: "reddit", source_url: "https://www.reddit.com/r/example/comments/1", author_identifier: "patient_writer",
  original_verbatim: "I am a 42 year old woman. After receiving Product A, I developed severe swelling and was admitted to hospital.",
  posted_at: "2026-09-01T08:00:00.000Z", ingested_at: "2026-09-01T09:00:00.000Z", algorithm_assessed_at: "2026-09-01T09:01:00.000Z",
  review_started_at: "2026-09-01T10:00:00.000Z", created_at: "2026-09-01T09:01:00.000Z", updated_at: "2026-09-01T10:05:00.000Z",
  detection_score: 0.92, classifier_version: "pv-classifier-test", product_name: "Product A", evidence_hash: "hash-001",
};

const ontology: any = {
  productProcedures: [{ value: "Product A", evidence: "receiving Product A", confidence: 0.99, role: "suspect" }],
  adverseEvents: [{ value: "severe swelling", evidence: "developed severe swelling", confidence: 0.97, meddraSuggestion: "Swelling", meddraValidated: true, meddraCode: "10042674", meddraVersion: "client-test-version" }],
  seriousness: { value: "serious", criteria: ["hospitalization"], evidence: ["admitted to hospital"], confidence: 0.98 },
  outcomes: [{ value: "ongoing", category: "ongoing", evidence: "not resolved", confidence: 0.8 }],
  timeToOnset: { category: "days", value: "2 days", evidence: "two days later", confidence: 0.8 },
  severity: { value: "severe", evidence: "severe", confidence: 0.99 },
  unexpectedness: { value: "unclear", basis: "insufficient_reference", confidence: 0 },
  causality: [{ value: "temporal_association", phrase: "after", evidence: "After receiving", confidence: 0.9 }],
  limitations: ["Dose not reported"], ontologyVersion: "test",
  icsrAssessment: {
    reportType: "spontaneous", primarySourceType: "consumer",
    minimumCriteria: {
      suspectProduct: { status: "yes", evidence: "Product A" }, adverseEventOrObservation: { status: "yes", evidence: "swelling" },
      identifiablePatient: { status: "yes", evidence: "42 year old woman" }, identifiableReporter: { status: "yes", evidence: "reviewer verified first-hand reporter" },
    },
    patientAssessment: { association: "specific_patient", existenceStatus: "verified", characteristicTypes: ["age_or_age_category", "sex_or_gender"], qualifyingCharacteristics: ["42 year old", "woman"], identifierBasis: "42 year old woman", verificationEvidence: "Reviewer confirmed source evidence", reviewerConfirmed: true },
    reporterAssessment: { relationship: "self_report", existenceStatus: "verified", qualifyingCharacteristics: ["consumer"], identifierBasis: "consumer", verificationEvidence: "Reviewer confirmed first-hand source" },
    seriousnessCriteria: ["hospitalization"],
    clinicalNarrative: { clinicalCourse: "Reporter states that after receiving Product A, the patient experienced severe swelling and was admitted to hospital. Dose and indication were not reported." },
    followUp: { needed: "yes", questions: "Obtain dose and outcome." }, duplicateAssessment: { status: "no_match" },
  },
};

const review = { id: "review-001", decision: "escalate", reviewer_id: "reviewer-001", reviewed_at: "2026-09-01T10:05:00.000Z", rationale: "Minimum criteria confirmed.", classifications: ["adverse_event"], validated_ae_ontology: ontology };

function build(overrides: { record?: any; ontology?: any; review?: any; classifications?: any; relationships?: any } = {}) {
  return buildPvE2bAlignedCase({ record: { ...record, ...(overrides.record || {}) }, ontology: overrides.ontology || ontology,
    review: overrides.review === undefined ? review : overrides.review, classifications: overrides.classifications || ["adverse_event"],
    relationships: overrides.relationships, now: "2026-09-01T10:05:00.000Z" });
}

const scenarios: Array<[string, () => void]> = [
  ["complete P-R-D-E case", () => assert.equal(build().classification, "potential_icsr_complete")],
  ["missing reporter", () => { const o = structuredClone(ontology); o.icsrAssessment.minimumCriteria.identifiableReporter.status = "no"; assert.equal(build({ ontology: o }).classification, "potential_icsr_incomplete"); }],
  ["missing identifiable patient", () => { const o = structuredClone(ontology); o.icsrAssessment.minimumCriteria.identifiablePatient.status = "no"; assert.ok((build({ ontology: o }).review.minimumCriteriaMissing as string[]).includes("identifiablePatient")); }],
  ["missing suspect product", () => { const o = structuredClone(ontology); o.icsrAssessment.minimumCriteria.suspectProduct.status = "no"; o.productProcedures = []; assert.equal(build({ ontology: o, record: { product_name: null } }).drugs.length, 0); }],
  ["missing event", () => { const o = structuredClone(ontology); o.icsrAssessment.minimumCriteria.adverseEventOrObservation.status = "no"; o.adverseEvents = []; assert.equal(build({ ontology: o }).reactions.length, 0); }],
  ["multiple reactions", () => { const o = structuredClone(ontology); o.adverseEvents.push({ value: "headache", evidence: "and headache", confidence: 0.8 }); assert.equal(build({ ontology: o }).reactions.length, 2); }],
  ["multiple suspected products", () => { const o = structuredClone(ontology); o.productProcedures.push({ value: "Product B", evidence: "also Product B", confidence: 0.8 }); assert.equal(build({ ontology: o }).drugs.length, 2); }],
  ["suspect plus concomitant", () => { const o = structuredClone(ontology); o.productProcedures.push({ value: "Product C", evidence: "taking Product C", confidence: 0.8, role: "concomitant" }); assert.equal(build({ ontology: o }).drugs[1].role, "concomitant"); }],
  ["serious hospitalization", () => assert.ok((build().reactions[0].seriousness as any).criteria.includes("hospitalization"))],
  ["fatal event", () => { const o = structuredClone(ontology); o.outcomes = [{ value: "fatal", category: "fatal", evidence: "died", confidence: 1 }]; assert.equal(build({ ontology: o }).reactions[0].outcome, "fatal"); }],
  ["pregnancy exposure", () => assert.equal(build({ classifications: ["pregnancy"] }).specialSituations[0].type, "pregnancy_exposure")],
  ["medication error without AE", () => { const o = structuredClone(ontology); o.adverseEvents = []; o.icsrAssessment.minimumCriteria.adverseEventOrObservation.status = "no"; assert.equal(build({ ontology: o, classifications: ["medication_error"] }).classification, "special_situation"); }],
  ["medication error with AE", () => { const c = build({ classifications: ["adverse_event", "medication_error"] }); assert.ok(c.reactions.length && c.specialSituations.length); }],
  ["off-label routes to human review", () => { assert.ok(getActivePvE2bMapping().humanReviewTriggers.some((x) => x.includes("off-label"))); assert.equal(build({ classifications: ["off_label_use"] }).specialSituations[0].type, "off_label_use"); }],
  ["lack of efficacy", () => assert.equal(build({ classifications: ["lack_of_efficacy"] }).specialSituations[0].type, "lack_of_efficacy")],
  ["ambiguous causality", () => { const o = structuredClone(ontology); o.causality = []; assert.equal(build({ ontology: o }).review.causalityStatementPresent, "no_or_unclear"); }],
  ["explicit reporter causality", () => assert.equal(build().review.causalityStatementPresent, "yes")],
  ["no causal statement is not fabricated", () => { const o = structuredClone(ontology); o.causality = []; assert.equal(build({ ontology: o }).narrative.causalityIsAttributed, false); }],
  ["uncertain product retains confidence", () => assert.equal(build({ record: { detection_score: 0.4 } }).evidence.find((x) => x.field === "drugs[].productNameReported")?.extractionConfidence, 0.4)],
  ["machine MedDRA suggestion awaits review", () => { const o = structuredClone(ontology); o.adverseEvents[0].meddraValidated = false; assert.ok(build({ ontology: o }).validation.issues.some((x) => x.code === "meddra_requires_validation")); }],
  ["duplicate social post", () => assert.ok(build({ relationships: [{ type: "possible_duplicate_of", targetCaseId: "case-000", confidence: 0.9, rationale: ["same URL"], status: "proposed" }] }).validation.issues.some((x) => x.code === "relationship_requires_review"))],
  ["follow-up is linked without merge", () => assert.equal(build({ relationships: [{ type: "follow_up_to", targetCaseId: "case-000", confidence: 0.8, rationale: ["same author"], status: "proposed" }] }).relationships[0].targetCaseId, "case-000")],
  ["unknown event date remains blank", () => assert.equal(build().reactions[0].onsetAt, undefined)],
  ["conflicting age remains distinct", () => { const c = build(); c.missing["patient.age"] = "conflicting"; assert.equal(c.missing["patient.age"], "conflicting"); }],
  ["PII is excluded from email config", () => { const c = build(); c.reporter.givenName = "Jane"; assert.ok(!JSON.stringify(buildPvClientNotification(c)).includes("Jane")); }],
  ["missing optional email fields are omitted", () => assert.ok(!buildPvClientNotification(build()).sections.flatMap((s) => s.fields).some((f) => f.field === "patient.medicalHistory"))],
  ["source scripts are escaped", () => { const html = renderPvClientNotificationHtml([buildPvClientNotification(build({ record: { original_verbatim: "<script>alert(1)</script>" } }))]); assert.ok(!html.includes("<script>")); assert.ok(html.includes("&lt;script&gt;")); }],
  ["low-confidence extraction is retained", () => assert.equal(build({ record: { detection_score: 0.2 } }).evidence[0].extractionConfidence, 0.2)],
  ["human-reviewed extraction is labeled", () => assert.ok(build().evidence.some((x) => x.extractionType === "human_validated"))],
  ["audit timestamps remain independent", () => { const a = build().audit; assert.equal(new Set([a.sourcePublishedAt, a.collectedAt, a.algorithmAssessedAt, a.humanReviewStartedAt, a.humanReviewedAt]).size, 5); }],
  ["notification cannot claim submission readiness", () => assert.equal(build().validation.regulatorySubmissionReady, false)],
  ["closed record is not PV reportable", () => assert.equal(build({ record: { status: "not_relevant" }, review: { ...review, decision: "close_not_relevant" } }).classification, "not_pv_relevant")],
  ["FDA regional mapping stays pending", () => assert.equal(getActivePvE2bMapping().mappings.find((x) => x.askSocialField === "administrative.fdaRegionalData")?.verificationStatus, "pending")],
  ["mapping package matches manifest", () => assert.equal(getActivePvE2bManifest().activeMappingVersion, getActivePvE2bMapping().mappingVersion)],
  ["email package matches manifest", () => assert.equal(getActivePvE2bManifest().activeEmailMappingVersion, getActivePvEmailMapping().emailMappingVersion)],
  ["HTML attributes are escaped", () => assert.equal(escapePvEmailHtml('" onload="x'), "&quot; onload=&quot;x")],
  ["E2B export differs from triage", () => { const c = build(); assert.equal(c.validation.pvTriageValid, true); assert.equal(c.validation.e2bExportReady, false); }],
  ["every field defines missing handling", () => assert.ok(getActivePvE2bMapping().mappings.every((x) => x.unavailableHandling))],
  ["every field defines email inclusion", () => assert.ok(getActivePvE2bMapping().mappings.every((x) => x.emailIncluded))],
  ["validation is repeatable", () => assert.deepEqual(validatePvE2bCase(build()), build().validation)],
  ["January 2026 ODCS code is configuration-backed", () => assert.equal(getActivePvIchCodeLists().codeLists.CL8.values.find((x) => x.code === "6")?.label, "Organised Data Collection System with source data from a digital platform")],
];

for (const [name, test] of scenarios) { test(); console.log(`PASS ${name}`); }
console.log(`PV E2B(R3) scenarios passed: ${scenarios.length}`);
