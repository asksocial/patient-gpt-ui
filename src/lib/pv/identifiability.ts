export type PvIdentifiabilityDimension = {
  status: "supported" | "not_established";
  label: "Identifiable" | "Not established";
  evidence: string[];
  limitations: string[];
};

export type PvIcsrIdentifiabilityAssessment = {
  patient: PvIdentifiabilityDimension;
  reporter: PvIdentifiabilityDimension;
  relationship: "self_report" | "first_hand_other" | "unclear";
  standard: "ICH E2D(R1) 6.1";
};

const FIRST_PERSON = /\b(i|i'm|i am|i've|i have|my|me)\b/i;
const FIRST_HAND_OTHER = /\b(my (?:child|daughter|son|mother|father|wife|husband|partner|patient)|our patient)\b/i;
const AGE = /\b(?:i(?:'m| am)\s+)?(\d{1,3})\s*(?:years? old|y\/?o)\b|\b(?:infant|child|adolescent|teenager|adult|elderly|older adult)\b/i;
const SEX_OR_GENDER = /\b(?:male|female|man|woman|boy|girl|nonbinary|non-binary|transgender|pregnant|pregnancy)\b/i;
const GESTATIONAL_AGE = /\b\d{1,2}\s*weeks?\s*(?:pregnant|gestation)\b/i;
const PATIENT_INITIALS = /\b(?:patient\s+)?[A-Z]\.?\s*[A-Z]\.?\b/;
const CONTACT = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b|\+?\d[\d\s().-]{7,}\d/;
const REPORTER_QUALIFICATION = /\b(?:physician|doctor|dr\.?|nurse|pharmacist|healthcare professional|hcp|lawyer|attorney|consumer|caregiver|parent)\b/i;
const REAL_NAME = /^[A-Z][a-z]+(?:[-'][A-Za-z]+)?(?:\s+[A-Z][a-z]+(?:[-'][A-Za-z]+)?)+$/;
const HANDLE_ONLY = /^@?[\w.-]+$/;

function matchEvidence(text: string, pattern: RegExp, label: string) {
  const match = text.match(pattern);
  return match ? `${label}: “${match[0]}”` : null;
}

export function assessIcsrIdentifiability(record: {
  original_verbatim?: string | null;
  author_identifier?: string | null;
}): PvIcsrIdentifiabilityAssessment {
  const text = String(record.original_verbatim || "");
  const author = String(record.author_identifier || "").trim();
  const selfReport = FIRST_PERSON.test(text);
  const firstHandOther = FIRST_HAND_OTHER.test(text);
  const patientEvidence = [
    matchEvidence(text, AGE, "Age or age category"),
    matchEvidence(text, SEX_OR_GENDER, "Sex, gender, or pregnancy characteristic"),
    matchEvidence(text, GESTATIONAL_AGE, "Gestational age"),
    matchEvidence(text, PATIENT_INITIALS, "Patient initials"),
  ].filter(Boolean) as string[];
  if (selfReport) patientEvidence.unshift("The author describes their own experience, linking the event to one specific patient.");
  else if (firstHandOther) patientEvidence.unshift("The author reports first-hand information about one specific patient.");

  const patientSupported = Boolean((selfReport || firstHandOther) && patientEvidence.length > 1);
  const reporterEvidence: string[] = [];
  if (author && CONTACT.test(author)) reporterEvidence.push(`Reporter contact characteristic: ${author}`);
  if (author && REPORTER_QUALIFICATION.test(author)) reporterEvidence.push(`Reporter qualification: ${author}`);
  if (author && REAL_NAME.test(author)) reporterEvidence.push(`Reporter name: ${author}`);
  if (selfReport) reporterEvidence.push("The reporter states that they personally experienced the event.");
  else if (firstHandOther) reporterEvidence.push("The reporter states that they have first-hand information about the patient.");

  const authorHasQualifier = reporterEvidence.some((item) => item.startsWith("Reporter contact") || item.startsWith("Reporter qualification") || item.startsWith("Reporter name"));
  const reporterSupported = Boolean((selfReport || firstHandOther) && authorHasQualifier);
  const handleOnly = Boolean(author && HANDLE_ONLY.test(author) && !authorHasQualifier);

  return {
    patient: {
      status: patientSupported ? "supported" : "not_established",
      label: patientSupported ? "Identifiable" : "Not established",
      evidence: patientEvidence,
      limitations: patientSupported ? [] : ["A qualifying patient characteristic such as age/age category, sex or gender, initials, date of birth, name, gestational age, or patient identifier was not established."],
    },
    reporter: {
      status: reporterSupported ? "supported" : "not_established",
      label: reporterSupported ? "Identifiable" : "Not established",
      evidence: reporterEvidence,
      limitations: reporterSupported ? [] : [handleOnly
        ? "A digital username or handle alone is insufficient to establish that a real reporter exists."
        : "A reporter name, initials, address/contact characteristic, qualification, or other evidence of a real first-hand reporter was not established."],
    },
    relationship: selfReport ? "self_report" : firstHandOther ? "first_hand_other" : "unclear",
    standard: "ICH E2D(R1) 6.1",
  };
}
