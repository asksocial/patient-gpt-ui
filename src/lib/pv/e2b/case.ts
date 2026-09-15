import { assessIcsrIdentifiability } from "../identifiability";
import { getActivePvE2bMapping, getActivePvEmailMapping, getActivePvE2bManifest } from "./config";
import type {
  PvCaseAssemblyInput,
  PvE2bAlignedCase,
  PvE2bCaseClassification,
  PvFieldEvidence,
  PvMissingReason,
  PvSpecialSituation,
} from "./types";
import { validatePvE2bCase } from "./validation";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function present(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && text(value) !== "";
}

function criterion(ontology: any, name: string) {
  return ontology?.icsrAssessment?.minimumCriteria?.[name]?.status;
}

function determineClassification(input: PvCaseAssemblyInput, ontology: any): PvE2bCaseClassification {
  const status = text(input.record.status);
  const decision = text(input.review?.decision);
  if (status === "not_relevant" || decision === "close_not_relevant") return "not_pv_relevant";

  const criteria = ["identifiablePatient", "identifiableReporter", "suspectProduct", "adverseEventOrObservation"];
  const yesCount = criteria.filter((name) => criterion(ontology, name) === "yes").length;
  const unclearCount = criteria.filter((name) => criterion(ontology, name) === "unclear").length;
  if (yesCount === criteria.length) return "potential_icsr_complete";
  if (input.classifications?.some((value) => value !== "adverse_event")) return "special_situation";
  if (yesCount >= 2 && (criterion(ontology, "suspectProduct") === "yes" || criterion(ontology, "adverseEventOrObservation") === "yes")) return "potential_icsr_incomplete";
  if (status === "health_experience") return "pv_relevant_non_icsr";
  if (unclearCount > 0 || input.record.detection_score >= 0.5) return "requires_human_review";
  return "insufficient_information";
}

function evidence(
  field: string,
  value: unknown,
  sourceText: string | undefined,
  extractionType: PvFieldEvidence["extractionType"],
  input: PvCaseAssemblyInput,
): PvFieldEvidence | null {
  if (!present(value)) return null;
  const manifest = getActivePvE2bManifest();
  return {
    field,
    value,
    extractionType,
    sourceText,
    sourceUrl: text(input.record.source_url) || undefined,
    sourcePlatform: text(input.record.source_type) || undefined,
    sourcePublishedAt: text(input.record.posted_at) || undefined,
    collectedAt: text(input.record.ingested_at) || undefined,
    extractionConfidence: typeof input.record.detection_score === "number" ? input.record.detection_score : undefined,
    modelVersion: text(input.record.classifier_version) || undefined,
    reviewedBy: text(input.review?.reviewer_id) || undefined,
    reviewedAt: text(input.review?.reviewed_at) || undefined,
    regulatoryVerificationStatus: extractionType === "human_validated" ? "verified" : "pending",
    mappingVersion: manifest.activeMappingVersion,
  };
}

function collectSpecialSituations(input: PvCaseAssemblyInput) {
  const mapping = getActivePvE2bMapping().specialSituationClassificationMap;
  const values = input.classifications || input.review?.classifications || input.record.proposed_classifications || [];
  return Array.from(new Set(values.map((value: string) => mapping[value]).filter(Boolean)))
    .filter((type) => type !== "product_quality_with_adverse_event" || (input.ontology || input.review?.validated_ae_ontology || input.record.ae_ontology)?.adverseEvents?.length)
    .map((type) => ({
    type,
    status: input.review ? "human_confirmed" : "detected",
    evidence: text(input.review?.rationale) || undefined,
    confidence: typeof input.record.detection_score === "number" ? input.record.detection_score : undefined,
  })) as PvSpecialSituation[];
}

function missingStateMap(caseData: Omit<PvE2bAlignedCase, "missing" | "validation">) {
  const requiredPaths: Array<[string, unknown]> = [
    ["reporter.identifiabilityStatus", caseData.reporter.identifiabilityStatus],
    ["patient.identifiabilityStatus", caseData.patient.identifiabilityStatus],
    ["drugs[].productNameReported", caseData.drugs[0]?.productNameReported],
    ["reactions[].verbatim", caseData.reactions[0]?.verbatim],
    ["narrative.caseNarrative", caseData.narrative.caseNarrative],
    ["audit.sourcePublishedAt", caseData.audit.sourcePublishedAt],
    ["audit.collectedAt", caseData.audit.collectedAt],
    ["audit.algorithmAssessedAt", caseData.audit.algorithmAssessedAt],
  ];
  return Object.fromEntries(requiredPaths.filter(([, value]) => !present(value)).map(([field]) => [field, "not_reported" as PvMissingReason]));
}

export function buildPvE2bAlignedCase(input: PvCaseAssemblyInput): PvE2bAlignedCase {
  const manifest = getActivePvE2bManifest();
  const emailMapping = getActivePvEmailMapping();
  const ontology = input.ontology || input.review?.validated_ae_ontology || input.record.ae_ontology || {};
  const identifiability = input.record.identifiability_assessment || assessIcsrIdentifiability(input.record);
  const patientAssessment = ontology?.icsrAssessment?.patientAssessment || {};
  const reporterAssessment = ontology?.icsrAssessment?.reporterAssessment || {};
  const reviewed = Boolean(input.review?.reviewed_at);
  const outcome = ontology?.outcomes?.[0];
  const reactions = (ontology?.adverseEvents || []).map((event: any) => ({
    verbatim: event.value,
    sourceEvidence: event.evidence,
    language: text(input.record.language) || undefined,
    meddraSuggestion: event.meddraSuggestion,
    meddraCode: event.meddraValidated === true ? event.meddraCode : undefined,
    meddraVersion: event.meddraValidated === true ? event.meddraVersion : undefined,
    seriousness: {
      overall: ontology?.seriousness?.value,
      criteria: ontology?.seriousness?.criteria || [],
    },
    onsetAt: event.onsetAt,
    endAt: event.endAt,
    timeToOnset: ontology?.timeToOnset,
    outcome: outcome?.category || "unknown",
    outcomeEvidence: outcome?.evidence,
    severity: ontology?.severity?.value,
    unexpectedness: ontology?.unexpectedness?.value,
  }));
  const drugs = (ontology?.productProcedures || []).map((product: any) => ({
    productNameReported: product.value,
    sourceEvidence: product.evidence,
    role: product.role || "suspect",
    activeIngredient: product.activeIngredient,
    indication: product.indication,
    dose: product.dose,
    doseUnit: product.doseUnit,
    route: product.route,
    therapyStartAt: product.therapyStartAt,
    therapyEndAt: product.therapyEndAt,
  }));
  if (!drugs.length && present(input.record.product_name)) drugs.push({ productNameReported: input.record.product_name, sourceEvidence: input.record.potential_event, role: "suspect" });
  const criteria = ontology?.icsrAssessment?.minimumCriteria || {};
  const minimumCriteriaDetected = Object.entries(criteria).filter(([, value]: any) => value?.status === "yes").map(([key]) => key);
  const minimumCriteriaMissing = ["identifiablePatient", "identifiableReporter", "suspectProduct", "adverseEventOrObservation"].filter((key) => criteria?.[key]?.status !== "yes");
  const sourceVerbatim = text(input.record.original_verbatim);
  const narrative = text(ontology?.icsrAssessment?.clinicalNarrative?.clinicalCourse) || sourceVerbatim;
  const base: Omit<PvE2bAlignedCase, "missing" | "validation"> = {
    id: text(input.record.id || input.record.external_id),
    classification: determineClassification(input, ontology),
    administrative: {
      askSocialCaseId: text(input.record.id || input.record.external_id),
      clientAccount: text(input.record.principal_id) || undefined,
      reportType: ontology?.icsrAssessment?.reportType,
      firstReceivedAtCandidate: text(input.record.ingested_at) || undefined,
      officialIdentifiersAssigned: false,
    },
    source: {
      platform: text(input.record.source_type) || "unknown",
      url: text(input.record.source_url) || undefined,
      verbatim: sourceVerbatim || undefined,
      authorIdentifier: text(input.record.author_identifier) || undefined,
      country: text(input.record.market) || undefined,
      evidenceHash: text(input.record.evidence_hash) || undefined,
    },
    reporter: {
      type: ontology?.icsrAssessment?.primarySourceType || "unknown",
      identifiabilityStatus: reporterAssessment.existenceStatus || identifiability.reporter.status,
      relationship: reporterAssessment.relationship || identifiability.reporter.relationship,
      qualifyingCharacteristics: reporterAssessment.qualifyingCharacteristics || identifiability.reporter.qualifyingCharacteristics,
      verificationEvidence: reporterAssessment.verificationEvidence || identifiability.reporter.verificationEvidence || undefined,
      hcpStatus: ontology?.icsrAssessment?.primarySourceType === "healthcare_professional" ? true : undefined,
    },
    patient: {
      identifiabilityStatus: patientAssessment.existenceStatus || identifiability.patient.status,
      association: patientAssessment.association || identifiability.patient.association,
      qualifyingCharacteristics: patientAssessment.qualifyingCharacteristics || identifiability.patient.qualifyingCharacteristics,
      verificationEvidence: patientAssessment.verificationEvidence || identifiability.patient.verificationEvidence || undefined,
      otherCharacteristics: text(patientAssessment.identifierBasis) || undefined,
    },
    reactions,
    drugs,
    tests: [],
    specialSituations: collectSpecialSituations(input),
    narrative: {
      caseNarrative: narrative || undefined,
      reporterComments: sourceVerbatim || undefined,
      limitations: ontology?.limitations || [],
      causalityIsAttributed: Boolean(ontology?.causality?.length),
    },
    evidence: [],
    audit: {
      sourcePublishedAt: text(input.record.posted_at) || undefined,
      collectedAt: text(input.record.ingested_at) || undefined,
      algorithmAssessedAt: text(input.record.algorithm_assessed_at || input.record.created_at) || undefined,
      humanReviewStartedAt: text(input.record.review_started_at) || undefined,
      humanReviewedAt: text(input.review?.reviewed_at) || undefined,
      escalatedAt: input.review?.decision === "escalate" ? text(input.review.reviewed_at) || undefined : undefined,
      clientNotifiedAt: text(input.transfer?.client_notified_at) || undefined,
    },
    relationships: input.relationships || [],
    review: {
      status: reviewed ? "human_reviewed" : input.record.review_started_at ? "in_review" : "not_started",
      reviewer: text(input.review?.reviewer_id) || undefined,
      rationale: text(input.review?.rationale) || undefined,
      minimumCriteriaDetected,
      minimumCriteriaMissing,
      seriousnessFlag: ontology?.seriousness?.value === "serious",
      specialSituationFlag: collectSpecialSituations(input).length > 0,
      causalityStatementPresent: ontology?.causality?.length ? "yes" : "no_or_unclear",
    },
    e2bMappingVersion: manifest.activeMappingVersion,
    ichPackageVersion: manifest.ichPackageVersion,
    controlledTerminologyVersion: manifest.ichControlledTerminologyVersion,
    emailMappingVersion: emailMapping.emailMappingVersion,
    createdAt: text(input.record.created_at) || input.now || new Date().toISOString(),
    updatedAt: text(input.record.updated_at || input.review?.reviewed_at) || input.now || new Date().toISOString(),
  };
  const extractedEvidence = [
    evidence("audit.sourcePublishedAt", base.audit.sourcePublishedAt, undefined, "verbatim", input),
    evidence("audit.collectedAt", base.audit.collectedAt, undefined, "derived", input),
    evidence("source.verbatim", base.source.verbatim, sourceVerbatim, "verbatim", input),
    ...drugs.map((drug: any) => evidence("drugs[].productNameReported", drug.productNameReported, drug.sourceEvidence, reviewed ? "human_validated" : "normalized", input)),
    ...reactions.map((reaction: any) => evidence("reactions[].verbatim", reaction.verbatim, reaction.sourceEvidence, reviewed ? "human_validated" : "verbatim", input)),
  ].filter(Boolean) as PvFieldEvidence[];
  base.evidence = extractedEvidence;
  const assembled = { ...base, missing: missingStateMap(base) } as PvE2bAlignedCase;
  assembled.validation = validatePvE2bCase(assembled);
  return assembled;
}
