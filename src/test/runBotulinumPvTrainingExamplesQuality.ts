import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildBotulinumPvTrainingExamples, PV_EXAMPLE_CLASSES, writeBotulinumPvTrainingExamples } from "../lib/pv/training/examples";

const fixedNow = () => new Date("2026-09-17T15:00:00.000Z");
const specialPreferredTerms = [
  "Overdose", "Extra dose administered", "Wrong product administered", "Intentional product misuse", "Off label use",
  "Accidental exposure to product", "Occupational exposure to product", "Maternal exposure during pregnancy",
  "Maternal exposure during breast feeding", "Drug ineffective", "Product quality issue",
];

function expression(conceptId: string, preferredTerm: string, normalized: string) {
  return {
    expression_id: `expr_${conceptId}`,
    expression: normalized,
    normalized_expression: normalized.toLocaleLowerCase("en-US"),
    expression_type: "lay_synonyms",
    expression_source: "GENERATED",
    confidence: "medium",
    language: "en",
    locale: "en-US",
    taxonomy_concept_id: conceptId,
    normalized_concept: normalized,
    meddra_pt: preferredTerm,
    is_official_meddra_synonym: false,
    validation_status: "pending_pv_medical_review",
    provenance: {},
  };
}

function concept(preferredTerm: string, normalized: string, index: number, profile = "clinical_high_priority") {
  const conceptId = `fixture_concept_${index}`;
  return {
    taxonomy_concept_id: conceptId,
    meddra_pt: preferredTerm,
    canonical_concept: normalized,
    taxonomy_version: "2026.01.0",
    library_version: "2026.01.0",
    semantic_category: profile === "clinical_high_priority" ? "neurologic" : "other",
    priority: profile === "clinical_high_priority" ? "high" : "standard",
    generation_profile: profile,
    source_case_count: 10_000 - index,
    review_status: "pending_pv_medical_review",
    clinical_synonyms: [],
    lay_synonyms: [expression(conceptId, preferredTerm, normalized)],
    consumer_expressions: [],
    colloquial_expressions: [],
    symptom_descriptions: [],
    likely_misspellings: [],
    slang_or_informal_phrasing: [],
    temporal_expressions: [],
    causal_expressions: [],
    uncertain_causality_expressions: [],
    provenance: {},
  };
}

function fixtureLibrary() {
  const clinical = Array.from({ length: 52 }, (_, index) => concept(`Fixture PT ${index + 1}`, `fixture event ${index + 1}`, index));
  const special = specialPreferredTerms.map((preferredTerm, index) => concept(preferredTerm, preferredTerm.toLocaleLowerCase("en-US"), 100 + index, "manual_review_only"));
  return {
    schemaVersion: "1.0.0",
    libraryVersion: "2026.01.0",
    status: "draft_pending_pv_medical_review",
    source: {
      taxonomySnapshot: "fixture-taxonomy",
      taxonomySha256: "a".repeat(64),
      taxonomyVersion: "2026.01.0",
    },
    concept_records: [...clinical, ...special],
  };
}

function main() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asksocial-pv-examples-"));
  try {
    const expressionDirectory = path.join(temporaryRoot, "expression-snapshot");
    fs.mkdirSync(expressionDirectory);
    const expressionLibraryPath = path.join(expressionDirectory, "social_expression_library.json");
    fs.writeFileSync(expressionLibraryPath, JSON.stringify(fixtureLibrary()));
    const result = buildBotulinumPvTrainingExamples({ expressionLibraryPath, now: fixedNow });
    assert.equal(result.examples.length, 572);
    assert.equal(result.importantConcepts.length, 52);
    for (const exampleClass of PV_EXAMPLE_CLASSES) assert.equal(result.examples.filter((item) => item.example_class === exampleClass).length, 52, `${exampleClass} must be balanced.`);
    assert(result.examples.every((item) => item.needs_human_review && item.human_review_status === "PENDING"));
    assert(result.examples.every((item) => item.provenance.source_type === "SYNTHETIC_CONTRAST"));
    assert(result.examples.every((item) => !/\breportable\b|\bconfirmed adr\b/i.test(`${item.text} ${item.reasoning_label}`)));
    assert(result.examples.filter((item) => item.example_class === "HYPOTHETICAL").every((item) => item.hypothetical));
    assert(result.examples.filter((item) => item.example_class === "ANTICIPATED_OR_FEARED").every((item) => !item.hypothetical));
    assert(result.examples.filter((item) => item.example_class === "NEGATED").every((item) => item.negated));
    assert(result.examples.filter((item) => item.icsr_candidate === "COMPLETE_POTENTIAL_ICSR").every((item) => item.patient_status === "IDENTIFIABLE" && item.reporter_status === "IDENTIFIABLE_FIRST_HAND"));
    assert.equal(result.examples.filter((item) => item.example_class === "MEDICATION_ERROR_OR_SPECIAL_SITUATION" && item.icsr_candidate === "SPECIAL_SITUATION_REVIEW").length, 52);
    for (const conceptItem of result.importantConcepts) {
      const group = result.examples.filter((item) => item.contrast_group_id === `contrast:${conceptItem.taxonomy_concept_id}`);
      assert.equal(group.length, 10);
      assert.equal(new Set(group.map((item) => item.mentioned_event)).size, 1, "Contrast set must reuse the same event terminology.");
      assert.equal(new Set(group.map((item) => item.split.partition)).size, 1, "Contrast set must not leak across partitions.");
      assert.equal(group.filter((item) => ["OBSERVED_EVENT_SELF", "OBSERVED_EVENT_THIRD_PARTY"].includes(item.example_class)).length, 2);
      assert.equal(group.filter((item) => ["HYPOTHETICAL", "ANTICIPATED_OR_FEARED", "NEGATED", "GENERAL_INFORMATION", "PROVIDER_WARNING", "HISTORICAL_OR_UNRELATED"].includes(item.example_class)).length, 6);
    }

    const outputDirectory = path.join(temporaryRoot, "training-output");
    const written = writeBotulinumPvTrainingExamples(result, outputDirectory);
    for (const expected of ["pv_training_examples.jsonl", "pv_training_examples.csv", "summary-report.json", "class-distribution.csv", "concept-coverage.csv", "manifest.json"]) {
      assert(fs.existsSync(path.join(outputDirectory, expected)), `Missing ${expected}.`);
    }
    assert.equal(written.manifest.validation.classBalancePassed, true);
    assert.equal(written.manifest.validation.contrastiveCoveragePassed, true);
    assert.equal(written.manifest.validation.conceptGroupLeakageDetected, false);
    assert.equal(written.manifest.validation.finalReportabilityDeterminations, 0);
    const lines = fs.readFileSync(path.join(outputDirectory, "pv_training_examples.jsonl"), "utf8").trim().split("\n");
    assert.equal(lines.length, 572);
    assert.equal(JSON.parse(lines[0]).provenance.source_taxonomy_sha256, "a".repeat(64));
    assert.throws(() => writeBotulinumPvTrainingExamples(result, outputDirectory), /already exists/, "Training snapshots must be immutable.");

    const invalidLibraryPath = path.join(temporaryRoot, "invalid-library.json");
    const invalid = fixtureLibrary();
    invalid.concept_records = invalid.concept_records.filter((item) => item.meddra_pt !== "Overdose");
    fs.writeFileSync(invalidLibraryPath, JSON.stringify(invalid));
    assert.throws(() => buildBotulinumPvTrainingExamples({ expressionLibraryPath: invalidLibraryPath }), /has no taxonomy\/expression-library parent Overdose/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  console.log(JSON.stringify({
    examples: 572,
    classes: 11,
    examplesPerClass: 52,
    importantConcepts: 52,
    contextualExamplesPerConcept: 10,
    difficultNegativesPerPositive: 3,
    leakageProtection: true,
    finalReportabilityDeterminations: 0,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
