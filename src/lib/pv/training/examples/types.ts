export const PV_EXAMPLE_CLASSES = [
  "OBSERVED_EVENT_SELF", "OBSERVED_EVENT_THIRD_PARTY", "POSSIBLE_EVENT_UNCERTAIN_CAUSALITY", "HYPOTHETICAL",
  "ANTICIPATED_OR_FEARED", "NEGATED", "GENERAL_INFORMATION", "PROVIDER_WARNING", "HISTORICAL_OR_UNRELATED",
  "INSUFFICIENT_INFORMATION", "MEDICATION_ERROR_OR_SPECIAL_SITUATION",
] as const;

export type PvExampleClass = typeof PV_EXAMPLE_CLASSES[number];
export type PvRelevance = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type IcsrCandidate = "COMPLETE_POTENTIAL_ICSR" | "POTENTIAL_ICSR_MISSING_ELEMENT" | "SPECIAL_SITUATION_REVIEW" | "NOT_AN_OBSERVED_EVENT" | "NON_CASE";
export type DatasetPartition = "train" | "validation" | "test" | "locked_holdout";
export type SpecialSituation = "OVERDOSE" | "EXTRA_DOSE" | "WRONG_PRODUCT" | "MISUSE" | "OFF_LABEL_USE" | "ACCIDENTAL_EXPOSURE" | "OCCUPATIONAL_EXPOSURE" | "PREGNANCY_EXPOSURE" | "BREASTFEEDING_EXPOSURE" | "LACK_OF_EFFICACY" | "PRODUCT_QUALITY_CONCERN";

export type EvidenceSpan = { start: number; end: number; text: string };

export type PvTrainingExample = {
  example_id: string;
  dataset_version: string;
  example_class: PvExampleClass;
  contrast_group_id: string;
  text: string;
  target_product: string;
  active_ingredient: string;
  mentioned_event: string;
  normalized_event: string;
  meddra_pt: string;
  observation_status: PvExampleClass;
  patient_status: "IDENTIFIABLE" | "SPECIFIC_NOT_IDENTIFIABLE" | "NO_CASE_PATIENT" | "UNKNOWN";
  reporter_status: "IDENTIFIABLE_FIRST_HAND" | "FIRST_HAND_NOT_IDENTIFIABLE" | "SECOND_HAND_NOT_IDENTIFIABLE" | "NO_CASE_REPORTER" | "UNKNOWN";
  drug_status: "MENTIONED_SUSPECT_CONTEXT" | "MENTIONED_NON_CASE_CONTEXT" | "MENTIONED_SPECIAL_SITUATION";
  event_status: "OBSERVED" | "POSSIBLE" | "AMBIGUOUS" | "HYPOTHETICAL" | "ANTICIPATED" | "NEGATED" | "INFORMATIONAL" | "HISTORICAL_UNRELATED" | "SPECIAL_SITUATION";
  temporal_relationship: "AFTER_PRODUCT" | "SINCE_PRODUCT" | "BEFORE_PRODUCT" | "ANTICIPATED_FUTURE" | "NO_TEMPORAL_RELATIONSHIP" | "UNKNOWN";
  causality_language: "TEMPORAL_ONLY" | "UNCERTAIN_ASSOCIATION" | "HYPOTHETICAL_CAUSAL_QUESTION" | "ANTICIPATED_CAUSALITY" | "NEGATED_ASSOCIATION" | "GENERAL_CAUSAL_STATEMENT" | "PROVIDER_WARNING_ONLY" | "TEMPORALLY_UNRELATED" | "NO_CAUSALITY_CLAIM";
  negated: boolean;
  hypothetical: boolean;
  third_party: boolean;
  special_situation: SpecialSituation | null;
  pv_relevance: PvRelevance;
  icsr_candidate: IcsrCandidate;
  needs_human_review: true;
  reasoning_label: string;
  evidence_spans: {
    product: EvidenceSpan[];
    event: EvidenceSpan[];
    patient: EvidenceSpan[];
    reporter: EvidenceSpan[];
    temporal: EvidenceSpan[];
    causality: EvidenceSpan[];
  };
  split: { partition: DatasetPartition; group_id: string; split_version: string };
  human_review_status: "PENDING";
  provenance: {
    source_type: "SYNTHETIC_CONTRAST";
    source_taxonomy_concept_id: string;
    source_expression_id?: string;
    source_taxonomy_snapshot: string;
    source_taxonomy_sha256: string;
    source_expression_library_snapshot: string;
    source_expression_library_sha256: string;
    taxonomy_version: string;
    expression_library_version: string;
    templates_version: string;
    special_situations_version: string;
    product_registry_version: string;
    generated_at: string;
    generation_method: "VERSIONED_CONTRAST_TEMPLATE" | "VERSIONED_SPECIAL_SITUATION_TEMPLATE";
    generation_statement: string;
  };
};

export type ContrastTemplate = Omit<PvTrainingExample, "example_id" | "dataset_version" | "example_class" | "contrast_group_id" | "text" | "target_product" | "active_ingredient" | "mentioned_event" | "normalized_event" | "meddra_pt" | "observation_status" | "special_situation" | "needs_human_review" | "evidence_spans" | "split" | "human_review_status" | "provenance"> & {
  class: Exclude<PvExampleClass, "MEDICATION_ERROR_OR_SPECIAL_SITUATION">;
  text: string;
  patient_evidence: string[];
  reporter_evidence: string[];
  temporal_evidence: string[];
  causality_evidence: string[];
};

export type ExampleDatasetConfiguration = {
  schemaVersion: string;
  datasetVersion: string;
  status: "draft_pending_human_adjudication" | "active" | "superseded";
  topic: string;
  activeContrastTemplates: string;
  activeSpecialSituations: string;
  productRegistry: string;
  recordSchema: string;
  language: string;
  locale: string;
  importantConceptProfiles: string[];
  importantConceptCount: number;
  fallbackConceptProfile: string;
  expectedExamplesPerClass: number;
  minimumDifficultNegativesPerPositive: number;
  splitVersion: string;
  splitPercentages: Record<DatasetPartition, number>;
  generationStatement: string;
  humanReviewPolicy: string;
  activationPolicy: string;
};

export type ExampleDatasetBuildResult = {
  generatedAt: string;
  source: {
    expressionLibraryPath: string;
    expressionLibrarySnapshot: string;
    expressionLibrarySha256: string;
    expressionLibraryVersion: string;
    taxonomySnapshot: string;
    taxonomySha256: string;
    taxonomyVersion: string;
  };
  examples: PvTrainingExample[];
  importantConcepts: Array<{ taxonomy_concept_id: string; meddra_pt: string; normalized_event: string }>;
};
