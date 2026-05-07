import { DiseaseProfile } from "./types";

/**
 * PROFILE TEMPLATE
 *
 * How to use:
 * 1. Copy this file
 * 2. Rename it to something like:
 *      - migraineProfile.ts
 *      - psoriasisProfile.ts
 *      - uterineFibroidsProfile.ts
 * 3. Update the exported constant name
 * 4. Fill in disease-specific patterns
 * 5. Register it in:
 *      src/ingestion/profiles/index.ts
 *
 * Goal:
 * Keep disease-state ingestion consistent across Meltwater CSVs and other
 * social/curated sources by making symptom extraction, burden detection,
 * treatment detection, and exclusion logic explicit and repeatable.
 */

export const diseaseProfileTemplate: DiseaseProfile = {
  /**
   * Unique internal ID used in profile registry and ingestion calls.
   * Example: "migraine", "psoriasis", "uterine_fibroids"
   */
  profileId: "replace_me_profile_id",

  /**
   * Therapeutic area string that will be stamped onto normalized findings.
   * Usually the same as profileId unless you want a different output label.
   */
  therapeuticArea: "replace_me_therapeutic_area",

  /**
   * Disease names and common aliases.
   * Include abbreviations, singular/plural, colloquial phrases, and common misspellings
   * when useful.
   */
  diseaseNames: [
    "replace me",
    "common alias",
    "common abbreviation",
  ],

  /**
   * Symptom extraction dictionary.
   *
   * Keys:
   * - normalized symptom labels that you want downstream answer assembly to use
   *
   * Values:
   * - phrases/patterns commonly seen in social discussion that should map
   *   to that normalized symptom
   *
   * Keep labels clean and reusable because they will appear in theme aggregation,
   * direct answers, and strategic implications.
   */
  symptomPatterns: {
    "example symptom": [
      "example symptom",
      "example symptoms",
      "common phrase",
      "colloquial expression",
    ],
    "second symptom": [
      "second symptom",
      "variant wording",
    ],
  },

  /**
   * Optional treatment extraction dictionary.
   *
   * Keys:
   * - normalized treatment labels
   *
   * Values:
   * - strings or phrases that indicate that treatment in discussion
   *
   * This supports treatment-decision-driver analysis and future journey logic.
   */
  treatmentPatterns: {
    "example treatment": [
      "example treatment",
      "brand name",
      "generic name",
    ],
    "surgery": [
      "surgery",
      "operation",
      "procedure",
    ],
  },

  /**
   * Burden language used to decide whether a row contains meaningful experience,
   * impact, disruption, or symptom-burden content.
   *
   * This helps the adapter distinguish real patient experience from weak mention-only rows.
   */
  burdenTerms: [
    "symptom",
    "pain",
    "fatigue",
    "daily life",
    "day to day",
    "quality of life",
    "disruptive",
    "suffering",
    "struggling",
    "impact",
    "can't work",
    "miss work",
  ],

  /**
   * Phrases indicating the speaker is talking about their own experience.
   * Used for persona detection.
   */
  patientIndicators: [
    "i have",
    "i've had",
    "i was diagnosed",
    "living with",
    "as a patient",
    "my symptoms",
    "i feel",
    "diagnosed with",
  ],

  /**
   * Phrases indicating caregiver / family / partner perspective.
   * Used for persona detection.
   */
  caregiverIndicators: [
    "my mom",
    "my mother",
    "my dad",
    "my father",
    "my child",
    "my daughter",
    "my son",
    "my husband",
    "my wife",
    "my partner",
    "caregiver",
    "as a caregiver",
  ],

  /**
   * Educational / awareness / advocacy content to exclude.
   *
   * These are usually low-signal for burden analysis because they often reflect
   * campaigns or generic awareness messaging rather than lived experience.
   */
  educationalExclusionPatterns: [
    "learn more",
    "raise awareness",
    "awareness month",
    "public health message",
    "screening campaign",
    "book your appointment",
    "schedule your consultation",
  ],

  /**
   * Low-quality noise patterns to exclude.
   *
   * These capture spam, promos, and low-value chatter that should not reach the
   * canonical answering pipeline.
   */
  lowQualityNoisePatterns: [
    "buy now",
    "discount code",
    "follow me",
    "subscribe now",
    "click link in bio",
  ],

  /**
   * Vaccine-context patterns.
   *
   * Leave empty unless the disease state commonly gets contaminated by vaccine discourse.
   * Example: hepatitis b conversations may need this; many other disease states may not.
   */
  vaccineContextPatterns: [],

  /**
   * Vaccine-causality narratives.
   *
   * Leave empty unless you explicitly want to suppress vaccine-causality content for
   * this disease-state profile.
   */
  vaccineCausalityPatterns: [],

  /**
   * Extra exclusion patterns for disease-specific junk.
   *
   * Examples:
   * - clinic promos
   * - aesthetic before/after posts
   * - fundraiser boilerplate
   * - disease-specific misinformation phrases
   */
  extraExclusionPatterns: [],

  /**
   * If true:
   * rows must explicitly reference the disease context to be kept.
   *
   * Use true for disease states where symptom language is too generic and could create
   * lots of false positives.
   *
   * Use false for disease states where discussion often omits the full disease name
   * but still clearly references the condition.
   */
  requireDiseaseContextForSymptoms: false,
};