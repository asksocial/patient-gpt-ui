import type { ReactionTaxonomyRecord } from "../taxonomy";

export const EXPRESSION_FIELDS = [
  "clinical_synonyms",
  "lay_synonyms",
  "consumer_expressions",
  "colloquial_expressions",
  "symptom_descriptions",
  "likely_misspellings",
  "slang_or_informal_phrasing",
  "temporal_expressions",
  "causal_expressions",
  "uncertain_causality_expressions",
] as const;

export type ExpressionField = typeof EXPRESSION_FIELDS[number];
export type ExpressionSource = "GENERATED" | "CURATED";
export type ExpressionConfidence = "high" | "medium" | "low";
export type GenerationProfile = "clinical_high_priority" | "special_situation_high_priority" | "fatal_outcome_high_priority" | "clinical_standard" | "manual_review_only";

export type SocialExpression = {
  expression_id: string;
  expression: string;
  normalized_expression: string;
  expression_type: ExpressionField;
  expression_source: ExpressionSource;
  confidence: ExpressionConfidence;
  language: string;
  locale: string;
  taxonomy_concept_id: string;
  normalized_concept: string;
  meddra_pt: string;
  is_official_meddra_synonym: false;
  validation_status: "pending_pv_medical_review";
  provenance: {
    source_reference: string;
    source_taxonomy_snapshot: string;
    source_taxonomy_sha256: string;
    taxonomy_version: string;
    templates_version: string;
    curated_seeds_version: string;
    generated_at: string;
    generation_method: "versioned_template" | "versioned_curated_seed";
    association_statement: string;
    official_terminology_statement: string;
  };
};

export type SocialExpressionConceptRecord = {
  taxonomy_concept_id: string;
  meddra_pt: string;
  canonical_concept: string;
  taxonomy_version: string;
  library_version: string;
  semantic_category: string;
  priority: "high" | "standard";
  generation_profile: GenerationProfile;
  source_case_count: number;
  review_status: "pending_pv_medical_review";
  clinical_synonyms: SocialExpression[];
  lay_synonyms: SocialExpression[];
  consumer_expressions: SocialExpression[];
  colloquial_expressions: SocialExpression[];
  symptom_descriptions: SocialExpression[];
  likely_misspellings: SocialExpression[];
  slang_or_informal_phrasing: SocialExpression[];
  temporal_expressions: SocialExpression[];
  causal_expressions: SocialExpression[];
  uncertain_causality_expressions: SocialExpression[];
  provenance: {
    source_taxonomy_concept_id: string;
    source_taxonomy_snapshot: string;
    source_taxonomy_sha256: string;
    source_meddra_pt_preserved: true;
    generated_at: string;
  };
};

export type ExpressionTemplates = {
  schemaVersion: string;
  templatesVersion: string;
  status: "active" | "draft" | "superseded";
  profiles: Record<GenerationProfile, Partial<Record<ExpressionField, string[]>>>;
};

export type CuratedSeed = {
  meddra_pt: string;
  confidence: ExpressionConfidence;
} & Partial<Record<ExpressionField, string[]>>;

export type CuratedSeeds = {
  schemaVersion: string;
  seedsVersion: string;
  status: "active" | "draft" | "superseded";
  reviewStatus: "pending_pv_medical_review";
  concepts: CuratedSeed[];
};

export type ExpressionLibraryConfiguration = {
  schemaVersion: string;
  libraryVersion: string;
  status: "draft_pending_pv_medical_review" | "active" | "superseded";
  topic: string;
  activeTemplates: string;
  activeCuratedSeeds: string;
  expressionSchema: string;
  language: string;
  locale: string;
  highPriorityDefinition: { frequencyRankAtOrBelow: number; seriousnessRankAtOrBelow: number };
  minimumHighPriorityCoverage: { lay_synonyms: number; colloquial_expressions: number; temporal_expressions: number };
  nonClinicalPatterns: string[];
  fatalOutcomePatterns: string[];
  associationStatement: string;
  officialTerminologyStatement: string;
  activationPolicy: string;
};

export type ExpressionQualityControlRecord = {
  taxonomy_concept_id: string;
  meddra_pt: string;
  canonical_concept: string;
  priority: "critical" | "high" | "standard";
  generation_profile: GenerationProfile;
  expression_count: number;
  generated_expression_count: number;
  curated_expression_count: number;
  low_confidence_expression_count: number;
  reasons: string[];
  required_action: string;
  production_eligible: false;
};

export type ExpressionLibraryBuildResult = {
  generatedAt: string;
  source: {
    taxonomyPath: string;
    taxonomySnapshot: string;
    taxonomySha256: string;
    taxonomyVersion: string;
    taxonomyConceptCount: number;
  };
  concepts: SocialExpressionConceptRecord[];
  expressions: SocialExpression[];
  qualityControl: ExpressionQualityControlRecord[];
  sourceTaxonomyRecords: ReactionTaxonomyRecord[];
};
