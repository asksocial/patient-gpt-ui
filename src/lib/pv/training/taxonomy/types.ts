export const PV_SEMANTIC_CATEGORIES = [
  "neuromuscular",
  "ocular",
  "respiratory",
  "swallowing",
  "speech",
  "injection-site",
  "systemic",
  "allergic/hypersensitivity",
  "weakness/fatigue",
  "cosmetic/asymmetry",
  "pain",
  "gastrointestinal",
  "cardiovascular",
  "neurologic",
  "psychiatric",
  "other",
] as const;

export type PvSemanticCategory = typeof PV_SEMANTIC_CATEGORIES[number];

export type TaxonomyRules = {
  schemaVersion: string;
  rulesVersion: string;
  status: "active" | "draft" | "superseded";
  normalizationPolicy: string;
  categories: Array<{ id: PvSemanticCategory; patterns: string[] }>;
  explicitConceptMappings: Array<{
    meddra_pts: string[];
    normalized_concept: string;
    relationship_type: "equivalent_to" | "closely_related_to";
    confidence: number;
    rationale: string;
  }>;
};

export type TaxonomyConfiguration = {
  schemaVersion: string;
  taxonomyVersion: string;
  status: "draft_pending_pv_review" | "active" | "superseded";
  topic: string;
  activeSemanticRules: string;
  recordSchema: string;
  categorySystem: string;
  categorySystemIsOfficialMeddraHierarchy: false;
  associationStatement: string;
  datePrecedence: Array<"receive_date" | "receipt_date" | "transmission_date">;
  exampleCaseLimit: number;
  summaryLimit: number;
  activationPolicy: string;
};

export type TaxonomyRelationship = {
  meddra_pt: string;
  normalized_concept: string;
  relationship_type: "equivalent_to" | "closely_related_to";
  confidence: number;
  rationale: string;
  review_status: "algorithmic_candidate_pending_pv_review";
};

export type ReactionTaxonomyRecord = {
  concept_id: string;
  taxonomy_version: string;
  meddra_pt: string;
  normalized_label: string;
  normalized_concept: string;
  concept_group_id: string;
  relationship_status: "algorithmic_candidate_pending_pv_review" | "no_relationship_suggested";
  related_concepts: TaxonomyRelationship[];
  semantic_category: PvSemanticCategory;
  semantic_categories: PvSemanticCategory[];
  category_system: string;
  category_is_official_meddra_hierarchy: false;
  source_reaction_occurrence_count: number;
  source_case_count: number;
  source_report_count: number;
  associated_target_products: string[];
  associated_active_ingredients: string[];
  serious_case_count: number;
  nonserious_case_count: number;
  unknown_seriousness_case_count: number;
  first_seen_date?: string;
  last_seen_date?: string;
  example_case_ids: string[];
  ranks: {
    frequency: number;
    seriousness: number;
    product_breadth: number;
    unique_cases: number;
  };
  review_status: "draft_pending_pv_review";
  provenance: {
    source: "FDA_FAERS_OPENFDA_NORMALIZED_CORPUS";
    source_corpus_snapshot: string;
    source_normalized_records: string;
    source_manifest_sha256: string;
    source_normalized_records_sha256: string;
    source_configuration_version: string;
    source_product_registry_version: string;
    source_mapping_version: string;
    taxonomy_rules_version: string;
    source_meddra_versions: string[];
    generated_at: string;
    association_statement: string;
  };
};

export type AssociationSummaryRow = {
  association_value: string;
  meddra_pt: string;
  normalized_label: string;
  source_case_count: number;
  serious_case_count: number;
  nonserious_case_count: number;
  unknown_seriousness_case_count: number;
  association_statement: string;
};

export type TaxonomyBuildResult = {
  generatedAt: string;
  source: {
    snapshotDirectory: string;
    normalizedRecordsPath: string;
    manifestPath: string;
    normalizedRecordsSha256: string;
    manifestSha256: string;
    expectedNormalizedRecords?: number;
    casesRead: number;
    duplicateCaseIds: number;
    casesWithReactionTerminology: number;
    casesMissingReactionTerminology: number;
    validReactionOccurrences: number;
    seriousCases: number;
    nonseriousCases: number;
    unknownSeriousnessCases: number;
  };
  records: ReactionTaxonomyRecord[];
  summaries: {
    topOverall: ReactionTaxonomyRecord[];
    topSerious: ReactionTaxonomyRecord[];
    byProduct: AssociationSummaryRow[];
    byActiveIngredient: AssociationSummaryRow[];
    byIndication: AssociationSummaryRow[];
  };
};
