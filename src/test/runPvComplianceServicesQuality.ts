import fs from "node:fs";
import path from "node:path";
import { calculatePvClock, classifyPvContent, parsePvCsv, reconcilePvOperations, type PvDetectionConcept } from "../lib/pv";
import { buildEcosystemNavigation, configurationFromEntitlements, resolveCustomerIntelligenceAccess } from "../lib/intelligence-platform";
import { resolveEntitlements } from "../lib/entitlements";

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
const workbench = fs.readFileSync(path.resolve(process.cwd(), "src/components/PvComplianceCenter.jsx"), "utf8");
assert(!workbench.includes("Eight connected PV services"), "The removed PV services marketing overview must not return to Compliance Overview.");
for (const phrase of ["Potential records, not AE determinations", "Original evidence is immutable", "Structured human review", "Zero unexplained records", "nil return"]) {
  assert(workbench.toLowerCase().includes(phrase.toLowerCase()), `PV workbench is missing required UX: ${phrase}`);
}
for (const phrase of ["Product / procedure", "Adverse event", "Seriousness", "Outcome", "Time to onset", "Severity", "Unexpectedness", "Causality language", "Adverse-event ontology review"]) {
  assert(workbench.includes(phrase), `PV workbench is missing ontology UX: ${phrase}`);
}
for (const phrase of ["CSV social-data intake", "Original post date", "Reviewer-identification date", "Governing day-zero clock", "CSV date column", "Day zero: reviewer identification"]) {
  assert(workbench.includes(phrase), `PV workbench is missing two-clock timestamp UX: ${phrase}`);
}
const importRoute = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/imports/route.ts"), "utf8");
assert(importRoute.includes("request.formData()"), "PV CSV ingestion must use a file-upload route.");
assert(!importRoute.includes('form.get("identifiedAt")'), "The client must not control the reviewer-identification timestamp.");

console.log("PV Compliance operational quality checks passed.");
