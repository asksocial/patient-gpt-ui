import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { buildBotulinumReactionTaxonomy, getTaxonomyConfiguration, writeBotulinumReactionTaxonomy } from "../lib/pv/training/taxonomy";

const fixtureDirectory = path.resolve(process.cwd(), "src/test/fixtures/faers-taxonomy");
const fixedNow = () => new Date("2026-09-16T20:00:00.000Z");

async function fixturePreferredTerms() {
  const terms = new Set<string>();
  const input = fs.createReadStream(path.join(fixtureDirectory, "normalized-records.jsonl"), { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const record = JSON.parse(line);
    for (const reaction of record.reactions || []) if (typeof reaction.meddra_preferred_term === "string" && reaction.meddra_preferred_term.trim()) terms.add(reaction.meddra_preferred_term);
  }
  return terms;
}

async function main() {
  const result = await buildBotulinumReactionTaxonomy({ sourceDirectory: fixtureDirectory, now: fixedNow });
  assert.equal(getTaxonomyConfiguration().categorySystemIsOfficialMeddraHierarchy, false);
  assert.equal(result.source.casesRead, 5, "Every fixture source case must be read.");
  assert.equal(result.source.expectedNormalizedRecords, 5, "Source manifest count must be retained.");
  assert.equal(result.source.duplicateCaseIds, 0);
  assert.equal(result.source.casesWithReactionTerminology, 4);
  assert.equal(result.source.casesMissingReactionTerminology, 1, "Records without reaction terminology must be counted rather than discarded.");
  assert.equal(result.source.validReactionOccurrences, 7);
  assert.equal(result.source.seriousCases, 2);
  assert.equal(result.source.nonseriousCases, 2);
  assert.equal(result.source.unknownSeriousnessCases, 1);

  const sourceTerms = await fixturePreferredTerms();
  assert.deepEqual(new Set(result.records.map((record) => record.meddra_pt)), sourceTerms, "Every source MedDRA PT must be preserved exactly once in the taxonomy.");
  assert.equal(result.records.length, 5);
  const eyelidPtosis = result.records.find((record) => record.meddra_pt === "Eyelid ptosis");
  assert(eyelidPtosis);
  assert.equal(eyelidPtosis.normalized_label, "eyelid drooping");
  assert.equal(eyelidPtosis.source_reaction_occurrence_count, 3);
  assert.equal(eyelidPtosis.source_case_count, 2);
  assert.equal(eyelidPtosis.source_report_count, 1, "Different case versions must not inflate unique safety report counts.");
  assert.equal(eyelidPtosis.serious_case_count, 2);
  assert.equal(eyelidPtosis.nonserious_case_count, 0);
  assert.equal(eyelidPtosis.unknown_seriousness_case_count, 0);
  assert.deepEqual(eyelidPtosis.associated_target_products, ["BOTOX", "DYSPORT"]);
  assert.deepEqual(eyelidPtosis.associated_active_ingredients, ["ABOBOTULINUMTOXINA", "ONABOTULINUMTOXINA"]);
  assert.equal(eyelidPtosis.first_seen_date, "2024-01-01");
  assert.equal(eyelidPtosis.last_seen_date, "2024-03-01");
  assert.equal(eyelidPtosis.semantic_category, "ocular");
  assert.equal(eyelidPtosis.category_is_official_meddra_hierarchy, false);
  assert(eyelidPtosis.related_concepts.some((item) => item.meddra_pt === "Ptosis" && item.review_status === "algorithmic_candidate_pending_pv_review"));
  assert.equal(eyelidPtosis.ranks.frequency, 1);
  assert.equal(eyelidPtosis.ranks.seriousness, 1);
  assert(eyelidPtosis.provenance.association_statement.includes("does not establish"));

  const displayVariant = result.records.find((record) => record.meddra_pt === "HEADACHE");
  assert.equal(displayVariant?.normalized_label, "headache", "Normalized labels may group presentation variants without replacing the source PT.");
  assert(displayVariant?.related_concepts.some((item) => item.meddra_pt === "Headache" && item.relationship_type === "equivalent_to"));

  const dysphagia = result.records.find((record) => record.meddra_pt === "Dysphagia");
  assert.equal(dysphagia?.normalized_label, "difficulty swallowing");
  assert.equal(dysphagia?.semantic_category, "swallowing");
  const headache = result.records.find((record) => record.meddra_pt === "Headache");
  assert(headache?.semantic_categories.includes("pain") && headache.semantic_categories.includes("neurologic"));

  assert(result.summaries.byProduct.some((row) => row.association_value === "BOTOX" && row.meddra_pt === "Eyelid ptosis" && row.source_case_count === 1));
  assert(result.summaries.byActiveIngredient.some((row) => row.association_value === "ONABOTULINUMTOXINA" && row.meddra_pt === "Dysphagia"));
  assert(result.summaries.byIndication.some((row) => row.association_value === "MIGRAINE" && row.meddra_pt === "Eyelid ptosis"));

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asksocial-faers-taxonomy-"));
  try {
    const outputDirectory = path.join(temporaryRoot, "taxonomy");
    const written = writeBotulinumReactionTaxonomy(result, outputDirectory);
    for (const expected of [
      "taxonomy.json", "taxonomy.csv", "manifest.json",
      "summaries/top-50-reactions-overall.json", "summaries/top-serious-reactions.json",
      "summaries/reactions-by-product.json", "summaries/reactions-by-active-ingredient.json", "summaries/reactions-by-indication.json",
    ]) assert(fs.existsSync(path.join(outputDirectory, expected)), `Missing generated file ${expected}.`);
    const taxonomy = JSON.parse(fs.readFileSync(path.join(outputDirectory, "taxonomy.json"), "utf8"));
    assert.equal(taxonomy.reconciliation.case_reconciliation_passed, true);
    assert.equal(taxonomy.reconciliation.seriousness_reconciliation_passed, true);
    assert.equal(taxonomy.reconciliation.reaction_reconciliation_passed, true);
    assert.equal(taxonomy.records.find((record: { meddra_pt: string }) => record.meddra_pt === "Eyelid ptosis").meddra_pt, "Eyelid ptosis");
    assert(fs.readFileSync(path.join(outputDirectory, "taxonomy.csv"), "utf8").includes('"Eyelid ptosis"'));
    assert.equal(written.manifest.uniqueReactionPreferredTerms, 5);
    assert.throws(() => writeBotulinumReactionTaxonomy(result, outputDirectory), /already exists/, "Taxonomy snapshots must be immutable.");

    const duplicateDirectory = path.join(temporaryRoot, "duplicate-source");
    fs.cpSync(fixtureDirectory, duplicateDirectory, { recursive: true });
    const firstLine = fs.readFileSync(path.join(fixtureDirectory, "normalized-records.jsonl"), "utf8").split("\n")[0];
    fs.appendFileSync(path.join(duplicateDirectory, "normalized-records.jsonl"), `${firstLine}\n`);
    await assert.rejects(
      () => buildBotulinumReactionTaxonomy({ sourceDirectory: duplicateDirectory, now: fixedNow }),
      /Duplicate normalized FAERS case ID/,
      "Duplicate cases must stop the build rather than be silently dropped.",
    );

    const malformedDirectory = path.join(temporaryRoot, "malformed-source");
    fs.cpSync(fixtureDirectory, malformedDirectory, { recursive: true });
    fs.appendFileSync(path.join(malformedDirectory, "normalized-records.jsonl"), "{malformed}\n");
    await assert.rejects(
      () => buildBotulinumReactionTaxonomy({ sourceDirectory: malformedDirectory, now: fixedNow }),
      /Malformed normalized FAERS JSON/,
      "Malformed source cases must stop the build rather than be silently dropped.",
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  console.log(JSON.stringify({
    uniqueReactionPreferredTerms: result.records.length,
    sourceCases: result.source.casesRead,
    seriousCases: result.source.seriousCases,
    recordsMissingReactionTerminology: result.source.casesMissingReactionTerminology,
    reactionOccurrencesReconciled: result.records.reduce((sum, record) => sum + record.source_reaction_occurrence_count, 0),
    meddraTermsPreservedExactly: true,
    silentDiscardProtection: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
