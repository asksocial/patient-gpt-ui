import evaluatorManifest from "../../../config/pv/icsr-candidate-evaluator/manifest.json";
import {
  assessIcsrIdentifiability,
  type PvPatientExistenceStatus,
  type PvReporterExistenceStatus,
} from "./identifiability";

export const ICSR_CANDIDATE_STATUSES = [
  "POTENTIAL_ICSR_COMPLETE",
  "POTENTIAL_ICSR_MISSING_PATIENT",
  "POTENTIAL_ICSR_MISSING_REPORTER",
  "POTENTIAL_ICSR_MISSING_DRUG",
  "POTENTIAL_ICSR_MISSING_EVENT",
  "POTENTIAL_ICSR_MULTIPLE_ELEMENTS_MISSING",
  "NOT_AN_OBSERVED_EVENT",
  "SPECIAL_SITUATION_REVIEW",
] as const;

export type IcsrCandidateStatus = typeof ICSR_CANDIDATE_STATUSES[number];
export type IcsrMissingElement = "P" | "R" | "D" | "E";
export type IcsrObservationContext = "OBSERVED" | "POSSIBLE_OBSERVED" | "NOT_OBSERVED" | "SPECIAL_SITUATION";

export type IcsrSourceMetadata = {
  username?: string | null;
  source_platform: string;
  source_url: string;
  post_id: string;
  original_post_timestamp: string;
  collection_timestamp: string;
  algorithm_timestamp: string;
  human_review_timestamp?: string | null;
  escalation_timestamp?: string | null;
};

export type IcsrDrugCandidate = {
  product: string;
  active_ingredient?: string;
  evidence: string;
  confidence: number;
  suspect: boolean;
};

export type IcsrEventCandidate = {
  raw_expression: string;
  normalized_event: string;
  meddra_pt_candidate?: string;
  evidence: string;
  confidence: number;
  suspected: boolean;
};

export type IcsrCandidateEvaluatorInput = {
  mention: string;
  pv_relevance_detected: true;
  observation_context: IcsrObservationContext;
  special_situation?: string | null;
  source: IcsrSourceMetadata;
  drug_candidates?: IcsrDrugCandidate[];
  event_candidates?: IcsrEventCandidate[];
  identifiability_review?: {
    patient_existence_status?: PvPatientExistenceStatus;
    patient_verification_evidence?: string;
    reporter_existence_status?: PvReporterExistenceStatus;
    reporter_verification_evidence?: string;
  };
};

type IdentifiabilityBasis = "ICH_QUALIFYING_CHARACTERISTIC" | "VERIFIED_EXISTENCE" | "SOURCE_ACCOUNT_CONTEXT" | "NONE";

export type IcsrCandidateEvaluation = {
  original_mention: string;
  patient: {
    present: boolean;
    evidence: string;
    confidence: number;
    basis: IdentifiabilityBasis;
    requires_human_confirmation: boolean;
  };
  reporter: {
    present: boolean;
    evidence: string;
    confidence: number;
    basis: IdentifiabilityBasis;
    requires_human_confirmation: boolean;
  };
  drug: {
    present: boolean;
    product: string;
    active_ingredient: string;
    evidence: string;
    confidence: number;
  };
  event: {
    present: boolean;
    raw_expression: string;
    normalized_event: string;
    meddra_pt_candidate: string;
    evidence: string;
    confidence: number;
  };
  drugs: Array<{
    present: boolean;
    product: string;
    active_ingredient: string;
    evidence: string;
    confidence: number;
  }>;
  events: Array<{
    present: boolean;
    raw_expression: string;
    normalized_event: string;
    meddra_pt_candidate: string;
    evidence: string;
    confidence: number;
  }>;
  special_situation: string | null;
  icsr_status: IcsrCandidateStatus;
  missing_elements: IcsrMissingElement[];
  pv_review_required: true;
  review_route: "POTENTIAL_ICSR_REVIEW" | "POTENTIAL_ICSR_MISSING_ELEMENT" | "NON_OBSERVED_CONTEXT_REVIEW" | "SPECIAL_SITUATION_REVIEW";
  source_metadata: Required<Omit<IcsrSourceMetadata, "username">> & { username: string | null };
  evaluator: {
    version: string;
    stage: "POST_PV_RELEVANCE_DETECTION";
    standard: "ICH E2D(R1) 6.1";
    final_determination_made: false;
  };
  limitations: string[];
};

type EvaluatorConfiguration = {
  evaluatorVersion: string;
  status: string;
  stage: "POST_PV_RELEVANCE_DETECTION";
  standard: "ICH E2D(R1) 6.1";
  legalNameRequiredForPatient: false;
  legalNameRequiredForReporter: false;
  accountContextPolicy: {
    enabled: boolean;
    requiredFields: Array<keyof IcsrSourceMetadata>;
    requiresFirstHandRelationship: boolean;
    status: string;
    confidence: number;
    note: string;
  };
  minimumCandidateConfidence: { drug: number; event: number };
  incompleteCaseReviewRoute: "POTENTIAL_ICSR_MISSING_ELEMENT";
  finalDeterminationPolicy: string;
};

const configuration = evaluatorManifest as EvaluatorConfiguration;

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function validateTimestamp(value: string | null | undefined, field: string, required = true) {
  if (!value) {
    if (required) throw new Error(`${field} is required.`);
    return;
  }
  if (Number.isNaN(new Date(value).getTime())) throw new Error(`${field} must be a valid timestamp.`);
}

function evidenceSupported(mention: string, evidence: string) {
  return Boolean(evidence.trim() && mention.toLocaleLowerCase("en-US").includes(evidence.trim().toLocaleLowerCase("en-US")));
}

function stableAccountContext(source: IcsrSourceMetadata) {
  if (!configuration.accountContextPolicy.enabled) return false;
  return configuration.accountContextPolicy.requiredFields.every((field) => String(source[field] ?? "").trim());
}

function preserveSource(source: IcsrSourceMetadata): IcsrCandidateEvaluation["source_metadata"] {
  validateTimestamp(source.original_post_timestamp, "original_post_timestamp");
  validateTimestamp(source.collection_timestamp, "collection_timestamp");
  validateTimestamp(source.algorithm_timestamp, "algorithm_timestamp");
  validateTimestamp(source.human_review_timestamp, "human_review_timestamp", false);
  validateTimestamp(source.escalation_timestamp, "escalation_timestamp", false);
  if (!source.source_platform.trim() || !source.source_url.trim() || !source.post_id.trim()) throw new Error("source_platform, source_url, and post_id are required for provenance.");
  return {
    username: source.username ?? null,
    source_platform: source.source_platform,
    source_url: source.source_url,
    post_id: source.post_id,
    original_post_timestamp: source.original_post_timestamp,
    collection_timestamp: source.collection_timestamp,
    algorithm_timestamp: source.algorithm_timestamp,
    human_review_timestamp: source.human_review_timestamp || null,
    escalation_timestamp: source.escalation_timestamp || null,
  };
}

function chooseDrugCandidate(mention: string, candidates: IcsrDrugCandidate[]) {
  return supportedDrugCandidates(mention, candidates)[0];
}

function supportedDrugCandidates(mention: string, candidates: IcsrDrugCandidate[]) {
  return candidates
    .filter((candidate) => candidate.suspect && candidate.product.trim() && evidenceSupported(mention, candidate.evidence) && clampConfidence(candidate.confidence) >= configuration.minimumCandidateConfidence.drug)
    .sort((a, b) => b.confidence - a.confidence);
}

function chooseEventCandidate(mention: string, candidates: IcsrEventCandidate[]) {
  return supportedEventCandidates(mention, candidates)[0];
}

function supportedEventCandidates(mention: string, candidates: IcsrEventCandidate[]) {
  return candidates
    .filter((candidate) => candidate.suspected && candidate.raw_expression.trim() && evidenceSupported(mention, candidate.evidence) && clampConfidence(candidate.confidence) >= configuration.minimumCandidateConfidence.event)
    .sort((a, b) => b.confidence - a.confidence);
}

function statusForMissing(missing: IcsrMissingElement[]): IcsrCandidateStatus {
  if (!missing.length) return "POTENTIAL_ICSR_COMPLETE";
  if (missing.length > 1) return "POTENTIAL_ICSR_MULTIPLE_ELEMENTS_MISSING";
  if (missing[0] === "P") return "POTENTIAL_ICSR_MISSING_PATIENT";
  if (missing[0] === "R") return "POTENTIAL_ICSR_MISSING_REPORTER";
  if (missing[0] === "D") return "POTENTIAL_ICSR_MISSING_DRUG";
  return "POTENTIAL_ICSR_MISSING_EVENT";
}

export function getIcsrCandidateEvaluatorConfiguration() {
  return configuration;
}

export function evaluateIcsrCandidate(input: IcsrCandidateEvaluatorInput): IcsrCandidateEvaluation {
  if (input.pv_relevance_detected !== true) throw new Error("The ICSR candidate evaluator may run only after PV relevance detection.");
  const mention = input.mention.trim();
  if (!mention) throw new Error("A source mention is required.");
  const sourceMetadata = preserveSource(input.source);
  const review = input.identifiability_review || {};
  const identifiability = assessIcsrIdentifiability({
    original_verbatim: mention,
    author_identifier: sourceMetadata.username,
    patient_existence_status: review.patient_existence_status,
    patient_verification_evidence: review.patient_verification_evidence,
    reporter_existence_status: review.reporter_existence_status,
    reporter_verification_evidence: review.reporter_verification_evidence,
  });
  const firstHand = identifiability.relationship === "self_report" || identifiability.relationship === "first_hand_other";
  const accountContext = stableAccountContext(input.source);
  const patientByCriterion = identifiability.patient.criterionStatus === "yes";
  const patientByAccount = identifiability.relationship === "self_report" && accountContext;
  const patientVerified = identifiability.patient.status === "verified" && Boolean(review.patient_verification_evidence?.trim());
  const patientPresent = patientByCriterion || patientByAccount || patientVerified;
  const patientBasis: IdentifiabilityBasis = patientVerified ? "VERIFIED_EXISTENCE" : patientByCriterion ? "ICH_QUALIFYING_CHARACTERISTIC" : patientByAccount ? "SOURCE_ACCOUNT_CONTEXT" : "NONE";
  const patientEvidence = [
    ...identifiability.patient.evidence,
    ...(patientByAccount ? [`Self-reported patient linked to ${sourceMetadata.source_platform} account ${sourceMetadata.username}, post ${sourceMetadata.post_id}, and preserved source URL; potentially identifiable pending human confirmation.`] : []),
  ].join(" ");
  const patientConfidence = patientVerified ? 0.98 : patientByCriterion ? 0.88 : patientByAccount ? configuration.accountContextPolicy.confidence : 0;

  const reporterExplicitlyVerified = firstHand
    && (identifiability.reporter.status === "verified" || identifiability.reporter.status === "anonymous_verified")
    && Boolean(review.reporter_verification_evidence?.trim());
  const reporterByAccount = firstHand && accountContext && Boolean(sourceMetadata.username);
  const reporterPresent = reporterExplicitlyVerified || reporterByAccount;
  const reporterBasis: IdentifiabilityBasis = reporterExplicitlyVerified ? "VERIFIED_EXISTENCE" : reporterByAccount ? "SOURCE_ACCOUNT_CONTEXT" : "NONE";
  const reporterEvidence = [
    ...identifiability.reporter.evidence,
    ...(reporterByAccount ? [`First-hand reporter linked to ${sourceMetadata.source_platform} account ${sourceMetadata.username}, post ${sourceMetadata.post_id}, and preserved source URL; potentially identifiable pending human confirmation.`] : []),
  ].join(" ");
  const reporterConfidence = reporterExplicitlyVerified ? 0.98 : reporterByAccount ? configuration.accountContextPolicy.confidence : 0;

  const supportedDrugs = supportedDrugCandidates(mention, input.drug_candidates || []);
  const supportedEvents = supportedEventCandidates(mention, input.event_candidates || []);
  const drugCandidate = chooseDrugCandidate(mention, supportedDrugs);
  const eventCandidate = chooseEventCandidate(mention, supportedEvents);
  const observedContext = input.observation_context === "OBSERVED" || input.observation_context === "POSSIBLE_OBSERVED";
  const drugPresent = Boolean(drugCandidate);
  const eventPresent = observedContext && Boolean(eventCandidate);
  const missing: IcsrMissingElement[] = [];
  if (!patientPresent) missing.push("P");
  if (!reporterPresent) missing.push("R");
  if (!drugPresent) missing.push("D");
  if (!eventPresent) missing.push("E");

  const status: IcsrCandidateStatus = input.observation_context === "SPECIAL_SITUATION"
    ? "SPECIAL_SITUATION_REVIEW"
    : input.observation_context === "NOT_OBSERVED"
      ? "NOT_AN_OBSERVED_EVENT"
      : statusForMissing(missing);
  const reviewRoute: IcsrCandidateEvaluation["review_route"] = status === "SPECIAL_SITUATION_REVIEW"
    ? "SPECIAL_SITUATION_REVIEW"
    : status === "NOT_AN_OBSERVED_EVENT"
      ? "NON_OBSERVED_CONTEXT_REVIEW"
      : missing.length
        ? configuration.incompleteCaseReviewRoute
        : "POTENTIAL_ICSR_REVIEW";
  const limitations = [
    configuration.finalDeterminationPolicy,
    ...identifiability.patient.limitations,
    ...identifiability.reporter.limitations,
  ];
  if (patientByAccount || reporterByAccount) limitations.push(configuration.accountContextPolicy.note);
  if (!drugCandidate) limitations.push("No supported suspect medicinal-product candidate met the configured evidence and confidence gate.");
  if (!eventCandidate) limitations.push("No supported suspected event candidate met the configured evidence and confidence gate.");
  if (input.observation_context === "NOT_OBSERVED") limitations.push("The upstream context classifier identified hypothetical, negated, informational, feared, warned-about, or temporally unrelated language rather than an observed event.");

  return {
    original_mention: input.mention,
    patient: {
      present: patientPresent,
      evidence: patientEvidence,
      confidence: clampConfidence(patientConfidence),
      basis: patientBasis,
      requires_human_confirmation: true,
    },
    reporter: {
      present: reporterPresent,
      evidence: reporterEvidence,
      confidence: clampConfidence(reporterConfidence),
      basis: reporterBasis,
      requires_human_confirmation: true,
    },
    drug: {
      present: drugPresent,
      product: drugCandidate?.product || "",
      active_ingredient: drugCandidate?.active_ingredient || "",
      evidence: drugCandidate?.evidence || "",
      confidence: clampConfidence(drugCandidate?.confidence || 0),
    },
    event: {
      present: eventPresent,
      raw_expression: eventCandidate?.raw_expression || "",
      normalized_event: eventCandidate?.normalized_event || "",
      meddra_pt_candidate: eventCandidate?.meddra_pt_candidate || "",
      evidence: eventCandidate?.evidence || "",
      confidence: clampConfidence(eventCandidate?.confidence || 0),
    },
    drugs: supportedDrugs.map((candidate) => ({
      present: true,
      product: candidate.product,
      active_ingredient: candidate.active_ingredient || "",
      evidence: candidate.evidence,
      confidence: clampConfidence(candidate.confidence),
    })),
    events: supportedEvents.map((candidate) => ({
      present: observedContext,
      raw_expression: candidate.raw_expression,
      normalized_event: candidate.normalized_event,
      meddra_pt_candidate: candidate.meddra_pt_candidate || "",
      evidence: candidate.evidence,
      confidence: clampConfidence(candidate.confidence),
    })),
    special_situation: input.special_situation || null,
    icsr_status: status,
    missing_elements: missing,
    pv_review_required: true,
    review_route: reviewRoute,
    source_metadata: sourceMetadata,
    evaluator: {
      version: configuration.evaluatorVersion,
      stage: configuration.stage,
      standard: configuration.standard,
      final_determination_made: false,
    },
    limitations: [...new Set(limitations.filter(Boolean))],
  };
}
