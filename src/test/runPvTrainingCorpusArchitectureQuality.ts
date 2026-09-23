import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pageOne from "./fixtures/openfda/botulinum-page-1.json";
import { normalizeOpenFdaRegulatoryCase } from "../lib/pv/training/regulatory";

type JsonRecord = Record<string, unknown>;

const projectRoot = process.cwd();
const configurationRoot = path.join(projectRoot, "config/pv/training-corpus/botulinum-toxin");
const projectManifestPath = path.join(configurationRoot, "manifest.json");

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonRecord;
}

function assertUniqueIds(items: JsonRecord[], label: string) {
  const ids = items.map((item) => String(item.id ?? ""));
  assert(ids.every(Boolean), `${label} must have IDs.`);
  assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique.`);
}

function assertRootRequiredFields(schema: JsonRecord, value: JsonRecord, label: string) {
  const required = schema.required as string[];
  assert(Array.isArray(required) && required.length > 0, `${label} must declare required fields.`);
  for (const field of required) assert(field in value, `${label} is missing required field ${field}.`);
}

const manifest = readJson(projectManifestPath);
assert.equal(manifest.status, "active");
assert.equal(manifest.projectVersion, "2026.01.0");

const posture = manifest.regulatoryPosture as JsonRecord;
assert.equal(posture.causalityDefault, "NOT_ESTABLISHED");
assert.equal(posture.pvRelevanceIsNotIcsrCompleteness, true);
assert.equal(posture.humanReviewRequiredForEscalation, true);
assert.equal(posture.aeKeywordAloneIsInsufficient, true);
assert.deepEqual(posture.minimumIcsrElements, ["P", "R", "D", "E"]);

assert.deepEqual(manifest.pipeline, [
  "RAW_MENTION",
  "PRODUCT_RECOGNITION",
  "PATIENT_REPORTER_RECOGNITION",
  "OBSERVED_EVENT_RECOGNITION",
  "TEMPORAL_CAUSAL_CONTEXT",
  "PV_RELEVANCE",
  "ICSR_ELEMENT_ASSESSMENT",
  "HUMAN_REVIEW_OR_NO_ESCALATION",
]);

const datasets = manifest.datasets as JsonRecord[];
assertUniqueIds(datasets, "Dataset contracts");
assert.deepEqual(datasets.map((item) => item.id), [
  "regulatory_case_corpus",
  "ae_adr_master_taxonomy",
  "consumer_social_expression_library",
  "pv_classifier_training_examples",
]);
assert.equal(datasets[0].status, "complete", "The implemented regulatory corpus must be marked complete.");
assert.equal(datasets[1].status, "draft_generated_pending_pv_review", "The generated taxonomy must remain visibly draft until PV review.");
assert.equal(datasets[2].status, "draft_generated_pending_pv_medical_review", "The generated expression library must remain visibly draft until qualified review.");
assert.equal(datasets[3].status, "draft_generated_pending_human_adjudication", "Generated training examples must remain visibly draft until human adjudication.");

const schemas = new Map<string, JsonRecord>();
for (const dataset of datasets) {
  const schemaPath = path.join(configurationRoot, String(dataset.schema));
  assert(fs.existsSync(schemaPath), `Missing schema for ${dataset.id}: ${schemaPath}`);
  const schema = readJson(schemaPath);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false, `${dataset.id} must reject undeclared root fields.`);
  schemas.set(String(dataset.id), schema);
}
assert.equal(new Set([...schemas.values()].map((schema) => schema.$id)).size, datasets.length, "Schema IDs must be unique.");

const regulatorySchema = schemas.get("regulatory_case_corpus")!;
const observation = {
  queryId: "architecture-fixture",
  queryKind: "brand" as const,
  productSearched: "BOTOX",
  field: "patient.drug.medicinalproduct.exact",
  suspectOnly: false,
  sourceApiQuery: "https://api.fda.gov/drug/event.json?search=BOTOX",
  retrievedAt: "2026-09-16T12:00:00.000Z",
  sourceProductValues: ["BOTOX COSMETIC"],
  sourceReactionValues: ["Eyelid ptosis"],
};
const normalized = normalizeOpenFdaRegulatoryCase(pageOne.results[0], [observation]).normalized as unknown as JsonRecord;
assertRootRequiredFields(regulatorySchema, normalized, "Normalized regulatory fixture");
assert.equal(normalized.causality_status, "NOT_ESTABLISHED");
assert(Array.isArray(normalized.drugs) && Array.isArray(normalized.reactions) && Array.isArray(normalized.outcomes));
assert(!("drug_reaction_relationships" in normalized), "The schema-backed regulatory record must not invent drug/reaction causality.");

const taxonomySchemaText = JSON.stringify(schemas.get("ae_adr_master_taxonomy"));
assert(taxonomySchemaText.includes("meddra_pt"));
assert(taxonomySchemaText.includes("category_is_official_meddra_hierarchy"));
assert(taxonomySchemaText.includes("draft_pending_pv_review"));
assert(taxonomySchemaText.includes("related_concepts"));

const expressionSchemaText = JSON.stringify(schemas.get("consumer_social_expression_library"));
for (const expressionType of ["clinical_synonyms", "lay_synonyms", "consumer_expressions", "colloquial_expressions", "symptom_descriptions", "likely_misspellings", "slang_or_informal_phrasing", "temporal_expressions", "causal_expressions", "uncertain_causality_expressions"]) {
  assert(expressionSchemaText.includes(expressionType), `Missing expression type ${expressionType}.`);
}
assert(expressionSchemaText.includes("GENERATED") && expressionSchemaText.includes("CURATED"));
assert(expressionSchemaText.includes("is_official_meddra_synonym"));
assert(expressionSchemaText.includes("pending_pv_medical_review"));

const exampleSchemaText = JSON.stringify(schemas.get("pv_classifier_training_examples"));
for (const exampleClass of ["OBSERVED_EVENT_SELF", "OBSERVED_EVENT_THIRD_PARTY", "POSSIBLE_EVENT_UNCERTAIN_CAUSALITY", "HYPOTHETICAL", "ANTICIPATED_OR_FEARED", "NEGATED", "GENERAL_INFORMATION", "PROVIDER_WARNING", "HISTORICAL_OR_UNRELATED", "INSUFFICIENT_INFORMATION", "MEDICATION_ERROR_OR_SPECIAL_SITUATION"]) {
  assert(exampleSchemaText.includes(exampleClass), `Missing classifier class ${exampleClass}.`);
}
for (const criterion of ["patient_status", "reporter_status", "drug_status", "event_status"]) assert(exampleSchemaText.includes(criterion), `Missing ICSR element field ${criterion}.`);
assert(exampleSchemaText.includes("evidence_spans"));
assert(exampleSchemaText.includes("locked_holdout"));
assert(exampleSchemaText.includes("human_review_status"));
assert(exampleSchemaText.includes("COMPLETE_POTENTIAL_ICSR") && exampleSchemaText.includes("SPECIAL_SITUATION_REVIEW"));

const assumptions = manifest.assumptions as JsonRecord[];
assertUniqueIds(assumptions, "Assumptions");
assert(assumptions.length >= 6 && assumptions.every((item) => item.status === "accepted"));

const decisions = manifest.unresolvedDecisions as JsonRecord[];
assertUniqueIds(decisions, "Unresolved decisions");
assert(decisions.length >= 6);
assert(decisions.every((item) => item.status === "open" && item.owner && item.blockingPhase));

const phases = manifest.phases as JsonRecord[];
assertUniqueIds(phases, "Implementation phases");
assert.deepEqual(phases.map((phase) => phase.id), [
  "PHASE_0_FOUNDATION",
  "PHASE_1_REGULATORY_CORPUS",
  "PHASE_2_TAXONOMY",
  "PHASE_3_EXPRESSION_LIBRARY",
  "PHASE_4_TRAINING_EXAMPLES",
  "PHASE_5_EVALUATION",
  "PHASE_6_OPERATIONS",
]);
for (const phase of phases) {
  const criteria = phase.acceptanceCriteria as JsonRecord[];
  assertUniqueIds(criteria, `${phase.id} acceptance criteria`);
  assert(criteria.length >= 3, `${phase.id} requires at least three acceptance criteria.`);
  if (phase.status === "complete") {
    assert(criteria.every((criterion) => criterion.status === "met"), `${phase.id} is complete but has unmet criteria.`);
  } else if (phase.status === "in_progress") {
    assert(criteria.some((criterion) => criterion.status === "met") && criteria.some((criterion) => criterion.status === "pending"), `${phase.id} must expose both completed and pending gates.`);
  } else {
    assert.equal(phase.status, "planned");
    assert(criteria.every((criterion) => criterion.status === "pending"), `${phase.id} is planned but contains promoted criteria.`);
  }
}

const architecturePath = path.resolve(configurationRoot, String(manifest.architectureDocument));
assert(fs.existsSync(architecturePath), "The project architecture document reference must resolve.");
const architecture = fs.readFileSync(architecturePath, "utf8");
for (const heading of ["## 1. Proposed architecture", "## 2. Proposed schemas", "## 3. Assumptions", "## 4. Unresolved decisions", "## 5. Implementation phases", "## 6. Acceptance criteria by phase"]) {
  assert(architecture.includes(heading), `Architecture document is missing ${heading}.`);
}
assert(architecture.includes("does not imply that those datasets have already been generated or approved"));

const regulatoryManifest = readJson(path.join(configurationRoot, "regulatory/manifest.json"));
for (const referenceKey of ["projectManifest", "normalizedRecordSchema"]) {
  const referencedPath = path.resolve(configurationRoot, "regulatory", String(regulatoryManifest[referenceKey]));
  assert(fs.existsSync(referencedPath), `Regulatory manifest reference ${referenceKey} must resolve.`);
}

console.log(JSON.stringify({
  datasets: datasets.length,
  schemas: schemas.size,
  assumptions: assumptions.length,
  unresolvedDecisions: decisions.length,
  phases: phases.length,
  acceptanceCriteria: phases.reduce((count, phase) => count + (phase.acceptanceCriteria as JsonRecord[]).length, 0),
  currentState: "Regulatory corpus complete; taxonomy, expression-library, contrastive training-example drafts, and validation harness generated pending qualified review/adjudication; operations phase planned",
}, null, 2));
