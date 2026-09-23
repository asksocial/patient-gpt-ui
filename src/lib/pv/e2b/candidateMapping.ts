import adapterManifestJson from "../../../../config/pv/icsr-e2b-adapter/manifest.json";
import type { IcsrCandidateEvaluation } from "../icsrEvaluator";
import { getActivePvE2bManifest, getActivePvE2bMapping, getActivePvEmailMapping, getPvE2bMappingEntry } from "./config";
import type { PvE2bMappingEntry } from "./types";

export type E2bUnavailableBehavior = "omit" | "null" | "unknown" | "masked" | "route_for_human_completion";
export type E2bValueSource = "SOURCE" | "AI_NORMALIZED" | "HUMAN_REVIEWED";

export type E2bValueLineage<T = unknown> = {
  source_value: T | null;
  normalized_value: T | null;
  reviewed_value: T | null;
  value_source: E2bValueSource;
  confidence: number;
};

export type IcsrE2bHumanReviewValue = {
  target_field: string;
  occurrence?: number;
  reviewed_value: unknown;
  confidence?: number;
  reviewed_by: string;
  reviewed_at: string;
};

export type IcsrE2bMappingInput = {
  case_id: string;
  candidate: IcsrCandidateEvaluation;
  human_reviewed_values?: IcsrE2bHumanReviewValue[];
  mapped_at?: string;
};

export type IcsrE2bMappedField = {
  target_field: string;
  concrete_field: string;
  occurrence: number | null;
  e2b_element: string | null;
  requirement: PvE2bMappingEntry["requirement"];
  condition: string | null;
  unavailable_behavior: E2bUnavailableBehavior;
  authoritative_unavailable_policy: string;
  human_review_required: boolean;
  value: E2bValueLineage;
  evidence: string | null;
};

export type IcsrE2bValidationError = {
  code: string;
  field: string;
  occurrence: number | null;
  severity: "warning" | "blocking";
  message: string;
  unavailable_behavior: E2bUnavailableBehavior;
};

export type IcsrClientEmailField = {
  field: string;
  label: string;
  value: unknown;
};

export type IcsrClientEmailRepresentation = {
  template_version: string;
  sections: Array<{ name: string; fields: IcsrClientEmailField[] }>;
  disclaimer: string;
};

export type IcsrE2bMappingResult = {
  case_id: string;
  original_social_mention: string;
  target_schema: {
    mapping_version: string;
    ich_package_version: string;
    implementation_guide_version: string;
    controlled_terminology_version: string;
    adapter_version: string;
  };
  candidate_status: IcsrCandidateEvaluation["icsr_status"];
  mapped_fields: IcsrE2bMappedField[];
  provenance: {
    source_metadata: IcsrCandidateEvaluation["source_metadata"];
    evaluator: IcsrCandidateEvaluation["evaluator"];
    limitations: string[];
    coding_suggestions: Array<{ occurrence: number; meddra_pt_candidate: string; confidence: number; human_validation_required: true }>;
    human_reviews: Array<Pick<IcsrE2bHumanReviewValue, "target_field" | "occurrence" | "reviewed_by" | "reviewed_at">>;
    mapped_at: string;
  };
  duplicate: {
    key: string;
    status: "UNIQUE" | "POSSIBLE_DUPLICATE";
    duplicate_of_case_id: string | null;
  };
  validation: {
    mapping_valid: boolean;
    e2b_export_ready: boolean;
    regulatory_submission_ready: false;
    errors: IcsrE2bValidationError[];
  };
  client_email: IcsrClientEmailRepresentation;
};

type AdapterManifest = {
  adapterVersion: string;
  status: "active";
  sourceEvaluatorVersion: string;
  targetMappingVersion: string;
  targetEmailMappingVersion: string;
  stage: "POST_ICSR_CANDIDATE_EVALUATION";
  candidateMappings: Array<{
    candidateField: string;
    targetField: string;
    channel: "source_value" | "normalized_value" | "reviewed_value";
    populatesTarget: boolean;
    note: string;
  }>;
  nonR3ProvenanceFields: string[];
};

const adapterManifest = adapterManifestJson as AdapterManifest;

function isPresent(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function confidence(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value as number));
}

function unavailableBehavior(entry: PvE2bMappingEntry): E2bUnavailableBehavior {
  const policy = entry.unavailableHandling.toLowerCase();
  if (policy.includes("redact") || policy.includes("mask")) return "masked";
  if (policy.includes("block") || policy.includes("prevent") || policy.includes("pending human")) return "route_for_human_completion";
  if (policy.includes("omit")) return "omit";
  if (policy.includes("unknown") || policy.includes("not_reported") || policy.includes("unable_to_determine")) return "unknown";
  return "null";
}

function lineage(sourceValue: unknown, normalizedValue: unknown, review: IcsrE2bHumanReviewValue | undefined, aiConfidence: number, preferSource: boolean): E2bValueLineage {
  const reviewed = review?.reviewed_value ?? null;
  const normalized = normalizedValue ?? null;
  const source = sourceValue ?? null;
  if (isPresent(reviewed)) return { source_value: source, normalized_value: normalized, reviewed_value: reviewed, value_source: "HUMAN_REVIEWED", confidence: confidence(review?.confidence ?? 1) };
  if (preferSource && isPresent(source)) return { source_value: source, normalized_value: normalized, reviewed_value: null, value_source: "SOURCE", confidence: confidence(aiConfidence) };
  if (isPresent(normalized)) return { source_value: source, normalized_value: normalized, reviewed_value: null, value_source: "AI_NORMALIZED", confidence: confidence(aiConfidence) };
  return { source_value: source, normalized_value: null, reviewed_value: null, value_source: "SOURCE", confidence: confidence(aiConfidence) };
}

function selectedValue(value: E2bValueLineage) {
  if (value.value_source === "HUMAN_REVIEWED") return value.reviewed_value;
  if (value.value_source === "AI_NORMALIZED") return value.normalized_value;
  return value.source_value;
}

function reviewKey(targetField: string, occurrence: number | null) {
  return `${targetField}::${occurrence ?? "single"}`;
}

function concreteField(targetField: string, occurrence: number | null) {
  return occurrence === null ? targetField : targetField.replace("[]", `[${occurrence}]`);
}

function requireMapping(targetField: string) {
  const entry = getPvE2bMappingEntry(targetField);
  if (!entry) throw new Error(`The authoritative E2B(R3) specification does not define ${targetField}.`);
  return entry;
}

function duplicateKey(candidate: IcsrCandidateEvaluation) {
  const source = candidate.source_metadata;
  return [source.source_platform, source.post_id, source.source_url].map((value) => value.trim().toLocaleLowerCase("en-US")).join("|");
}

function validateAdapterVersions() {
  const target = getActivePvE2bManifest();
  if (adapterManifest.status !== "active") throw new Error("The ICSR-to-E2B adapter is not active.");
  if (adapterManifest.targetMappingVersion !== target.activeMappingVersion) throw new Error("The adapter target does not match the active authoritative E2B mapping.");
  if (adapterManifest.targetEmailMappingVersion !== target.activeEmailMappingVersion) throw new Error("The adapter target does not match the approved client email template.");
  for (const mapping of adapterManifest.candidateMappings) requireMapping(mapping.targetField);
}

function buildClientEmail(
  input: IcsrE2bMappingInput,
  fields: IcsrE2bMappedField[],
): IcsrClientEmailRepresentation {
  const template = getActivePvEmailMapping();
  const candidate = input.candidate;
  const byConcreteField = new Map(fields.map((field) => [field.concrete_field, field.value]));
  const displayValue = (field: string) => {
    const mapped = byConcreteField.get(field);
    if (mapped) return { value: selectedValue(mapped), value_source: mapped.value_source, confidence: mapped.confidence };
    if (field === "source.platform") return candidate.source_metadata.source_platform;
    if (field === "source.url") return candidate.source_metadata.source_url;
    if (field === "source.verbatim") return candidate.original_mention;
    if (field === "reporter.identifiabilityStatus") return candidate.reporter.present ? "potentially_identifiable_pending_human_confirmation" : "not_established";
    if (field === "patient.identifiabilityStatus") return candidate.patient.present ? "potentially_identifiable_pending_human_confirmation" : "not_established";
    if (field === "drugs") return candidate.drugs.map((drug, occurrence) => ({
      occurrence,
      product: byConcreteField.get(`drugs[${occurrence}].productNameReported`),
      active_ingredient: byConcreteField.get(`drugs[${occurrence}].activeIngredient`),
      role: byConcreteField.get(`drugs[${occurrence}].role`),
    }));
    if (field === "reactions") return candidate.events.filter((event) => event.present).map((event, occurrence) => ({
      occurrence,
      event: byConcreteField.get(`reactions[${occurrence}].verbatim`),
      meddra_pt_candidate: event.meddra_pt_candidate || null,
      human_validation_required: true,
    }));
    if (field === "specialSituations") return candidate.special_situation ? [candidate.special_situation] : [];
    if (field === "classification") return candidate.icsr_status;
    if (field === "review.minimumCriteriaDetected") return ["P", "R", "D", "E"].filter((value) => !candidate.missing_elements.includes(value as "P" | "R" | "D" | "E"));
    if (field === "review.minimumCriteriaMissing") return candidate.missing_elements;
    if (field === "review.seriousnessFlag") return undefined;
    if (field === "review.specialSituationFlag") return candidate.icsr_status === "SPECIAL_SITUATION_REVIEW";
    if (field === "review.causalityStatementPresent") return "not_assessed_by_candidate_evaluator";
    if (field === "review.status") return candidate.source_metadata.human_review_timestamp ? "human_reviewed" : "requires_human_review";
    return undefined;
  };
  const meaningful = (value: unknown) => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== "";
  const sections = new Map<string, { name: string; fields: IcsrClientEmailField[] }>();
  for (const config of [...template.fields].sort((a, b) => a.order - b.order)) {
    const value = displayValue(config.field);
    const include = config.include === "always"
      ? meaningful(value) || config.displayUnknown === true
      : config.include === "when_present"
        ? meaningful(value)
        : config.include === "when_flagged"
          ? (Array.isArray(value) ? value.length > 0 : value === true)
          : false;
    if (!include) continue;
    const section = sections.get(config.section) || { name: config.section, fields: [] };
    section.fields.push({ field: config.field, label: config.label, value: meaningful(value) ? value : "Not reported" });
    sections.set(config.section, section);
  }
  return {
    template_version: template.emailMappingVersion,
    sections: [...sections.values()].filter((section) => section.fields.length > 0),
    disclaimer: template.disclaimer,
  };
}

function mapCandidate(input: IcsrE2bMappingInput, mappedAt: string): IcsrE2bMappingResult {
  validateAdapterVersions();
  const candidate = input.candidate;
  const reviews = new Map((input.human_reviewed_values || []).map((review) => [reviewKey(review.target_field, review.occurrence ?? null), review]));
  const fields: IcsrE2bMappedField[] = [];
  const errors: IcsrE2bValidationError[] = [];

  const addField = (targetField: string, sourceValue: unknown, normalizedValue: unknown, aiConfidence: number, evidence: string | null, occurrence: number | null = null, preferSource = false) => {
    const entry = requireMapping(targetField);
    const review = reviews.get(reviewKey(targetField, occurrence));
    const value = lineage(sourceValue, normalizedValue, review, aiConfidence, preferSource);
    fields.push({
      target_field: targetField,
      concrete_field: concreteField(targetField, occurrence),
      occurrence,
      e2b_element: entry.e2bElement,
      requirement: entry.requirement,
      condition: entry.condition,
      unavailable_behavior: unavailableBehavior(entry),
      authoritative_unavailable_policy: entry.unavailableHandling,
      human_review_required: entry.humanReviewRequired,
      value,
      evidence,
    });
  };

  addField("administrative.askSocialCaseId", input.case_id, null, 1, null);
  addField("narrative.caseNarrative", candidate.original_mention, null, 1, candidate.original_mention);
  addField("narrative.reporterComments", candidate.original_mention, null, 1, candidate.original_mention);
  addField("audit.sourcePublishedAt", candidate.source_metadata.original_post_timestamp, null, 1, null);
  addField("audit.collectedAt", candidate.source_metadata.collection_timestamp, null, 1, null);
  addField("audit.algorithmAssessedAt", candidate.source_metadata.algorithm_timestamp, null, 1, null);
  if (candidate.source_metadata.human_review_timestamp) addField("audit.humanReviewedAt", candidate.source_metadata.human_review_timestamp, null, 1, null);
  if (candidate.source_metadata.escalation_timestamp) addField("audit.escalatedAt", candidate.source_metadata.escalation_timestamp, null, 1, null);

  candidate.drugs.forEach((drug, occurrence) => {
    addField("drugs[].role", null, "suspect", drug.confidence, drug.evidence, occurrence);
    addField("drugs[].productNameReported", drug.evidence, drug.product, drug.confidence, drug.evidence, occurrence, true);
    if (drug.active_ingredient) addField("drugs[].activeIngredient", null, drug.active_ingredient, drug.confidence, drug.evidence, occurrence);
  });
  candidate.events.filter((event) => event.present).forEach((event, occurrence) => {
    addField("reactions[].verbatim", event.raw_expression, event.normalized_event, event.confidence, event.evidence, occurrence, true);
  });

  for (const review of input.human_reviewed_values || []) {
    const entry = getPvE2bMappingEntry(review.target_field);
    if (!entry) {
      errors.push({ code: "UNKNOWN_REVIEW_TARGET", field: review.target_field, occurrence: review.occurrence ?? null, severity: "blocking", message: "Human-reviewed value targets a field not defined by the authoritative E2B(R3) mapping.", unavailable_behavior: "route_for_human_completion" });
      continue;
    }
    const key = reviewKey(review.target_field, review.occurrence ?? null);
    if (!fields.some((field) => reviewKey(field.target_field, field.occurrence) === key)) addField(review.target_field, null, null, 0, null, review.occurrence ?? null);
  }

  if (!input.case_id.trim()) errors.push({ code: "MISSING_CASE_ID", field: "administrative.askSocialCaseId", occurrence: null, severity: "blocking", message: "AskSocial case ID is required.", unavailable_behavior: "route_for_human_completion" });
  if (candidate.evaluator.version !== adapterManifest.sourceEvaluatorVersion) errors.push({ code: "UNSUPPORTED_CANDIDATE_VERSION", field: "evaluator.version", occurrence: null, severity: "blocking", message: `Candidate evaluator version ${candidate.evaluator.version} is not supported by adapter ${adapterManifest.adapterVersion}.`, unavailable_behavior: "route_for_human_completion" });
  if (!candidate.original_mention.trim()) errors.push({ code: "MISSING_ORIGINAL_MENTION", field: "narrative.caseNarrative", occurrence: null, severity: "blocking", message: "The original social mention must be retained.", unavailable_behavior: "route_for_human_completion" });
  for (const [field, value] of Object.entries({
    "audit.sourcePublishedAt": candidate.source_metadata.original_post_timestamp,
    "audit.collectedAt": candidate.source_metadata.collection_timestamp,
    "audit.algorithmAssessedAt": candidate.source_metadata.algorithm_timestamp,
  })) {
    if (!value || Number.isNaN(new Date(value).getTime())) errors.push({ code: "MALFORMED_TIMESTAMP", field, occurrence: null, severity: "blocking", message: `${field} must contain a valid, independently preserved timestamp.`, unavailable_behavior: "route_for_human_completion" });
  }
  for (const review of input.human_reviewed_values || []) {
    if (!review.reviewed_by.trim() || Number.isNaN(new Date(review.reviewed_at).getTime())) errors.push({ code: "MALFORMED_HUMAN_REVIEW", field: review.target_field, occurrence: review.occurrence ?? null, severity: "blocking", message: "Human-reviewed values require reviewer identity and a valid review timestamp.", unavailable_behavior: "route_for_human_completion" });
  }

  const target = getActivePvE2bMapping();
  const required = target.mappings.filter((entry) => entry.requirement === "required" && entry.regulatorySource === "ICH");
  for (const entry of required) {
    const occurrenceCount = entry.askSocialField.startsWith("drugs[]")
      ? Math.max(candidate.drugs.length, 1)
      : entry.askSocialField.startsWith("reactions[]")
        ? Math.max(candidate.events.filter((event) => event.present).length, 1)
        : 1;
    for (let index = 0; index < occurrenceCount; index += 1) {
      const occurrence = entry.cardinality === "repeating" ? index : null;
      const mapped = fields.find((field) => field.target_field === entry.askSocialField && field.occurrence === occurrence);
      if (!mapped || !isPresent(selectedValue(mapped.value))) errors.push({
        code: "EXPECTED_R3_FIELD_UNAVAILABLE",
        field: entry.askSocialField,
        occurrence,
        severity: "blocking",
        message: `${entry.displayName} (${entry.e2bElement}) cannot be populated from the current candidate and requires downstream or human completion.`,
        unavailable_behavior: unavailableBehavior(entry),
      });
    }
  }
  if (candidate.patient.present && !candidate.patient.evidence.trim()) errors.push({ code: "PATIENT_EVIDENCE_MISSING", field: "patient", occurrence: null, severity: "blocking", message: "Patient presence cannot be mapped without supporting evidence.", unavailable_behavior: "route_for_human_completion" });
  if (candidate.reporter.present && !candidate.reporter.evidence.trim()) errors.push({ code: "REPORTER_EVIDENCE_MISSING", field: "reporter", occurrence: null, severity: "blocking", message: "Reporter presence cannot be mapped without supporting evidence.", unavailable_behavior: "route_for_human_completion" });
  if (candidate.events.some((event) => event.meddra_pt_candidate)) errors.push({ code: "MEDDRA_CODING_REQUIRES_HUMAN_VALIDATION", field: "reactions[].meddraCode", occurrence: null, severity: "blocking", message: "A MedDRA PT-name candidate is preserved as a suggestion but cannot populate the MedDRA code or version fields.", unavailable_behavior: "route_for_human_completion" });
  for (const field of fields.filter((item) => item.e2b_element && item.human_review_required && item.value.value_source !== "HUMAN_REVIEWED")) {
    errors.push({
      code: "HUMAN_REVIEW_REQUIRED",
      field: field.target_field,
      occurrence: field.occurrence,
      severity: "blocking",
      message: `${field.concrete_field} contains preserved source or AI-normalized material but requires a human-reviewed value before E2B export.`,
      unavailable_behavior: "route_for_human_completion",
    });
  }

  const manifest = getActivePvE2bManifest();
  const result: IcsrE2bMappingResult = {
    case_id: input.case_id,
    original_social_mention: candidate.original_mention,
    target_schema: {
      mapping_version: manifest.activeMappingVersion,
      ich_package_version: manifest.ichPackageVersion,
      implementation_guide_version: manifest.ichImplementationGuideVersion,
      controlled_terminology_version: manifest.ichControlledTerminologyVersion,
      adapter_version: adapterManifest.adapterVersion,
    },
    candidate_status: candidate.icsr_status,
    mapped_fields: fields,
    provenance: {
      source_metadata: structuredClone(candidate.source_metadata),
      evaluator: structuredClone(candidate.evaluator),
      limitations: [...candidate.limitations],
      coding_suggestions: candidate.events.map((event, occurrence) => ({ occurrence, meddra_pt_candidate: event.meddra_pt_candidate, confidence: event.confidence, human_validation_required: true as const })).filter((item) => item.meddra_pt_candidate),
      human_reviews: (input.human_reviewed_values || []).map(({ target_field, occurrence, reviewed_by, reviewed_at }) => ({ target_field, occurrence, reviewed_by, reviewed_at })),
      mapped_at: mappedAt,
    },
    duplicate: { key: duplicateKey(candidate), status: "UNIQUE", duplicate_of_case_id: null },
    validation: {
      mapping_valid: !errors.some((error) => error.code.startsWith("MALFORMED") || error.code === "MISSING_CASE_ID" || error.code === "MISSING_ORIGINAL_MENTION" || error.code === "UNKNOWN_REVIEW_TARGET" || error.code === "UNSUPPORTED_CANDIDATE_VERSION"),
      e2b_export_ready: errors.length === 0,
      regulatory_submission_ready: false,
      errors,
    },
    client_email: { template_version: "", sections: [], disclaimer: "" },
  };
  result.client_email = buildClientEmail(input, fields);
  return result;
}

export function getIcsrE2bAdapterManifest() {
  validateAdapterVersions();
  return adapterManifest;
}

export function mapIcsrCandidateToE2b(input: IcsrE2bMappingInput): IcsrE2bMappingResult {
  const mappedAt = input.mapped_at || new Date().toISOString();
  if (Number.isNaN(new Date(mappedAt).getTime())) throw new Error("mapped_at must be a valid timestamp.");
  return mapCandidate(input, mappedAt);
}

export function mapIcsrCandidateBatchToE2b(inputs: IcsrE2bMappingInput[]): IcsrE2bMappingResult[] {
  const seen = new Map<string, string>();
  return inputs.map((input) => {
    const result = mapIcsrCandidateToE2b(input);
    const priorCaseId = seen.get(result.duplicate.key);
    if (priorCaseId) {
      result.duplicate.status = "POSSIBLE_DUPLICATE";
      result.duplicate.duplicate_of_case_id = priorCaseId;
      result.validation.errors.push({
        code: "POSSIBLE_DUPLICATE_CASE",
        field: "source_metadata",
        occurrence: null,
        severity: "warning",
        message: `Source provenance matches retained case ${priorCaseId}; human duplicate assessment is required.`,
        unavailable_behavior: "route_for_human_completion",
      });
      result.validation.e2b_export_ready = false;
    } else {
      seen.set(result.duplicate.key, result.case_id);
    }
    return result;
  });
}
