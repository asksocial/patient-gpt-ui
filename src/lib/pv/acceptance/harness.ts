import fs from "node:fs";
import path from "node:path";
import manifestJson from "../../../../config/pv/acceptance/botulinum-toxin/manifest.json";
import { mapIcsrCandidateToE2b, type IcsrE2bMappingResult } from "../e2b";
import type { IcsrCandidateEvaluation } from "../icsrEvaluator";
import { getBotulinumPvRecognitionConfiguration, recognizeBotulinumToxinPvMention } from "../recognition";
import { botulinumPvEndToEndAcceptanceFixtures, type BotulinumPvAcceptanceFixture } from "./fixtures";

type AcceptanceAssertion = {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  evidence: string;
};

type AcceptanceManifest = {
  schemaVersion: string;
  acceptanceSuiteVersion: string;
  topic: string;
  status: "active";
  regulatorySnapshot: string;
  taxonomySnapshot: string;
  expressionSnapshot: string;
  minimumSyntheticExamples: number;
  requiredProducts: string[];
  requiredConcepts: string[];
};

const manifest = manifestJson as AcceptanceManifest;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function selectedValue(field: IcsrE2bMappingResult["mapped_fields"][number]) {
  if (field.value.value_source === "HUMAN_REVIEWED") return field.value.reviewed_value;
  if (field.value.value_source === "AI_NORMALIZED") return field.value.normalized_value;
  return field.value.source_value;
}

function present(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function exactSpans(rawMention: string, spans: Array<{ start: number; end: number; text: string }>) {
  return spans.every((span) => span.start >= 0 && span.end > span.start && span.end <= rawMention.length && rawMention.slice(span.start, span.end) === span.text);
}

function assertResult(id: string, name: string, condition: boolean, evidence: string): AcceptanceAssertion {
  return { id, name, status: condition ? "PASS" : "FAIL", evidence };
}

function candidateEvaluation(value: ReturnType<typeof recognizeBotulinumToxinPvMention>["icsr_element_assessment"]): value is IcsrCandidateEvaluation {
  return "evaluator" in value;
}

function runFixture(fixture: BotulinumPvAcceptanceFixture, index: number) {
  const originalTimestamp = new Date(Date.UTC(2026, 8, 1, 12, index, 0)).toISOString();
  const collectionTimestamp = new Date(Date.UTC(2026, 8, 1, 12, index + 1, 0)).toISOString();
  const algorithmTimestamp = new Date(Date.UTC(2026, 8, 1, 12, index + 2, 0)).toISOString();
  const sourceUrl = `https://social.example.test/posts/${fixture.id}`;
  const recognition = recognizeBotulinumToxinPvMention({
    original_mention: fixture.rawMention,
    source: "Synthetic social acceptance fixture",
    source_url: sourceUrl,
    source_id: fixture.id,
    author_identifier: fixture.authorIdentifier,
    original_timestamp: originalTimestamp,
    collection_timestamp: collectionTimestamp,
    algorithm_timestamp: algorithmTimestamp,
  });
  const candidate = candidateEvaluation(recognition.icsr_element_assessment) ? recognition.icsr_element_assessment : null;
  const e2b = candidate ? mapIcsrCandidateToE2b({ case_id: `AS-${fixture.id.toUpperCase()}`, candidate, mapped_at: new Date(Date.UTC(2026, 8, 1, 14, index, 0)).toISOString() }) : null;
  const detectedProducts = recognition.product_recognition.map((item) => item.product);
  const detectedEvents = recognition.observed_event_detection.events.map((item) => item.raw_expression);
  const normalizedEvents = recognition.event_normalization.map((item) => item.normalized_concept);
  const meddraCandidates = recognition.meddra_candidate_mapping.map((item) => item.meddra_pt_candidate);
  const actualPvRelevant = recognition.pv_relevance.level !== "NONE";
  const actualHumanReview = recognition.human_review_routing.status === "PV review required";
  const caseAssertions = [
    assertResult(`${fixture.id}:raw`, "Raw mention preserved", recognition.original_mention === fixture.rawMention && (!e2b || e2b.original_social_mention === fixture.rawMention), `classifier=${recognition.original_mention === fixture.rawMention}; e2b=${e2b ? e2b.original_social_mention === fixture.rawMention : "not_applicable"}`),
    assertResult(`${fixture.id}:product`, "Expected product detected", fixture.expectedProducts.every((item) => detectedProducts.includes(item)), `expected=${fixture.expectedProducts.join("|")}; actual=${detectedProducts.join("|")}`),
    assertResult(`${fixture.id}:event`, "Expected event and MedDRA PT candidate detected", fixture.expectedMeddraCandidates.every((item) => meddraCandidates.includes(item)), `expected=${fixture.expectedMeddraCandidates.join("|") || "none"}; actual=${meddraCandidates.join("|") || "none"}`),
    assertResult(`${fixture.id}:negation`, "Negation context classified", recognition.negation_detection.applies_to_event === fixture.expectedNegated, `expected=${fixture.expectedNegated}; actual=${recognition.negation_detection.applies_to_event}`),
    assertResult(`${fixture.id}:hypothetical`, "Hypothetical context classified", recognition.hypothetical_detection.detected === fixture.expectedHypothetical, `expected=${fixture.expectedHypothetical}; actual=${recognition.hypothetical_detection.detected}`),
    assertResult(`${fixture.id}:pv`, "PV relevance expectation", actualPvRelevant === fixture.expectedPvRelevant, `expected=${fixture.expectedPvRelevant}; actual=${recognition.pv_relevance.level}`),
    assertResult(`${fixture.id}:route`, "Human-review routing expectation", actualHumanReview === fixture.expectedHumanReview, `expected=${fixture.expectedHumanReview}; actual=${recognition.human_review_routing.route}`),
    assertResult(`${fixture.id}:time`, "Original social timestamp preserved", recognition.source.original_timestamp === originalTimestamp && (!e2b || e2b.provenance.source_metadata.original_post_timestamp === originalTimestamp), originalTimestamp),
    assertResult(`${fixture.id}:span`, "Evidence spans reproduce source", exactSpans(fixture.rawMention, recognition.evidence_spans), `${recognition.evidence_spans.length} spans checked`),
    assertResult(`${fixture.id}:human`, "No final regulatory disposition made", recognition.human_review_routing.final_regulatory_determination_made === false && (!e2b || e2b.validation.regulatory_submission_ready === false), "Human assessment remains mandatory"),
  ];
  const mappedFields = e2b?.mapped_fields.filter((field) => present(selectedValue(field))).map((field) => ({
    field: field.concrete_field,
    e2b_element: field.e2b_element,
    requirement: field.requirement,
    value_source: field.value.value_source,
    source_value: field.value.source_value,
    normalized_value: field.value.normalized_value,
    reviewed_value: field.value.reviewed_value,
  })) || [];
  const notificationFields = e2b?.client_email.sections.flatMap((section) => section.fields.map((field) => ({ section: section.name, ...field }))) || [];
  const p = candidate?.patient || { present: recognition.patient_reporter_evidence.patient_present, evidence: recognition.patient_reporter_evidence.patient_evidence_spans.map((item) => item.text).join("; "), confidence: 0 };
  const r = candidate?.reporter || { present: recognition.patient_reporter_evidence.reporter_present, evidence: recognition.patient_reporter_evidence.reporter_evidence_spans.map((item) => item.text).join("; "), confidence: 0 };
  const d = candidate?.drug || { present: detectedProducts.length > 0, product: detectedProducts[0] || "", active_ingredient: recognition.product_recognition[0]?.active_ingredient || "", evidence: recognition.product_recognition[0]?.evidence_spans[0]?.text || "", confidence: recognition.product_recognition[0]?.confidence || 0 };
  const e = candidate?.event || { present: recognition.observed_event_detection.observed || recognition.observed_event_detection.possible_observed, raw_expression: detectedEvents[0] || "", normalized_event: normalizedEvents[0] || "", meddra_pt_candidate: meddraCandidates[0] || "", evidence: recognition.observed_event_detection.events[0]?.evidence_spans[0]?.text || "", confidence: recognition.observed_event_detection.events[0]?.confidence || 0 };

  return {
    id: fixture.id,
    tags: fixture.tags,
    pass: caseAssertions.every((item) => item.status === "PASS"),
    failures: caseAssertions.filter((item) => item.status === "FAIL"),
    assertions: caseAssertions,
    raw_mention: fixture.rawMention,
    detected_product: recognition.product_recognition,
    detected_event: recognition.observed_event_detection.events,
    normalized_event: recognition.event_normalization,
    meddra_candidate: recognition.meddra_candidate_mapping,
    negation_status: recognition.negation_detection,
    hypothetical_status: recognition.hypothetical_detection,
    temporal_evidence: recognition.temporal_relationships,
    causality_evidence: recognition.causality_language,
    P_status: p,
    R_status: r,
    D_status: d,
    E_status: e,
    pv_relevance: recognition.pv_relevance,
    icsr_candidate_status: candidate ? { status: candidate.icsr_status, missing_elements: candidate.missing_elements, review_route: candidate.review_route } : { status: "NOT_EVALUATED_NO_PV_RELEVANCE", missing_elements: ["P", "R", "D", "E"], review_route: "NO_ESCALATION_RETAIN_AUDIT" },
    human_review_routing: recognition.human_review_routing,
    e2b_r3_fields_populated: mappedFields,
    missing_fields: [...new Set([...(candidate?.missing_elements || []), ...(e2b?.validation.errors.map((item) => item.field) || [])])],
    client_notification_fields: notificationFields,
    explanation_and_evidence_spans: { rationale: recognition.pv_relevance.rationale, spans: recognition.evidence_spans },
    human_review_queue: {
      retained: true,
      eligible_for_active_review: actualHumanReview,
      status: actualHumanReview ? "PENDING_HUMAN_REVIEW" : "AUDIT_RETAINED_NO_ESCALATION",
      route: recognition.human_review_routing.route,
      final_regulatory_disposition: null,
    },
    provenance: {
      source: recognition.source,
      versions: recognition.versions,
      terminology_lineage: recognition.observed_event_detection.events.flatMap((event) => event.evidence_spans.filter((span) => span.kind === "event").map((span) => ({ raw_expression: span.text, mapping_source: span.source, normalized_concept: span.normalized_concept, regulatory_candidate: event.meddra_pt_candidate, human_validation_required: event.human_validation_required }))),
      e2b: e2b?.provenance || null,
    },
  };
}

export function runBotulinumPvEndToEndAcceptance(options: { projectRoot?: string; generatedAt?: string } = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const generatedAt = options.generatedAt || new Date().toISOString();
  const regulatoryDirectory = path.resolve(projectRoot, manifest.regulatorySnapshot);
  const taxonomyDirectory = path.resolve(projectRoot, manifest.taxonomySnapshot);
  const expressionDirectory = path.resolve(projectRoot, manifest.expressionSnapshot);
  const regulatoryManifest = readJson<any>(path.join(regulatoryDirectory, "manifest.json"));
  const taxonomyManifest = readJson<any>(path.join(taxonomyDirectory, "manifest.json"));
  const taxonomy = readJson<any>(path.join(taxonomyDirectory, "taxonomy.json"));
  const expressionManifest = readJson<any>(path.join(expressionDirectory, "manifest.json"));
  const expressions = readJson<any>(path.join(expressionDirectory, "social_expression_library.json"));
  const runtime = getBotulinumPvRecognitionConfiguration();
  const fixtures = botulinumPvEndToEndAcceptanceFixtures();
  const cases = fixtures.map(runFixture);
  const taxonomyTerms = new Set<string>(taxonomy.records.map((item: any) => item.meddra_pt));
  const expressionEntries = expressions.concept_records.flatMap((concept: any) => [
    ...concept.clinical_synonyms,
    ...concept.lay_synonyms,
    ...concept.consumer_expressions,
    ...concept.colloquial_expressions,
    ...concept.symptom_descriptions,
    ...concept.likely_misspellings,
    ...concept.slang_or_informal_phrasing,
    ...concept.temporal_expressions,
    ...concept.causal_expressions,
    ...concept.uncertain_causality_expressions,
  ]);
  const stageAssertions: AcceptanceAssertion[] = [
    assertResult("stage:faers", "FAERS regulatory snapshot complete", regulatoryManifest.status === "complete" && regulatoryManifest.truncated === false, `raw=${regulatoryManifest.recordCounts.rawUnique}; normalized=${regulatoryManifest.recordCounts.normalized}`),
    assertResult("stage:no-discard", "No regulatory source record silently discarded", regulatoryManifest.recordCounts.rawUnique === regulatoryManifest.recordCounts.normalized && regulatoryManifest.recordCounts.malformed === fs.readFileSync(path.join(regulatoryDirectory, "malformed-records.jsonl"), "utf8").trim().split("\n").filter(Boolean).length, `raw=${regulatoryManifest.recordCounts.rawUnique}; normalized=${regulatoryManifest.recordCounts.normalized}; quarantined=${regulatoryManifest.recordCounts.malformed}`),
    assertResult("stage:taxonomy", "Required regulatory reaction terminology retained", manifest.requiredConcepts.every((term) => taxonomyTerms.has(term)) && taxonomyManifest.reconciliation.case_reconciliation_passed && taxonomyManifest.reconciliation.reaction_reconciliation_passed, `${manifest.requiredConcepts.filter((term) => !taxonomyTerms.has(term)).join(", ") || "all required PTs present"}`),
    assertResult("stage:expression", "Consumer terminology remains distinct from regulatory terminology", expressionEntries.length > 0 && expressionEntries.every((item: any) => item.is_official_meddra_synonym === false && ["GENERATED", "CURATED"].includes(item.expression_source)), `${expressionEntries.length} expression records checked`),
    assertResult("stage:version-chain", "Version chain is consistent", taxonomyManifest.taxonomyVersion === runtime.manifest.taxonomyVersion && expressionManifest.libraryVersion === runtime.manifest.expressionLibraryVersion && expressionManifest.source.taxonomyVersion === taxonomyManifest.taxonomyVersion, `taxonomy=${taxonomyManifest.taxonomyVersion}; expression=${expressionManifest.libraryVersion}; classifier=${runtime.manifest.pipelineVersion}`),
    assertResult("stage:minimum", "Minimum synthetic corpus size met", fixtures.length >= manifest.minimumSyntheticExamples, `${fixtures.length} synthetic records`),
    assertResult("stage:products", "All required products covered", manifest.requiredProducts.every((product) => fixtures.some((fixture) => fixture.expectedProducts.includes(product))), manifest.requiredProducts.join(", ")),
    assertResult("stage:concepts", "All required event concepts covered", manifest.requiredConcepts.every((term) => fixtures.some((fixture) => fixture.expectedMeddraCandidates.includes(term))), manifest.requiredConcepts.join(", ")),
  ];
  const allCasesRetained = cases.length === fixtures.length && cases.every((item) => item.human_review_queue.retained);
  const mappedLineageSeparated = cases.flatMap((item) => item.e2b_r3_fields_populated).every((field) => ["SOURCE", "AI_NORMALIZED", "HUMAN_REVIEWED"].includes(field.value_source));
  const incompleteRetained = cases.filter((item) => item.human_review_routing.status === "PV review required" && item.icsr_candidate_status.missing_elements.length > 0).every((item) => item.human_review_queue.retained && item.human_review_queue.eligible_for_active_review);
  const multiple = cases.find((item) => item.id === "btx-e2e-053");
  const acceptanceCriteria: AcceptanceAssertion[] = [
    assertResult("AC-01", "No source content is silently discarded", allCasesRetained && stageAssertions.find((item) => item.id === "stage:no-discard")?.status === "PASS", `${fixtures.length} inputs; ${cases.length} outputs; all retained=${allCasesRetained}`),
    assertResult("AC-02", "Raw source is preserved", cases.every((item) => item.assertions.find((assertion) => assertion.id.endsWith(":raw"))?.status === "PASS"), "Classifier, mapped candidate, or retained audit contains exact source text"),
    assertResult("AC-03", "Original social timestamp is preserved", cases.every((item) => item.assertions.find((assertion) => assertion.id.endsWith(":time"))?.status === "PASS"), "All 56 source timestamps checked"),
    assertResult("AC-04", "Generated terminology is distinguishable from regulatory terminology", stageAssertions.find((item) => item.id === "stage:expression")?.status === "PASS" && cases.every((item) => item.provenance.terminology_lineage.every((lineage) => lineage.mapping_source && lineage.human_validation_required)), "Expression origin and human-validation flags retained"),
    assertResult("AC-05", "AI inference is distinguishable from source evidence", mappedLineageSeparated, "Every populated E2B field retains source/normalized/reviewed channels"),
    assertResult("AC-06", "Missing ICSR elements do not cause deletion", incompleteRetained, `${cases.filter((item) => item.human_review_routing.status === "PV review required" && item.icsr_candidate_status.missing_elements.length > 0).length} incomplete candidates retained for review`),
    assertResult("AC-07", "Hypothetical and negated mentions are distinguishable", cases.filter((item) => item.tags.includes("hypothetical") || item.tags.includes("negated")).every((item) => item.pass || item.failures.every((failure) => !failure.id.endsWith(":hypothetical") && !failure.id.endsWith(":negation"))), "Difficult negative context assertions checked"),
    assertResult("AC-08", "Multiple drugs and events remain separate", Boolean(multiple && multiple.detected_product.length === 2 && multiple.detected_event.length === 2 && multiple.e2b_r3_fields_populated.filter((field) => field.field.startsWith("drugs[") && field.field.endsWith("productNameReported")).length === 2 && multiple.e2b_r3_fields_populated.filter((field) => field.field.startsWith("reactions[") && field.field.endsWith("verbatim")).length === 2), "Fixture btx-e2e-053 must preserve two drug and two reaction occurrences without pairwise causality"),
    assertResult("AC-09", "Provenance is preserved end-to-end", cases.every((item) => item.provenance.source.id === item.id && item.provenance.versions.classifier_version && (!item.provenance.e2b || item.provenance.e2b.source_metadata.post_id === item.id)), "Source ID, URL, timestamps, versions, and mapping provenance checked"),
    assertResult("AC-10", "Human review precedes final regulatory disposition", cases.every((item) => item.human_review_routing.final_regulatory_determination_made === false && item.human_review_queue.final_regulatory_disposition === null), "No synthetic case receives an automated final disposition"),
    assertResult("AC-11", "Classifier output audits back to source", cases.every((item) => item.assertions.find((assertion) => assertion.id.endsWith(":span"))?.status === "PASS"), "All evidence offsets reproduce exact source substrings"),
  ];
  const caseFailures = cases.flatMap((item) => item.failures.map((failure) => ({ case_id: item.id, raw_mention: item.raw_mention, ...failure })));
  const failures = [...stageAssertions, ...acceptanceCriteria].filter((item) => item.status === "FAIL").map((item) => ({ scope: "acceptance", ...item })).concat(caseFailures.map((item) => ({ scope: "example", ...item })));
  const failedMeddraExpectations = caseFailures.filter((failure) => failure.id.endsWith(":event"));
  const failedContextExpectations = caseFailures.filter((failure) => failure.id.endsWith(":hypothetical"));
  const report = {
    schema_version: manifest.schemaVersion,
    acceptance_suite_version: manifest.acceptanceSuiteVersion,
    topic: manifest.topic,
    generated_at: generatedAt,
    overall_status: failures.length ? "FAIL" : "PASS",
    production_readiness: failures.length ? "NOT_READY_FOR_UNSUPERVISED_PRODUCTION; CONTROLLED_HUMAN-REVIEW PILOT ONLY" : "ACCEPTANCE_CRITERIA_MET_PENDING_QUALIFIED_PV_APPROVAL",
    pipeline: ["FAERS source", "Regulatory Case Corpus", "AE/ADR Taxonomy", "Consumer Expression Library", "Social Mention Classifier", "PV Relevance Assessment", "ICSR Completeness Assessment", "E2B(R3) Mapping", "Human Review Queue", "Client AE/ADR Notification Object"],
    counts: {
      input_examples: fixtures.length,
      output_examples: cases.length,
      passing_examples: cases.filter((item) => item.pass).length,
      failing_examples: cases.filter((item) => !item.pass).length,
      difficult_negatives: fixtures.filter((item) => item.tags.includes("difficult_negative")).length,
      active_review_queue: cases.filter((item) => item.human_review_queue.eligible_for_active_review).length,
      audit_retained_no_escalation: cases.filter((item) => !item.human_review_queue.eligible_for_active_review).length,
    },
    stage_results: stageAssertions,
    acceptance_criteria: acceptanceCriteria,
    failures,
    remediation_recommendations: [
      ...(failedMeddraExpectations.some((item) => item.evidence.includes("Diplopia")) ? [{ priority: "HIGH", recommendation: "Split diplopia/seeing-double expressions from the Vision blurred runtime concept and map them to the source-preserved FAERS MedDRA PT candidate Diplopia; require PV terminology review before activation." }] : []),
      ...(failedMeddraExpectations.some((item) => item.evidence.includes("Dysarthria")) ? [{ priority: "HIGH", recommendation: "Separate slurred-speech/dysarthria language from Dysphonia/voice-change language in the versioned runtime lexicon and validate the mapping against the FAERS-derived taxonomy." }] : []),
      ...(failedContextExpectations.length ? [{ priority: "HIGH", recommendation: "Make hypothetical-question detection mutually distinguishable from declarative label information and provider warnings. Preserve informational/provider-warning context as separate flags without also marking those statements as hypothetical." }] : []),
      { priority: "HIGH", recommendation: "Complete qualified PV/medical adjudication of the draft taxonomy, consumer-expression library, candidate gold dataset, and acceptance failures before production promotion." },
      { priority: "MEDIUM", recommendation: "Add a mechanical reconciliation artifact proving every runtime expression term is traceable to either the versioned expression library or an explicitly governed supplemental concept source." },
      { priority: "MEDIUM", recommendation: "Exercise the same queue and notification projections against an isolated staging Supabase project after local semantic failures are resolved; this local suite intentionally makes no external writes or email deliveries." },
    ],
    technical_debt: [
      "The generated taxonomy and consumer-expression library remain draft and pending qualified PV/medical review.",
      "The human-review queue portion is validated as a deterministic queue projection; database persistence, concurrency, permissions, and notification delivery require an isolated staging integration test.",
      "Client notification objects are template-constrained previews and are intentionally not regulatory-submission-ready before human completion.",
      "Synthetic English examples do not establish real-world prevalence, multilingual performance, or production sensitivity.",
      "The runtime lexicon is versioned but is not yet accompanied by a complete machine-readable reconciliation to every expression-library record.",
    ],
    cases,
  };
  return report;
}

export function getBotulinumPvEndToEndAcceptanceManifest() {
  return manifest;
}
