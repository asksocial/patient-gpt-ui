import { DiseaseProfile } from "./types";

export const uterineFibroidsProfile: DiseaseProfile = {
  profileId: "uterine_fibroids",
  therapeuticArea: "uterine_fibroids",

  diseaseNames: ["fibroids", "uterine fibroids"],

  symptomPatterns: {
    "heavy bleeding": ["heavy bleeding", "heavy periods", "flooding"],
    pain: ["pelvic pain", "cramps", "painful periods"],
    bloating: ["bloating", "bloated"],
    fatigue: ["fatigue", "tired"],
    anemia: ["anemia", "low iron"],
    "fertility concerns": ["fertility", "trying to conceive"],
  },

  treatmentPatterns: {
    hysterectomy: ["hysterectomy"],
    myomectomy: ["myomectomy"],
    embolization: ["embolization", "ufe"],
  },

  burdenTerms: [
    "pain",
    "heavy bleeding",
    "daily life",
    "quality of life",
    "can't work",
    "disruptive",
  ],

  patientIndicators: [
    "i have",
    "i was diagnosed",
    "my fibroids",
  ],

  caregiverIndicators: [
    "my sister",
    "my wife",
    "my friend",
  ],

  educationalExclusionPatterns: [
    "awareness",
    "learn more",
  ],

  lowQualityNoisePatterns: [
    "buy now",
    "follow me",
  ],

  vaccineContextPatterns: [],
  vaccineCausalityPatterns: [],

  extraExclusionPatterns: [],

  requireDiseaseContextForSymptoms: false,
};