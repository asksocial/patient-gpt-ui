import type { CanonicalFinding } from "../answering/models/finding";
import {
  classifyPatientEvidence,
  type ResolvedPatientAudience,
} from "../lib/patient-intelligence/classifyPatientEvidence";
import { buildPatientIntelligence } from "../lib/patient-intelligence/buildPatientIntelligence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function finding(id: string, text: string, options: {
  platform?: string;
  persona?: string;
} = {}): CanonicalFinding {
  return {
    findingId: id,
    findingType: "treatment_journey",
    canonicalClaim: text,
    summary: text,
    therapeuticArea: "Example therapeutic area",
    countries: ["US"],
    personas: options.persona ? [options.persona] : [],
    platforms: options.platform ? [options.platform] : [],
    symptoms: [],
    treatments: ["Example treatment"],
    lifecycleStages: [],
    intentLabels: [],
    confidence: 0.8,
    relevanceScore: 0.8,
    evidenceStrength: 0.8,
    evidence: [{
      sourceType: "live",
      sourceId: id,
      excerpt: text,
      platform: options.platform,
    }],
    normalizedLabels: ["example treatment"],
    semanticFingerprint: id,
  };
}

const fixtures = [
  finding("confirmed-patient", "I received Example treatment and my recovery took three days.", { platform: "Reddit", persona: "patient" }),
  finding("likely-patient", "My Example treatment on Wednesday left me swollen and worried about the result."),
  finding("likely-considering", "I want to try Example treatment but I am worried about the cost."),
  finding("likely-caregiver", "Someone I care for received Example treatment and their recovery has been painful."),
  finding("provider", "In my practice I administered Example treatment to patients and assessed their outcomes.", { platform: "LinkedIn", persona: "provider" }),
  finding("promotional", "Book now for Example treatment. Contact us today for a free consultation.", { platform: "Instagram" }),
  finding("observer", "People online are discussing Example treatment this week.", { platform: "X" }),
];

const classified = new Map(fixtures.map((item) => [item.findingId, classifyPatientEvidence(item)]));

assert(classified.get("confirmed-patient")?.tier === "confirmed_patient", "Explicit patient evidence must retain the confirmed tier.");
assert(classified.get("likely-patient")?.tier === "likely_patient", "First-person treatment outcomes must qualify as likely patient evidence when existing voice metadata is unresolved.");
assert(classified.get("likely-considering")?.tier === "likely_patient", "Prospective patient barriers must qualify as likely patient evidence.");
assert(classified.get("likely-caregiver")?.tier === "likely_caregiver", "Supported caregiver accounts must qualify for the likely caregiver tier.");
assert(classified.get("provider")?.resolvedAudience === "provider_hcp" && !classified.get("provider")?.eligible, "Provider-authored evidence must not leak into the patient subset.");
assert(classified.get("promotional")?.resolvedAudience === "company_or_commercial" && !classified.get("promotional")?.eligible, "Promotional evidence must not leak into the patient subset.");
assert(
  !classified.get("observer")?.eligible &&
  !["patient", "caregiver"].includes(String(classified.get("observer")?.resolvedAudience)),
  "General community commentary must remain distinct from personal patient evidence."
);

const forbiddenAudienceLabels = new Set<ResolvedPatientAudience | "unknown" | "other">(["unknown", "other"]);
assert([...classified.values()].every((item) => !forbiddenAudienceLabels.has(item.resolvedAudience)), "Every record must receive a meaningful audience resolution instead of unknown or other.");
assert([...classified.values()].filter((item) => item.eligible).every((item) => item.rationale && item.confidence >= 0.5), "Every eligible record must expose an evidence rationale and bounded confidence.");

const intelligence = buildPatientIntelligence("Example therapeutic area", fixtures, "2026-09-11T12:00:00.000Z");
assert(intelligence.dataQuality.patientVoiceFindingCount === 4, "Patient Intelligence must combine confirmed and likely patient/caregiver evidence.");
assert(intelligence.dataQuality.confirmedPatientFindingCount === 1, "Confirmed patient evidence must be counted separately.");
assert(intelligence.dataQuality.likelyPatientFindingCount === 2, "Likely patient evidence must be counted separately.");
assert(intelligence.dataQuality.likelyCaregiverFindingCount === 1, "Likely caregiver evidence must be counted separately.");
assert(Object.values(intelligence.dataQuality.resolvedAudienceCounts).reduce((sum, count) => sum + count, 0) === fixtures.length, "Resolved audience counts must account for the complete corpus.");
assert(intelligence.evidence.every((item) => item.evidenceTierLabel && item.classificationConfidence >= 0.5), "Representative evidence must expose confidence-tier provenance.");

console.log("Therapeutic-area-agnostic patient evidence classifier quality checks passed.");
