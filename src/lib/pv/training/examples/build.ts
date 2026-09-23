import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SocialExpression, SocialExpressionConceptRecord } from "../expressions";
import { getContrastTemplates, getExampleDatasetConfiguration, getSpecialSituationTemplates, getTrainingProductRegistry } from "./config";
import { PV_EXAMPLE_CLASSES, type ContrastTemplate, type DatasetPartition, type EvidenceSpan, type ExampleDatasetBuildResult, type PvTrainingExample } from "./types";

type ExpressionLibraryArtifact = {
  libraryVersion?: string;
  status?: string;
  source?: { taxonomySnapshot?: string; taxonomySha256?: string; taxonomyVersion?: string };
  concept_records?: SocialExpressionConceptRecord[];
};

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function replaceTokens(value: string, product: string, event: string) {
  return value.replaceAll("{product}", product).replaceAll("{event}", event);
}

function evidenceSpan(text: string, value: string): EvidenceSpan {
  const start = text.indexOf(value);
  if (start < 0) throw new Error(`Evidence value '${value}' is not present in generated text '${text}'.`);
  return { start, end: start + value.length, text: value };
}

function evidenceSpans(text: string, values: string[]) {
  return values.map((value) => evidenceSpan(text, value));
}

function partitionFor(groupId: string): DatasetPartition {
  const configuration = getExampleDatasetConfiguration();
  const bucket = Number.parseInt(sha256(groupId).slice(0, 8), 16) % 100;
  const trainEnd = configuration.splitPercentages.train;
  const validationEnd = trainEnd + configuration.splitPercentages.validation;
  const testEnd = validationEnd + configuration.splitPercentages.test;
  if (bucket < trainEnd) return "train";
  if (bucket < validationEnd) return "validation";
  if (bucket < testEnd) return "test";
  return "locked_holdout";
}

function expressionFor(concept: SocialExpressionConceptRecord): SocialExpression | undefined {
  return concept.lay_synonyms.find((item) => item.expression_source === "CURATED")
    || concept.lay_synonyms.find((item) => item.normalized_expression === concept.canonical_concept.toLocaleLowerCase("en-US"))
    || concept.lay_synonyms[0];
}

function createExampleId(datasetVersion: string, groupId: string, exampleClass: string, product: string, text: string) {
  return `pvex_${sha256(`${datasetVersion}|${groupId}|${exampleClass}|${product}|${text}`).slice(0, 24)}`;
}

function contextualExample(options: {
  concept: SocialExpressionConceptRecord;
  template: ContrastTemplate;
  product: string;
  activeIngredient: string;
  generatedAt: string;
  source: ExampleDatasetBuildResult["source"];
}): PvTrainingExample {
  const configuration = getExampleDatasetConfiguration();
  const templates = getContrastTemplates();
  const specialSituations = getSpecialSituationTemplates();
  const products = getTrainingProductRegistry();
  const expression = expressionFor(options.concept);
  const event = expression?.expression || options.concept.canonical_concept;
  const text = replaceTokens(options.template.text, options.product, event);
  const groupId = `contrast:${options.concept.taxonomy_concept_id}`;
  return {
    example_id: createExampleId(configuration.datasetVersion, groupId, options.template.class, options.product, text),
    dataset_version: configuration.datasetVersion,
    example_class: options.template.class,
    contrast_group_id: groupId,
    text,
    target_product: options.product,
    active_ingredient: options.activeIngredient,
    mentioned_event: event,
    normalized_event: options.concept.canonical_concept,
    meddra_pt: options.concept.meddra_pt,
    observation_status: options.template.class,
    patient_status: options.template.patient_status,
    reporter_status: options.template.reporter_status,
    drug_status: options.template.drug_status,
    event_status: options.template.event_status,
    temporal_relationship: options.template.temporal_relationship,
    causality_language: options.template.causality_language,
    negated: options.template.negated,
    hypothetical: options.template.hypothetical,
    third_party: options.template.third_party,
    special_situation: null,
    pv_relevance: options.template.pv_relevance,
    icsr_candidate: options.template.icsr_candidate,
    needs_human_review: true,
    reasoning_label: options.template.reasoning_label,
    evidence_spans: {
      product: [evidenceSpan(text, options.product)],
      event: [evidenceSpan(text, event)],
      patient: evidenceSpans(text, options.template.patient_evidence),
      reporter: evidenceSpans(text, options.template.reporter_evidence),
      temporal: evidenceSpans(text, options.template.temporal_evidence),
      causality: evidenceSpans(text, options.template.causality_evidence),
    },
    split: { partition: partitionFor(groupId), group_id: groupId, split_version: configuration.splitVersion },
    human_review_status: "PENDING",
    provenance: {
      source_type: "SYNTHETIC_CONTRAST",
      source_taxonomy_concept_id: options.concept.taxonomy_concept_id,
      source_expression_id: expression?.expression_id,
      source_taxonomy_snapshot: options.source.taxonomySnapshot,
      source_taxonomy_sha256: options.source.taxonomySha256,
      source_expression_library_snapshot: options.source.expressionLibrarySnapshot,
      source_expression_library_sha256: options.source.expressionLibrarySha256,
      taxonomy_version: options.source.taxonomyVersion,
      expression_library_version: options.source.expressionLibraryVersion,
      templates_version: templates.templatesVersion,
      special_situations_version: specialSituations.specialSituationsVersion,
      product_registry_version: products.registryVersion,
      generated_at: options.generatedAt,
      generation_method: "VERSIONED_CONTRAST_TEMPLATE",
      generation_statement: configuration.generationStatement,
    },
  };
}

function specialSituationExample(options: {
  concept: SocialExpressionConceptRecord;
  situation: ReturnType<typeof getSpecialSituationTemplates>["situations"][number];
  product: string;
  activeIngredient: string;
  occurrence: number;
  generatedAt: string;
  source: ExampleDatasetBuildResult["source"];
}): PvTrainingExample {
  const configuration = getExampleDatasetConfiguration();
  const templates = getContrastTemplates();
  const specialSituations = getSpecialSituationTemplates();
  const products = getTrainingProductRegistry();
  const text = replaceTokens(options.situation.text, options.product, options.situation.mentioned_event);
  const mentionedEvent = replaceTokens(options.situation.mentioned_event, options.product, options.situation.mentioned_event);
  const groupId = `special:${options.concept.taxonomy_concept_id}`;
  return {
    example_id: createExampleId(configuration.datasetVersion, groupId, `MEDICATION_ERROR_OR_SPECIAL_SITUATION:${options.situation.id}:${options.occurrence}`, options.product, text),
    dataset_version: configuration.datasetVersion,
    example_class: "MEDICATION_ERROR_OR_SPECIAL_SITUATION",
    contrast_group_id: groupId,
    text,
    target_product: options.product,
    active_ingredient: options.activeIngredient,
    mentioned_event: mentionedEvent,
    normalized_event: options.concept.canonical_concept,
    meddra_pt: options.concept.meddra_pt,
    observation_status: "MEDICATION_ERROR_OR_SPECIAL_SITUATION",
    patient_status: "SPECIFIC_NOT_IDENTIFIABLE",
    reporter_status: "FIRST_HAND_NOT_IDENTIFIABLE",
    drug_status: "MENTIONED_SPECIAL_SITUATION",
    event_status: "SPECIAL_SITUATION",
    temporal_relationship: "UNKNOWN",
    causality_language: "NO_CAUSALITY_CLAIM",
    negated: false,
    hypothetical: false,
    third_party: false,
    special_situation: options.situation.id,
    pv_relevance: "HIGH",
    icsr_candidate: "SPECIAL_SITUATION_REVIEW",
    needs_human_review: true,
    reasoning_label: "A configured medication error or special situation is described without a final regulatory determination; it requires PV review and human assessment.",
    evidence_spans: {
      product: [evidenceSpan(text, options.product)],
      event: [evidenceSpan(text, mentionedEvent)],
      patient: [],
      reporter: [],
      temporal: [],
      causality: [],
    },
    split: { partition: partitionFor(groupId), group_id: groupId, split_version: configuration.splitVersion },
    human_review_status: "PENDING",
    provenance: {
      source_type: "SYNTHETIC_CONTRAST",
      source_taxonomy_concept_id: options.concept.taxonomy_concept_id,
      source_taxonomy_snapshot: options.source.taxonomySnapshot,
      source_taxonomy_sha256: options.source.taxonomySha256,
      source_expression_library_snapshot: options.source.expressionLibrarySnapshot,
      source_expression_library_sha256: options.source.expressionLibrarySha256,
      taxonomy_version: options.source.taxonomyVersion,
      expression_library_version: options.source.expressionLibraryVersion,
      templates_version: templates.templatesVersion,
      special_situations_version: specialSituations.specialSituationsVersion,
      product_registry_version: products.registryVersion,
      generated_at: options.generatedAt,
      generation_method: "VERSIONED_SPECIAL_SITUATION_TEMPLATE",
      generation_statement: configuration.generationStatement,
    },
  };
}

function validateSpan(text: string, span: EvidenceSpan, exampleId: string) {
  if (span.start < 0 || span.end <= span.start || text.slice(span.start, span.end) !== span.text) throw new Error(`Invalid evidence span on ${exampleId}.`);
}

export function validatePvTrainingExamples(result: ExampleDatasetBuildResult) {
  const configuration = getExampleDatasetConfiguration();
  const expectedTotal = PV_EXAMPLE_CLASSES.length * configuration.expectedExamplesPerClass;
  if (result.examples.length !== expectedTotal) throw new Error(`Expected ${expectedTotal} balanced examples, received ${result.examples.length}.`);
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const example of result.examples) {
    if (ids.has(example.example_id)) throw new Error(`Duplicate example ID: ${example.example_id}`);
    if (texts.has(example.text)) throw new Error(`Duplicate training text: ${example.text}`);
    ids.add(example.example_id);
    texts.add(example.text);
    if (!example.text.toLocaleLowerCase("en-US").includes(example.mentioned_event.toLocaleLowerCase("en-US"))) throw new Error(`Mentioned event is absent from ${example.example_id}.`);
    if (!example.needs_human_review || example.human_review_status !== "PENDING") throw new Error(`Generated example bypasses human review: ${example.example_id}`);
    if (/\breportable\b|\bconfirmed adr\b/i.test(`${example.text} ${example.reasoning_label}`)) throw new Error(`Prohibited final-determination language in ${example.example_id}.`);
    if (example.observation_status !== example.example_class) throw new Error(`Observation status does not match class on ${example.example_id}.`);
    if (example.example_class === "HYPOTHETICAL" && !example.hypothetical) throw new Error(`Hypothetical example is missing its context flag: ${example.example_id}.`);
    if (example.example_class === "ANTICIPATED_OR_FEARED" && example.hypothetical) throw new Error(`Anticipated/feared examples must remain distinct from hypothetical questions: ${example.example_id}.`);
    if (example.example_class === "NEGATED" && !example.negated) throw new Error(`Negated example is missing its context flag: ${example.example_id}.`);
    for (const spans of Object.values(example.evidence_spans)) for (const span of spans) validateSpan(example.text, span, example.example_id);
    if (example.icsr_candidate === "COMPLETE_POTENTIAL_ICSR" && (example.patient_status !== "IDENTIFIABLE" || example.reporter_status !== "IDENTIFIABLE_FIRST_HAND" || example.event_status !== "OBSERVED")) throw new Error(`Complete potential ICSR labels require P/R/E evidence: ${example.example_id}`);
    if (example.example_class === "MEDICATION_ERROR_OR_SPECIAL_SITUATION" && (!example.special_situation || example.icsr_candidate !== "SPECIAL_SITUATION_REVIEW")) throw new Error(`Special-situation example is inconsistent: ${example.example_id}`);
  }
  for (const exampleClass of PV_EXAMPLE_CLASSES) {
    const count = result.examples.filter((example) => example.example_class === exampleClass).length;
    if (count !== configuration.expectedExamplesPerClass) throw new Error(`Class ${exampleClass} is not balanced: ${count}.`);
  }
  for (const concept of result.importantConcepts) {
    const groupId = `contrast:${concept.taxonomy_concept_id}`;
    const group = result.examples.filter((example) => example.contrast_group_id === groupId);
    if (group.length !== 10 || new Set(group.map((item) => item.example_class)).size !== 10) throw new Error(`Concept ${concept.meddra_pt} lacks its complete contextual contrast set.`);
    const positives = group.filter((item) => item.example_class === "OBSERVED_EVENT_SELF" || item.example_class === "OBSERVED_EVENT_THIRD_PARTY");
    const difficultNegatives = group.filter((item) => ["HYPOTHETICAL", "ANTICIPATED_OR_FEARED", "NEGATED", "GENERAL_INFORMATION", "PROVIDER_WARNING", "HISTORICAL_OR_UNRELATED"].includes(item.example_class));
    if (positives.length !== 2 || difficultNegatives.length < positives.length * configuration.minimumDifficultNegativesPerPositive) throw new Error(`Concept ${concept.meddra_pt} lacks mandatory difficult negatives per positive.`);
    if (new Set(group.map((item) => item.mentioned_event.toLocaleLowerCase("en-US"))).size !== 1) throw new Error(`Contrast set ${concept.meddra_pt} does not use the same event terminology.`);
    if (new Set(group.map((item) => item.split.partition)).size !== 1) throw new Error(`Contrast group ${concept.meddra_pt} leaks across partitions.`);
  }
  const partitionsBySourceConcept = new Map<string, Set<string>>();
  for (const example of result.examples) {
    const partitions = partitionsBySourceConcept.get(example.provenance.source_taxonomy_concept_id) || new Set<string>();
    partitions.add(example.split.partition);
    partitionsBySourceConcept.set(example.provenance.source_taxonomy_concept_id, partitions);
  }
  for (const [conceptId, partitions] of partitionsBySourceConcept) if (partitions.size > 1) throw new Error(`Source concept ${conceptId} leaks across partitions.`);
}

export function buildBotulinumPvTrainingExamples(options: { expressionLibraryPath: string; now?: () => Date }): ExampleDatasetBuildResult {
  const expressionLibraryPath = path.resolve(options.expressionLibraryPath);
  const sourceBytes = fs.readFileSync(expressionLibraryPath);
  let library: ExpressionLibraryArtifact;
  try {
    library = JSON.parse(sourceBytes.toString("utf8")) as ExpressionLibraryArtifact;
  } catch (error) {
    throw new Error(`Malformed expression-library JSON at ${expressionLibraryPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!library.libraryVersion || !library.source?.taxonomySnapshot || !library.source.taxonomySha256 || !library.source.taxonomyVersion || !library.concept_records?.length) throw new Error("Expression library is missing required versioned source lineage or concept records.");
  const configuration = getExampleDatasetConfiguration();
  const templates = getContrastTemplates();
  const specialSituations = getSpecialSituationTemplates();
  const productRegistry = getTrainingProductRegistry();
  const products = productRegistry.families.flatMap((family) => family.brands.map((brand) => ({ product: brand, activeIngredient: family.activeIngredients[0] })));
  const configuredImportant = library.concept_records
    .filter((concept) => configuration.importantConceptProfiles.includes(concept.generation_profile))
    .sort((a, b) => b.source_case_count - a.source_case_count || a.meddra_pt.localeCompare(b.meddra_pt));
  const fallback = library.concept_records
    .filter((concept) => concept.generation_profile === configuration.fallbackConceptProfile)
    .sort((a, b) => b.source_case_count - a.source_case_count || a.meddra_pt.localeCompare(b.meddra_pt));
  const importantConcepts = [...configuredImportant, ...fallback].slice(0, configuration.importantConceptCount);
  if (importantConcepts.length !== configuration.importantConceptCount) throw new Error(`Expected ${configuration.importantConceptCount} important AE concepts, found ${importantConcepts.length}.`);
  const generatedAt = (options.now || (() => new Date()))().toISOString();
  const source: ExampleDatasetBuildResult["source"] = {
    expressionLibraryPath,
    expressionLibrarySnapshot: path.basename(path.dirname(expressionLibraryPath)),
    expressionLibrarySha256: sha256(sourceBytes),
    expressionLibraryVersion: library.libraryVersion,
    taxonomySnapshot: library.source.taxonomySnapshot,
    taxonomySha256: library.source.taxonomySha256,
    taxonomyVersion: library.source.taxonomyVersion,
  };
  const examples: PvTrainingExample[] = [];
  importantConcepts.forEach((concept, conceptIndex) => {
    const product = products[conceptIndex % products.length];
    for (const template of templates.classes) examples.push(contextualExample({ concept, template, ...product, generatedAt, source }));
  });
  const conceptByPreferredTerm = new Map(library.concept_records.map((concept) => [concept.meddra_pt, concept]));
  for (let index = 0; index < configuration.expectedExamplesPerClass; index += 1) {
    const situation = specialSituations.situations[index % specialSituations.situations.length];
    const concept = conceptByPreferredTerm.get(situation.meddra_pt);
    if (!concept) throw new Error(`Special situation ${situation.id} has no taxonomy/expression-library parent ${situation.meddra_pt}.`);
    const product = products[index % products.length];
    examples.push(specialSituationExample({ concept, situation, ...product, occurrence: index, generatedAt, source }));
  }
  const result: ExampleDatasetBuildResult = {
    generatedAt,
    source,
    examples,
    importantConcepts: importantConcepts.map((concept) => ({ taxonomy_concept_id: concept.taxonomy_concept_id, meddra_pt: concept.meddra_pt, normalized_event: concept.canonical_concept })),
  };
  validatePvTrainingExamples(result);
  return result;
}
