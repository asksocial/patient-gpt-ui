import type { EvidenceClass } from "../../evidence/types";
import type { ThemeDefinition, ThemeTaxonomy } from "../themeModels";

const DIRECT_AND_AUTHORITATIVE: EvidenceClass[] = [
  "patient_conversation",
  "caregiver_conversation",
  "provider_conversation",
  "community_conversation",
  "forum",
  "youtube_review",
  "personal_blog",
  "clinical_study",
  "research_journal",
  "medical_society",
  "government_or_regulator",
  "advocacy_organization",
  "healthcare_trade_publication",
  "healthcare_news",
  "consumer_news",
];

const PROMOTIONAL: EvidenceClass[] = [
  "corporate_pr",
  "clinic_marketing",
  "retail_or_product",
  "sponsored_content",
  "influencer_content",
];

function theme(
  themeId: string,
  label: string,
  description: string,
  keywords: string[],
  preferredEvidenceClasses: EvidenceClass[] = [
    "patient_conversation",
    "caregiver_conversation",
    "provider_conversation",
    "clinical_study",
  ]
): ThemeDefinition {
  return {
    themeId,
    label,
    description,
    keywords,
    preferredEvidenceClasses,
    allowedEvidenceClasses: DIRECT_AND_AUTHORITATIVE,
    excludedEvidenceClasses: PROMOTIONAL,
  };
}

const GENERIC_THEMES: ThemeDefinition[] = [
  theme(
    "symptoms_burden",
    "Symptoms & Daily Burden",
    "Symptoms and their effects on daily life, function, and quality of life.",
    ["symptom", "pain", "fatigue", "daily life", "quality of life", "function", "struggling", "burden"]
  ),
  theme(
    "treatment_experience",
    "Treatment Experience & Outcomes",
    "Experiences with treatment decisions, benefits, outcomes, maintenance, and switching.",
    ["treatment", "therapy", "medication", "procedure", "improved", "worked", "didn't work", "did not work", "switch", "stopped"]
  ),
  theme(
    "safety_tolerability",
    "Safety & Tolerability",
    "Safety concerns, adverse experiences, side effects, and tolerability discussions.",
    ["safety", "safe", "side effect", "adverse", "reaction", "complication", "tolerability", "risk"],
    ["patient_conversation", "caregiver_conversation", "provider_conversation", "clinical_study", "government_or_regulator"]
  ),
  theme(
    "access_affordability",
    "Access & Affordability",
    "Access, availability, insurance, affordability, and logistical barriers.",
    ["access", "available", "availability", "insurance", "coverage", "cost", "price", "expensive", "appointment", "waitlist"]
  ),
  theme(
    "diagnosis_journey",
    "Diagnosis & Care Journey",
    "Diagnosis, referral, provider selection, and movement through care.",
    ["diagnosis", "diagnosed", "misdiagnosed", "referral", "specialist", "doctor", "provider", "appointment", "journey"]
  ),
  theme(
    "emotional_burden",
    "Emotional Burden",
    "Emotional effects, trust, uncertainty, confidence, and support needs.",
    ["anxiety", "anxious", "fear", "afraid", "worried", "frustrated", "hope", "trust", "confused", "support"]
  ),
  theme(
    "unmet_need_information",
    "Unmet Needs & Information Gaps",
    "Unresolved needs, questions, misinformation, and education gaps.",
    ["unmet need", "need", "question", "unclear", "unknown", "confused", "information", "education", "misinformation", "wish"]
  ),
  theme(
    "research_clinical_trials",
    "Research & Clinical Trials",
    "Clinical research, evidence, trial awareness, eligibility, enrollment, and outcomes.",
    ["study", "research", "clinical trial", "clinical study", "evidence", "eligible", "eligibility", "enroll", "participant", "results"],
    ["clinical_study", "research_journal", "medical_society", "government_or_regulator", "provider_conversation", "patient_conversation"]
  ),
];

export function createGenericThemeTaxonomy(
  therapeuticArea: string
): ThemeTaxonomy {
  return {
    therapeuticArea,
    themes: GENERIC_THEMES.map((item) => ({
      ...item,
      keywords: [...item.keywords],
      preferredEvidenceClasses: [...(item.preferredEvidenceClasses || [])],
      allowedEvidenceClasses: [...(item.allowedEvidenceClasses || [])],
      excludedEvidenceClasses: [...(item.excludedEvidenceClasses || [])],
    })),
  };
}
