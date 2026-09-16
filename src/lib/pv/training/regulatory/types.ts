export type OpenFdaQueryKind = "brand" | "active_ingredient";

export type BotulinumProductFamily = {
  familyId: string;
  brands: string[];
  activeIngredients: string[];
};

export type BotulinumProductRegistry = {
  schemaVersion: string;
  registryVersion: string;
  status: "active" | "draft" | "superseded";
  families: BotulinumProductFamily[];
};

export type OpenFdaRegulatoryMapping = {
  schemaVersion: string;
  mappingVersion: string;
  status: "active" | "draft" | "superseded";
  endpoint: string;
  queryFields: {
    brand: string[];
    activeIngredient: string[];
    suspectDrugField: string;
    suspectDrugCode: string;
  };
  paging: {
    pageSize: number;
    sort: string;
    strategy: "search_after_link_with_bounded_skip_fallback";
    skipFallbackMaximumTotal: number;
    skipFallbackPageSize: number;
  };
  retry: {
    maxAttempts: number;
    queryRestartAttempts: number;
    skipFallbackActivationPass: number;
    skipFallbackCooldownMs: number;
    initialDelayMs: number;
    maximumDelayMs: number;
    minimumRequestIntervalMs: number;
  };
  codes: {
    drugRole: Record<string, "suspect" | "concomitant" | "interacting">;
    patientAgeUnit: Record<string, string>;
    patientSex: Record<string, string>;
    reporterQualification: Record<string, string>;
    reactionOutcome: Record<string, string>;
  };
};

export type OpenFdaQueryDefinition = {
  queryId: string;
  kind: OpenFdaQueryKind;
  productSearched: string;
  field: string;
  suspectOnly: boolean;
  searchExpression: string;
  publicUrl: string;
};

export type OpenFdaQueryObservation = {
  queryId: string;
  queryKind: OpenFdaQueryKind;
  productSearched: string;
  field: string;
  suspectOnly: boolean;
  sourceApiQuery: string;
  retrievedAt: string;
  sourceProductValues: string[];
  sourceReactionValues: string[];
};

export type OpenFdaRawRecordEnvelope = {
  deduplicationKey: string;
  rawSourceRecordSha256: string;
  rawSourceRecord: Record<string, unknown>;
  observations: OpenFdaQueryObservation[];
};

export type NormalizedFaersDate = {
  raw: string;
  iso?: string;
};

export type NormalizedFaersDrug = {
  source_index: number;
  medicinal_product?: string;
  active_ingredient?: string;
  openfda_brand_names: string[];
  openfda_generic_names: string[];
  openfda_substance_names: string[];
  drug_characterization_code?: string;
  drug_role?: "suspect" | "concomitant" | "interacting" | "unknown";
  indication?: string;
  dose_text?: string;
  structured_dose?: {
    value?: string;
    unit_code?: string;
  };
  cumulative_dose?: {
    value?: string;
    unit_code?: string;
  };
  route?: string;
  therapy_start_date?: NormalizedFaersDate;
  therapy_end_date?: NormalizedFaersDate;
  is_target_botulinum_product: boolean;
  matched_target_product?: string;
  matched_active_ingredient?: string;
  suspect_role_if_available?: "suspect" | "concomitant" | "interacting" | "unknown";
};

export type NormalizedFaersReaction = {
  source_index: number;
  source_reaction_value: string;
  meddra_preferred_term: string;
  meddra_version?: string;
  outcome_code?: string;
  outcome?: string;
};

export type NormalizedFaersOutcome = {
  source_reaction_index: number;
  source_reaction_value: string;
  outcome_code: string;
  outcome: string;
};

export type NormalizedFaersRegulatoryCase = {
  case_id: string;
  faers_case_id: string;
  safety_report_id: string;
  safety_report_version?: string;
  authority_case_number?: string;
  company_case_number?: string;
  receipt_date?: NormalizedFaersDate;
  receive_date?: NormalizedFaersDate;
  transmission_date?: NormalizedFaersDate;
  serious_indicator?: boolean;
  seriousness_criteria: {
    death: boolean;
    life_threatening: boolean;
    hospitalization: boolean;
    disability: boolean;
    congenital_anomaly: boolean;
    other_medically_important: boolean;
  };
  patient?: {
    age?: string;
    age_unit_code?: string;
    age_unit?: string;
    sex_code?: string;
    sex?: string;
    weight_kg?: string;
  };
  country?: string;
  reporter?: {
    qualification_code?: string;
    qualification?: string;
    country?: string;
  };
  drugs: NormalizedFaersDrug[];
  reactions: NormalizedFaersReaction[];
  outcomes: NormalizedFaersOutcome[];
  concomitant_products: string[];
  is_target_botulinum_product: boolean;
  matched_target_products: string[];
  matched_active_ingredients: string[];
  suspect_role_if_available: Array<"suspect" | "concomitant" | "interacting" | "unknown">;
  causality_status: "NOT_ESTABLISHED";
  provenance: {
    source: "FDA_FAERS_OPENFDA";
    endpoint: string;
    source_api_queries: OpenFdaQueryObservation[];
    raw_source_record_sha256: string;
    raw_source_record_storage: string;
    configuration_version: string;
    product_registry_version: string;
    source_mapping_version: string;
  };
  normalization_warnings: string[];
};

export type OpenFdaMalformedRecord = {
  queryId: string;
  retrievedAt: string;
  error: string;
  rawSourceRecord: unknown;
};

export type OpenFdaQueryRun = {
  query: OpenFdaQueryDefinition;
  pagesRetrieved: number;
  sourceHits: number;
  uniqueRecordsAdded: number;
  duplicatesObserved: number;
  recordsRejectedBySuspectPostFilter: number;
  totalReportedByApi?: number;
  apiLastUpdated?: string;
  completed: boolean;
  queryPasses: number;
  attemptErrors: Array<{ pass: number; error: string }>;
  skipFallbackUsed: boolean;
  error?: string;
};

export type OpenFdaIngestionResult = {
  startedAt: string;
  completedAt: string;
  configurationVersion: string;
  productRegistryVersion: string;
  sourceMappingVersion: string;
  status: "complete" | "partial";
  truncated: boolean;
  queryRuns: OpenFdaQueryRun[];
  rawRecords: OpenFdaRawRecordEnvelope[];
  normalizedRecords: NormalizedFaersRegulatoryCase[];
  malformedRecords: OpenFdaMalformedRecord[];
  duplicateCount: number;
};
