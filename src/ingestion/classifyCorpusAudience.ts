import { segmentAudience, type AudienceRole } from "./audienceSegments";
import type { Glp1AudienceClassification } from "./glp1Audience";
import type { DiseaseProfile } from "./profiles/types";

const PERSONAL = /\bi (?:have|had|take|took|started|tried|use|used|received|underwent|was diagnosed|am living|am considering|want to try)\b|\bmy (?:symptoms|treatment|medication|diagnosis|injection|surgery|recovery|dose)\b|\bas a patient\b/iu;
const CARE = /\b(?:my (?:mother|father|mom|dad|child|son|daughter|wife|husband|partner)|as a caregiver)\b.{0,100}\b(?:treatment|diagnos\w*|taking|takes|surgery|symptoms|care|therapy)\b/iu;
const PROMO = /\b(?:buy now|shop now|book now|promo code|discount code|dm to order|affiliate|free consultation)\b/iu;
const REPORTED = /\b(?:patient|patients|woman|man|she|he|they)\b.{0,70}\b(?:diagnosed|underwent|treatment experience|recovery|side effects|taking|took|started treatment)\b/iu;
const contains = (text: string, terms: string[]) => terms.some(term => term.trim() && text.includes(term.toLowerCase()));

/** Topic-aware source attribution shared by all disease profiles. Explicit
 * source metadata takes precedence; text alone never establishes credentials. */
export function classifyCorpusAudience(fields: Record<string, unknown>, profile: DiseaseProfile, context: { retained?: boolean; persona?: string[] } = {}): Glp1AudienceClassification {
  const text = [fields.Title, fields["Opening Text"], fields["Hit Sentence"]].filter(Boolean).join(" ").normalize("NFKC");
  const lower = text.toLowerCase();
  const quoted = /^\s*(?:RT|QT)\s+@/iu.test(text) || /^quote$/iu.test(String(fields["Content Type"] || ""));
  const own = quoted ? text.includes(";") ? text.slice(text.indexOf(";") + 1) : "" : text;
  const profileTerms = [...profile.diseaseNames, ...(profile.brands || []), ...(profile.medications || []), ...(profile.procedures || []), ...Object.values(profile.treatmentPatterns || {}).flat()];
  const relevant = context.retained || contains(lower, profileTerms);
  const clinicalSpeech = /\bi (?:have (?:treated|prescribed|seen|diagnosed|administered)|treat|prescribe|diagnose|administer)\b|\b(?:my|our) patients\b/iu.test(own);
  const personal = relevant && !clinicalSpeech && (PERSONAL.test(own) || contains(own.toLowerCase(), profile.patientIndicators || []));
  const caregiver = relevant && CARE.test(own);
  const promo = PROMO.test(text);
  const publication = /news|journal|press release|research/i.test(String(fields["Source Type"] || ""));
  const prior = (context.persona || []).map(role => role.toLowerCase());
  let audience: AudienceRole = !relevant ? "off_topic" : caregiver ? "caregiver" : personal ? "patient" : publication ? "media_or_research" : "general_discussion";
  // Canonical persona fields supply a content designation for retained
  // records, without asserting a verified author identity.
  if (context.retained && !personal && !caregiver) {
    if (prior.some(role => /caregiver|family/.test(role))) audience = "caregiver";
    else if (prior.some(role => /^patient$|prospective.patient/.test(role))) audience = "patient";
  }
  const patientContent = Boolean(relevant && (personal || caregiver || REPORTED.test(text) || quoted && PERSONAL.test(text) || audience === "patient" || audience === "caregiver"));
  if (promo && relevant && !patientContent) audience = "company_or_commercial";
  const eligiblePatientVoice = Boolean((personal || caregiver) && !promo);
  const base = {
    version: "corpus-audience-2026-10-22.1", audience,
    designation: !relevant ? "outside_topic_context" : quoted && patientContent ? "reshared_patient_account" : promo ? "commercial_or_promotional" : personal ? "likely_personal_experience" : caregiver ? "likely_caregiver_experience" : "source_attribution",
    patientContent, eligiblePatientVoice, confidence: eligiblePatientVoice ? 0.72 : 0.55,
    signals: [context.retained ? "Retained in the configured analytical corpus" : relevant ? "Topic context supported by the configured profile" : "No supported topic context in available text"],
    matchedEvidence: personal ? [own.match(PERSONAL)?.[0] || "Profile patient indicator"] : [], reviewRequired: true, topicRelevant: Boolean(relevant),
  };
  return segmentAudience(fields, base);
}
