import fs from "node:fs";
import path from "node:path";
import { calculatePvClock, classifyPvContent, derivePvOverviewMetrics, parsePvCsv, reconcilePvOperations, type PvDetectionConcept, type PvRecordStatus } from "../lib/pv";
import { buildEcosystemNavigation, configurationFromEntitlements, resolveCustomerIntelligenceAccess } from "../lib/intelligence-platform";
import { resolveEntitlements } from "../lib/entitlements";
import { createPvSponsorReport, sponsorReportFileName } from "../lib/pv/sponsorReport";
import { assessIcsrIdentifiability, patientCriterionStatus, reporterCriterionStatus } from "../lib/pv/identifiability";
import { PDFDocument } from "pdf-lib";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const concepts: PvDetectionConcept[] = [
  { id: "product", category: "product", canonicalTerm: "Product A", terms: ["product a", "prodct a"], language: "en", weight: 100, version: 3, active: true },
  { id: "rash", category: "adverse_experience", canonicalTerm: "rash", terms: ["rash", "hives"], exclusions: ["commercial says"], language: "en", weight: 100, version: 3, active: true },
  { id: "severe", category: "severity", canonicalTerm: "severe", terms: ["terrible", "emergency"], language: "en", weight: 80, version: 3, active: true },
];

const patientResult = classifyPvContent({
  externalId: "post-1", sourceType: "reddit", sourceUrl: "https://example.test/post-1",
  verbatim: "I started Product A and developed a terrible rash.", language: "en", postedAt: "2026-08-06T09:00:00.000Z",
}, concepts);
assert(patientResult.shouldCreateRecord, "A product-linked health experience must route to human PV review.");
assert(patientResult.classifications.includes("adverse_event"), "Potential adverse-event classification should be proposed.");
assert(patientResult.rationale.some((item) => item.includes("not an adverse-event determination")), "Detection must explicitly preserve human determination.");

const supportedIdentifiability = assessIcsrIdentifiability({ original_verbatim: "I am a 42-year-old woman and developed a rash after Product A.", author_identifier: "Jane Smith" });
assert(supportedIdentifiability.patient.status === "characteristics_detected" && supportedIdentifiability.patient.characteristicTypes.includes("age_or_age_category") && supportedIdentifiability.patient.criterionStatus === "yes" && supportedIdentifiability.reporter.status === "characteristics_detected", "One qualifying characteristic associated with a specific patient must satisfy the patient criterion while a named first-hand reporter remains verification-pending.");
assert(reporterCriterionStatus({ relationship: supportedIdentifiability.reporter.relationship, existenceStatus: supportedIdentifiability.reporter.status, identifierBasis: supportedIdentifiability.reporter.qualifyingCharacteristics.join("; ") }) === "unclear", "Detected reporter characteristics must not automatically satisfy the reporter criterion.");
assert(reporterCriterionStatus({ relationship: "self_report", existenceStatus: "verified", identifierBasis: "Name: Jane Smith" }) === "unclear", "Selecting verified without documenting verification evidence must not satisfy the reporter criterion.");
const verifiedIdentifiability = assessIcsrIdentifiability({ original_verbatim: "I am a 42-year-old woman and developed a rash after Product A.", author_identifier: "Jane Smith", reporter_existence_status: "verified", reporter_verification_evidence: "Identity confirmed during permitted follow-up." });
assert(verifiedIdentifiability.reporter.status === "verified" && reporterCriterionStatus({ relationship: verifiedIdentifiability.reporter.relationship, existenceStatus: verifiedIdentifiability.reporter.status, identifierBasis: verifiedIdentifiability.reporter.qualifyingCharacteristics.join("; "), verificationEvidence: verifiedIdentifiability.reporter.verificationEvidence }) === "yes", "A verified real, first-hand reporter with documented evidence must satisfy the reporter criterion.");
const anonymousVerified = assessIcsrIdentifiability({ original_verbatim: "I developed a rash after Product A.", author_identifier: "Anonymous", reporter_existence_status: "anonymous_verified", reporter_verification_evidence: "PV intake staff verified the individual's existence while retaining anonymity." });
assert(anonymousVerified.reporter.status === "anonymous_verified" && reporterCriterionStatus({ relationship: anonymousVerified.reporter.relationship, existenceStatus: anonymousVerified.reporter.status, verificationEvidence: anonymousVerified.reporter.verificationEvidence }) === "yes", "An anonymous reporter must qualify when existence and first-hand knowledge are verified and documented.");
const anonymousUnverified = assessIcsrIdentifiability({ original_verbatim: "I developed a rash after Product A.", author_identifier: "Anonymous" });
assert(anonymousUnverified.reporter.isAnonymous && anonymousUnverified.reporter.status === "not_established", "Anonymous intent alone must not establish that a real reporter exists.");
const handleOnlyIdentifiability = assessIcsrIdentifiability({ original_verbatim: "I developed a rash after Product A.", author_identifier: "@patient123" });
assert(handleOnlyIdentifiability.patient.status === "not_established" && handleOnlyIdentifiability.reporter.status === "not_established", "A first-person post and digital handle alone must not establish a real patient or reporter under ICH E2D(R1).");
const namedButNotFirstHand = assessIcsrIdentifiability({ original_verbatim: "Reports online say that Product A caused a rash.", author_identifier: "Jane Smith" });
assert(namedButNotFirstHand.reporter.status === "characteristics_detected" && namedButNotFirstHand.reporter.relationship === "second_hand", "A reporter name without personal experience or first-hand patient information must remain incomplete and be identified as second-hand.");
assert(reporterCriterionStatus({ relationship: namedButNotFirstHand.reporter.relationship, existenceStatus: "verified", verificationEvidence: "Identity verified" }) === "no", "A verified person providing only second-hand information must not qualify as the primary-source reporter.");
const patientOnlyQualifier = assessIcsrIdentifiability({ original_verbatim: "I am a 42-year-old woman and developed a rash after Product A.", author_identifier: "@patient123" });
assert(patientOnlyQualifier.patient.criterionStatus === "yes" && patientOnlyQualifier.reporter.status === "not_established", "A patient characteristic must not be reused as a reporter identifier when a digital handle is the only author identifier.");
const reporterInitials = assessIcsrIdentifiability({ original_verbatim: "I developed a rash after Product A.", author_identifier: "J.S." });
assert(reporterInitials.reporter.qualifyingCharacteristics.some((item) => item.startsWith("Initials")), "Reporter initials must be retained as an ICH qualifying characteristic without implying verification.");
const reporterOrganisation = assessIcsrIdentifiability({ original_verbatim: "We treated a patient who developed a rash after Product A.", author_identifier: "Dr. Smith, City Hospital" });
assert(reporterOrganisation.reporter.relationship === "first_hand_other" && reporterOrganisation.reporter.qualifyingCharacteristics.some((item) => item.startsWith("Organisation")), "Reporter qualification and organisation characteristics must support follow-up of a first-hand report.");
const professionalPage = assessIcsrIdentifiability({ original_verbatim: "Product A can help headaches.", author_identifier: "The Jaw Physio" });
assert(professionalPage.reporter.qualifyingCharacteristics.some((item) => item.startsWith("Qualification")) && !professionalPage.reporter.qualifyingCharacteristics.some((item) => item.startsWith("Name")), "A professional page label must not be misrepresented as a verified personal name.");
const promotionalFirstPerson = assessIcsrIdentifiability({ original_verbatim: "My clinic offers Product A and discusses rash risks.", author_identifier: "Jane Smith" });
assert(promotionalFirstPerson.reporter.relationship === "unclear", "Generic first-person promotional language must not be classified as personal experience.");
const aggregatePatients = assessIcsrIdentifiability({ original_verbatim: "Twenty patients experienced rash after Product A.", author_identifier: "Jane Smith" });
assert(aggregatePatients.patient.status === "not_established" && aggregatePatients.patient.criterionStatus === "no" && aggregatePatients.patient.limitations.some((item) => item.includes("specific identifiable patient")) && aggregatePatients.reporter.relationship === "unclear", "A definite-number aggregate statement must not establish a specific patient or a first-hand reporter.");
const namedPatient = assessIcsrIdentifiability({ original_verbatim: "My patient Jane Smith developed a rash after Product A.", author_identifier: "Dr. Jones" });
assert(namedPatient.patient.characteristicTypes.includes("name") && namedPatient.patient.criterionStatus === "yes", "An explicitly named patient with an associated event must satisfy the patient criterion.");
const patientDob = assessIcsrIdentifiability({ original_verbatim: "My patient was born on January 2, 1980 and developed a rash after Product A.", author_identifier: "Dr. Jones" });
assert(patientDob.patient.characteristicTypes.includes("date_of_birth") && patientDob.patient.criterionStatus === "yes", "An explicit patient date of birth must be retained as a qualifying characteristic.");
const patientId = assessIcsrIdentifiability({ original_verbatim: "My patient ID 12345 developed a rash after Product A.", author_identifier: "Dr. Jones" });
assert(patientId.patient.characteristicTypes.includes("patient_identifier") && !patientId.patient.characteristicTypes.includes("initials") && patientId.patient.criterionStatus === "yes", "A patient identification number must be classified correctly rather than misread as initials.");
const patientInitials = assessIcsrIdentifiability({ original_verbatim: "My patient J.S. developed a rash after Product A.", author_identifier: "Dr. Jones" });
assert(patientInitials.patient.characteristicTypes.includes("initials") && patientInitials.patient.criterionStatus === "yes", "Dotted patient initials must survive relationship parsing and satisfy the patient criterion.");
const aeAbbreviation = assessIcsrIdentifiability({ original_verbatim: "I developed an AE after Product A.", author_identifier: "Jane Smith" });
assert(!aeAbbreviation.patient.characteristicTypes.includes("initials") && aeAbbreviation.patient.criterionStatus !== "yes", "An AE abbreviation must never be misclassified as patient initials.");
const secondHandSpecificPatient = assessIcsrIdentifiability({ original_verbatim: "According to the report, patient Jane Smith developed a rash after Product A.", author_identifier: "Alex Jones" });
assert(secondHandSpecificPatient.patient.criterionStatus === "yes" && secondHandSpecificPatient.reporter.relationship === "second_hand", "A specific identifiable patient must be assessed independently from an incomplete second-hand reporter.");
assert(patientCriterionStatus({ association: "specific_patient", existenceStatus: "verified", characteristicTypes: ["name"], identifierBasis: "Name: Jane Smith" }) === "unclear", "Selecting verified without documenting patient verification evidence must not substantiate the verification claim.");
assert(patientCriterionStatus({ association: "specific_patient", existenceStatus: "characteristics_detected", characteristicTypes: ["name"], identifierBasis: "Name: Jane Smith" }) === "yes", "One documented qualifying characteristic associated with a specific patient must satisfy ICH patient identifiability without requiring additional verification.");

const ontologyResult = classifyPvContent({
  externalId: "post-ontology", sourceType: "curated", sourceUrl: "https://example.test/post-ontology", dataOrigin: "curated",
  verbatim: "Following Product A, a severe rash began two days later. I think it was from Product A. I was hospitalized and it is still ongoing. This reaction was not listed.",
  language: "en", postedAt: "2026-08-06T09:00:00.000Z",
}, concepts);
assert(ontologyResult.ontologyExtraction.productProcedures[0]?.value === "Product A", "PV ontology must extract the product or procedure.");
assert(ontologyResult.ontologyExtraction.adverseEvents[0]?.value === "rash", "PV ontology must extract the adverse event.");
assert(ontologyResult.ontologyExtraction.seriousness.value === "serious" && ontologyResult.ontologyExtraction.seriousness.criteria.includes("hospitalization"), "Hospitalization must propose serious status with a criterion.");
assert(ontologyResult.ontologyExtraction.outcomes.some((outcome) => outcome.category === "ongoing") && ontologyResult.ontologyExtraction.outcomes.some((outcome) => outcome.category === "hospitalization"), "PV ontology must retain all supported outcomes.");
assert(ontologyResult.ontologyExtraction.timeToOnset.category === "days", "PV ontology must normalize time to onset.");
assert(ontologyResult.ontologyExtraction.severity.value === "severe", "PV ontology must extract explicit severity.");
assert(ontologyResult.ontologyExtraction.unexpectedness.value === "emerging_signal", "Explicit not-listed language must propose emerging-signal review.");
assert(ontologyResult.ontologyExtraction.causality.some((item) => item.value === "possible_attribution"), "Reporter causality language must be retained without claiming clinical causality.");
assert(ontologyResult.contextConfidence === 100, "Explicit seriousness criteria must elevate PV triage context.");

const negatedSeriousnessResult = classifyPvContent({
  externalId: "post-negation", sourceType: "live", sourceUrl: "https://example.test/post-negation",
  verbatim: "Product A caused a mild rash, but I was not hospitalized and it was not serious.",
  language: "en", postedAt: "2026-08-06T09:00:00.000Z",
}, concepts);
assert(negatedSeriousnessResult.ontologyExtraction.seriousness.value === "non_serious", "Explicit non-serious language must not be inverted by a negated hospitalization mention.");
assert(!negatedSeriousnessResult.ontologyExtraction.outcomes.some((outcome) => outcome.category === "hospitalization"), "Negated hospitalization must not be extracted as an outcome.");

const expectedResult = classifyPvContent({
  externalId: "post-expected", sourceType: "live", sourceUrl: "https://example.test/post-expected", dataOrigin: "live",
  verbatim: "Product A gave me a rash.", language: "en", postedAt: "2026-08-06T09:00:00.000Z",
}, concepts, { expectedEvents: ["rash"] });
assert(expectedResult.ontologyExtraction.unexpectedness.value === "expected_label_event", "Configured label references must support expected-event proposals.");

const commercialResult = classifyPvContent({
  externalId: "post-2", sourceType: "instagram", sourceUrl: "https://example.test/post-2",
  verbatim: "The commercial says Product A may cause rash.", language: "en", postedAt: "2026-08-06T09:00:00.000Z",
}, concepts);
assert(!commercialResult.shouldCreateRecord, "Configured exclusions must prevent a commercial mention from becoming a review record.");

const clock = calculatePvClock({
  status: "new", postedAt: "2026-08-06T00:00:00.000Z", ingestedAt: "2026-08-06T00:10:00.000Z", identifiedAt: "2026-08-06T00:15:00.000Z",
}, { reviewMinutes: 600, transferMinutes: 600, acknowledgmentMinutes: 1200, clockStart: "posted_at", timezone: "UTC" }, new Date("2026-08-06T09:00:00.000Z"));
assert(clock.state === "approaching" && clock.elapsedMinutes === 540, "PV clock must expose posting-based SLA risk.");
assert(clock.governingClock === "posted_at" && clock.governingTimestamp === "2026-08-06T00:00:00.000Z", "PV clock must expose its governing timestamp.");

const identifiedClock = calculatePvClock({
  status: "new", postedAt: "2026-07-01T00:00:00.000Z", ingestedAt: "2026-08-06T00:10:00.000Z", identifiedAt: "2026-08-06T00:15:00.000Z",
}, { reviewMinutes: 600, transferMinutes: 600, acknowledgmentMinutes: 1200, clockStart: "identified_at", timezone: "UTC" }, new Date("2026-08-06T09:00:00.000Z"));
assert(identifiedClock.elapsedMinutes === 525, "CSV-import SLA timing must begin at reviewer identification, not the historical post date.");
assert(identifiedClock.governingClock === "identified_at" && identifiedClock.governingTimestamp === "2026-08-06T00:15:00.000Z", "CSV-import clocks must label reviewer identification as day zero.");

const pendingReportabilityClock = calculatePvClock({
  status: "new", postedAt: "2026-07-01T00:00:00.000Z", ingestedAt: "2026-08-06T00:10:00.000Z", identifiedAt: "2026-08-06T00:15:00.000Z",
}, { reviewMinutes: 15 * 24 * 60, transferMinutes: 600, acknowledgmentMinutes: 1200, clockStart: "reportability_identified_at", timezone: "UTC" }, new Date("2026-08-06T09:00:00.000Z"));
assert(pendingReportabilityClock.state === "not_started" && !pendingReportabilityClock.governingTimestamp, "Imported social evidence must not start Day Zero before qualified reportability review.");

function overviewRecord(id: string, status: PvRecordStatus, assignedReviewerId: string | null = null) {
  return {
    id, status, assigned_reviewer_id: assignedReviewerId, day_zero_basis: "reportability_identified_at" as const,
    posted_at: "2026-08-01T00:00:00.000Z", ingested_at: "2026-08-16T00:00:00.000Z", identified_at: "2026-08-16T00:00:00.000Z",
    reportability_identified_at: "2026-08-16T00:00:00.000Z",
  };
}
const overviewRecords = [
  overviewRecord("unassigned", "new"), overviewRecord("list-assigned", "new"), overviewRecord("reviewer-assigned", "in_review", "reviewer-1"),
  overviewRecord("closed", "not_relevant", "reviewer-1"), overviewRecord("ready", "ready_for_transfer", "reviewer-1"),
  overviewRecord("sent", "transferred", "reviewer-1"), overviewRecord("received", "acknowledged", "reviewer-1"), overviewRecord("reconciled", "reconciled", "reviewer-1"),
];
const overviewReviews = ["closed", "ready", "sent", "received", "reconciled"].map((record_id) => ({ record_id, reviewed_at: "2026-08-16T00:00:00.000Z" }));
const overviewTransfers = [
  { record_id: "sent", status: "delivered" as const, transferred_at: "2026-08-16T04:00:00.000Z", created_at: "2026-08-16T04:00:00.000Z" },
  { record_id: "received", status: "acknowledged" as const, transferred_at: "2026-08-16T04:00:00.000Z", acknowledged_at: "2026-08-16T05:00:00.000Z", created_at: "2026-08-16T04:00:00.000Z" },
];
const overviewMetrics = derivePvOverviewMetrics({
  records: overviewRecords, reviews: overviewReviews, transfers: overviewTransfers,
  reviewLists: [{ assigned_to: "reviewer-2", items: [{ record_id: "list-assigned" }] }],
  screeningRuns: [{ status: "completed", nil_return: true }, { status: "completed", nil_return: false }], now: new Date("2026-08-16T20:00:00.000Z"),
}).metrics;
assert(overviewMetrics.totalRecords === 8 && overviewMetrics.reviewedRecords === 5, "PV overview totals must account for every flagged and human-reviewed record exactly once.");
assert(overviewMetrics.unassignedActiveClock === 1, "Only unreviewed and unassigned records with an active day-zero clock belong in the unassigned-clock card.");
assert(overviewMetrics.awaitingReview === 3 && overviewMetrics.screeningCompliance === 87.5, "Assignment and review actions must update the awaiting-review and compliance cards without hiding open records.");
assert(overviewMetrics.transferred === 3 && overviewMetrics.unacknowledged === 1, "Transferred totals must survive acknowledgment while the unacknowledged card retains only sponsor responses still pending.");
assert(overviewMetrics.approachingSla === 1 && overviewMetrics.nilReturns === 1 && overviewMetrics.reconciliationCompletion === 13, "SLA, nil-return, and reconciliation cards must reflect their current workflow stages.");
const postReviewMetrics = derivePvOverviewMetrics({
  records: overviewRecords.map((record) => record.id === "unassigned" ? { ...record, status: "not_relevant" as const, assigned_reviewer_id: "reviewer-3" } : record),
  reviews: [...overviewReviews, { record_id: "unassigned", reviewed_at: "2026-08-16T20:30:00.000Z" }], transfers: overviewTransfers,
  reviewLists: [{ assigned_to: "reviewer-2", items: [{ record_id: "list-assigned" }] }], now: new Date("2026-08-16T21:00:00.000Z"),
}).metrics;
assert(postReviewMetrics.unassignedActiveClock === 0 && postReviewMetrics.awaitingReview === 2 && postReviewMetrics.reviewedRecords === 6 && postReviewMetrics.screeningCompliance === 100, "Completing review must immediately reconcile every affected overview card.");

const parsedCsv = parsePvCsv(new TextEncoder().encode([
  "Date,Text,URL,ID",
  '2026-08-01T12:00:00Z,"Product A caused a rash, then hives",https://example.test/post-1,csv-1',
].join("\n")), "social-data.csv");
assert(parsedCsv.dateColumn === "Date", "PV CSV intake must detect the date column.");
assert(parsedCsv.rows[0]?.postedAt === "2026-08-01T12:00:00.000Z", "PV CSV intake must normalize the original post date from the CSV date column.");
assert(parsedCsv.rows[0]?.postedAtRawValue === "2026-08-01T12:00:00Z", "PV CSV intake must preserve the raw post-date value for provenance.");
assert(parsedCsv.rows[0]?.verbatim.includes("rash, then hives"), "PV CSV intake must preserve quoted content containing delimiters.");
const sparseCsv = parsePvCsv(new TextEncoder().encode("Date,Text\n2026-08-01,Product A rash\n2026-08-02,"), "sparse.csv");
assert(sparseCsv.rowCount === 2 && sparseCsv.rows.length === 1 && sparseCsv.errors[0]?.rowNumber === 3, "PV CSV intake must retain row-level failures without discarding valid social data.");
for (const [therapeuticArea, reporterHeader, reporterValue] of [
  ["Medical Aesthetics", "Author Name", "Jane Smith"],
  ["Gene Therapy", "Creator Name", "Alex Rivera"],
  ["Botulinum toxin", "Influencer", "Morgan Lee"],
] as const) {
  const areaCsv = parsePvCsv(new TextEncoder().encode(`Date,Text,${reporterHeader}\n2026-08-01,Product A caused a rash,${reporterValue}`), `${therapeuticArea}.csv`);
  assert(areaCsv.authorIdentifierColumn === reporterHeader && areaCsv.rows[0]?.authorIdentifier === reporterValue, `${therapeuticArea} reporter identifiers must use the shared therapeutic-area-agnostic CSV mapping.`);
}

const reconciliation = reconcilePvOperations({
  records: [{ id: "record-1", status: "transferred", reviewedAt: "2026-08-01T01:00:00Z", transferredAt: "2026-08-01T02:00:00Z" }],
  transfers: [{ id: "transfer-1", recordId: "record-1", status: "delivered", transferredAt: "2026-08-01T02:00:00Z" }],
  sources: [{ id: "source-1", active: true, cadenceMinutes: 1440, lastScreenedAt: "2026-08-01T00:00:00Z" }],
  periodEnd: "2026-08-06T00:00:00Z",
});
assert(reconciliation.issues.some((issue) => issue.type === "transferred_not_acknowledged"), "Reconciliation must flag missing sponsor acknowledgment.");
assert(reconciliation.issues.some((issue) => issue.type === "missing_screening_run"), "Reconciliation must flag missed screening cadence.");

const pvAccess = resolveCustomerIntelligenceAccess(configurationFromEntitlements(resolveEntitlements({
  userId: "pv-reviewer", organizationId: "pv-sponsor", organizationMetadata: { grants: ["module_medical_affairs", "agent_pharmacovigilance_assistant"] },
})));
const pvNavigation = buildEcosystemNavigation(pvAccess).find((group) => group.id === "pv_compliance");
assert(pvNavigation?.items.length === 7, "Licensed PV users must receive the dedicated PV Compliance navigation workspace.");
const noPvNavigation = buildEcosystemNavigation({ modules: [], agents: [] });
assert(!noPvNavigation.some((group) => group.id === "pv_compliance"), "PV Compliance navigation must remain entitlement-gated.");

const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608060001_create_pv_compliance_services.sql"), "utf8");
const ontologyMigration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608080002_expand_pv_adverse_event_ontology.sql"), "utf8");
const csvImportMigration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608100001_create_pv_csv_imports.sql"), "utf8");
const corpusMigration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608110002_scope_pv_corpora.sql"), "utf8");
const reviewListMigration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608110003_create_pv_review_lists.sql"), "utf8");
const genericEnrichmentMigration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608230003_generalize_pv_reporter_enrichment.sql"), "utf8");
for (const table of ["pv_detection_libraries", "pv_detection_concepts", "pv_sources", "pv_screening_runs", "pv_sla_policies", "pv_records", "pv_reviews", "pv_transfers", "pv_audit_events", "pv_reconciliation_runs", "pv_reconciliation_issues"]) {
  assert(migration.includes(`public.${table}`), `PV migration is missing ${table}.`);
}
assert(migration.includes("evidence_hash") && migration.includes("payload_hash") && migration.includes("previous_hash"), "Evidence, transfer, and provenance hashes are required.");
for (const field of ["data_origin", "ae_ontology", "ontology_version", "validated_ae_ontology", "expected_event_terms"]) {
  assert(ontologyMigration.includes(field), `PV adverse-event ontology migration is missing ${field}.`);
}
for (const field of ["pv_import_batches", "available_at", "posted_at_source_column", "posted_at_raw_value", "day_zero_basis", "source_row_number"]) {
  assert(csvImportMigration.includes(field), `PV CSV timestamp migration is missing ${field}.`);
}
for (const field of ["corpus_id", "therapeutic_area", "pv_records_therapeutic_area_queue_idx"]) assert(corpusMigration.includes(field), `PV corpus scoping migration is missing ${field}.`);
for (const field of ["pv_review_lists", "pv_review_list_items", "assigned_to", "shared_emails", "record_id"]) assert(reviewListMigration.includes(field), `PV review-list migration is missing ${field}.`);
for (const field of ["author_identifier_column", "pv_detection_libraries", "pv_import_batches", "pv_records", "therapeutic_area"]) assert(genericEnrichmentMigration.includes(field), `Therapeutic-area-agnostic PV enrichment migration is missing ${field}.`);
const workbench = fs.readFileSync(path.resolve(process.cwd(), "src/components/PvComplianceCenter.jsx"), "utf8");
const lifecycleSource = workbench.slice(workbench.indexOf("function LifecycleRecords"), workbench.indexOf("function ReviewQueue"));
assert(!workbench.includes("Eight connected PV services"), "The removed PV services marketing overview must not return to Compliance Overview.");
for (const phrase of ["Potential records, not AE determinations", "Original evidence is immutable", "Structured human review", "Zero unexplained records", "nil return"]) {
  assert(workbench.toLowerCase().includes(phrase.toLowerCase()), `PV workbench is missing required UX: ${phrase}`);
}
for (const phrase of ["Flagged records", "Human review completed", "Unassigned records with active clocks", "Potential records awaiting human review", "Not reviewed or assigned", "PV_LIFECYCLE_TOOLTIPS"]) {
  assert(workbench.includes(phrase), `PV Compliance Overview is missing clarified stage guidance: ${phrase}`);
}
for (const phrase of ["combined screening score", "confidence that the mention refers", "potential safety-relevant situation", "Origin provides provenance"]) {
  assert(workbench.includes(phrase), `PV Screening Status is missing metric tooltip guidance: ${phrase}`);
}
assert(!workbench.includes('label="Sources due"') && !workbench.includes('label="Awaiting review"'), "Ambiguous PV overview stage labels must not return.");
assert(workbench.includes('import Tooltip from "./ui/Tooltip"'), "PV Compliance Overview must use the shared accessible tooltip behavior.");
assert(workbench.includes("onSelectLifecycle(status)") && workbench.includes("View mentions →") && workbench.includes("View mentions"), "Every PV lifecycle card must be a visible, clickable mention drill-down.");
for (const phrase of ["PV lifecycle ·", "currently comprise this lifecycle count", "Back to Compliance Overview", "No mentions are currently in the", "PvMentionDialog"]) {
  assert(lifecycleSource.includes(phrase), `PV lifecycle drill-down is missing ${phrase}.`);
}
assert(lifecycleSource.includes("const pageSize = 20") && lifecycleSource.includes("Page {currentPage} of {pageCount}") && lifecycleSource.includes("data.total"), "Lifecycle mention lists must use exact server counts and paginate at 20 records per page.");
assert(lifecycleSource.includes("status, page: String(page), pageSize: String(pageSize)") && lifecycleSource.includes('params.set("therapeuticArea", therapeuticArea)'), "Lifecycle mention requests must retain exact status and therapeutic-area scope.");
for (const phrase of ["Product / procedure", "Adverse event", "Seriousness", "Outcome", "Time to onset", "Severity", "Unexpectedness", "Causality language", "Adverse-event assessment"]) {
  assert(workbench.includes(phrase), `PV workbench is missing ontology UX: ${phrase}`);
}
for (const phrase of ["Reviewer workflow", "one specific patient", "ICH qualifying patient characteristic (select at least one)", "Patient supporting evidence (required)", "Reviewer patient-evidence confirmation"]) {
  assert(workbench.includes(phrase), `Structured review is missing the reviewer guide or required patient-identifiability gate: ${phrase}`);
}
for (const option of ["non_serious", "permanent_injury", "immediate", "moderate", "expected_label_event", "possibly due to", "think it was from"]) {
  assert(workbench.includes(`"${option}"`), `PV ontology dropdowns are missing the controlled value ${option}.`);
}
assert(workbench.includes('OntologySelect labelText="Causality language"'), "Causality Language must use a controlled dropdown instead of free text.");
assert(!workbench.includes("Proposed adverse-event ontology"), "The machine-proposed ontology panel must not render in Screening Status.");
assert(workbench.includes('record.import_batch_id ? "Social"'), "CSV-ingested mentions must display Social as their evidence origin.");
const reviewQueueSource = workbench.slice(workbench.indexOf("function ReviewQueue"), workbench.indexOf("function RecordWorkbench"));
assert(!reviewQueueSource.includes("PvOntologyReview") && !reviewQueueSource.includes("Adverse-event ontology review"), "Adverse-event ontology review must not render inside Review Queue.");
const structuredReviewSource = workbench.slice(workbench.indexOf("function StructuredReview"), workbench.indexOf("function SponsorHandoff"));
const sponsorHandoffSource = workbench.slice(workbench.indexOf("function SponsorHandoff"), workbench.indexOf("function Transfers"));
const sourceRegistrySource = workbench.slice(workbench.indexOf("function SourceRegistry"), workbench.indexOf("function Configuration"));
assert(structuredReviewSource.includes("<RecordWorkbench"), "The ontology workbench must render within Structured Review.");
assert(!structuredReviewSource.includes("Botulinum toxin PV corpus"), "The Botulinum toxin corpus activation section must not render in Structured Review.");
const workbenchMetricsIndex = workbench.indexOf('label="PV detection score"');
const workbenchOntologyIndex = workbench.indexOf("<PvOntologyReview", workbenchMetricsIndex);
const workbenchStructuredReviewIndex = workbench.indexOf('title="Structured human review"', workbenchMetricsIndex);
assert(workbenchMetricsIndex >= 0 && workbenchStructuredReviewIndex > workbenchMetricsIndex && workbenchOntologyIndex > workbenchStructuredReviewIndex, "The reviewer-approved adverse-event assessment must appear inside the governed Structured Review after the initial relevance decision.");
assert(!workbench.includes("CSV social-data intake"), "The browser-facing CSV social-data intake section must remain removed from Screening Status.");
for (const phrase of ["Original post date", "Content availability", "Reportability review / Day Zero", "CSV date column", "Day zero:"]) {
  assert(workbench.includes(phrase), `PV workbench is missing two-clock timestamp UX: ${phrase}`);
}
for (const phrase of ["Structured Review", "Continue to structured review", "Return to Review Queue", "pv-structured-review"]) {
  assert(workbench.includes(phrase), `PV structured-review navigation is missing ${phrase}.`);
}
for (const phrase of ["ICH E2D(R1) identifiability gate", "Four minimum ICSR criteria", "Identifiable patient criterion", "Patient association (required)", "ICH qualifying patient characteristic (select at least one)", "Patient supporting evidence (required)", "Reviewer patient-evidence confirmation", "Identifiable reporter criterion", "Reporter knowledge of the event (required)", "Reporter existence verification (required)", "Reporter qualifying characteristic or anonymous status", "Reporter verification evidence (required)", "Seriousness criteria", "Targeted follow-up questions", "Duplicate assessment"]) {
  assert(workbench.includes(phrase), `PV structured review is missing its E2D(R1) assessment field: ${phrase}.`);
}
for (const removedField of ["Patient existence status", "Patient existence verification evidence", "Patient follow-up feasible", "Patient follow-up status", "Reporter follow-up feasible", "Reporter follow-up status", "Patient characteristics", "Therapy details", "Medical history", "Concurrent conditions", "Diagnosis / laboratory evidence", "Alternative causes / confounders", "Regional / local reporting assessment", "Causality type"]) {
  assert(!workbench.includes(`labelText="${removedField}"`), `The simplified Structured Review must not render the noncritical or duplicative input ${removedField}.`);
}
for (const phrase of ["Sponsor-ready assessments", "Create PDF", "Review email handoff", "Minimum criteria", "Review assessment", "sponsorCases.map"]) {
  assert(sponsorHandoffSource.includes(phrase), `QA & Sponsor Handoff is missing sponsor-report aggregation UX: ${phrase}.`);
}
for (const phrase of ["QA export test · Not Relevant mentions", "QA TEST ONLY", "Create QA PDF", "Internal/test recipient email", "Share QA handoff", "Send QA email", "never changes lifecycle status or starts Day Zero"]) {
  assert(sponsorHandoffSource.includes(phrase), `QA & Sponsor Handoff is missing the segregated Not Relevant export safeguard: ${phrase}.`);
}
for (const phrase of ["Source Screening Coverage", "Log Source Screening Run", "nil return", "individual AE/ADR review status"]) {
  assert(sourceRegistrySource.includes(phrase), `Source Registry is missing source-screening operations UX: ${phrase}.`);
}
for (const phrase of ["History &amp; Audit", "Record History", "Audit Details", "<details"]) {
  assert(workbench.includes(phrase), `The consolidated record ledger is missing ${phrase}.`);
}
assert(!workbench.includes('Card title="Workflow history"') && !workbench.includes('Card title="Audit / provenance chain"'), "History and provenance must not remain as competing always-open cards.");
for (const phrase of ["Full mention", "Patient and reporter identification", "ICH E2D(R1) Section 6.1", "digital handles alone", "Save review list", "Save to workspace", "Saved aggregate review lists", "Download CSV", "Share by email", "Assignee email or user ID"]) {
  assert(workbench.includes(phrase), `PV workbench is missing aggregate-review UX: ${phrase}`);
}
assert(!workbench.includes("Name this review list") && !workbench.includes("Review list name"), "Saving a PV review list must not require a user-supplied name.");
assert(reviewQueueSource.includes('busy === "review-list:create" ? "Saving…" : "Save"') && reviewQueueSource.includes('disabled={!listWorkspaceId || busy === "review-list:create"}'), "The simplified review-list action must be labeled Save and enabled whenever a writable workspace is selected.");
assert(reviewQueueSource.includes("Create a workspace before saving a list"), "Users without a writable workspace must receive the required creation prompt.");
assert(reviewQueueSource.includes("const pageSize = 20") && reviewQueueSource.includes("pageRecords.map"), "The Potential PV Review Queue must display no more than 20 mentions per page.");
assert(reviewQueueSource.includes("Select all PV mentions on this page") && reviewQueueSource.includes("Page {currentPage} of {pageCount}"), "PV queue pagination must preserve explicit page selection and navigation.");
assert(reviewQueueSource.includes("await onRefreshWorkspaces()") && reviewQueueSource.includes("currentWritableWorkspaces"), "Saving a PV review list must refresh and re-evaluate writable workspaces before opening the save dialog.");
for (const timestamp of ["Publication timestamp", "Collection timestamp", "Review timestamp", "Escalation timestamp"]) {
  assert(workbench.includes(timestamp), `The Potential PV Review Queue is missing the governed ${timestamp}.`);
}
assert(reviewQueueSource.includes("PV_QUEUE_HEADERS.map"), "The Potential PV Review Queue must render the governed timestamp headers.");
for (const header of ["Status", "Product", "Potential event", "Full mention", "Source", "Publication timestamp", "Collection timestamp", "Review timestamp", "Escalation timestamp", "Day-zero clock", "Score", "Reviewer"]) {
  assert(workbench.includes(`label: "${header}", tooltip:`), `Every Potential PV Review Queue field must provide an explanatory tooltip: ${header}.`);
}
for (const field of ["publication_timestamp", "collection_timestamp", "review_timestamp", "escalation_timestamp"]) {
  assert(reviewQueueSource.includes(`formatDate(record.${field})`), `The Potential PV Review Queue must display ${field}.`);
}
assert(workbench.includes("PV_REVIEW_WINDOW_MS = 15 * 24 * 60 * 60 * 1000") && reviewQueueSource.includes("reviewCountdown(record, nowMs)"), "The queue day-zero clock must retain the 15-day review window.");
assert(workbench.includes('record.reportability_identified_at || ""') && !workbench.includes('const identifiedAt = new Date(record.identified_at'), "The queue day-zero countdown must start exclusively from qualified reportability identification.");
assert(workbench.includes("Opening structured review does not start this clock") && workbench.includes("does not itself start Day Zero"), "The queue timestamp guidance must separate review initiation from Day Zero.");
assert(reviewQueueSource.includes("setInterval(() => setNowMs(Date.now()), 30_000)"), "The queue day-zero countdown must update automatically as time elapses.");
assert(workbench.includes("PV_SCORE_TOOLTIP") && workbench.includes("It is not an adverse-event determination"), "The queue score column must explain how the screening score should be interpreted.");
assert(reviewQueueSource.includes('const [sort, setSort] = useState({ key: "", direction: "" })') && reviewQueueSource.includes("function sortByColumn(key)"), "Every queue data column must use the shared interactive sorting control.");
assert(reviewQueueSource.includes('key === "score" ? "desc" : "asc"') && reviewQueueSource.includes('head.key === "score" ? "highest to lowest"'), "Score must initially sort highest-to-lowest while other columns initially sort ascending.");
assert(reviewQueueSource.includes("PV_QUEUE_HEADERS.map") && reviewQueueSource.includes("onClick={() => sortByColumn(head.key)}"), "Every governed queue header must be clickable for sorting.");
assert(reviewQueueSource.includes('aria-sort={sort.key === head.key') && reviewQueueSource.includes('className="inline-flex cursor-pointer'), "Every sortable header must expose its direction accessibly and display the interaction cursor.");
assert(!reviewQueueSource.includes("formatDate(record.algorithm_timestamp)"), "The queue must omit the redundant Algorithm timestamp column when it cannot be distinguished from collection.");
assert(reviewQueueSource.includes("sourceLabel(record)") && workbench.includes('sourceType.endsWith("_csv")'), "CSV-origin PV queue records must be labeled Social.");
assert(workbench.includes("Enter a reviewer rationale before saving this PV decision."), "Enabled PV decisions must explain the rationale requirement inline when submitted empty.");
assert(workbench.includes('title="Initial relevance decision"') && workbench.includes("Mark as Relevant") && workbench.includes('review("close_not_relevant", false)'), "The structured-review workflow must require an explicit relevance decision before revealing the detailed assessment.");
assert(workbench.includes('markedRelevant && !["transferred"') && workbench.includes("setMarkedRelevant(true)"), "Ontology and ICH case fields must remain hidden until the reviewer marks the mention relevant.");
assert(workbench.includes('onReviewComplete?.(decision)') && workbench.includes('navigateTab("overview")'), "Either Close as Not Relevant action must return the reviewer to Compliance Overview after the retained decision succeeds.");
assert(workbench.includes('onNavigate?.(`pv_${nextTab}`)') && workbench.includes('navigateTab("overview")'), "PV section navigation must keep the page heading synchronized when a closed record returns to Compliance Overview.");
assert(workbench.includes('option === "not_applicable" ? "N/A"') && workbench.includes('const choices = options.includes("not_applicable")'), "Every structured assessment dropdown must include an explicit N/A option.");
assert(workbench.includes("PV_REVIEW_FIELD_TOOLTIPS") && workbench.includes("<FieldLabel labelText={labelText}"), "Structured-review fields must render contextual tooltips through the shared field-label control.");
assert(workbench.includes("xl:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]"), "The Compliance Clock must use a compact width so the record content receives the available horizontal space.");
assert(workbench.includes("Confirm all four minimum ICSR criteria") && workbench.includes("Confirm reportability & escalate"), "Escalation must require the four minimum ICSR criteria and explicitly establish Day Zero.");
assert(!workbench.includes('disabled={busy.startsWith("review:") || !rationale.trim()}'), "PV decision buttons must not be silently disabled while the rationale is empty.");
const importRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/imports/route.ts"), "utf8");
assert(importRoute.includes("request.formData()"), "PV CSV ingestion must use a file-upload route.");
assert(!importRoute.includes('form.get("identifiedAt")'), "The client must not control the reviewer-identification timestamp.");
assert(importRoute.includes("authorIdentifierColumn"), "PV CSV ingestion must preserve an available author/reporter identifier for ICH identifiability review.");
assert(importRoute.includes('form.get("therapeuticArea")'), "PV CSV ingestion must preserve the user-selected therapeutic area for every corpus.");
const pvService = fs.readFileSync(path.resolve(process.cwd(), "src/lib/pv/service.ts"), "utf8");
assert(pvService.includes("Math.min(1000, input.limit || 500)"), "The PV review queue must expose complete therapeutic-area evidence sets instead of silently capping them at 100.");
for (const contract of ["enrichPvRecordsWithAvailableMetadata", "repeat_csv_import", "record.available_metadata_enrich", "enrichedAvailableFields", "library.therapeutic_area", "author_identifier_column"]) {
  assert(pvService.includes(contract), `Generic PV ingestion is missing the shared metadata-enrichment contract ${contract}.`);
}
assert(pvService.includes("overwriteExistingValues: false"), "Reporter enrichment must preserve existing governed identifiers rather than overwrite them.");
for (const field of ["publication_timestamp", "collection_timestamp", "algorithm_timestamp", "review_timestamp", "escalation_timestamp"]) {
  assert(pvService.includes(field), `The PV queue service is missing its ${field} chronology field.`);
}
assert(pvService.includes('.eq("decision", "escalate")') && pvService.includes("escalationByRecord"), "The Escalation timestamp must come from the first governed escalation review.");
assert(pvService.includes("listAllPvRecordsForOverview") && pvService.includes("derivePvOverviewMetrics"), "Compliance Overview must use the complete record ledger and lifecycle-derived metrics.");
assert(pvService.includes('adverseEventOntology: review.validated_ae_ontology') && pvService.includes('ontologyStatus: "reviewer_validated"'), "Sponsor transfers must include the final reviewer-approved adverse-event ontology.");
assert(pvService.includes("listPvSponsorCases") && pvService.includes("recordPvSponsorReportActivity") && pvService.includes('decision", "escalate'), "Escalated reviews must be aggregated into auditable sponsor reports.");
assert(pvService.includes("recordUpdates.reportability_identified_at = reportabilityIdentifiedAt") && pvService.includes("dayZeroStarted"), "Qualified escalation must persist and audit the first reportability-review Day Zero trigger.");
assert(pvService.includes("patientCriterionStatus") && pvService.includes("controlled ICH qualifying characteristic") && pvService.includes("patientAssessment?.characteristicTypes") && pvService.includes("patientAssessment?.reviewerConfirmed === true"), "Server-side escalation must independently enforce the ICH patient characteristic, specific-patient association, supporting evidence, and reviewer-confirmation requirements.");
assert(pvService.includes("reporterCriterionStatus") && pvService.includes("reporterAssessment?.relationship") && pvService.includes("reporterAssessment?.existenceStatus") && pvService.includes("verificationEvidence"), "Server-side escalation must independently enforce ICH-aligned reporter existence, first-hand knowledge, and verification evidence.");
assert(pvService.includes("reportabilityIdentifiedAt: record.reportability_identified_at || undefined"), "A saved review decision must never substitute for the qualified reportability-identification timestamp that starts Day Zero.");
assert(pvService.includes("startPvRecordReview") && pvService.includes('action: "review.start"') && pvService.includes("review_started_at"), "Continue to structured review must retain its own immutable human-review start timestamp.");
const reviewStartMigration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608230002_add_pv_review_start.sql"), "utf8");
assert(reviewStartMigration.includes("review_started_at") && !reviewStartMigration.includes("update public.pv_records"), "Historical records must remain blank rather than inferring a structured-review timestamp from a different workflow event.");
const recordsRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/records/route.ts"), "utf8");
const libraryRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/library/route.ts"), "utf8");
assert(recordsRoute.includes("therapeuticArea") && libraryRoute.includes("therapeuticArea"), "Live detection and detection-library APIs must retain therapeutic-area scope.");
assert(recordsRoute.includes("listPvRecordsPage") && recordsRoute.includes('searchParams.has("page")') && pvService.includes('select("*", { count: "exact" })') && pvService.includes('.eq("status", input.status)') && pvService.includes(".range(from, from + pageSize - 1)"), "PV lifecycle drill-down must use an exact, status-filtered, server-paginated ledger query.");
assert(workbench.includes("therapeuticArea, libraries") && workbench.includes("Therapeutic area: {therapeuticArea}"), "PV Detection Library configuration must visibly inherit the selected therapeutic area.");
const moduleView = fs.readFileSync(path.resolve(process.cwd(), "src/components/ModuleIntelligenceView.jsx"), "utf8");
assert(!moduleView.includes("Botulinum toxin") && moduleView.includes("View all evidence"), "Shared module evidence UX must remain therapeutic-area agnostic.");
assert(!pvService.includes("proposedAdverseEventOntology") && !pvService.includes("validatedAdverseEventOntology"), "Sponsor transfers must not expose parallel proposed and validated ontology fields.");
for (const contract of ["createPvReviewList", "listPvReviewLists", "updatePvReviewList", "review_list.share_email", "review_list.export"]) assert(pvService.includes(contract), `PV aggregate-review service is missing ${contract}.`);
const reviewListRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/review-lists/route.ts"), "utf8");
const reviewListExportRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/review-lists/[listId]/export/route.ts"), "utf8");
assert(reviewListRoute.includes("requirePvPrincipal") && reviewListRoute.includes("therapeuticArea"), "PV review lists must be entitlement- and therapeutic-area-scoped.");
assert(reviewListRoute.includes("workspaceId") && reviewListRoute.includes("saveIntelligenceWorkProduct") && reviewListRoute.includes('type: "pv_review_list"'), "Saved PV review lists must be registered in the selected workspace.");
assert(reviewListExportRoute.includes("Content-Disposition") && reviewListExportRoute.includes("Full mention"), "PV aggregate-list exports must download the complete source evidence.");
const workspaceManager = fs.readFileSync(path.resolve(process.cwd(), "src/components/WorkspaceManager.jsx"), "utf8");
for (const phrase of ["PvReviewListDetail", "Assign to another user", "Send list by email", "Recipient email address", "PV review list"]) {
  assert(workspaceManager.includes(phrase), `Workspace PV review-list UX is missing ${phrase}.`);
}

const sponsorReportRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/sponsor-reports/route.ts"), "utf8");
const sponsorReportExportRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/sponsor-reports/export/route.ts"), "utf8");
const sponsorReportSource = fs.readFileSync(path.resolve(process.cwd(), "src/lib/pv/sponsorReport.ts"), "utf8");
for (const phrase of ["publication timestamp", "collection timestamp", "algorithm timestamp", "reportability review / day-zero timestamp", "escalation timestamp", "ICH E2D(R1) minimum ICSR criteria", "identifiable patient", "patient association", "patient existence status", "patient qualifying characteristic types", "patient qualifying characteristics", "patient verification evidence", "patient follow-up feasibility", "patient follow-up status", "identifiable reporter", "reporter relationship to event", "reporter existence status", "reporter qualifying characteristics", "reporter verification evidence", "reporter follow-up feasibility", "reporter follow-up status", "unfiltered primary-source evidence", "seriousness criteria", "stand-alone clinical narrative inputs", "duplicate assessment", "targeted follow-up questions", "regional / local reporting assessment"]) {
  assert(sponsorReportSource.toLowerCase().includes(phrase.toLowerCase()), `Sponsor PDF is missing E2D(R1) report content: ${phrase}.`);
}
assert(sponsorReportExportRoute.includes('"Content-Type": "application/pdf"') && sponsorReportExportRoute.includes("recordPvSponsorReportActivity"), "Sponsor-report export must return an audited PDF.");
assert(sponsorReportRoute.includes("RESEND_API_KEY") && sponsorReportRoute.includes("PV_SPONSOR_FROM_EMAIL") && sponsorReportRoute.includes('transferMethod: "secure_email"'), "Sponsor-report sharing must support governed email attachment delivery and transfer provenance.");
assert(sponsorReportRoute.includes('delivery === "provider" ? "share" : "prepare"'), "A client-email draft must be audited as prepared rather than falsely marked as sent.");
assert(sponsorReportRoute.includes("emailDelivery") && sponsorReportRoute.includes("No email was sent by AskSocial"), "The sponsor-report API must disclose whether direct email is configured and must not imply that a client draft was sent.");
for (const contract of ["listPvQaNotRelevantCases", 'mode === "qa_not_relevant"', 'action: mode === "qa_not_relevant" ? "qa_export" : "export"']) {
  assert(sponsorReportExportRoute.includes(contract) || sponsorReportRoute.includes(contract) || pvService.includes(contract), `Not Relevant QA export is missing ${contract}.`);
}
assert(pvService.includes('.eq("decision", "close_not_relevant")') && pvService.includes('.eq("status", "not_relevant")'), "QA export examples must come only from retained Not Relevant reviews and records.");
assert(sponsorReportRoute.includes('if (mode === "sponsor_handoff")') && sponsorReportRoute.includes('"qa_share"') && sponsorReportRoute.includes('"qa_prepare"'), "QA email delivery must be audited separately and must never call the sponsor transfer mutation path.");
for (const phrase of ["Share QA handoff", "Direct email is not configured", "Download PDF & open draft", "Send QA email"]) {
  assert(workbench.includes(phrase), `QA handoff delivery UX is missing ${phrase}.`);
}
for (const phrase of ["NOT FOR SPONSOR SUBMISSION", "Non-Reportable Case Documentation", "Creating, exporting, or delivering this document does not start Day Zero or alter any record lifecycle status"]) {
  assert(sponsorReportSource.includes(phrase), `The Not Relevant PDF is missing its non-reportable safeguard: ${phrase}.`);
}
for (const phrase of ["createQaCaseSheetReport", "Case documentation", "Index of included assessments", "Case identification and source", "Governed chronology", "Reviewer-approved safety assessment", "Unfiltered primary-source evidence", "Stand-alone clinical narrative inputs"]) {
  assert(sponsorReportSource.includes(phrase), `The QA PDF is missing its approved case-sheet format element: ${phrase}.`);
}
const notRelevantCaseSheetSource = sponsorReportSource.slice(
  sponsorReportSource.indexOf("async function createQaCaseSheetReport"),
  sponsorReportSource.indexOf("export async function createPvSponsorReport"),
);
for (const phrase of ["QA Non-Reportable Export Test", "QA case sheets", "QA example", "QA TEST ONLY - NOT FOR SPONSOR SUBMISSION", "CLOSE NOT RELEVANT"]) {
  assert(!notRelevantCaseSheetSource.includes(phrase), `The Not Relevant PDF must not display the removed label: ${phrase}.`);
}
void (async () => {
  const sampleSponsorPdf = await createPvSponsorReport({
    therapeuticArea: "Test area",
    generatedBy: "reviewer-1",
    generatedAt: "2026-08-21T12:00:00.000Z",
    cases: [{
      id: "review-1",
      record: { id: "record-1", status: "ready_for_transfer", therapeutic_area: "Test area", product_name: "Product A", potential_event: "Rash", source_type: "social", source_url: "https://example.test/post", original_verbatim: "I developed a rash after Product A.", original_language: "en", posted_at: "2026-08-20T10:00:00.000Z", ingested_at: "2026-08-20T11:00:00.000Z", identified_at: "2026-08-20T12:00:00.000Z", created_at: "2026-08-20T11:05:00.000Z", evidence_hash: "evidence", classifier_version: "1", library_version: 1, ontology_version: "1" },
      review: { id: "review-1", decision: "escalate", reviewer_id: "reviewer-1", reviewed_at: "2026-08-20T12:00:00.000Z", classifications: ["adverse_event"], rationale: "Product and event supported by verbatim.", validated_ae_ontology: { productProcedures: [{ value: "Product A" }], adverseEvents: [{ value: "Rash" }], seriousness: { value: "non_serious" }, icsrAssessment: { reportType: "spontaneous", primarySourceType: "consumer", minimumCriteria: { suspectProduct: { status: "yes" }, adverseEventOrObservation: { status: "yes" }, identifiablePatient: { status: "unclear" }, identifiableReporter: { status: "unclear" } }, seriousnessCriteria: [], clinicalNarrative: {}, followUp: { needed: "yes", questions: "Obtain patient and reporter identifiers." }, duplicateAssessment: { status: "not_checked" } } } },
      transfer: null,
    }],
  });
  assert(Buffer.from(sampleSponsorPdf.bytes).subarray(0, 5).toString() === "%PDF-", "Sponsor report generation must produce a valid PDF document.");
  const sampleQaPdf = await createPvSponsorReport({
    therapeuticArea: "Test area",
    generatedBy: "reviewer-1",
    generatedAt: "2026-08-21T12:00:00.000Z",
    mode: "qa_not_relevant",
    cases: [{
      id: "review-qa-1",
      record: { id: "record-qa-1", status: "not_relevant", therapeutic_area: "Test area", product_name: "Product A", potential_event: "Unconfirmed event", source_type: "social", source_url: "https://example.test/qa", original_verbatim: "A non-relevant QA example.", original_language: "en", posted_at: "2026-08-20T10:00:00.000Z", ingested_at: "2026-08-20T11:00:00.000Z", identified_at: "2026-08-20T12:00:00.000Z", evidence_hash: "qa-evidence", classifier_version: "1", library_version: 1, ontology_version: "1" },
      review: { id: "review-qa-1", decision: "close_not_relevant", reviewer_id: "reviewer-1", reviewed_at: "2026-08-20T12:00:00.000Z", classifications: [], rationale: "No supported AE/ADR.", validated_ae_ontology: { icsrAssessment: { minimumCriteria: {} } } },
      transfer: null,
    }],
  });
  assert(Buffer.from(sampleQaPdf.bytes).subarray(0, 5).toString() === "%PDF-", "Not Relevant QA export must produce a valid PDF document.");
  const parsedQaPdf = await PDFDocument.load(sampleQaPdf.bytes);
  assert(parsedQaPdf.getPageCount() === 2, "The QA packet must contain one cover/index page followed by exactly one sheet per included mention.");
  assert(sponsorReportFileName("Test area", "qa_not_relevant") === "asksocial-test-area-qa-not-relevant-export-test.pdf", "The QA PDF filename must be unmistakably segregated from sponsor submission packages.");
  console.log("PV Compliance operational quality checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
