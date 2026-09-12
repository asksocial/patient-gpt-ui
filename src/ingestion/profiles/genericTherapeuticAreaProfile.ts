import type { DiseaseProfile } from "./types";

function humanize(value: string) {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Safe baseline used when a newly configured therapeutic area does not yet
 * have a domain-specific ingestion profile. Domain profiles may add precision,
 * but the shared platform must never stop working merely because one has not
 * been authored yet.
 */
export function createGenericTherapeuticAreaProfile(
  profileId: string,
  therapeuticArea?: string
): DiseaseProfile {
  const area = humanize(therapeuticArea || profileId) || "therapeutic area";

  return {
    profileId,
    therapeuticArea: area,
    diseaseNames: [area],
    symptomPatterns: {
      "symptoms and health experiences": [
        "symptom",
        "pain",
        "fatigue",
        "reaction",
        "side effect",
        "adverse event",
        "complication",
      ],
      "treatment outcomes": [
        "improved",
        "worsened",
        "worked",
        "didn't work",
        "did not work",
        "recovered",
        "ongoing",
      ],
    },
    treatmentPatterns: {
      treatment: [
        "treatment",
        "therapy",
        "medicine",
        "medication",
        "drug",
        "procedure",
        "injection",
        "surgery",
      ],
    },
    burdenTerms: [
      "pain",
      "fatigue",
      "daily life",
      "quality of life",
      "struggling",
      "worried",
      "anxious",
      "frustrated",
      "can't work",
      "cannot work",
      "missed work",
      "cost",
      "access",
      "side effect",
      "complication",
    ],
    patientIndicators: [
      "i have",
      "i had",
      "i've had",
      "i was diagnosed",
      "i was treated",
      "i take",
      "i tried",
      "my symptoms",
      "my treatment",
      "my medication",
      "after my",
      "as a patient",
      "living with",
    ],
    caregiverIndicators: [
      "my child",
      "my daughter",
      "my son",
      "my mother",
      "my mom",
      "my father",
      "my dad",
      "my partner",
      "my spouse",
      "as a caregiver",
      "caregiver",
    ],
    educationalExclusionPatterns: [
      "awareness month",
      "public health message",
      "book your appointment",
      "schedule your consultation",
    ],
    lowQualityNoisePatterns: [
      "buy now",
      "discount code",
      "link in bio",
      "giveaway",
      "subscribe now",
    ],
    requirePatientVoice: false,
    requireDiseaseContextForSymptoms: false,
    journeyStages: [
      "Awareness",
      "Diagnosis",
      "Treatment Consideration",
      "Treatment",
      "Outcomes",
      "Maintenance",
      "Switching",
    ],
    emotions: [
      "Hope",
      "Fear",
      "Trust",
      "Confusion",
      "Anxiety",
      "Frustration",
      "Satisfaction",
    ],
    adverseEventPatterns: {
      "reported adverse experience": [
        "side effect",
        "adverse event",
        "adverse reaction",
        "reaction after",
        "complication",
      ],
    },
    marketThemes: [
      "Patient experience",
      "Treatment outcomes",
      "Safety and tolerability",
      "Access and affordability",
      "Unmet need",
      "Trust and information",
    ],
  };
}
