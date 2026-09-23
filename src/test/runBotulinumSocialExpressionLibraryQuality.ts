import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildBotulinumReactionTaxonomy } from "../lib/pv/training/taxonomy";
import {
  EXPRESSION_FIELDS,
  buildBotulinumSocialExpressionLibrary,
  getExpressionLibraryConfiguration,
  writeBotulinumSocialExpressionLibrary,
} from "../lib/pv/training/expressions";

const fixtureDirectory = path.resolve(process.cwd(), "src/test/fixtures/faers-taxonomy");
const fixedNow = () => new Date("2026-09-17T12:00:00.000Z");

async function main() {
  const taxonomy = await buildBotulinumReactionTaxonomy({ sourceDirectory: fixtureDirectory, now: fixedNow });
  const prototype = taxonomy.records[0];
  const synthetic = [
    { meddra_pt: "Drug ineffective", normalized_concept: "drug ineffective", semantic_category: "other", ranks: { frequency: 6, seriousness: 90, product_breadth: 20, unique_cases: 6 } },
    { meddra_pt: "Death", normalized_concept: "death", semantic_category: "systemic", ranks: { frequency: 10, seriousness: 2, product_breadth: 10, unique_cases: 10 } },
    { meddra_pt: "Rare ambiguous finding", normalized_concept: "rare ambiguous finding", semantic_category: "other", ranks: { frequency: 999, seriousness: 999, product_breadth: 999, unique_cases: 999 } },
  ].map((item, index) => ({
    ...prototype,
    concept_id: `synthetic_${index}`,
    meddra_pt: item.meddra_pt,
    normalized_label: item.normalized_concept,
    normalized_concept: item.normalized_concept,
    concept_group_id: `group_${index}`,
    semantic_category: item.semantic_category,
    semantic_categories: [item.semantic_category],
    ranks: item.ranks,
  }));
  const records = [...taxonomy.records, ...synthetic];
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asksocial-social-expressions-"));
  try {
    const taxonomyDirectory = path.join(temporaryRoot, "taxonomy-snapshot");
    fs.mkdirSync(taxonomyDirectory);
    const taxonomyPath = path.join(taxonomyDirectory, "taxonomy.json");
    fs.writeFileSync(taxonomyPath, JSON.stringify({ taxonomyVersion: "2026.01.0", status: "draft_pending_pv_review", records }));
    const result = buildBotulinumSocialExpressionLibrary({ taxonomyPath, now: fixedNow });
    assert.equal(result.concepts.length, records.length, "Every taxonomy concept must be retained.");
    assert.deepEqual(new Set(result.concepts.map((item) => item.meddra_pt)), new Set(records.map((item) => item.meddra_pt)), "Source MedDRA PTs must be preserved exactly.");
    assert(result.expressions.length > 0);
    assert(result.expressions.every((item) => item.taxonomy_concept_id && item.normalized_concept && item.meddra_pt && item.provenance.source_reference));
    assert(result.expressions.every((item) => item.is_official_meddra_synonym === false));
    assert(result.expressions.every((item) => item.validation_status === "pending_pv_medical_review"));

    const dysphagia = result.concepts.find((item) => item.meddra_pt === "Dysphagia");
    assert(dysphagia);
    const curated = dysphagia.lay_synonyms.find((item) => item.expression === "trouble swallowing");
    assert.equal(curated?.expression_source, "CURATED");
    assert.equal(curated?.confidence, "high");
    assert.equal(curated?.normalized_concept, "difficulty swallowing");
    assert.equal(curated?.provenance.generation_method, "versioned_curated_seed");
    const configuration = getExpressionLibraryConfiguration();
    for (const concept of result.concepts.filter((item) => item.priority === "high")) {
      assert(concept.lay_synonyms.length >= configuration.minimumHighPriorityCoverage.lay_synonyms, `${concept.meddra_pt} needs ten lay expressions.`);
      assert(concept.colloquial_expressions.length >= configuration.minimumHighPriorityCoverage.colloquial_expressions, `${concept.meddra_pt} needs five colloquial expressions.`);
      assert(concept.temporal_expressions.length >= configuration.minimumHighPriorityCoverage.temporal_expressions, `${concept.meddra_pt} needs five temporal expressions.`);
    }
    assert.equal(result.concepts.find((item) => item.meddra_pt === "Drug ineffective")?.generation_profile, "special_situation_high_priority");
    assert.equal(result.concepts.find((item) => item.meddra_pt === "Death")?.generation_profile, "fatal_outcome_high_priority");
    const rare = result.concepts.find((item) => item.meddra_pt === "Rare ambiguous finding");
    assert.equal(rare?.generation_profile, "manual_review_only");
    assert(rare && EXPRESSION_FIELDS.every((field) => rare[field].length === 0), "Rare ambiguous concepts should be withheld rather than hallucinated.");
    assert(result.qualityControl.some((item) => item.meddra_pt === "Rare ambiguous finding" && item.reasons.some((reason) => reason.includes("withheld"))));
    assert(result.qualityControl.every((item) => item.production_eligible === false));

    const outputDirectory = path.join(temporaryRoot, "expression-library");
    const written = writeBotulinumSocialExpressionLibrary(result, outputDirectory);
    for (const expected of ["social_expression_library.json", "social_expression_library.csv", "quality-control-report.json", "quality-control-report.csv", "manifest.json"]) {
      assert(fs.existsSync(path.join(outputDirectory, expected)), `Missing generated output ${expected}.`);
    }
    assert.equal(written.manifest.validation.allTaxonomyConceptsRetained, true);
    assert.equal(written.manifest.validation.officialMeddraSynonymClaims, 0);
    assert.equal(written.manifest.validation.productionEligibleConcepts, 0);
    assert.throws(() => writeBotulinumSocialExpressionLibrary(result, outputDirectory), /already exists/, "Library snapshots must be immutable.");
    const library = JSON.parse(fs.readFileSync(path.join(outputDirectory, "social_expression_library.json"), "utf8"));
    assert.equal(library.safeguards.causalityEstablished, false);
    assert.equal(library.safeguards.productionUseAllowedBeforePvMedicalReview, false);
    assert.equal(library.counts.taxonomyConcepts, records.length);
    assert(fs.readFileSync(path.join(outputDirectory, "social_expression_library.csv"), "utf8").includes('"trouble swallowing"'));

    const invalidTaxonomyPath = path.join(temporaryRoot, "invalid-taxonomy.json");
    fs.writeFileSync(invalidTaxonomyPath, JSON.stringify({ taxonomyVersion: "2026.01.0", records: [{ ...prototype, meddra_pt: "" }] }));
    assert.throws(() => buildBotulinumSocialExpressionLibrary({ taxonomyPath: invalidTaxonomyPath }), /must have a concept ID, MedDRA PT, and normalized concept/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  console.log(JSON.stringify({
    taxonomyConceptRetention: true,
    parentMappingAndProvenanceValidation: true,
    highPriorityCoverageValidation: true,
    conservativeRareConceptHandling: true,
    officialMeddraSynonymClaims: 0,
    productionEligibleBeforeReview: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
