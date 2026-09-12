import type { CanonicalFinding } from "../../answering/models/finding";
import { analyzeEvidence } from "../../answering/evidence/analyzeEvidence";
import { normalizeEvidenceMetadata } from "../../answering/evidence/normalizeEvidenceMetadata";
import type { EvidenceIntelligence } from "../../answering/evidence/types";
import { getRankingProfile } from "../../answering/ranking/getRankingProfile";

export type PatientEvidenceTier =
  | "confirmed_patient"
  | "confirmed_caregiver"
  | "likely_patient"
  | "likely_caregiver"
  | "not_patient_evidence";

export type ResolvedPatientAudience =
  | "patient"
  | "caregiver"
  | "provider_hcp"
  | "company_or_commercial"
  | "media_or_research"
  | "advocacy"
  | "community_observer"
  | "insufficient_personal_evidence";

export type PatientEvidenceClassification = {
  eligible: boolean;
  tier: PatientEvidenceTier;
  resolvedAudience: ResolvedPatientAudience;
  confidence: number;
  signals: string[];
  rationale: string;
  intelligence: EvidenceIntelligence;
};

const PERSONAL_PUBLICATIONS = new Set([
  "social_post",
  "forum_post",
  "review",
  "blog_post",
  "video",
  "podcast",
  "unknown",
]);

const COMPETING_VOICES = new Set([
  "provider",
  "researcher",
  "journalist",
  "corporate",
  "clinic",
  "retail",
  "influencer",
  "advocacy",
]);

const MEDIA_OR_RESEARCH_CLASSES = new Set([
  "research_journal",
  "clinical_study",
  "medical_society",
  "government_or_regulator",
  "healthcare_trade_publication",
  "healthcare_news",
  "consumer_news",
  "event_or_conference",
]);

const COMPANY_CLASSES = new Set([
  "corporate_pr",
  "clinic_marketing",
  "retail_or_product",
  "sponsored_content",
  "influencer_content",
]);

const FIRST_PERSON = /\b(?:i|i'm|i’m|i've|i’ve|i'd|i’d|me|my|mine|myself)\b/i;
const FIRST_PERSON_PLURAL = /\b(?:we|we're|we’re|we've|we’ve|our|ours|ourselves)\b/i;
const DIRECT_TREATMENT_EXPERIENCE = /\bi\s+(?:received|underwent|was treated|was injected|got treated|have been treated|have been getting)\b|\bafter my\s+(?:treatment|procedure|injection|appointment|session)|\bmy\s+(?:treatment|procedure|injection|dose|results?|recovery|side effects?|symptoms?|diagnosis|condition|appointment|injector|doctor|provider)\b/i;
const PERSONAL_ACTION = /\bi\s+(?:got|had|tried|started|stopped|switched|used|took|booked|scheduled|am getting|went for|went through)\b/i;
const LIVED_OUTCOME = /\b(?:worked for me|did(?: not|n't) work for me|helped me|left me|made me|i (?:experienced|felt|developed|recovered|improved|reacted|regret)|my (?:results?|recovery|side effects?|symptoms?)|wears? off|wore off|lasted|still swollen|still bruised|still hurting)\b/i;
const PERSONAL_TREATMENT_INTENT = /\b(?:i (?:want|need|plan|hope|would like|might|may|will|won't|won’t|would never|refuse) (?:to )?(?:get|try|have|use|start|stop|switch|avoid)|i(?:'m|i’m| am) (?:getting|trying|using|considering|avoiding)|i (?:do not|don't|don’t) (?:get|use|want)|never getting)\b/i;
const PERSONAL_BODY_OR_CONDITION = /\bmy\s+(?:face|forehead|eyes?|eyebrows?|lips?|jaw|jawline|masseters?|neck|skin|wrinkles?|lines?|migraines?|headaches?|sweating|spasms?|pain|condition|symptoms?)\b/i;
const PERSONAL_OUTCOME_PROXIMITY = /\bmy\b.{0,60}\b(?:left|caused|gave me|resulted|lasted|wore off|wears off|hurt|hurts|painful|swollen|swelling|bruised|bruising|droop(?:ed|ing)?|improved|helped|worked|failed)\b|\b(?:for me|on me)\b/i;
const BARRIER_LANGUAGE = /\b(?:i (?:cannot|can't|can’t|couldn't|couldn’t|won't|won’t) afford|too expensive|cost me|insurance (?:denied|won't|won’t|doesn't|doesn’t)|could not access|couldn't access|wait(?:ing)? list|hard to find|worried about|concerned about|afraid of|scared of|hesitant|not sure|unsure|trust my|find a qualified)\b/i;
const EMOTION_LANGUAGE = /\b(?:i (?:feel|felt|am feeling|was feeling)|i'm|i’m)\s+(?:afraid|anxious|worried|scared|confused|embarrassed|frustrated|disappointed|regretful|hopeful|excited|happy|relieved|upset)|\b(?:my anxiety|my confidence|my self-esteem|made me feel)\b/i;
const UNMET_NEED_LANGUAGE = /\b(?:i need|i wish|i want|i would like|looking for|need help|need advice|wish there (?:was|were)|no one told me|wasn't told|wasn’t told|cannot find|can't find|can’t find)\b/i;
const PROSPECTIVE_PATIENT_LANGUAGE = /\b(?:should i|can i|would i|i am considering|i'm considering|i’m considering|i am thinking about|i'm thinking about|i’m thinking about|i want to try|i'm planning|i’m planning|has anyone (?:tried|had|got|experienced)|anyone (?:tried|had|got|experienced)|what was your experience|is this normal for me)\b/i;
const CAREGIVER_IDENTITY = /\b(?:as (?:a|their) caregiver|caring for|i care for|my (?:child|son|daughter|husband|wife|mother|father|mom|dad|partner|spouse)|our (?:child|son|daughter|mother|father|mom|dad|family member)|someone i care for)\b/i;
const CAREGIVER_EXPERIENCE = /\b(?:they|he|she|my (?:child|son|daughter|husband|wife|mother|father|mom|dad|partner|spouse|patient))\s+(?:got|had|received|underwent|tried|started|stopped|experienced|noticed|felt|developed|recovered|improved|reacted|was treated|was injected)|\b(?:their|his|her)\s+(?:treatment|procedure|injection|results?|recovery|side effects?|symptoms?|diagnosis|condition)\b/i;
const TREATMENT_OR_HEALTH_CONTEXT = /\b(?:treat(?:ment|ed)|procedure|inject(?:ion|ed|able)|therapy|medication|medicine|drug|dose|session|appointment|consultation|doctor|physician|provider|clinic|diagnosis|condition|symptom|side effect|adverse|reaction|result|outcome|recovery|pain|swelling|bruising|healing|effective|efficacy|benefit|risk|safety)\b/i;
const COMMUNITY_DISCUSSION = /\b(?:has anyone|anyone else|what do you think|thoughts on|does anyone know|looking for advice|need advice|would you recommend|curious about|wondering if|pros and cons|what was your experience|can anyone share)\b/i;
const PROVIDER_SELF_REFERENCE = /\b(?:my|our) patients?\b|\b(?:in|at) (?:my|our) (?:practice|clinic)\b|\bi\s+(?:administered|prescribed|treated|injected|assessed|diagnosed|recommended|gave)\b|\bwe\s+(?:administer|prescribe|treat|inject|assess|diagnose|recommend|offer|perform)\b/i;
const ADDITIONAL_PROMOTIONAL_LANGUAGE = /\b(?:book now|book your|schedule (?:your|a) consultation|contact us|call (?:today|now)|free consultation|shop now|buy now|promo code|discount code|limited offer|special offer|link in bio|dm (?:us|to book)|mention my name|use my code|affiliate)\b/i;
const HYPOTHETICAL_OR_MARKETING_QUERY = /\b(?:questions? like|search(?:es|ing)? (?:for|things like)|when someone asks|prospective patients?|ai overviews?|search engine|faq section)\b/i;

function normalizeText(value: string) {
  return ` ${value.toLowerCase().replace(/\s+/g, " ").trim()} `;
}

function hasNearbyTherapeuticContext(text: string, profileTerms: string[]) {
  const action = PERSONAL_ACTION.exec(text);
  if (!action) return false;
  const nearby = text.slice(Math.max(0, action.index - 70), action.index + action[0].length + 90);
  return TREATMENT_OR_HEALTH_CONTEXT.test(nearby) || profileTerms.some((term) => nearby.includes(term));
}

function result(
  intelligence: EvidenceIntelligence,
  params: Omit<PatientEvidenceClassification, "intelligence" | "rationale">
): PatientEvidenceClassification {
  return {
    ...params,
    confidence: Number(Math.max(0, Math.min(1, params.confidence)).toFixed(2)),
    rationale: params.signals.join("; "),
    intelligence,
  };
}

/**
 * Resolves every source into a useful audience bucket while using a deliberately
 * narrower gate for Patient Intelligence eligibility. The classifier is based on
 * personal-experience language rather than any therapeutic-area vocabulary, so it
 * can be applied consistently to every supported corpus.
 */
export function classifyPatientEvidence(
  finding: CanonicalFinding
): PatientEvidenceClassification {
  const intelligence = analyzeEvidence(finding);
  const metadata = normalizeEvidenceMetadata(finding);
  const text = normalizeText(metadata.fullText);

  if (intelligence.isPromotional || COMPANY_CLASSES.has(intelligence.evidenceClass) || ADDITIONAL_PROMOTIONAL_LANGUAGE.test(text)) {
    return result(intelligence, {
      eligible: false,
      tier: "not_patient_evidence",
      resolvedAudience: "company_or_commercial",
      confidence: Math.max(0.75, intelligence.classificationConfidence),
      signals: ["Commercial, clinic, sponsored, or promotional source"],
    });
  }

  const explicitCaregiver =
    intelligence.voice === "caregiver" ||
    intelligence.evidenceClass === "caregiver_conversation";
  if (explicitCaregiver) {
    return result(intelligence, {
      eligible: true,
      tier: "confirmed_caregiver",
      resolvedAudience: "caregiver",
      confidence: Math.max(0.82, intelligence.classificationConfidence),
      signals: ["Existing evidence ontology identifies a caregiver account"],
    });
  }

  const explicitPatient =
    intelligence.voice === "patient" ||
    intelligence.evidenceClass === "patient_conversation";
  if (explicitPatient) {
    return result(intelligence, {
      eligible: true,
      tier: "confirmed_patient",
      resolvedAudience: "patient",
      confidence: Math.max(0.82, intelligence.classificationConfidence),
      signals: ["Existing evidence ontology identifies a patient account"],
    });
  }

  if (COMPETING_VOICES.has(intelligence.voice)) {
    const resolvedAudience = intelligence.voice === "provider"
      ? "provider_hcp"
      : intelligence.voice === "advocacy"
        ? "advocacy"
        : ["corporate", "clinic", "retail", "influencer"].includes(intelligence.voice)
          ? "company_or_commercial"
          : "media_or_research";
    return result(intelligence, {
      eligible: false,
      tier: "not_patient_evidence",
      resolvedAudience,
      confidence: Math.max(0.72, intelligence.classificationConfidence),
      signals: [`Existing evidence ontology identifies ${intelligence.voice} voice`],
    });
  }

  if (MEDIA_OR_RESEARCH_CLASSES.has(intelligence.evidenceClass)) {
    return result(intelligence, {
      eligible: false,
      tier: "not_patient_evidence",
      resolvedAudience: "media_or_research",
      confidence: Math.max(0.72, intelligence.classificationConfidence),
      signals: ["Publication is news, research, government, society, or conference evidence"],
    });
  }

  const personalPublication =
    PERSONAL_PUBLICATIONS.has(intelligence.publicationType) ||
    ["social", "forum", "review", "blog", "video", "podcast", "unknown"].includes(intelligence.platform);
  const firstPerson = FIRST_PERSON.test(text);
  const firstPersonPlural = FIRST_PERSON_PLURAL.test(text);
  const treatmentContext = TREATMENT_OR_HEALTH_CONTEXT.test(text);
  const canonicalTreatmentContext = [...(finding.treatments || []), ...(finding.normalizedLabels || [])]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => value.length >= 3)
    .some((value) => text.includes(` ${value} `) || text.includes(value));
  const therapeuticProfileTerms = (getRankingProfile(finding.therapeuticArea).globalBoosts || [])
    .map(({ term }) => term.trim().toLowerCase())
    .filter((term) => term.length >= 3);
  const therapeuticProfileContext = therapeuticProfileTerms.some((term) => text.includes(term));
  const hasTreatmentContext = treatmentContext || canonicalTreatmentContext || therapeuticProfileContext;
  const directExperience = DIRECT_TREATMENT_EXPERIENCE.test(text) || hasNearbyTherapeuticContext(text, therapeuticProfileTerms);
  const personalIntent = PERSONAL_TREATMENT_INTENT.test(text);
  const personalBodyOrCondition = PERSONAL_BODY_OR_CONDITION.test(text);
  const livedOutcome = LIVED_OUTCOME.test(text) || PERSONAL_OUTCOME_PROXIMITY.test(text);
  const barrier = BARRIER_LANGUAGE.test(text);
  const emotion = EMOTION_LANGUAGE.test(text);
  const unmetNeed = UNMET_NEED_LANGUAGE.test(text);
  const prospectivePatient = PROSPECTIVE_PATIENT_LANGUAGE.test(text);
  const caregiverIdentity = CAREGIVER_IDENTITY.test(text);
  const caregiverExperience = CAREGIVER_EXPERIENCE.test(text);
  const providerSelfReference = PROVIDER_SELF_REFERENCE.test(text);

  if (providerSelfReference) {
    return result(intelligence, {
      eligible: false,
      tier: "not_patient_evidence",
      resolvedAudience: "provider_hcp",
      confidence: Math.max(0.78, intelligence.classificationConfidence),
      signals: ["First-person language refers to treating or assessing patients as a healthcare professional"],
    });
  }

  if (
    personalPublication &&
    hasTreatmentContext &&
    caregiverIdentity &&
    (caregiverExperience || firstPerson)
  ) {
    const signals = ["Caregiver or family relationship language", "Treatment or health-experience context"];
    if (caregiverExperience) signals.push("Caregiver describes a specific person's experience or outcome");
    return result(intelligence, {
      eligible: true,
      tier: "likely_caregiver",
      resolvedAudience: "caregiver",
      confidence: caregiverExperience ? 0.76 : 0.68,
      signals,
    });
  }

  const experienceSignals = [
    directExperience,
    livedOutcome,
    personalIntent,
    personalBodyOrCondition,
    barrier,
    emotion,
    unmetNeed,
    prospectivePatient,
  ].filter(Boolean).length;
  const qualifiesAsLikelyPatient =
    personalPublication &&
    hasTreatmentContext &&
    !HYPOTHETICAL_OR_MARKETING_QUERY.test(text) &&
    (
      (firstPerson && experienceSignals >= 1 && (directExperience || livedOutcome || personalIntent || personalBodyOrCondition || prospectivePatient)) ||
      (prospectivePatient && (firstPerson || intelligence.isAuthenticConversation))
    );

  if (qualifiesAsLikelyPatient) {
    const signals = ["Personal or community-compatible publication", "Treatment or health-experience context"];
    if (therapeuticProfileContext) signals.push("Active topic profile term");
    if (firstPerson) signals.push("First-person language");
    if (directExperience) signals.push("Direct treatment-experience language");
    if (livedOutcome) signals.push("Personal outcome or recovery language");
    if (personalIntent) signals.push("Personal treatment consideration, use, or avoidance language");
    if (personalBodyOrCondition) signals.push("Personal symptom, condition, or treatment-area language");
    if (barrier) signals.push("Patient barrier or access language");
    if (emotion) signals.push("Patient emotion language");
    if (unmetNeed) signals.push("Unmet-need or support-seeking language");
    if (prospectivePatient) signals.push("Prospective-patient question or consideration language");
    const confidence = 0.56 + Math.min(0.22, experienceSignals * 0.04) + (directExperience || livedOutcome ? 0.05 : 0);
    return result(intelligence, {
      eligible: true,
      tier: "likely_patient",
      resolvedAudience: "patient",
      confidence,
      signals,
    });
  }

  if (
    intelligence.voice === "community" ||
    COMMUNITY_DISCUSSION.test(text) ||
    (personalPublication && (firstPersonPlural || intelligence.isCommunityConversation || intelligence.platform === "social" || intelligence.platform === "forum"))
  ) {
    return result(intelligence, {
      eligible: false,
      tier: "not_patient_evidence",
      resolvedAudience: "community_observer",
      confidence: Math.max(0.55, intelligence.classificationConfidence),
      signals: ["Community discussion lacks a supported first-person treatment experience"],
    });
  }

  if (intelligence.evidenceClass === "provider_conversation") {
    return result(intelligence, {
      eligible: false,
      tier: "not_patient_evidence",
      resolvedAudience: "provider_hcp",
      confidence: Math.max(0.58, intelligence.classificationConfidence),
      signals: ["Provider-oriented evidence class without supported personal patient experience or community context"],
    });
  }

  return result(intelligence, {
    eligible: false,
    tier: "not_patient_evidence",
    resolvedAudience: "insufficient_personal_evidence",
    confidence: Math.max(0.45, intelligence.classificationConfidence),
    signals: ["Available text does not establish patient, caregiver, or another attributable personal voice"],
  });
}

export function patientEvidenceTierLabel(tier: PatientEvidenceTier) {
  switch (tier) {
    case "confirmed_patient": return "Direct patient evidence";
    case "confirmed_caregiver": return "Direct caregiver evidence";
    case "likely_patient": return "Likely patient evidence";
    case "likely_caregiver": return "Likely caregiver evidence";
    default: return "Not patient evidence";
  }
}
