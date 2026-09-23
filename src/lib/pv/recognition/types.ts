import type { IcsrCandidateEvaluation } from "../icsrEvaluator";

export type BotulinumPvRelevance = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type BotulinumObservationStatus = "OBSERVED" | "POSSIBLE_OBSERVED" | "NEGATED" | "HYPOTHETICAL" | "INFORMATIONAL" | "ANTICIPATED" | "HISTORICAL_UNRELATED";

export type BotulinumEvidenceSpan = {
  kind: "product" | "patient" | "reporter" | "event" | "temporal" | "causality" | "negation" | "hypothetical" | "third_party" | "special_situation" | "seriousness";
  start: number;
  end: number;
  text: string;
  normalized_concept: string;
  confidence: number;
  source: "PRODUCT_REGISTRY" | "PRODUCT_ALIAS_CONFIG" | "FAERS_TAXONOMY" | "SOCIAL_EXPRESSION_LIBRARY" | "CONTRAST_CONTEXT_RULE" | "SPECIAL_SITUATION_LIBRARY" | "ICH_IDENTIFIABILITY_RULE";
};

export type BotulinumPvRecognitionInput = {
  original_mention: string;
  source: string;
  source_url: string;
  source_id: string;
  original_timestamp: string;
  collection_timestamp: string;
  author_identifier?: string | null;
  language?: string;
  algorithm_timestamp?: string;
};

export type BotulinumRecognizedProduct = {
  family_id: string;
  product: string;
  active_ingredient: string;
  match_type: "BRAND" | "ACTIVE_INGREDIENT" | "CLASS";
  confidence: number;
  evidence_spans: BotulinumEvidenceSpan[];
};

export type BotulinumRecognizedEvent = {
  raw_expression: string;
  normalized_event: string;
  meddra_pt_candidate: string;
  taxonomy_concept_id: string;
  confidence: number;
  serious_potential: boolean;
  observation_status: BotulinumObservationStatus;
  human_validation_required: true;
  evidence_spans: BotulinumEvidenceSpan[];
};

export type BotulinumPvPipelineOutput = {
  original_mention: string;
  source: {
    name: string;
    url: string;
    id: string;
    author_identifier: string | null;
    original_timestamp: string;
    collection_timestamp: string;
    algorithm_timestamp: string;
  };
  versions: {
    classifier_version: string;
    taxonomy_version: string;
    expression_library_version: string;
    product_registry_version: string;
    product_alias_version: string;
    contrast_templates_version: string;
    special_situations_version: string;
  };
  product_recognition: BotulinumRecognizedProduct[];
  patient_reporter_evidence: {
    patient_present: boolean;
    reporter_present: boolean;
    relationship: "self_report" | "first_hand_other" | "second_hand" | "unclear";
    multiple_patients: boolean;
    ambiguous_pronouns: boolean;
    patient_evidence_spans: BotulinumEvidenceSpan[];
    reporter_evidence_spans: BotulinumEvidenceSpan[];
    assessment: unknown;
  };
  observed_event_detection: {
    observed: boolean;
    possible_observed: boolean;
    events: BotulinumRecognizedEvent[];
  };
  event_normalization: Array<{ raw_expression: string; normalized_concept: string; confidence: number }>;
  meddra_candidate_mapping: Array<{ normalized_concept: string; meddra_pt_candidate: string; taxonomy_concept_id: string; confidence: number; human_validation_required: true }>;
  temporal_relationships: Array<{ type: "AFTER_PRODUCT" | "SINCE_PRODUCT" | "BEFORE_PRODUCT" | "ONSET_INTERVAL" | "UNKNOWN"; confidence: number; evidence_span: BotulinumEvidenceSpan }>;
  causality_language: Array<{ type: "REPORTED_ATTRIBUTION" | "POSSIBLE_ATTRIBUTION" | "TEMPORAL_ONLY" | "DENIED" | "NONE"; confidence: number; evidence_span: BotulinumEvidenceSpan }>;
  negation_detection: {
    detected: boolean;
    applies_to_event: boolean;
    confidence: number;
    evidence_spans: BotulinumEvidenceSpan[];
  };
  hypothetical_detection: {
    detected: boolean;
    informational: boolean;
    anticipated_or_feared: boolean;
    historical_or_unrelated: boolean;
    confidence: number;
    evidence_spans: BotulinumEvidenceSpan[];
  };
  third_party_detection: {
    detected: boolean;
    relationship: "first_hand_other" | "second_hand" | "ambiguous_pronoun" | "none";
    confidence: number;
    evidence_spans: BotulinumEvidenceSpan[];
  };
  context: {
    negated: boolean;
    hypothetical: boolean;
    informational: boolean;
    anticipated_or_feared: boolean;
    historical_or_unrelated: boolean;
    third_party: boolean;
    evidence_spans: BotulinumEvidenceSpan[];
  };
  special_situations: Array<{ type: string; confidence: number; evidence_spans: BotulinumEvidenceSpan[]; human_review_required: true }>;
  pv_relevance: {
    level: BotulinumPvRelevance;
    score: number;
    confidence: number;
    serious_safety_priority: boolean;
    rationale: string[];
  };
  icsr_element_assessment: IcsrCandidateEvaluation | {
    evaluated: false;
    icsr_status: "NOT_EVALUATED_NO_PV_RELEVANCE";
    missing_elements: ["P", "R", "D", "E"];
    pv_review_required: false;
  };
  human_review_routing: {
    status: "PV review required" | "NO_ESCALATION_RETAIN_AUDIT";
    route: "POTENTIAL_ICSR_REVIEW" | "POTENTIAL_ICSR_MISSING_ELEMENT" | "SPECIAL_SITUATION_REVIEW" | "PV_TRIAGE_REVIEW" | "NO_ESCALATION_RETAIN_AUDIT";
    priority: "critical" | "high" | "standard" | "audit_only";
    final_regulatory_determination_made: false;
    statement: string;
  };
  confidence: number;
  evidence_spans: BotulinumEvidenceSpan[];
  normalized_concepts: string[];
  human_review_status: "PV review required" | "NO_ESCALATION_RETAIN_AUDIT";
};
