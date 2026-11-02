export type PvScreeningDraft = {
  recordUpdatedAt: string;
  productMention: "yes" | "no" | "unclear";
  healthExperience: "yes" | "no" | "unclear";
  selectedClasses: string[];
  rationale: string;
  followUpOwner: string;
  followUpDueAt: string;
  identificationTime: string;
  patientEvidenceConfirmed: boolean;
  ontologyReview: Record<string, string>;
  e2dReview: Record<string, string | string[]>;
  initialFollowUp?: string;
  reviewedFields?: Record<string, unknown>;
  savedBy: string;
  savedAt: string;
};

export function screeningDraftFingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(screeningDraftFingerprint).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${screeningDraftFingerprint(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

const ontologyKeys = ["productProcedure", "adverseEvent", "seriousness", "outcome", "timeToOnset", "timeToOnsetDetail", "severity", "unexpectedness", "causalityLanguage"];
const assessmentKeys = ["reportType", "primarySourceType", "patientIdentifierBasis", "patientAssociation", "patientExistenceStatus", "patientVerificationEvidence", "patientFollowUpFeasibility", "patientFollowUpStatus", "reporterIdentifierBasis", "reporterRelationship", "reporterExistenceStatus", "reporterVerificationEvidence", "reporterFollowUpFeasibility", "reporterFollowUpStatus", "patientCharacteristics", "therapyDetails", "medicalHistory", "concurrentConditions", "clinicalCourse", "diagnosisAndLaboratoryEvidence", "alternativeCausesAndConfounders", "followUpNeeded", "followUpQuestions", "duplicateStatus", "duplicateReference", "regionalReportingAssessment"];
const classifications = ["adverse_event", "product_quality_complaint", "pregnancy", "medication_error", "lack_of_efficacy", "overdose", "misuse_abuse", "other"];
export function assertScreeningDraftRecord(record: { status: string; updated_at: string }, expectedUpdatedAt: unknown) {
  if (!["new", "in_review", "health_experience", "not_relevant"].includes(record.status)) throw new Error("Screening drafts cannot change a sponsor-ready or transferred record.");
  if (expectedUpdatedAt !== record.updated_at) throw Object.assign(new Error("The record disposition changed. Reload before saving the screening draft."), { status: 409 });
}
function text(value: unknown) {
  if (typeof value !== "string" || value.length > 10000) throw new Error("Invalid screening draft field.");
  return value;
}
function strings(value: unknown) {
  if (!Array.isArray(value) || value.length > 50) throw new Error("Invalid screening draft selection.");
  return value.map(text);
}

/** Drafts retain unfinished reviewer work; they never establish reportability. */
export function retainScreeningDraft(input: any, actor: string, timestamp: string): PvScreeningDraft {
  if (!input || !Number.isFinite(Date.parse(input.recordUpdatedAt))) throw new Error("The source record revision is required for a screening draft.");
  if (!["yes", "no", "unclear"].includes(input.productMention) || !["yes", "no", "unclear"].includes(input.healthExperience)) throw new Error("Invalid screening criteria.");
  const selectedClasses = strings(input.selectedClasses);
  if (selectedClasses.some(value => !classifications.includes(value))) throw new Error("Invalid screening classification.");
  if (typeof input.patientEvidenceConfirmed !== "boolean") throw new Error("Invalid patient evidence confirmation.");
  if (input.reviewedFields && (typeof input.reviewedFields !== "object" || Array.isArray(input.reviewedFields) || JSON.stringify(input.reviewedFields).length > 150000)) throw new Error("Invalid clinical draft fields.");
  if (input.initialFollowUp && !["Initial", "Follow-up"].includes(input.initialFollowUp)) throw new Error("Invalid report sequence.");
  return {
    ...(input.reviewedFields ? { reviewedFields: input.reviewedFields } : {}),
    ...(input.initialFollowUp ? { initialFollowUp: input.initialFollowUp } : {}),
    recordUpdatedAt: input.recordUpdatedAt,
    productMention: input.productMention, healthExperience: input.healthExperience, selectedClasses,
    rationale: text(input.rationale), followUpOwner: text(input.followUpOwner), followUpDueAt: text(input.followUpDueAt), identificationTime: text(input.identificationTime),
    patientEvidenceConfirmed: input.patientEvidenceConfirmed,
    ontologyReview: Object.fromEntries(ontologyKeys.map(key => [key, text(input.ontologyReview?.[key])])),
    e2dReview: { ...Object.fromEntries(assessmentKeys.map(key => [key, text(input.e2dReview?.[key])])), patientCharacteristicTypes: strings(input.e2dReview?.patientCharacteristicTypes), seriousnessCriteria: strings(input.e2dReview?.seriousnessCriteria) },
    savedBy: actor, savedAt: timestamp,
  };
}
