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
};

export type PvSlaPolicy = {
  reviewMinutes: number;
  transferMinutes: number;
  acknowledgmentMinutes: number;
  clockStart: "posted_at" | "ingested_at" | "identified_at";
  timezone: string;
};

export type PvClockStatus = {
  stage: "review" | "transfer" | "acknowledgment" | "complete";
  startedAt: string;
  dueAt?: string;
  elapsedMinutes: number;
  remainingMinutes?: number;
  percentConsumed: number;
  state: "healthy" | "approaching" | "breached" | "complete";
};

export type PvReviewDecision = {
  productMention: "yes" | "no" | "unclear";
  healthExperience: "yes" | "no" | "unclear";
  classifications: PvClassification[];
  rationale: string;
  action: "escalate" | "close_not_relevant";
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
