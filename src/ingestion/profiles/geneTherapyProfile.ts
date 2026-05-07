import { DiseaseProfile } from "./types";

export const geneTherapyProfile: DiseaseProfile = {
  profileId: "gene_therapy",
  therapeuticArea: "gene_therapy",

  diseaseNames: [
    "gene therapy",
    "genetic therapy",
    "viral vector",
    "aav",
    "lentiviral",
    "crispr",
    "casgevy",
    "lyfgenia",
    "elevidys",
    "hemgenix",
    "luxturna",
    "zolgensa",
    "beqvez"
  ],

  symptomPatterns: {
    pain: ["pain", "painful", "hurts", "aching", "ache"],
    fatigue: ["fatigue", "tired", "exhausted", "low energy", "drained"],
    weakness: ["weak", "weakness", "can barely move"],
    nausea: ["nausea", "nauseous", "queasy"],
    vomiting: ["vomiting", "vomit", "throwing up", "threw up"],
    fever: ["fever", "temperature", "febrile"],
    headache: ["headache", "migraine", "head pain"],
    swelling: ["swelling", "swollen", "inflammation"],
    liver_concerns: ["liver enzymes", "alt", "ast", "liver issues", "liver toxicity"],
    infusion_reaction: [
      "infusion reaction",
      "reaction during infusion",
      "reaction to infusion"
    ]
  },

  treatmentPatterns: {
    gene_therapy: [
      "gene therapy",
      "genetic therapy",
      "viral vector",
      "aav",
      "lentiviral",
      "crispr"
    ],
    steroids: ["steroid", "steroids", "prednisone", "prednisolone"],
    conditioning: ["conditioning regimen", "conditioning", "busulfan", "myeloablative"],
    hospitalization: ["hospital stay", "hospitalization", "admitted", "inpatient"]
  },

  burdenTerms: [
    "burden",
    "hard",
    "difficult",
    "struggling",
    "daily life",
    "day to day",
    "quality of life",
    "side effect",
    "recovery",
    "recovered",
    "monitoring",
    "follow-up",
    "travel for treatment",
    "care coordination",
    "financial stress",
    "uncertainty",
    "anxiety",
    "scared",
    "fear",
    "overwhelming"
  ],

  patientIndicators: [
    "i have",
    "i had",
    "i got",
    "i received",
    "i was treated",
    "i was infused",
    "i started",
    "my treatment",
    "my infusion",
    "my gene therapy",
    "my recovery",
    "living with",
    "i am experiencing",
    "i'm experiencing"
  ],

  caregiverIndicators: [
    "my son",
    "my daughter",
    "my child",
    "my husband",
    "my wife",
    "my partner",
    "my mom",
    "my dad",
    "my family member",
    "as a caregiver",
    "caregiver"
  ],

  educationalExclusionPatterns: [
    "did you know",
    "join us",
    "learn more",
    "webinar",
    "register here",
    "awareness month",
    "what is gene therapy",
    "how gene therapy works",
    "explainer",
    "breaking news",
    "press release"
  ],

  lowQualityNoisePatterns: [
    "buy now",
    "subscribe",
    "follow me",
    "promo code",
    "discount",
    "donate now",
    "please donate",
    "gofundme"
  ],

  hardExclusionPatterns: [
    "stock is up",
    "stock is down",
    "invest now",
    "share price",
    "earnings call",
    "bullish",
    "bearish"
  ],

  extraExclusionPatterns: [],
  requirePatientVoice: false,
  requireDiseaseContextForSymptoms: false
};