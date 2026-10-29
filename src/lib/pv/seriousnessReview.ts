/** Preserve every retained criterion in the editor, including older extraction codes. */
export const REVIEW_SERIOUSNESS_CRITERIA = ["death", "life_threatening", "hospitalization", "disability_or_incapacity", "congenital_anomaly_or_birth_defect", "important_medical_event"] as const;
export function seriousnessReviewOptions(retained: string[] = []): string[] {
  return [...new Set<string>([...REVIEW_SERIOUSNESS_CRITERIA, ...retained])];
}
