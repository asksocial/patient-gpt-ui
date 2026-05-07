import { DiseaseProfile } from "./types";

export const hepatitisBProfile: DiseaseProfile = {
  profileId: "hepatitis_b",
  therapeuticArea: "hepatitis_b",

  diseaseNames: ["hepatitis b", "hep b", "hbv"],

  symptomPatterns: {
    pain: ["pain", "abdominal pain", "liver pain"],
    fatigue: ["fatigue", "tired", "exhausted", "low energy"],
    jaundice: ["jaundice", "yellow eyes", "yellow skin"],
    nausea: ["nausea"],
    weakness: ["weakness", "weak"],
    swelling: ["swelling", "bloated"],
    fever: ["fever"],
    vomiting: ["vomiting", "vomit"],
  },

  treatmentPatterns: {},

  burdenTerms: [
    "pain",
    "fatigue",
    "tired",
    "exhausted",
    "struggling",
    "daily life",
  ],

  patientIndicators: [
    "i have",
    "i was diagnosed",
    "i am suffering",
    "living with",
    "my hepatitis",
    "my hep b",
  ],

  caregiverIndicators: ["my son", "my daughter", "my mom", "my dad"],

  // 🚨 MUCH STRONGER FILTER (STRUCTURAL)
  educationalExclusionPatterns: [
    "did you know",
    "hepatitis b is",
    "is a serious",
    "preventable viral infection",
    "many people living with",
    "over 20 million",
    "silent liver killer",
    "symptoms include",
    "awareness",
    "join us",
    "learn about",
  ],

  lowQualityNoisePatterns: [
    "pick me",
    "please pick me",
    "fitnesswww",
    "palmpay",
    "donate",
  ],

  hardExclusionPatterns: ["vaccine", "jab", "booster"],

  requirePatientVoice: true,
  extraExclusionPatterns: [],
  requireDiseaseContextForSymptoms: false,
};