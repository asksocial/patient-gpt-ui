export type PvPatientIdentifiabilityDimension = {
  status: "supported" | "not_established";
  label: "Identifiable" | "Not established";
  evidence: string[];
  limitations: string[];
};

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

const SELF_EXPERIENCE = /\b(?:i|i've|i have|i'm|i am)\b[^.!?\n]{0,180}\b(?:experienced|developed|had|got|suffered|noticed|felt|was diagnosed|was hospitali[sz]ed|took|used|received|started|stopped|underwent|was given|was treated)\b|\b(?:after|following)\s+(?:i\s+)?(?:took|used|received|started|underwent|was given)[^.!?\n]{0,120}\b(?:i|my)\b/i;
const FIRST_HAND_OTHER = /\b(?:my|our)\s+(?:child|daughter|son|mother|father|wife|husband|partner|patient)\b[^.!?\n]{0,180}\b(?:experienced|developed|had|got|suffered|noticed|felt|was diagnosed|was hospitali[sz]ed|took|used|received|started|underwent)|\b(?:i|we)\s+(?:treated|examined|diagnosed|observed|cared for|administered|prescribed to)\s+(?:my\s+|our\s+|the\s+|a\s+)?patient\b|\bpatient\s+(?:i|we)\s+(?:treated|examined|diagnosed|observed|cared for)\b/i;
const SECOND_HAND = /\b(?:reports? online (?:say|said|claim|claimed)|i (?:heard|read|saw) (?:that|about)|someone (?:said|told me|posted)|according to|it was reported that|a report says|people (?:say|said))\b/i;
const AGE = /\b(?:i(?:'m| am)\s+)?(\d{1,3})\s*(?:years? old|y\/?o)\b|\b(?:infant|child|adolescent|teenager|adult|elderly|older adult)\b/i;
const SEX_OR_GENDER = /\b(?:male|female|man|woman|boy|girl|nonbinary|non-binary|transgender|pregnant|pregnancy)\b/i;
const GESTATIONAL_AGE = /\b\d{1,2}\s*weeks?\s*(?:pregnant|gestation)\b/i;
const PATIENT_INITIALS = /\b(?:patient\s+)?[A-Z]\.?\s*[A-Z]\.?\b/;
const AGGREGATE_PATIENT_STATEMENT = /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|several|multiple|many|a few|some)\s+patients?\b/i;
const CONTACT = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b|\+?\d[\d\s().-]{7,}\d/;
const REPORTER_QUALIFICATION = /\b(?:physician|doctor|dr\.?|nurse|pharmacist|healthcare professional|health care professional|hcp|dentist|surgeon|physiotherapist|physical therapist|lawyer|attorney|consumer|caregiver|parent|patient advocate|researcher)\b/i;
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

export function assessIcsrIdentifiability(record: {
  original_verbatim?: string | null;
  author_identifier?: string | null;
  reporter_existence_status?: PvReporterExistenceStatus | null;
  reporter_verification_evidence?: string | null;
}): PvIcsrIdentifiabilityAssessment {
  const text = String(record.original_verbatim || "");
  const author = String(record.author_identifier || "").trim();
  const relationship = reporterRelationship(text);
  const selfReport = relationship === "self_report";
  const firstHandOther = relationship === "first_hand_other";
  const patientEvidence = [
    matchEvidence(text, AGE, "Age or age category"),
    matchEvidence(text, SEX_OR_GENDER, "Sex, gender, or pregnancy characteristic"),
    matchEvidence(text, GESTATIONAL_AGE, "Gestational age"),
    matchEvidence(text, PATIENT_INITIALS, "Patient initials"),
  ].filter(Boolean) as string[];
  if (selfReport) patientEvidence.unshift("The author describes their own experience, linking the event to one specific patient.");
  else if (firstHandOther) patientEvidence.unshift("The author reports first-hand information about one specific patient.");

  const patientSupported = Boolean((selfReport || firstHandOther) && patientEvidence.length > 1);
  const aggregatePatientStatement = AGGREGATE_PATIENT_STATEMENT.test(text);
  const isAnonymous = ANONYMOUS.test(author);
  const qualifyingCharacteristics: string[] = [];
  if (author && CONTACT.test(author)) qualifyingCharacteristics.push(`Contact characteristic: ${author}`);
  if (author && REPORTER_QUALIFICATION.test(author)) qualifyingCharacteristics.push(`Qualification: ${author}`);
  if (author && REPORTER_INITIALS.test(author)) qualifyingCharacteristics.push(`Initials: ${author}`);
  if (author && REAL_NAME.test(author) && !isAnonymous) qualifyingCharacteristics.push(`Name: ${author}`);
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
      status: patientSupported ? "supported" : "not_established",
      label: patientSupported ? "Identifiable" : "Not established",
      evidence: patientEvidence,
      limitations: patientSupported ? [] : [aggregatePatientStatement
        ? "An aggregate or definite-number patient statement does not establish a specific identifiable patient. Obtain patient-specific information before creating an ICSR."
        : "A qualifying patient characteristic such as age/age category, sex or gender, initials, date of birth, name, gestational age, or patient identifier was not established."],
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
