/** Evidence intake schema, not the ICH transport schema. Formal XML needs separate validation. */
export type Availability = "reported" | "not_reported" | "unknown" | "not_available_from_source" | "requires_review";
export type CaseField = {
  value: string;
  availability: Availability;
  evidence: string;
  confidence: number | null;
  source_reference: string | null;
  origin: "source" | "extracted" | "human_added";
  confirmed: boolean;
};
export type MinimumCriterion = {
  present: "present" | "potentially_present" | "not_identified";
  evidence: string;
  confidence: number | null;
  source_reference: string | null;
  confirmed: boolean;
};
export const PATIENT_FIELDS = ["identifier", "age", "ageGroup", "sex", "weight", "medicalHistory", "pregnancyStatus"] as const;
export const REPORTER_FIELDS = ["identifier", "type", "qualification", "country", "platform"] as const;
export const PRODUCT_FIELDS = ["brandName", "genericName", "activeIngredient", "indication", "dose", "frequency", "route", "therapyStartDate", "therapyEndDate", "batchLot"] as const;
export const EVENT_FIELDS = ["verbatim", "normalizedEvent", "meddraTerm", "meddraVersion", "onset", "end", "outcome", "medicalIntervention"] as const;
export const CONCOMITANT_FIELDS = ["product", "dose", "route", "indication", "therapyStartDate", "therapyEndDate"] as const;
export const HISTORY_FIELDS = ["conditions", "allergies", "previousReactions", "pregnancyInformation", "otherContext"] as const;
export const SERIOUSNESS_FIELDS = ["death", "lifeThreatening", "hospitalization", "disability", "congenitalAnomaly", "otherMedicallyImportant"] as const;
export const ASSESSMENT_FIELDS = ["caseValidity", "seriousness", "causality", "expectedness", "meddraCoding", "listedness", "reportability"] as const;
export type Fields<K extends string> = { [P in K]: CaseField };
export type SeriousnessEvidence = Omit<CaseField, "value"> & { value: "evidence_present" | "evidence_absent_from_source" | "requires_pv_review" };
export type R3AlignedCase = {
  schemaVersion: "asksocial-r3-intake-1";
  id: string;
  identification: Fields<"reportType" | "country">;
  status: "detected" | "requires_review" | "reviewed" | "email_ready" | "sent" | "exported";
  sourceEvidence: Array<{
    id: string; mentionId: string; url: string; platform: string; authorIdentifier: string;
    publicationTimestamp: string; detectionTimestamp: string; excerpt: string; evidenceHash: string;
  }>;
  minimumCriteria: { [K in "patient" | "reporter" | "product" | "event"]: MinimumCriterion };
  patient: Fields<typeof PATIENT_FIELDS[number]>;
  reporter: Fields<typeof REPORTER_FIELDS[number]>;
  suspectProducts: Array<Fields<typeof PRODUCT_FIELDS[number]>>;
  events: Array<Fields<typeof EVENT_FIELDS[number]> & { seriousness: { [K in typeof SERIOUSNESS_FIELDS[number]]: SeriousnessEvidence } }>;
  concomitantProducts: Array<Fields<typeof CONCOMITANT_FIELDS[number]>>;
  medicalHistory: Fields<typeof HISTORY_FIELDS[number]>;
  narrative: CaseField;
  /** Human-only assessment; never folded back into source evidence. */
  pvAssessment: Fields<typeof ASSESSMENT_FIELDS[number]>;
  internalNotes: string;
  approval: { reviewer: string; timestamp: string } | null;
};
export type IcsrEmail = { subject: string; recipients: string; body: string };
export type IcsrSnapshot = {
  revision: number;
  originalExtraction: R3AlignedCase;
  caseData: R3AlignedCase;
  email: IcsrEmail | null;
};
