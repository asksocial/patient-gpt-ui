export const PV_CLASSIFICATIONS = [
  "adverse_event",
  "product_quality_complaint",
  "pregnancy",
  "medication_error",
  "lack_of_efficacy",
  "overdose",
  "misuse_abuse",
  "other",
] as const;

export type PvClassification = (typeof PV_CLASSIFICATIONS)[number];
export type PvRecordStatus =
  | "new"
  | "in_review"
  | "not_relevant"
  | "ready_for_transfer"
  | "transferred"
  | "acknowledged"
  | "reconciled";

export type PvConceptCategory =
  | "product"
  | "adverse_experience"
  | "severity"
  | "treatment_change"
  | "lack_of_efficacy"
  | "medication_error"
  | "overdose"
  | "pregnancy"
  | "misuse_abuse"
  | "product_quality";

export type PvDetectionConcept = {
  id: string;
  category: PvConceptCategory;
  canonicalTerm: string;
  terms: string[];
  exclusions?: string[];
  productId?: string;
  language: string;
  market?: string;
  weight: number;
  activeFrom?: string;
  activeUntil?: string;
  version: number;
  active: boolean;
};
export type PvContentInput = {
  therapeuticArea?: string;
  externalId: string;
  sourceId?: string;
  sourceType: string;
  sourceUrl: string;
  authorIdentifier?: string;
  verbatim: string;
  language?: string;
  market?: string;
  postedAt: string;
  ingestedAt?: string;
  parentContext?: string;
  threadContext?: string[];
  immutableCaptureUrl?: string;
  dataOrigin?: "live" | "curated" | "unknown";
  identifiedAt?: string;
  importBatchId?: string;
  sourceRowNumber?: number;
  postedAtSourceColumn?: string;
  postedAtRawValue?: string;
  dayZeroBasis?: "posted_at" | "identified_at" | "reportability_identified_at";
  dayZeroReason?: string;
};

export type PvOntologyEvidence = {
  value: string;
  evidence: string;
  confidence: number;
};

export type PvAdverseEventOntology = {
  productProcedures: PvOntologyEvidence[];
  adverseEvents: PvOntologyEvidence[];
  seriousness: {
    value: "serious" | "non_serious" | "unclear";
    criteria: string[];
    evidence: string[];
    confidence: number;
  };
  outcomes: Array<PvOntologyEvidence & {
    category: "recovered" | "ongoing" | "hospitalization" | "permanent_injury" | "fatal" | "unknown";
  }>;
  timeToOnset: {
    category: "immediate" | "hours" | "days" | "weeks" | "months" | "unknown";
    value?: string;
    evidence?: string;
    confidence: number;
  };
  severity: {
    value: "mild" | "moderate" | "severe" | "unclear";
    evidence?: string;
    confidence: number;
  };
  unexpectedness: {
    value: "expected_label_event" | "emerging_signal" | "unclear";
    evidence?: string;
    basis: "configured_label_reference" | "explicit_reporter_language" | "insufficient_reference";
    confidence: number;
  };
  causality: Array<{
    value: "temporal_association" | "possible_attribution" | "reported_attribution" | "denied";
    phrase: string;
    evidence: string;
    confidence: number;
  }>;
  limitations: string[];
  ontologyVersion: string;
  icsrAssessment?: {
    reportType: "spontaneous" | "solicited" | "undetermined";
    primarySourceType: "consumer" | "healthcare_professional" | "other" | "unknown";
    minimumCriteria: {
      suspectProduct: { status: "yes" | "no" | "unclear"; evidence?: string };
      adverseEventOrObservation: { status: "yes" | "no" | "unclear"; evidence?: string };
      identifiablePatient: { status: "yes" | "no" | "unclear"; evidence?: string };
      identifiableReporter: { status: "yes" | "no" | "unclear"; evidence?: string };
    };
    seriousnessCriteria: string[];
    clinicalNarrative: {
      patientCharacteristics?: string;
      therapyDetails?: string;
      medicalHistory?: string;
      concurrentConditions?: string;
      clinicalCourse?: string;
      diagnosisAndLaboratoryEvidence?: string;
      alternativeCausesAndConfounders?: string;
    };
    followUp: {
      needed: "yes" | "no" | "unclear";
      questions?: string;
    };
    duplicateAssessment: {
      status: "not_checked" | "no_match" | "potential_duplicate" | "confirmed_duplicate";
      reference?: string;
    };
    regionalReportingAssessment?: string;
  };
};

export type PvConceptMatch = {
  conceptId: string;
  category: PvConceptCategory;
  canonicalTerm: string;
  matchedTerm: string;
  weight: number;
};

export type PvDetectionResult = {
  shouldCreateRecord: boolean;
  score: number;
  productConfidence: number;
  healthExperienceConfidence: number;
  contextConfidence: number;
  classifications: PvClassification[];
  matches: PvConceptMatch[];
  exclusions: string[];
  rationale: string[];
  classifierVersion: string;
  detectionLibraryVersion: number;
  ontologyExtraction: PvAdverseEventOntology;
};

export type PvSlaPolicy = {
  reviewMinutes: number;
  transferMinutes: number;
  acknowledgmentMinutes: number;
  clockStart: "posted_at" | "ingested_at" | "identified_at" | "reportability_identified_at";
  timezone: string;
};

export type PvClockStatus = {
  stage: "not_started" | "review" | "transfer" | "acknowledgment" | "complete";
  startedAt: string;
  dueAt?: string;
  elapsedMinutes: number;
  remainingMinutes?: number;
  percentConsumed: number;
  state: "not_started" | "healthy" | "approaching" | "breached" | "complete";
  governingClock: "posted_at" | "ingested_at" | "identified_at" | "reportability_identified_at";
  governingTimestamp?: string;
};

export type PvReviewDecision = {
  productMention: "yes" | "no" | "unclear";
  healthExperience: "yes" | "no" | "unclear";
  classifications: PvClassification[];
  rationale: string;
  action: "escalate" | "close_not_relevant";
  ontologyReview?: PvAdverseEventOntology;
};

export type PvReconciliationIssueType =
  | "reviewed_not_transferred"
  | "transferred_not_acknowledged"
  | "duplicate_transfer"
  | "missing_screening_run"
  | "missing_nil_return"
  | "open_record"
  | "timestamp_discrepancy";

export type PvReconciliationIssue = {
  type: PvReconciliationIssueType;
  recordId?: string;
  sourceId?: string;
  detail: string;
  severity: "warning" | "critical";
};

export type PvReconciliationInput = {
  records: Array<{
    id: string;
    status: PvRecordStatus;
    reviewedAt?: string;
    transferredAt?: string;
    acknowledgedAt?: string;
  }>;
  transfers: Array<{
    id: string;
    recordId: string;
    status: "queued" | "delivered" | "acknowledged" | "failed";
    transferredAt?: string;
    acknowledgedAt?: string;
  }>;
  sources: Array<{
    id: string;
    active: boolean;
    cadenceMinutes: number;
    lastScreenedAt?: string;
    lastNilReturnAt?: string;
  }>;
  periodEnd: string;
};
