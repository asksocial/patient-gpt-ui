import assert from "node:assert/strict";
import {
  evaluateIcsrCandidate,
  type IcsrCandidateEvaluatorInput,
} from "../lib/pv";
import {
  getActivePvE2bMapping,
  getActivePvEmailMapping,
  getIcsrE2bAdapterManifest,
  mapIcsrCandidateBatchToE2b,
  mapIcsrCandidateToE2b,
  type IcsrE2bMappingInput,
} from "../lib/pv/e2b";

const mention = "I'm a 42-year-old woman. Two days after Botox and Dysport, I developed trouble swallowing and blurry vision.";

function candidate(overrides: Partial<IcsrCandidateEvaluatorInput> = {}) {
  return evaluateIcsrCandidate({
    mention,
    pv_relevance_detected: true,
    observation_context: "OBSERVED",
    source: {
      username: "@patient_42",
      source_platform: "Reddit",
      source_url: "https://reddit.example/r/botulinum/comments/case-42",
      post_id: "case-42",
      original_post_timestamp: "2026-09-17T10:00:00.000Z",
      collection_timestamp: "2026-09-17T10:05:00.000Z",
      algorithm_timestamp: "2026-09-17T10:06:00.000Z",
      human_review_timestamp: null,
      escalation_timestamp: null,
    },
    drug_candidates: [
      { product: "BOTOX", active_ingredient: "ONABOTULINUMTOXINA", evidence: "Botox", confidence: 0.99, suspect: true },
    ],
    event_candidates: [
      { raw_expression: "trouble swallowing", normalized_event: "difficulty swallowing", meddra_pt_candidate: "Dysphagia", evidence: "trouble swallowing", confidence: 0.98, suspected: true },
    ],
    ...overrides,
  });
}

function input(overrides: Partial<IcsrE2bMappingInput> = {}): IcsrE2bMappingInput {
  return {
    case_id: "AS-PV-00042",
    candidate: candidate(),
    mapped_at: "2026-09-17T10:07:00.000Z",
    ...overrides,
  };
}

function mappedField(result: ReturnType<typeof mapIcsrCandidateToE2b>, target: string, occurrence: number | null = null) {
  const field = result.mapped_fields.find((item) => item.target_field === target && item.occurrence === occurrence);
  assert(field, `Expected mapped field ${target} occurrence ${occurrence}`);
  return field;
}

function main() {
  const specificationBefore = JSON.stringify(getActivePvE2bMapping());
  const manifest = getIcsrE2bAdapterManifest();
  assert.equal(manifest.targetMappingVersion, getActivePvE2bMapping().mappingVersion);
  assert.equal(manifest.targetEmailMappingVersion, getActivePvEmailMapping().emailMappingVersion);

  const basic = mapIcsrCandidateToE2b(input());
  assert.equal(basic.original_social_mention, mention, "The exact social mention must be preserved.");
  assert.deepEqual(basic.provenance.source_metadata, candidate().source_metadata, "All source identifiers and timestamps must be preserved.");
  assert.equal(mappedField(basic, "drugs[].productNameReported", 0).e2b_element, "G.k.2.2");
  assert.equal(mappedField(basic, "reactions[].verbatim", 0).e2b_element, "E.i.1.1a");
  assert.equal(mappedField(basic, "narrative.caseNarrative").e2b_element, "H.1");
  assert.equal(mappedField(basic, "drugs[].productNameReported", 0).requirement, "required");
  assert.equal(mappedField(basic, "drugs[].productNameReported", 0).value.source_value, "Botox");
  assert.equal(mappedField(basic, "drugs[].productNameReported", 0).value.normalized_value, "BOTOX");
  assert.equal(mappedField(basic, "drugs[].productNameReported", 0).value.reviewed_value, null);
  assert.equal(mappedField(basic, "drugs[].productNameReported", 0).value.value_source, "SOURCE", "As-reported product fields must select source evidence by default.");
  assert.equal(mappedField(basic, "reactions[].verbatim", 0).value.value_source, "SOURCE", "Reaction verbatim must select the source channel by default.");
  assert(basic.validation.errors.some((error) => error.code === "EXPECTED_R3_FIELD_UNAVAILABLE" && error.field === "administrative.senderCaseId"));
  assert(basic.validation.errors.some((error) => error.code === "MEDDRA_CODING_REQUIRES_HUMAN_VALIDATION"));
  assert(basic.validation.errors.some((error) => error.code === "HUMAN_REVIEW_REQUIRED" && error.field === "narrative.caseNarrative"));
  assert.equal(basic.validation.e2b_export_ready, false);
  assert.equal(basic.validation.regulatory_submission_ready, false);
  assert.equal(basic.provenance.coding_suggestions[0].meddra_pt_candidate, "Dysphagia");
  assert(!basic.mapped_fields.some((field) => field.target_field === "reactions[].meddraCode" && field.value.normalized_value === "Dysphagia"), "A MedDRA PT-name suggestion must not silently populate an official code field.");

  const reviewed = mapIcsrCandidateToE2b(input({
    human_reviewed_values: [{
      target_field: "drugs[].productNameReported",
      occurrence: 0,
      reviewed_value: "BOTOX Cosmetic",
      confidence: 1,
      reviewed_by: "pv-reviewer-1",
      reviewed_at: "2026-09-17T11:00:00.000Z",
    }],
  }));
  const reviewedProduct = mappedField(reviewed, "drugs[].productNameReported", 0).value;
  assert.deepEqual(reviewedProduct, {
    source_value: "Botox",
    normalized_value: "BOTOX",
    reviewed_value: "BOTOX Cosmetic",
    value_source: "HUMAN_REVIEWED",
    confidence: 1,
  }, "Human review must be selected without replacing source or normalized values.");

  const missing = mapIcsrCandidateToE2b(input({
    candidate: candidate({
      mention: "A patient said something happened.",
      source: { ...candidate().source_metadata, username: null },
      drug_candidates: [],
      event_candidates: [],
    }),
  }));
  assert(missing.validation.errors.some((error) => error.field === "drugs[].productNameReported"));
  assert(missing.validation.errors.some((error) => error.field === "reactions[].meddraCode"));
  assert.equal(missing.candidate_status, "POTENTIAL_ICSR_MULTIPLE_ELEMENTS_MISSING");

  const malformedCandidate = structuredClone(candidate());
  malformedCandidate.source_metadata.algorithm_timestamp = "not-a-timestamp";
  const malformed = mapIcsrCandidateToE2b(input({ case_id: "", candidate: malformedCandidate }));
  assert.equal(malformed.validation.mapping_valid, false);
  assert(malformed.validation.errors.some((error) => error.code === "MISSING_CASE_ID"));
  assert(malformed.validation.errors.some((error) => error.code === "MALFORMED_TIMESTAMP" && error.field === "audit.algorithmAssessedAt"));

  const multiple = mapIcsrCandidateToE2b(input({
    candidate: candidate({
      drug_candidates: [
        { product: "BOTOX", active_ingredient: "ONABOTULINUMTOXINA", evidence: "Botox", confidence: 0.99, suspect: true },
        { product: "DYSPORT", active_ingredient: "ABOBOTULINUMTOXINA", evidence: "Dysport", confidence: 0.97, suspect: true },
      ],
      event_candidates: [
        { raw_expression: "trouble swallowing", normalized_event: "difficulty swallowing", meddra_pt_candidate: "Dysphagia", evidence: "trouble swallowing", confidence: 0.98, suspected: true },
        { raw_expression: "blurry vision", normalized_event: "blurred vision", meddra_pt_candidate: "Vision blurred", evidence: "blurry vision", confidence: 0.96, suspected: true },
      ],
    }),
  }));
  assert.equal(multiple.mapped_fields.filter((field) => field.target_field === "drugs[].productNameReported").length, 2, "Multiple drugs must remain separate repeating G.k occurrences.");
  assert.equal(multiple.mapped_fields.filter((field) => field.target_field === "reactions[].verbatim").length, 2, "Multiple events must remain separate repeating E.i occurrences.");
  assert.equal(mappedField(multiple, "drugs[].productNameReported", 1).value.normalized_value, "DYSPORT");
  assert.equal(mappedField(multiple, "reactions[].verbatim", 1).value.normalized_value, "blurred vision");

  const duplicates = mapIcsrCandidateBatchToE2b([
    input({ case_id: "AS-PV-00042" }),
    input({ case_id: "AS-PV-00043" }),
  ]);
  assert.equal(duplicates.length, 2, "Potential duplicates must be retained, not discarded.");
  assert.equal(duplicates[0].duplicate.status, "UNIQUE");
  assert.equal(duplicates[1].duplicate.status, "POSSIBLE_DUPLICATE");
  assert.equal(duplicates[1].duplicate.duplicate_of_case_id, "AS-PV-00042");
  assert(duplicates[1].validation.errors.some((error) => error.code === "POSSIBLE_DUPLICATE_CASE"));

  const approvedEmailFields = new Set(getActivePvEmailMapping().fields.map((field) => field.field));
  const emittedEmailFields = basic.client_email.sections.flatMap((section) => section.fields.map((field) => field.field));
  assert(emittedEmailFields.length > 0);
  assert(emittedEmailFields.every((field) => approvedEmailFields.has(field)), "Client-email representation may contain only approved template fields.");
  assert.equal(basic.client_email.template_version, getActivePvEmailMapping().emailMappingVersion);
  assert(emittedEmailFields.includes("source.verbatim"));
  assert(emittedEmailFields.includes("drugs"));
  assert(emittedEmailFields.includes("reactions"));

  assert.equal(JSON.stringify(getActivePvE2bMapping()), specificationBefore, "The authoritative E2B(R3) specification must remain unchanged by mapping.");
  console.log(JSON.stringify({
    adapterVersion: manifest.adapterVersion,
    targetMappingVersion: manifest.targetMappingVersion,
    mappingTests: true,
    missingFieldTests: true,
    malformedCaseTests: true,
    multipleDrugTests: true,
    multipleEventTests: true,
    duplicateCaseTests: true,
    approvedEmailTemplateOnly: true,
    sourceNormalizedReviewedSeparation: true,
  }, null, 2));
}

main();
