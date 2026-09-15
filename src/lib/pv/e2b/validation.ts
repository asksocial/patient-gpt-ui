import { getActivePvE2bMapping } from "./config";
import type { PvCaseValidation, PvE2bAlignedCase, PvValidationIssue } from "./types";

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

export function validatePvE2bCase(caseData: Omit<PvE2bAlignedCase, "validation"> | PvE2bAlignedCase): PvCaseValidation {
  const issues: PvValidationIssue[] = [];
  const add = (issue: PvValidationIssue) => issues.push(issue);
  if (!hasText(caseData.id)) add({ code: "missing_case_id", field: "id", message: "AskSocial Case ID is required.", severity: "blocking" });
  if (!hasText(caseData.source?.verbatim) && !hasText(caseData.source?.url)) add({ code: "missing_source_evidence", field: "source", message: "At least one original evidence reference is required.", severity: "blocking" });
  if (!caseData.audit?.collectedAt) add({ code: "missing_collection_timestamp", field: "audit.collectedAt", message: "Collection timestamp is required for governed intake.", severity: "blocking" });
  if (!caseData.audit?.algorithmAssessedAt) add({ code: "missing_algorithm_timestamp", field: "audit.algorithmAssessedAt", message: "Algorithm assessment timestamp must remain independently auditable.", severity: "warning" });

  const minimumMissing = Array.isArray(caseData.review?.minimumCriteriaMissing) ? caseData.review.minimumCriteriaMissing : [];
  if (minimumMissing.length) add({ code: "minimum_icsr_elements_missing", field: "review.minimumCriteriaMissing", message: `Missing minimum potential ICSR elements: ${minimumMissing.join(", ")}.`, severity: "warning" });
  if (caseData.relationships.some((item) => item.status === "proposed" && ["possible_duplicate_of", "follow_up_to"].includes(item.type))) add({ code: "relationship_requires_review", field: "relationships", message: "A possible duplicate or follow-up relationship requires human confirmation.", severity: "warning" });
  if (caseData.reactions.some((reaction) => hasText(reaction.meddraSuggestion) && !hasText(reaction.meddraCode))) add({ code: "meddra_requires_validation", field: "reactions[].meddraCode", message: "Machine-suggested MedDRA coding requires human validation and a configured version.", severity: "blocking" });

  const mapping = getActivePvE2bMapping();
  for (const entry of mapping.mappings.filter((item) => item.verificationStatus === "pending" && item.sourceType !== "client-system")) {
    add({ code: "regulatory_verification_required", field: entry.askSocialField, message: entry.notes, severity: "information", regulatoryVerificationRequired: true });
  }

  const schemaValid = !issues.some((issue) => issue.severity === "blocking" && ["missing_case_id", "missing_source_evidence", "missing_collection_timestamp"].includes(issue.code));
  const pvTriageValid = schemaValid && (caseData.reactions.length > 0 || caseData.specialSituations.length > 0 || caseData.classification === "requires_human_review");
  const emailReady = schemaValid && hasText(caseData.narrative?.caseNarrative) && hasText(caseData.source?.verbatim);
  const officialIdentifiersPresent = hasText(caseData.administrative?.senderCaseId) && hasText(caseData.administrative?.worldwideCaseId);
  const e2bExportReady = schemaValid
    && minimumMissing.length === 0
    && caseData.review?.status === "human_reviewed"
    && officialIdentifiersPresent
    && caseData.reactions.length > 0
    && caseData.drugs.length > 0
    && caseData.reactions.every((reaction) => hasText(reaction.meddraCode) && hasText(reaction.meddraVersion));
  if (!e2bExportReady) add({
    code: "not_e2b_export_ready",
    message: "The intake record may support downstream transformation, but required identifiers, validated coding, review, or business-rule data are incomplete.",
    severity: "information",
  });
  return { schemaValid, pvTriageValid, emailReady, e2bExportReady, regulatorySubmissionReady: false, issues };
}
