import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildR3AlignedCase, caseFields, displayField, generateCaseNarrative } from "../lib/pv/icsr/case";
import { exportIcsrSummary, generateIcsrEmail, ICSR_ASSESSMENT } from "../lib/pv/icsr/email";
import { applyCaseReview, approveIcsr, changedPaths, validateEmail, validateIcsrReview } from "../lib/pv/icsr/review";
import { transitionIcsrSnapshot } from "../lib/pv/icsr/workflow";
import type { IcsrSnapshot, R3AlignedCase } from "../lib/pv/icsr/types";

const source = "I am a 32-year-old female. I received BOTOX and Dysport. Two days later I had trouble swallowing and blurred vision. I ended up in the hospital. Dose unknown.";
function fixture(text = source): Record<string, any> {
  return {
    id: "a23d8974-4fa5-4115-891b-f26abf054eae", source_type: "Reddit", source_url: "https://example.org/post/1",
    author_identifier: "@public-account", original_verbatim: text, market: "US", posted_at: "2026-09-30T12:00:00Z",
    identified_at: "2026-10-01T10:00:00Z", ingested_at: "2026-10-01T09:00:00Z", evidence_hash: "evidence-hash",
    detection_score: 90, ae_ontology: {
      productProcedures: [{ value: "BOTOX", evidence: "BOTOX", dose: "unknown", fieldEvidence: { dose: "unknown" }, confidence: 0.9 }],
      adverseEvents: [{ value: "Difficulty swallowing", evidence: "trouble swallowing", confidence: 0.9 }],
      seriousness: { value: "serious", criteria: ["hospitalization"], evidence: ["I ended up in the hospital"], confidence: 0.9 },
      timeToOnset: { value: "Two days later", evidence: "Two days later", confidence: 0.9 }, outcomes: [],
      icsrAssessment: { minimumCriteria: { identifiablePatient: { status: "yes", evidence: "32-year-old female" }, identifiableReporter: { status: "yes", evidence: "@public-account" } } },
    },
  };
}
function reviewed(input: R3AlignedCase): R3AlignedCase {
  const draft = structuredClone(input);
  // Qualified reviewer confirms the existing public identifier under client procedures.
  draft.minimumCriteria.reporter.present = "present";
  for (const criterion of Object.values(draft.minimumCriteria)) criterion.confirmed = true;
  for (const [, field] of caseFields(draft)) field.confirmed = true;
  draft.identification.reportType.availability = "reported";
  draft.identification.reportType.evidence = "Initial review of source mention; no previous notification.";
  return draft;
}
const original = buildR3AlignedCase(fixture());
assert.throws(() => generateIcsrEmail(original), /Human review/);
assert.equal(original.identification.country.availability, "not_reported", "Configured market must not become patient country");
assert.equal(original.minimumCriteria.reporter.present, "potentially_present", "A username requires client PV review");
const complete = reviewed(original);
assert.equal(validateIcsrReview(complete).completePotentialIcsr, true, "A: All minimum elements supported");
assert.deepEqual(validateIcsrReview(complete).issues, []);
const approved = approveIcsr(complete, "reviewer-1", "2026-10-01T12:00:00Z");
const email = generateIcsrEmail(approved);
assert.match(email.subject, /^Potential ICSR – BOTOX/);
for (const heading of ["Potential Safety Case Identified", "Minimum ICSR Criteria", "Patient", "Reporter", "Suspect Product", "Adverse Event(s)", "Case Narrative", "Concomitant Products", "Relevant Medical History", "Source Evidence", "Information Not Available", "AskSocial Assessment"]) assert.ok(email.body.includes(heading));
assert.ok(email.body.includes(ICSR_ASSESSMENT));
console.log("PASS A: complete potential case requires explicit human approval before preview");

for (const [letter, key] of [["B", "patient"], ["C", "reporter"]] as const) {
  const missing = structuredClone(complete);
  missing.minimumCriteria[key] = { ...missing.minimumCriteria[key], present: "not_identified", evidence: "", source_reference: null };
  assert.equal(validateIcsrReview(missing).completePotentialIcsr, false);
  assert.equal(validateIcsrReview(missing).label, "Potential Safety Signal — Minimum ICSR Criteria Require Review");
  assert.throws(() => approveIcsr(missing, "reviewer", "now"), /Minimum ICSR/);
  assert.equal(missing.events.length, 1, "Incomplete records must not be discarded");
  console.log(`PASS ${letter}: missing ${key} retained and approval blocked`);
}
const multiple = fixture();
multiple.ae_ontology.adverseEvents.push({ value: "Blurred vision", evidence: "blurred vision" });
multiple.ae_ontology.productProcedures.push({ value: "Dysport", evidence: "Dysport" });
const multiCase = buildR3AlignedCase(multiple);
assert.equal(multiCase.events.length, 2);
assert.equal(multiCase.suspectProducts.length, 2);
assert.equal(multiCase.events[1].verbatim.value, "blurred vision");
assert.equal(multiCase.events[1].onset.availability, "not_reported", "Do not distribute case-level timing across events");
assert.equal(multiCase.events[0].seriousness.hospitalization.value, "requires_pv_review");
const multiEmail = generateIcsrEmail(approveIcsr(reviewed(multiCase), "reviewer", "now"));
assert.ok(multiEmail.body.includes("Product 2") && multiEmail.body.includes("Event 2"));
console.log("PASS D/E: multiple events/products preserved independently in case and email");

assert.equal(original.events[0].seriousness.hospitalization.value, "evidence_present");
assert.equal(original.pvAssessment.seriousness.value, "");
assert.ok(email.body.includes("classification requires PV assessment"));
const conditional = buildR3AlignedCase(fixture(source.replace("I ended up in the hospital", "If I was hospitalized")));
assert.equal(conditional.events[0].seriousness.hospitalization.value, "requires_pv_review");
console.log("PASS F: hospitalization language is evidence, not an automatic seriousness determination");

const causalityRecord = fixture("I am a 32-year-old female. Botox ruined my ability to swallow.");
causalityRecord.ae_ontology.productProcedures = [{ value: "Botox", evidence: "Botox" }];
causalityRecord.ae_ontology.adverseEvents = [{ value: "Difficulty swallowing", evidence: "Botox ruined my ability to swallow" }];
const causality = buildR3AlignedCase(causalityRecord);
assert.ok(generateCaseNarrative(causality).includes("The source reported: “Botox ruined my ability to swallow”"));
assert.ok(generateCaseNarrative(causality).includes("causality has not been determined by AskSocial"));
assert.equal(causality.pvAssessment.causality.value, "");
console.log("PASS G: reporter attribution remains a quotation, separate from PV causality");

assert.equal(displayField(original.patient.weight), "Not reported");
assert.equal(displayField(original.suspectProducts[0].dose), "Unknown (explicitly reported)");
assert.equal(original.suspectProducts[0].batchLot.value, "");
assert.equal(original.events[0].meddraTerm.value, "");
const unsupported = fixture(); unsupported.ae_ontology.productProcedures[0].dose = "100 units";
unsupported.ae_ontology.productProcedures[0].fieldEvidence.dose = "fabricated evidence";
assert.equal(buildR3AlignedCase(unsupported).suspectProducts[0].dose.availability, "not_reported");
unsupported.ae_ontology.productProcedures[0].fieldEvidence.dose = "BOTOX";
assert.equal(buildR3AlignedCase(unsupported).suspectProducts[0].dose.availability, "not_reported", "A real but unrelated quote cannot populate a clinical value");
console.log("PASS H: missing and explicitly unknown are distinct; unsupported clinical values rejected");

const correction = applyCaseReview(approved, { fields: { "events.0.normalizedEvent": { value: "Swallowing difficulty", availability: "reported", evidence: "trouble swallowing", source_reference: original.sourceEvidence[0].id, confirmed: true } }, internalNotes: "PRIVATE INTERNAL NOTE" });
assert.equal(original.events[0].normalizedEvent.value, "Difficulty swallowing");
assert.equal(correction.events[0].normalizedEvent.value, "Swallowing difficulty");
assert.equal(correction.events[0].normalizedEvent.origin, "human_added");
assert.equal(correction.approval, null);
assert.throws(() => generateIcsrEmail(correction), /Human review/);
const oldSnapshot: IcsrSnapshot = { revision: 1, originalExtraction: original, caseData: approved, email };
const nextSnapshot: IcsrSnapshot = { revision: 2, originalExtraction: original, caseData: correction, email: null };
assert.ok(changedPaths(oldSnapshot, nextSnapshot).includes("caseData.events.0.normalizedEvent.value"));
assert.equal(nextSnapshot.originalExtraction.events[0].normalizedEvent.value, "Difficulty swallowing");
const correctedApproved = approveIcsr(correction, "reviewer-2", "2026-10-01T13:00:00Z");
const correctedEmail = generateIcsrEmail(correctedApproved);
assert.ok(!correctedEmail.body.includes("PRIVATE INTERNAL NOTE"));
assert.ok(!JSON.stringify(exportIcsrSummary(correctedApproved, correctedEmail)).includes("PRIVATE INTERNAL NOTE"));
console.log("PASS I: human correction preserves extraction, requires renewed approval, and excludes internal notes");

assert.throws(() => applyCaseReview(original, { fields: { "sourceEvidence.0.excerpt": {} as any } }), /Invalid case field/);
assert.throws(() => applyCaseReview(original, { fields: { "patient.age": { ...original.patient.age, source_reference: "other-tenant" } } }), /Unknown source/);
assert.throws(() => applyCaseReview(original, { fields: { "patient.age": { ...original.patient.age, value: "", availability: "reported" } } }), /must not be empty/);
assert.throws(() => validateEmail({ ...email, subject: "case\nBcc: attacker@example.org" }), /header newlines/);
assert.throws(() => validateEmail({ ...email, recipients: "invalid" }), /email addresses/);
assert.equal(validateEmail({ ...email, recipients: "pv@example.org; safety@example.org" }).recipients, "pv@example.org; safety@example.org");
const migration = readFileSync("supabase/migrations/202610010001_create_pv_icsr_email_reviews.sql", "utf8");
assert.ok(migration.includes("pg_advisory_xact_lock") && migration.includes("v_revision <> p_expected_revision"));
assert.ok(migration.includes("Original extraction is immutable") && migration.includes("before update or delete"));
assert.ok(migration.includes("enable row level security") && migration.includes("from public, anon, authenticated"));
const route = readFileSync("src/app/api/pv/records/[recordId]/icsr/route.ts", "utf8");
assert.equal((route.match(/await requirePvPrincipal\(\)/g) || []).length, 2);
const service = readFileSync("src/lib/pv/icsr/service.ts", "utf8");
assert.ok(service.includes('.eq("principal_id", principal.principalId)'));
const workflow = readFileSync("src/lib/pv/icsr/workflow.ts", "utf8");
assert.ok(workflow.includes("sentConfirmation !== true"));
const pending: IcsrSnapshot = { revision: 0, originalExtraction: original, caseData: original, email: null };
assert.throws(() => transitionIcsrSnapshot(pending, { action: "generate" }, "reviewer", "now"), /Human review/);
const ready = transitionIcsrSnapshot(oldSnapshot, { action: "generate" }, "reviewer", "now");
assert.equal(ready.caseData.status, "email_ready");
assert.equal(ready.revision, 2);
assert.throws(() => transitionIcsrSnapshot(ready, { action: "sent", email: ready.email, sentConfirmation: false }, "reviewer", "now"), /Confirm the notification/);
const addressedEmail = { ...ready.email!, recipients: "pv@example.org" };
assert.throws(() => transitionIcsrSnapshot(ready, { action: "save_email", email: { ...addressedEmail, body: "Disclaimer deleted" } }, "reviewer", "now"), /Retain the AskSocial/);
const edited = transitionIcsrSnapshot(ready, { action: "save_email", email: { ...addressedEmail, subject: "Reviewed safety notification" } }, "reviewer", "now");
assert.equal(edited.email!.subject, "Reviewed safety notification");
const exported = transitionIcsrSnapshot(edited, { action: "export", email: edited.email }, "reviewer", "now");
assert.equal(exported.caseData.status, "exported");
const sent = transitionIcsrSnapshot(edited, { action: "sent", email: edited.email, sentConfirmation: true }, "reviewer", "now");
assert.equal(sent.caseData.status, "sent");
const reopened = transitionIcsrSnapshot(sent, { action: "save_review", review: { internalNotes: "Follow-up needed" } }, "reviewer", "now");
assert.equal(reopened.caseData.approval, null);
assert.equal(reopened.email, null);
assert.equal(sent.email!.subject, "Reviewed safety notification", "Previous snapshots remain unchanged");
console.log("PASS workflow: preview edits, disclaimer retention, export, explicit sent attestation, re-review invalidation");
console.log("PASS safeguards: server allowlist, provenance, header validation, migration/access guard assertions");
console.log("PV ICSR email quality: all scenarios passed. Database RPC/access execution requires a migrated test database.");
