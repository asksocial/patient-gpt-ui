import type { PvAdverseEventOntology, PvClassification } from "../types";

export const PV_E2B_CASE_CLASSIFICATIONS = [
  "potential_icsr_complete",
  "potential_icsr_incomplete",
  "pv_relevant_non_icsr",
  "special_situation",
  "insufficient_information",
  "not_pv_relevant",
  "requires_human_review",
] as const;

export type PvE2bCaseClassification = (typeof PV_E2B_CASE_CLASSIFICATIONS)[number];
export type PvMissingReason =
  | "not_reported"
  | "unknown"
  | "not_applicable"
  | "unable_to_determine"
  | "ambiguous"
  | "conflicting"
  | "redacted"
  | "not_collected";

export type PvExtractionType = "verbatim" | "normalized" | "derived" | "inferred" | "human_validated";
export type PvRegulatoryVerificationStatus = "not_required" | "pending" | "verified";

export type PvFieldEvidence = {
  field: string;
  value: unknown;
  extractionType: PvExtractionType;
  sourceText?: string;
  sourceStartOffset?: number;
  sourceEndOffset?: number;
  sourceUrl?: string;
  sourcePlatform?: string;
  sourcePublishedAt?: string;
  collectedAt?: string;
  extractionConfidence?: number;
  modelName?: string;
  modelVersion?: string;
  promptVersion?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  regulatoryVerificationStatus: PvRegulatoryVerificationStatus;
  mappingVersion: string;
};

export type PvAuditTrail = {
  sourcePublishedAt?: string;
  collectedAt?: string;
  algorithmAssessedAt?: string;
  humanReviewStartedAt?: string;
  humanReviewedAt?: string;
  escalatedAt?: string;
  clientNotifiedAt?: string;
};

export type PvCaseRelationshipType =
  | "possible_duplicate_of"
  | "confirmed_duplicate_of"
  | "follow_up_to"
  | "repost_of"
  | "related_case";

export type PvCaseRelationship = {
  type: PvCaseRelationshipType;
  targetCaseId: string;
  confidence?: number;
  rationale: string[];
  status: "proposed" | "human_confirmed" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
};

export type PvSpecialSituation = {
  type:
    | "medication_error"
    | "misuse"
    | "abuse"
    | "overdose"
    | "occupational_exposure"
    | "pregnancy_exposure"
    | "breastfeeding_exposure"
    | "off_label_use"
    | "lack_of_efficacy"
    | "product_quality_with_adverse_event"
    | "suspected_infectious_transmission"
    | "unexpected_therapeutic_benefit"
    | "pediatric_exposure"
    | "drug_interaction";
  status: "detected" | "human_confirmed" | "rejected";
  evidence?: string;
  confidence?: number;
};

export type PvValidationIssue = {
  code: string;
  field?: string;
  message: string;
  severity: "information" | "warning" | "blocking";
  regulatoryVerificationRequired?: boolean;
};

export type PvCaseValidation = {
  schemaValid: boolean;
  pvTriageValid: boolean;
  emailReady: boolean;
  e2bExportReady: boolean;
  regulatorySubmissionReady: false;
  issues: PvValidationIssue[];
};

export type PvE2bAlignedCase = {
  id: string;
  classification: PvE2bCaseClassification;
  administrative: Record<string, unknown>;
  source: Record<string, unknown>;
  reporter: Record<string, unknown>;
  patient: Record<string, unknown>;
  reactions: Array<Record<string, unknown>>;
  drugs: Array<Record<string, unknown>>;
  tests: Array<Record<string, unknown>>;
  specialSituations: PvSpecialSituation[];
  narrative: Record<string, unknown>;
  missing: Record<string, PvMissingReason>;
  evidence: PvFieldEvidence[];
  audit: PvAuditTrail;
  relationships: PvCaseRelationship[];
  review: Record<string, unknown>;
  validation: PvCaseValidation;
  e2bMappingVersion: string;
  ichPackageVersion: string;
  controlledTerminologyVersion: string;
  emailMappingVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type PvE2bMappingEntry = {
  askSocialField: string;
  displayName: string;
  e2bElement: string | null;
  e2bSection: string | null;
  regulatorySource: "ICH" | "FDA" | "AskSocial-only" | "Client-specific";
  description: string;
  dataType: string;
  cardinality: "single" | "repeating";
  requirement: "required" | "conditional" | "optional" | "N/A";
  condition: string | null;
  allowedValues: string[] | string | null;
  sourceType: "direct" | "inferred" | "derived" | "normalized" | "human-reviewed" | "client-system";
  extractionMethod: string;
  confidenceRequired: boolean | { minimum: number };
  humanReviewRequired: boolean;
  unavailableHandling: string;
  evidenceRequired: boolean;
  emailIncluded: "always" | "conditional" | "never";
  emailLabel: string | null;
  notes: string;
  verificationStatus: PvRegulatoryVerificationStatus;
};

export type PvE2bMappingPackage = {
  schemaVersion: string;
  mappingVersion: string;
  status: "active" | "superseded" | "draft";
  effectiveFrom: string;
  sources: Record<string, string>;
  missingStates: PvMissingReason[];
  mappings: PvE2bMappingEntry[];
  specialSituationClassificationMap: Record<string, PvSpecialSituation["type"]>;
  humanReviewTriggers: string[];
  relationshipTypes: PvCaseRelationshipType[];
};

export type PvEmailFieldConfig = {
  field: string;
  label: string;
  section: string;
  include: "always" | "when_present" | "when_flagged" | "never";
  displayUnknown?: boolean;
  order: number;
};

export type PvEmailMappingPackage = {
  schemaVersion: string;
  emailMappingVersion: string;
  status: "active" | "superseded" | "draft";
  fields: PvEmailFieldConfig[];
  displayRules: string[];
  disclaimer: string;
};

export type PvIchCodeListPackage = {
  schemaVersion: string;
  packageVersion: string;
  publishedAt: string;
  sourcePackageVersion: string;
  sourceFile: string;
  codeLists: Record<string, {
    name: string;
    version: string;
    oid: string;
    values: Array<{ code: string; label: string }>;
  }>;
};

export type PvCaseAssemblyInput = {
  record: Record<string, any>;
  review?: Record<string, any> | null;
  transfer?: Record<string, any> | null;
  ontology?: PvAdverseEventOntology | null;
  classifications?: Array<PvClassification | PvSpecialSituation["type"]>;
  relationships?: PvCaseRelationship[];
  now?: string;
};
