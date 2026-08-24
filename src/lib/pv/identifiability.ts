export type PvPatientIdentifiabilityDimension = {
  status: PvPatientExistenceStatus;
  label: "Existence verified" | "Identifiable — qualifying characteristic detected" | "Characteristics detected — patient association pending" | "Not established";
  evidence: string[];
  limitations: string[];
  association: PvPatientAssociation;
  associationLabel: "Associated with one specific patient" | "Aggregate patient statement" | "Specific-patient association not established";
  characteristicTypes: PvPatientCharacteristicType[];
  qualifyingCharacteristics: string[];
  verificationEvidence: string;
  criterionStatus: PvPatientCriterionStatus;
};

export type PvPatientExistenceStatus = "verified" | "characteristics_detected" | "not_established";
export type PvPatientAssociation = "specific_patient" | "aggregate_patients" | "unclear";
export type PvPatientCharacteristicType = "age_or_age_category" | "gestational_age" | "sex_or_gender" | "initials" | "date_of_birth" | "name" | "patient_identifier" | "regional_or_local_identifier";
export type PvPatientCriterionStatus = "yes" | "no" | "unclear";

export type PvReporterRelationship = "self_report" | "first_hand_other" | "second_hand" | "unclear";
export type PvReporterExistenceStatus = "verified" | "anonymous_verified" | "characteristics_detected" | "not_established";
export type PvReporterCriterionStatus = "yes" | "no" | "unclear";

export type PvReporterIdentifiabilityDimension = {
  status: PvReporterExistenceStatus;
  label: "Verified" | "Anonymous — existence verified" | "Characteristics detected — verification pending" | "Not established";
  evidence: string[];
  limitations: string[];
  relationship: PvReporterRelationship;
  relationshipLabel: "Experienced the event" | "First-hand information about another patient" | "Second-hand information" | "First-hand relationship not established";
  qualifyingCharacteristics: string[];
  isAnonymous: boolean;
  verificationEvidence: string;
};

export type PvIcsrIdentifiabilityAssessment = {
  patient: PvPatientIdentifiabilityDimension;
  reporter: PvReporterIdentifiabilityDimension;
  relationship: PvReporterRelationship;
  standard: "ICH E2D(R1) 6.1";
};

export type PvReporterReviewAssessment = {
  relationship?: PvReporterRelationship;
  existenceStatus?: PvReporterExistenceStatus;
  identifierBasis?: string;
  verificationEvidence?: string;
};

export type PvPatientReviewAssessment = {
  association?: PvPatientAssociation;
  existenceStatus?: PvPatientExistenceStatus;
  characteristicTypes?: PvPatientCharacteristicType[];
  identifierBasis?: string;
  verificationEvidence?: string;
};

const SELF_EXPERIENCE = /\b(?:i|i've|i have|i'm|i am)\b[^\n]{0,180}\b(?:experienced|developed|had|got|suffered|noticed|felt|was diagnosed|was hospitali[sz]ed|took|used|received|started|stopped|underwent|was given|was treated)\b|\b(?:after|following)\s+(?:i\s+)?(?:took|used|received|started|underwent|was given)[^\n]{0,120}\b(?:i|my)\b/i;
const FIRST_HAND_OTHER = /\b(?:my|our)\s+(?:child|daughter|son|mother|father|wife|husband|partner|patient)\b[^\n]{0,180}\b(?:experienced|developed|had|got|suffered|noticed|felt|was diagnosed|was hospitali[sz]ed|took|used|received|started|underwent)|\b(?:i|we)\s+(?:treated|examined|diagnosed|observed|cared for|administered|prescribed to)\s+(?:my\s+|our\s+|the\s+|a\s+)?patient\b|\bpatient\s+(?:i|we)\s+(?:treated|examined|diagnosed|observed|cared for)\b/i;
const SECOND_HAND = /\b(?:reports? online (?:say|said|claim|claimed)|i (?:heard|read|saw) (?:that|about)|someone (?:said|told me|posted)|according to|it was reported that|a report says|people (?:say|said))\b/i;
const AGE = /\b(?:aged?|age)\s*[:=#-]?\s*\d{1,3}\b|\b\d{1,3}(?:[-\s]+(?:year|yr)s?[-\s]+old|\s*y\/?o)\b|\b(?:i am|i'm|patient is|patient was)\s+(?:a\s+|an\s+)?\d{1,3}\b|\b(?:infant|child|adolescent|teenager|adult|elderly|older adult)\b/i;
const SEX_OR_GENDER = /\b(?:male|female|man|woman|boy|girl|nonbinary|non-binary|transgender|pregnant|pregnancy)\b/i;
const GESTATIONAL_AGE = /\b\d{1,2}\s*weeks?\s*(?:pregnant|gestation)\b/i;
const PATIENT_INITIALS = /\b(?:patient(?:'s)?\s+initials?|initials?|(?:my|our|the|a)\s+patient)\s*[:=#-]?\s*((?:[A-Z]\.){2,4})(?=\s|[,;:]|$)/i;
const PATIENT_DATE_OF_BIRTH = /\b(?:date of birth|d\.?o\.?b\.?)\s*[:=#-]?\s*(?:\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b|\bborn\s+on\s+(?:\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/i;
const PATIENT_IDENTIFIER = /\bpatient(?:\s+identification|\s+identifier|\s+id|\s+number|\s+no\.?)\s*[:=#-]?\s*([A-Z0-9][A-Z0-9_-]{2,})\b/i;
const PATIENT_NAME = /\b(?:(?:my|our|the|a)\s+patient|patient)\s+(?:named\s+|name\s*(?:is|:|=)\s*)?([\p{L}][\p{L}'’-]+(?:\s+[\p{L}][\p{L}'’-]+){1,3})(?=\s+(?:experienced|developed|had|got|suffered|noticed|felt|was diagnosed|was hospitali[sz]ed|took|used|received|started|underwent)\b|[,;]|$)/iu;
const AGGREGATE_PATIENT_STATEMENT = /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|several|multiple|many|a few|some)\s+patients?\b/i;
const SPECIFIC_PATIENT_EVENT = /\b(?:patient|subject|individual)\b[^\n]{0,180}\b(?:experienced|developed|had|got|suffered|noticed|felt|was diagnosed|was hospitali[sz]ed|took|used|received|started|underwent)\b/i;
const CONTACT = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b|\+?\d[\d\s().-]{7,}\d/;
const REPORTER_QUALIFICATION = /\b(?:physician|doctor|dr\.?|m\.?d\.?|nurse|r\.?n\.?|pharmacist|healthcare professional|health care professional|hcp|dentist|surgeon|physio|physiotherapist|physical therapist|lawyer|attorney|consumer|caregiver|parent|patient advocate|researcher)\b/i;
const REPORTER_INITIALS = /^(?:[\p{L}]\.?\s*){2,4}$/u;
const REAL_NAME = /^[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+)+$/u;
const ORGANIZATION_OR_DEPARTMENT = /\b(?:organisation|organization|department|clinic|hospital|medical cent(?:er|re)|practice|pharmacy|university|law firm|health system)\b/i;
const ADDRESS_OR_LOCATION = /\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|city|state|province|postcode|postal code|region|country)\b/i;
const HANDLE_ONLY = /^@?[\w.-]+$/;
const ANONYMOUS = /^(?:anonymous|anon(?:ymous)? reporter|name withheld|identity withheld|confidential reporter)$/i;

function matchEvidence(text: string, pattern: RegExp, label: string) {
  const match = text.match(pattern);
  return match ? `${label}: “${match[0]}”` : null;
}

function reporterRelationship(text: string): PvReporterRelationship {
  if (SECOND_HAND.test(text)) return "second_hand";
  if (SELF_EXPERIENCE.test(text)) return "self_report";
  if (FIRST_HAND_OTHER.test(text)) return "first_hand_other";
  return "unclear";
}

function relationshipLabel(relationship: PvReporterRelationship): PvReporterIdentifiabilityDimension["relationshipLabel"] {
  if (relationship === "self_report") return "Experienced the event";
  if (relationship === "first_hand_other") return "First-hand information about another patient";
  if (relationship === "second_hand") return "Second-hand information";
  return "First-hand relationship not established";
}

export function reporterCriterionStatus(assessment: PvReporterReviewAssessment): PvReporterCriterionStatus {
  const firstHand = assessment.relationship === "self_report" || assessment.relationship === "first_hand_other";
  const verificationEvidence = String(assessment.verificationEvidence || "").trim();
  const identifierBasis = String(assessment.identifierBasis || "").trim();
  if (firstHand && assessment.existenceStatus === "anonymous_verified" && verificationEvidence) return "yes";
  if (firstHand && assessment.existenceStatus === "verified" && identifierBasis && verificationEvidence) return "yes";
  if (assessment.relationship === "second_hand" || assessment.existenceStatus === "not_established") return "no";
  return "unclear";
}

function patientCharacteristics(text: string) {
  const candidates: Array<[PvPatientCharacteristicType, RegExp, string]> = [
    ["age_or_age_category", AGE, "Age or age category"],
    ["gestational_age", GESTATIONAL_AGE, "Gestational age"],
    ["sex_or_gender", SEX_OR_GENDER, "Sex, gender, or pregnancy characteristic"],
    ["initials", PATIENT_INITIALS, "Patient initials"],
    ["date_of_birth", PATIENT_DATE_OF_BIRTH, "Date of birth"],
    ["name", PATIENT_NAME, "Patient name"],
    ["patient_identifier", PATIENT_IDENTIFIER, "Patient identification number"],
  ];
  return candidates.flatMap(([type, pattern, evidenceLabel]) => {
    const evidence = matchEvidence(text, pattern, evidenceLabel);
    return evidence ? [{ type, evidence }] : [];
  });
}

function patientAssociationLabel(association: PvPatientAssociation): PvPatientIdentifiabilityDimension["associationLabel"] {
  if (association === "specific_patient") return "Associated with one specific patient";
  if (association === "aggregate_patients") return "Aggregate patient statement";
  return "Specific-patient association not established";
}

export function patientCriterionStatus(assessment: PvPatientReviewAssessment): PvPatientCriterionStatus {
  if (assessment.association === "aggregate_patients" || assessment.existenceStatus === "not_established") return "no";
  if (assessment.association !== "specific_patient") return "unclear";
  if (!assessment.characteristicTypes?.length || !String(assessment.identifierBasis || "").trim()) return "unclear";
  if (assessment.existenceStatus === "characteristics_detected") return "yes";
  if (assessment.existenceStatus === "verified" && String(assessment.verificationEvidence || "").trim()) return "yes";
  return "unclear";
}

export function assessIcsrIdentifiability(record: {
  original_verbatim?: string | null;
  author_identifier?: string | null;
  reporter_existence_status?: PvReporterExistenceStatus | null;
  reporter_verification_evidence?: string | null;
  patient_existence_status?: PvPatientExistenceStatus | null;
  patient_verification_evidence?: string | null;
}): PvIcsrIdentifiabilityAssessment {
  const text = String(record.original_verbatim || "");
  const author = String(record.author_identifier || "").trim();
  const relationship = reporterRelationship(text);
  const selfReport = relationship === "self_report";
  const firstHandOther = relationship === "first_hand_other";
  const detectedPatientCharacteristics = patientCharacteristics(text);
  const patientCharacteristicTypes = detectedPatientCharacteristics.map((item) => item.type);
  const patientQualifyingCharacteristics = detectedPatientCharacteristics.map((item) => item.evidence);
  const aggregatePatientStatement = AGGREGATE_PATIENT_STATEMENT.test(text);
  const patientAssociation: PvPatientAssociation = aggregatePatientStatement
    ? "aggregate_patients"
    : selfReport || firstHandOther || SPECIFIC_PATIENT_EVENT.test(text)
      ? "specific_patient"
      : "unclear";
  const patientExistenceStatus: PvPatientExistenceStatus = record.patient_existence_status === "verified" && patientQualifyingCharacteristics.length
    ? "verified"
    : patientQualifyingCharacteristics.length
      ? "characteristics_detected"
      : "not_established";
  const patientCriterion = patientCriterionStatus({
    association: patientAssociation,
    existenceStatus: patientExistenceStatus,
    characteristicTypes: patientCharacteristicTypes,
    identifierBasis: patientQualifyingCharacteristics.join("; "),
    verificationEvidence: String(record.patient_verification_evidence || ""),
  });
  const patientEvidence: string[] = [];
  if (selfReport) patientEvidence.unshift("The author describes their own experience, linking the event to one specific patient.");
  else if (firstHandOther) patientEvidence.unshift("The author reports first-hand information about one specific patient.");
  else if (patientAssociation === "specific_patient") patientEvidence.unshift("The source associates the event with one specifically described patient.");
  patientEvidence.push(...patientQualifyingCharacteristics);
  if (record.patient_verification_evidence) patientEvidence.push(`Existence verification: ${record.patient_verification_evidence}`);
  const patientLimitations: string[] = [];
  if (patientAssociation === "aggregate_patients") patientLimitations.push("An aggregate or definite-number patient statement does not establish a specific identifiable patient. Obtain patient-specific information before creating an ICSR.");
  else if (patientAssociation === "unclear") patientLimitations.push("Confirm that the AE/ADR or observation is associated with one specific patient.");
  if (!patientCharacteristicTypes.length) patientLimitations.push("Obtain at least one qualifying patient characteristic: age or age category, gestational age, sex, initials, date of birth, name, patient identification number, or another identifier permitted by regional or local requirements.");
  if (patientExistenceStatus === "verified" && !record.patient_verification_evidence) patientLimitations.push("Document the evidence used to verify that the patient exists, or retain the status as qualifying characteristics detected.");
  const isAnonymous = ANONYMOUS.test(author);
  const qualifyingCharacteristics: string[] = [];
  if (author && CONTACT.test(author)) qualifyingCharacteristics.push(`Contact characteristic: ${author}`);
  if (author && REPORTER_QUALIFICATION.test(author)) qualifyingCharacteristics.push(`Qualification: ${author}`);
  if (author && REPORTER_INITIALS.test(author)) qualifyingCharacteristics.push(`Initials: ${author}`);
  const looksLikeProfessionalOrOrganisation = /^(?:the)\b/i.test(author) || ORGANIZATION_OR_DEPARTMENT.test(author) || REPORTER_QUALIFICATION.test(author);
  if (author && REAL_NAME.test(author) && !isAnonymous && !looksLikeProfessionalOrOrganisation) qualifyingCharacteristics.push(`Name: ${author}`);
  if (author && ORGANIZATION_OR_DEPARTMENT.test(author)) qualifyingCharacteristics.push(`Organisation or department: ${author}`);
  if (author && ADDRESS_OR_LOCATION.test(author)) qualifyingCharacteristics.push(`Address or location characteristic: ${author}`);

  const explicitExistence = record.reporter_existence_status;
  const existenceStatus: PvReporterExistenceStatus = explicitExistence === "verified" || explicitExistence === "anonymous_verified"
    ? explicitExistence
    : qualifyingCharacteristics.length
      ? "characteristics_detected"
      : "not_established";
  const reporterEvidence = [
    relationship === "self_report" ? "The source language indicates that the reporter personally experienced the event."
      : relationship === "first_hand_other" ? "The source language indicates first-hand information about another patient."
        : relationship === "second_hand" ? "The source language indicates second-hand information rather than first-hand knowledge."
          : "The source does not establish that the author experienced the event or has first-hand information.",
    ...(author ? [`Source author identifier: ${author}`] : []),
    ...qualifyingCharacteristics.map((item) => `Reporter ${item.charAt(0).toLowerCase()}${item.slice(1)}`),
  ];
  if (isAnonymous) reporterEvidence.push("The reporter is presented as anonymous; existence must be verified independently before the reporter criterion is met.");
  if (record.reporter_verification_evidence) reporterEvidence.push(`Existence verification: ${record.reporter_verification_evidence}`);

  const handleOnly = Boolean(author && HANDLE_ONLY.test(author) && !qualifyingCharacteristics.length && !isAnonymous);
  const reporterLimitations: string[] = [];
  if (relationship === "second_hand") reporterLimitations.push("The information is second-hand. Where permissible and feasible, obtain first-hand confirmation from a primary source.");
  else if (relationship === "unclear") reporterLimitations.push("Confirm that the person providing the information experienced the event or has first-hand knowledge about it.");
  if (existenceStatus === "characteristics_detected") reporterLimitations.push("Qualifying reporter characteristics were detected, but the existence of a real reporter remains to be verified.");
  else if (existenceStatus === "not_established") reporterLimitations.push(handleOnly
    ? "A digital username or handle alone is insufficient to establish that a real reporter exists."
    : "Obtain at least one qualifying reporter characteristic and evidence that a real reporter exists.");

  return {
    patient: {
      status: patientExistenceStatus,
      label: patientExistenceStatus === "verified" ? "Existence verified"
        : patientCriterion === "yes" ? "Identifiable — qualifying characteristic detected"
          : patientExistenceStatus === "characteristics_detected" ? "Characteristics detected — patient association pending"
            : "Not established",
      evidence: patientEvidence,
      limitations: patientLimitations,
      association: patientAssociation,
      associationLabel: patientAssociationLabel(patientAssociation),
      characteristicTypes: patientCharacteristicTypes,
      qualifyingCharacteristics: patientQualifyingCharacteristics,
      verificationEvidence: String(record.patient_verification_evidence || ""),
      criterionStatus: patientCriterion,
    },
    reporter: {
      status: existenceStatus,
      label: existenceStatus === "verified" ? "Verified"
        : existenceStatus === "anonymous_verified" ? "Anonymous — existence verified"
          : existenceStatus === "characteristics_detected" ? "Characteristics detected — verification pending"
            : "Not established",
      evidence: reporterEvidence,
      limitations: reporterLimitations,
      relationship,
      relationshipLabel: relationshipLabel(relationship),
      qualifyingCharacteristics,
      isAnonymous,
      verificationEvidence: String(record.reporter_verification_evidence || ""),
    },
    relationship,
    standard: "ICH E2D(R1) 6.1",
  };
}
