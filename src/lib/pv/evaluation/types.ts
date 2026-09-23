import type { BotulinumPvPipelineOutput } from "../recognition";

export const PV_REVIEWER_LABELS = [
  "TRUE_PV_CANDIDATE",
  "POSSIBLE_PV_CANDIDATE",
  "NON_CASE",
  "INSUFFICIENT_INFORMATION",
  "SPECIAL_SITUATION",
  "NEEDS_SECOND_REVIEW",
] as const;

export type PvReviewerLabel = typeof PV_REVIEWER_LABELS[number];

export const PV_EVALUATION_SLICES = [
  "serious_event_concepts",
  "negated_events",
  "hypothetical_statements",
  "third_party_reports",
  "missing_icsr_elements",
  "special_situations",
  "colloquial_language",
  "misspellings",
  "fragmented_social_posts",
] as const;

export type PvEvaluationSlice = typeof PV_EVALUATION_SLICES[number];
export type PvBinaryTruth = "POSITIVE" | "NEGATIVE";
export type PvMetricBasis = "PROVISIONAL_BASELINE" | "ADJUDICATED_ONLY" | "HUMAN_WHEN_AVAILABLE";

export type PvGoldCandidateRecord = {
  record_id: string;
  dataset_version: string;
  text: string;
  source: {
    platform: string;
    url: string;
    id: string;
    author_identifier: string | null;
    original_timestamp: string;
    collection_timestamp: string;
  };
  provisional_reference_label: Exclude<PvReviewerLabel, "NEEDS_SECOND_REVIEW">;
  provisional_binary_truth: PvBinaryTruth;
  reference_label_source: "SEEDED_EVALUATION_DESIGN" | "KNOWN_FALSE_NEGATIVE_REGRESSION";
  adjudication_status: "PENDING_PV_REVIEW";
  slice_tags: PvEvaluationSlice[];
  expected_icsr_missing_elements: Array<"P" | "R" | "D" | "E">;
  rationale: string;
};

export type PvModelDecisionSnapshot = {
  snapshot_id: string;
  record_id: string;
  dataset_version: string;
  evaluated_at: string;
  classifier_version: string;
  taxonomy_version: string;
  model_decision: {
    routed_for_pv_review: boolean;
    pv_relevance: "HIGH" | "MEDIUM" | "LOW" | "NONE";
    human_review_route: BotulinumPvPipelineOutput["human_review_routing"]["route"];
    icsr_status: string;
    missing_elements: string[];
  };
  structured_output: BotulinumPvPipelineOutput;
  immutable_hash: string;
};

export type PvAdjudicationStage = "PRIMARY_REVIEW" | "SECOND_REVIEW" | "FINAL_ADJUDICATION";

export type PvAdjudicationEvent = {
  event_id: string;
  record_id: string;
  model_snapshot_id: string;
  stage: PvAdjudicationStage;
  reviewer_id: string;
  reviewer_qualification_attested: true;
  reviewer_decision: PvReviewerLabel;
  reviewer_notes: string;
  adjudication_timestamp: string;
  classifier_version: string;
  taxonomy_version: string;
  model_decision_at_review: PvModelDecisionSnapshot["model_decision"];
  disagreement_with_model: boolean;
  disagreement_with_prior_review: boolean;
  previous_event_hash: string;
  event_hash: string;
};

export type PvAdjudicationLedger = {
  schema_version: "1.0.0";
  dataset_version: string;
  model_snapshots: PvModelDecisionSnapshot[];
  events: PvAdjudicationEvent[];
};

export type PvConfusionMatrix = {
  true_positive: number;
  true_negative: number;
  false_positive: number;
  false_negative: number;
};

export type PvBinaryMetrics = {
  evaluated_records: number;
  excluded_records: number;
  sensitivity_recall: number | null;
  specificity: number | null;
  precision: number | null;
  false_positive_rate: number | null;
  false_negative_rate: number | null;
  f1: number | null;
  confusion_matrix: PvConfusionMatrix;
};

export type PvEvaluationReport = {
  schema_version: "1.0.0";
  dataset_version: string;
  classifier_version: string;
  taxonomy_version: string;
  generated_at: string;
  metric_basis: PvMetricBasis;
  qualification: string;
  overall: PvBinaryMetrics;
  slices: Record<PvEvaluationSlice, PvBinaryMetrics>;
  disagreements: Array<{
    record_id: string;
    model_decision: boolean;
    reference_decision: PvReviewerLabel;
    false_positive: boolean;
    false_negative: boolean;
  }>;
  unadjudicated_record_ids: string[];
  regression: {
    required_record_ids: string[];
    passed_record_ids: string[];
    failed_record_ids: string[];
  };
};

export type PvFalseNegativeRegressionRecord = PvGoldCandidateRecord & {
  regression_reason: string;
  introduced_in_classifier_version: string;
  expected_model_route: "PV review required";
};
