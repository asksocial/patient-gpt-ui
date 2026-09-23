import assert from "node:assert/strict";
import {
  BOTULINUM_PV_RECOGNITION_VERSION,
  getBotulinumPvRecognitionConfiguration,
  recognizeBotulinumToxinPvMention,
  type BotulinumPvPipelineOutput,
  type BotulinumPvRecognitionInput,
} from "../lib/pv";

const sourceMetadata = {
  source: "Reddit",
  source_url: "https://reddit.example/r/aesthetics/comments/pv-101",
  source_id: "pv-101",
  original_timestamp: "2026-09-17T10:00:00.000Z",
  collection_timestamp: "2026-09-17T10:05:00.000Z",
  algorithm_timestamp: "2026-09-17T10:06:00.000Z",
};

function recognize(original_mention: string, overrides: Partial<BotulinumPvRecognitionInput> = {}) {
  return recognizeBotulinumToxinPvMention({
    original_mention,
    author_identifier: "@source_author",
    ...sourceMetadata,
    ...overrides,
  });
}

function assertExactSpans(result: BotulinumPvPipelineOutput) {
  for (const evidence of result.evidence_spans) {
    assert.equal(
      result.original_mention.slice(evidence.start, evidence.end),
      evidence.text,
      `Evidence offset must reproduce source text for ${evidence.kind}.`,
    );
    assert(evidence.start >= 0 && evidence.end > evidence.start && evidence.end <= result.original_mention.length);
  }
}

function assertNoFinalDetermination(result: BotulinumPvPipelineOutput) {
  assert.equal(result.human_review_routing.final_regulatory_determination_made, false);
  assert(!/reportable ae confirmed|confirmed adr/i.test(result.human_review_routing.statement));
  if (result.human_review_status === "PV review required") assert.equal(result.human_review_routing.statement, "PV review required");
}

function main() {
  const config = getBotulinumPvRecognitionConfiguration();
  assert.equal(config.manifest.pipelineVersion, BOTULINUM_PV_RECOGNITION_VERSION);
  assert.equal(config.manifest.status, "active");
  assert.equal(config.lexicon.taxonomyVersion, config.manifest.taxonomyVersion);

  const positive = recognize("I'm a 42-year-old woman. Three days after Botox, I developed trouble swallowing.");
  assert.equal(positive.product_recognition[0].product, "BOTOX");
  assert.equal(positive.observed_event_detection.observed, true);
  assert.equal(positive.event_normalization[0].normalized_concept, "difficulty swallowing");
  assert.equal(positive.meddra_candidate_mapping[0].meddra_pt_candidate, "Dysphagia");
  assert.equal(positive.meddra_candidate_mapping[0].human_validation_required, true);
  assert.equal(positive.temporal_relationships.some((item) => item.type === "AFTER_PRODUCT"), true);
  assert.equal(positive.pv_relevance.level, "HIGH");
  assert.equal(positive.human_review_status, "PV review required");
  assert.equal("icsr_status" in positive.icsr_element_assessment && positive.icsr_element_assessment.icsr_status, "POTENTIAL_ICSR_COMPLETE");
  assertExactSpans(positive);
  assertNoFinalDetermination(positive);

  const directObserved = recognize("Botox made my eyelid droop.");
  assert.equal(directObserved.observed_event_detection.observed, true);
  assert.equal(directObserved.meddra_candidate_mapping[0].meddra_pt_candidate, "Eyelid ptosis");
  assert.equal(directObserved.human_review_status, "PV review required");

  const uncertain = recognize("Not sure if it's related, but I've had blury vision since getting Dysport.");
  assert.equal(uncertain.observed_event_detection.observed, true);
  assert.equal(uncertain.causality_language.some((item) => item.type === "POSSIBLE_ATTRIBUTION"), true);
  assert.equal(uncertain.meddra_candidate_mapping[0].meddra_pt_candidate, "Vision blurred");
  assert.equal(uncertain.human_review_status, "PV review required");

  const hypothetical = recognize("Can Botox cause trouble swallowing?");
  assert.equal(hypothetical.hypothetical_detection.detected, true);
  assert.equal(hypothetical.pv_relevance.level, "NONE");
  assert.equal(hypothetical.human_review_routing.route, "NO_ESCALATION_RETAIN_AUDIT");
  assert.equal(hypothetical.observed_event_detection.events[0].observation_status, "HYPOTHETICAL");

  const negated = recognize("I had Botox yesterday and thankfully no trouble swallowing.");
  assert.equal(negated.negation_detection.detected, true);
  assert.equal(negated.negation_detection.applies_to_event, true);
  assert.equal(negated.pv_relevance.level, "NONE");
  assert.equal(negated.observed_event_detection.events[0].observation_status, "NEGATED");

  const informational = recognize("The Botox label says it can cause eyelid droop.");
  assert.equal(informational.hypothetical_detection.informational, true);
  assert.equal(informational.pv_relevance.level, "NONE");

  const providerWarning = recognize("My injector warned me that Dysport can cause difficulty swallowing.");
  assert.equal(providerWarning.context.informational, true);
  assert.equal(providerWarning.pv_relevance.level, "NONE");

  const historical = recognize("I had trouble swallowing for years before I ever received Botox.");
  assert.equal(historical.hypothetical_detection.historical_or_unrelated, true);
  assert.equal(historical.observed_event_detection.events[0].observation_status, "HISTORICAL_UNRELATED");
  assert.equal(historical.pv_relevance.level, "NONE");

  const thirdParty = recognize("My wife had trouble swallowing two days after her Xeomin injections, and I saw it happen.");
  assert.equal(thirdParty.third_party_detection.detected, true);
  assert.equal(thirdParty.third_party_detection.relationship, "first_hand_other");
  assert.equal(thirdParty.context.third_party, true);
  assert.notEqual(thirdParty.pv_relevance.level, "NONE");

  const secondHand = recognize("Someone posted that a patient had trouble swallowing after Botox.");
  assert.equal(secondHand.third_party_detection.relationship, "second_hand");
  assert.equal("icsr_status" in secondHand.icsr_element_assessment && secondHand.icsr_element_assessment.icsr_status, "POTENTIAL_ICSR_MULTIPLE_ELEMENTS_MISSING");

  const ambiguousPronoun = recognize("They developed muscular weakness after Daxxify.", { author_identifier: null });
  assert.equal(ambiguousPronoun.patient_reporter_evidence.ambiguous_pronouns, true);
  assert.equal(ambiguousPronoun.third_party_detection.relationship, "ambiguous_pronoun");
  assert.notEqual("icsr_status" in ambiguousPronoun.icsr_element_assessment && ambiguousPronoun.icsr_element_assessment.icsr_status, "POTENTIAL_ICSR_COMPLETE");

  const multiplePatients = recognize("Three patients experienced ptosis after Botox.", { author_identifier: null });
  assert.equal(multiplePatients.patient_reporter_evidence.multiple_patients, true);
  assert.equal("icsr_status" in multiplePatients.icsr_element_assessment && multiplePatients.icsr_element_assessment.icsr_status, "POTENTIAL_ICSR_MULTIPLE_ELEMENTS_MISSING");

  const multipleDrugs = recognize("After Botox and Dysport, I developed a droopy eyelid.");
  assert.deepEqual(multipleDrugs.product_recognition.map((item) => item.product), ["BOTOX", "DYSPORT"]);
  assert.equal("drugs" in multipleDrugs.icsr_element_assessment && multipleDrugs.icsr_element_assessment.drugs.length, 2);

  const activeIngredientAlias = recognize("After onabotulinum toxin type A, I developed a droopy eyelid.");
  assert.equal(activeIngredientAlias.product_recognition[0].active_ingredient, "ONABOTULINUMTOXINA");
  assert.equal(activeIngredientAlias.product_recognition[0].evidence_spans[0].source, "PRODUCT_ALIAS_CONFIG");

  const multipleEvents = recognize("After Jeuveau I developed a droopy eyelid, headache, and blurry vision.");
  assert.deepEqual(multipleEvents.meddra_candidate_mapping.map((item) => item.meddra_pt_candidate), ["Eyelid ptosis", "Headache", "Vision blurred"]);

  const slang = recognize("After Botox: frozen face and a crooked smile 😭");
  assert.equal(slang.observed_event_detection.events.some((item) => item.normalized_event === "facial movement impairment"), true);
  assert.equal(slang.observed_event_detection.events.some((item) => item.normalized_event === "facial asymmetry"), true);

  const misspelling = recognize("Botox yesterday. drooopy eyelid today 😭");
  assert.equal(misspelling.observed_event_detection.observed, true);
  assert.equal(misspelling.meddra_candidate_mapping[0].meddra_pt_candidate, "Eyelid ptosis");
  assert.equal(misspelling.human_review_status, "PV review required");

  const fragmentedSerious = recognize("Dysport. 2 days later. cant breathe 😰 help");
  assert.equal(fragmentedSerious.pv_relevance.serious_safety_priority, true);
  assert(["HIGH", "MEDIUM"].includes(fragmentedSerious.pv_relevance.level));
  assert.equal(fragmentedSerious.human_review_routing.priority, "critical");

  const explicitSeriousness = recognize("I was hospitalized after Botox because of a severe headache.");
  assert.equal(explicitSeriousness.pv_relevance.serious_safety_priority, true);
  assert.equal(explicitSeriousness.evidence_spans.some((item) => item.kind === "seriousness" && item.text === "hospitalized"), true);
  assert.equal(explicitSeriousness.human_review_routing.priority, "critical");

  const specialSituation = recognize("I was given an extra dose of Xeomin by mistake.");
  assert.equal(specialSituation.special_situations[0].type, "EXTRA_DOSE");
  assert.equal(specialSituation.human_review_routing.route, "SPECIAL_SITUATION_REVIEW");
  assert.equal(specialSituation.human_review_status, "PV review required");

  const productQuality = recognize("The Daxxify vial seal was broken before use.");
  assert.equal(productQuality.special_situations[0].type, "PRODUCT_QUALITY_CONCERN");

  const weakContext = recognize("Botox headache", { author_identifier: null });
  assert.equal(weakContext.pv_relevance.level, "LOW");
  assert.equal("icsr_status" in weakContext.icsr_element_assessment && weakContext.icsr_element_assessment.icsr_status, "POTENTIAL_ICSR_MULTIPLE_ELEMENTS_MISSING");
  assert.notEqual(weakContext.human_review_routing.route, "POTENTIAL_ICSR_REVIEW");

  const vague = recognize("Botox ruined me.");
  assert.notEqual(vague.pv_relevance.level, "NONE");
  assert.equal(vague.observed_event_detection.events.length, 0);
  assert.equal("missing_elements" in vague.icsr_element_assessment && vague.icsr_element_assessment.missing_elements.includes("E"), true);

  const unrelated = recognize("Hair botox gave my hair shine. I read about headaches elsewhere.");
  assert.equal(unrelated.product_recognition.length, 0);
  assert.equal(unrelated.pv_relevance.level, "NONE");

  for (const result of [positive, directObserved, uncertain, hypothetical, negated, informational, providerWarning, historical, thirdParty, secondHand, ambiguousPronoun, multiplePatients, multipleDrugs, activeIngredientAlias, multipleEvents, slang, misspelling, fragmentedSerious, explicitSeriousness, specialSituation, productQuality, weakContext, vague, unrelated]) {
    assert.equal(result.source.url, sourceMetadata.source_url);
    assert.equal(result.source.id, sourceMetadata.source_id);
    assert.equal(result.source.original_timestamp, sourceMetadata.original_timestamp);
    assert.equal(result.source.collection_timestamp, sourceMetadata.collection_timestamp);
    assert.equal(result.source.algorithm_timestamp, sourceMetadata.algorithm_timestamp);
    assert.equal(result.versions.classifier_version, BOTULINUM_PV_RECOGNITION_VERSION);
    assertExactSpans(result);
    assertNoFinalDetermination(result);
    assert.doesNotThrow(() => JSON.stringify(result));
  }

  assert.throws(() => recognize(" "), /Original mention is required/);
  assert.throws(() => recognize("Botox caused ptosis.", { source_url: "" }), /Source, source URL, and source ID are required/);
  assert.throws(() => recognize("Botox caused ptosis.", { collection_timestamp: "" }), /collection_timestamp is required/);
  assert.throws(() => recognize("Botox caused ptosis.", { original_timestamp: "bad" }), /original_timestamp must be a valid timestamp/);

  console.log(JSON.stringify({
    pipelineVersion: BOTULINUM_PV_RECOGNITION_VERSION,
    cases: 24,
    exactEvidenceOffsets: true,
    contextContrast: ["hypothetical", "negated", "informational", "provider_warning", "historical"],
    difficultLanguage: ["ambiguous_pronouns", "multiple_drugs", "multiple_patients", "third_party", "slang", "misspellings", "emoji", "fragments"],
    seriousFalseNegativePriority: true,
    finalRegulatoryDeterminationMade: false,
  }, null, 2));
}

main();
