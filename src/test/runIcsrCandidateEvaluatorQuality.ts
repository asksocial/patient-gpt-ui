import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateIcsrCandidate,
  getIcsrCandidateEvaluatorConfiguration,
  type IcsrCandidateEvaluatorInput,
} from "../lib/pv";

const timestamps = {
  original_post_timestamp: "2026-09-17T10:00:00.000Z",
  collection_timestamp: "2026-09-17T10:05:00.000Z",
  algorithm_timestamp: "2026-09-17T10:06:00.000Z",
  human_review_timestamp: null,
  escalation_timestamp: null,
};

function source(overrides: Partial<IcsrCandidateEvaluatorInput["source"]> = {}): IcsrCandidateEvaluatorInput["source"] {
  return {
    username: "@pv_author_42",
    source_platform: "Reddit",
    source_url: "https://reddit.example/r/example/comments/post-42",
    post_id: "post-42",
    ...timestamps,
    ...overrides,
  };
}

function drug(product = "BOTOX", activeIngredient = "ONABOTULINUMTOXINA", evidence = "Botox") {
  return [{ product, active_ingredient: activeIngredient, evidence, confidence: 0.98, suspect: true }];
}

function event(rawExpression = "trouble swallowing", normalizedEvent = "difficulty swallowing", meddraPt = "Dysphagia") {
  return [{ raw_expression: rawExpression, normalized_event: normalizedEvent, meddra_pt_candidate: meddraPt, evidence: rawExpression, confidence: 0.96, suspected: true }];
}

function evaluate(overrides: Partial<IcsrCandidateEvaluatorInput>): ReturnType<typeof evaluateIcsrCandidate> {
  return evaluateIcsrCandidate({
    mention: "I'm a 42-year-old woman with initials M.D. Three days after Botox, I developed trouble swallowing.",
    pv_relevance_detected: true,
    observation_context: "OBSERVED",
    source: source(),
    drug_candidates: drug(),
    event_candidates: event(),
    ...overrides,
  });
}

function main() {
  const configuration = getIcsrCandidateEvaluatorConfiguration();
  assert.equal(configuration.stage, "POST_PV_RELEVANCE_DETECTION");
  assert.equal(configuration.legalNameRequiredForPatient, false);
  assert.equal(configuration.legalNameRequiredForReporter, false);
  assert.equal(configuration.incompleteCaseReviewRoute, "POTENTIAL_ICSR_MISSING_ELEMENT");
  const outputSchema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "config/pv/icsr-candidate-evaluator/output-schema-2026.01.0.json"), "utf8"));
  assert.equal(outputSchema.additionalProperties, false);
  for (const status of ["POTENTIAL_ICSR_COMPLETE", "POTENTIAL_ICSR_MISSING_PATIENT", "POTENTIAL_ICSR_MISSING_REPORTER", "POTENTIAL_ICSR_MISSING_DRUG", "POTENTIAL_ICSR_MISSING_EVENT", "POTENTIAL_ICSR_MULTIPLE_ELEMENTS_MISSING", "NOT_AN_OBSERVED_EVENT", "SPECIAL_SITUATION_REVIEW"]) {
    assert(outputSchema.properties.icsr_status.enum.includes(status));
  }

  const complete = evaluate({});
  assert.equal(complete.icsr_status, "POTENTIAL_ICSR_COMPLETE");
  assert.equal(complete.original_mention, "I'm a 42-year-old woman with initials M.D. Three days after Botox, I developed trouble swallowing.");
  assert.deepEqual(complete.missing_elements, []);
  assert.equal(complete.patient.present, true);
  assert.equal(complete.patient.basis, "ICH_QUALIFYING_CHARACTERISTIC");
  assert.equal(complete.reporter.present, true);
  assert.equal(complete.reporter.basis, "SOURCE_ACCOUNT_CONTEXT");
  assert.equal(complete.drug.product, "BOTOX");
  assert.equal(complete.drug.active_ingredient, "ONABOTULINUMTOXINA");
  assert.equal(complete.event.meddra_pt_candidate, "Dysphagia");
  assert.equal(complete.drugs.length, 1);
  assert.equal(complete.events.length, 1);
  assert.equal(complete.review_route, "POTENTIAL_ICSR_REVIEW");
  assert.equal(complete.evaluator.final_determination_made, false);
  assert.equal(complete.pv_review_required, true);
  assert.deepEqual(complete.source_metadata, source(), "Every source identifier and timestamp must be preserved exactly.");

  const accountIdentifiedSelf = evaluate({
    mention: "I developed eyelid drooping after Botox.",
    source: source({ username: "@aesthetic_patient" }),
    event_candidates: event("eyelid drooping", "eyelid drooping", "Eyelid ptosis"),
  });
  assert.equal(accountIdentifiedSelf.icsr_status, "POTENTIAL_ICSR_COMPLETE");
  assert.equal(accountIdentifiedSelf.patient.basis, "SOURCE_ACCOUNT_CONTEXT");
  assert.equal(accountIdentifiedSelf.reporter.basis, "SOURCE_ACCOUNT_CONTEXT");
  assert(accountIdentifiedSelf.limitations.some((item) => item.includes("handle alone is insufficient")), "Account-based identifiability must remain pending human confirmation.");

  const missingPatient = evaluate({
    mention: "My wife developed trouble swallowing after her Botox injections, and I saw it happen.",
  });
  assert.equal(missingPatient.icsr_status, "POTENTIAL_ICSR_MISSING_PATIENT");
  assert.deepEqual(missingPatient.missing_elements, ["P"]);
  assert.equal(missingPatient.review_route, "POTENTIAL_ICSR_MISSING_ELEMENT");

  const missingReporter = evaluate({
    mention: "A 45-year-old female patient developed trouble swallowing after Botox.",
    source: source({ username: null }),
  });
  assert.equal(missingReporter.icsr_status, "POTENTIAL_ICSR_MISSING_REPORTER");
  assert.deepEqual(missingReporter.missing_elements, ["R"]);

  const missingDrug = evaluate({ drug_candidates: [] });
  assert.equal(missingDrug.icsr_status, "POTENTIAL_ICSR_MISSING_DRUG");
  assert.deepEqual(missingDrug.missing_elements, ["D"]);
  assert.equal(missingDrug.drug.present, false);

  const missingEvent = evaluate({ event_candidates: [] });
  assert.equal(missingEvent.icsr_status, "POTENTIAL_ICSR_MISSING_EVENT");
  assert.deepEqual(missingEvent.missing_elements, ["E"]);
  assert.equal(missingEvent.event.present, false);

  const multipleMissing = evaluate({
    mention: "Something happened and I need help.",
    source: source({ username: null }),
    drug_candidates: [],
    event_candidates: [],
  });
  assert.equal(multipleMissing.icsr_status, "POTENTIAL_ICSR_MULTIPLE_ELEMENTS_MISSING");
  assert.deepEqual(multipleMissing.missing_elements, ["P", "R", "D", "E"]);
  assert.equal(multipleMissing.review_route, "POTENTIAL_ICSR_MISSING_ELEMENT");

  const hypothetical = evaluate({
    mention: "Can Botox cause trouble swallowing?",
    observation_context: "NOT_OBSERVED",
  });
  assert.equal(hypothetical.icsr_status, "NOT_AN_OBSERVED_EVENT");
  assert.equal(hypothetical.event.present, false);
  assert.equal(hypothetical.event.raw_expression, "trouble swallowing", "Recognized terminology must remain available even when context is non-observed.");
  assert.equal(hypothetical.event.confidence, 0.96);
  assert.equal(hypothetical.review_route, "NON_OBSERVED_CONTEXT_REVIEW");

  const special = evaluate({
    mention: "I was given an extra dose of Botox by mistake.",
    observation_context: "SPECIAL_SITUATION",
    special_situation: "EXTRA_DOSE",
    event_candidates: [],
  });
  assert.equal(special.icsr_status, "SPECIAL_SITUATION_REVIEW");
  assert.equal(special.review_route, "SPECIAL_SITUATION_REVIEW");
  assert(special.missing_elements.includes("E"), "Missing AE information must remain explicit on a special situation.");

  const secondHand = evaluate({
    mention: "Someone posted that a patient had trouble swallowing after Botox.",
  });
  assert.equal(secondHand.reporter.present, false, "A stable handle must not override second-hand reporter language.");
  assert(secondHand.missing_elements.includes("R"));

  const unsupportedEvidence = evaluate({
    drug_candidates: [{ product: "BOTOX", active_ingredient: "ONABOTULINUMTOXINA", evidence: "Dysport", confidence: 0.99, suspect: true }],
  });
  assert.equal(unsupportedEvidence.drug.present, false, "Candidate evidence not present in the source mention must be rejected.");

  assert.throws(
    () => evaluateIcsrCandidate({ ...({} as IcsrCandidateEvaluatorInput), pv_relevance_detected: false } as unknown as IcsrCandidateEvaluatorInput),
    /only after PV relevance detection/,
  );
  assert.throws(() => evaluate({ source: source({ algorithm_timestamp: "not-a-date" }) }), /algorithm_timestamp must be a valid timestamp/);

  console.log(JSON.stringify({
    stage: configuration.stage,
    completePotentialIcsr: true,
    specificMissingElementStatuses: 4,
    multipleMissingElementsRetained: true,
    nonObservedContextProtected: true,
    specialSituationRouting: true,
    accountContextPendingHumanConfirmation: true,
    timestampsPreserved: true,
    finalDeterminationMade: false,
  }, null, 2));
}

main();
