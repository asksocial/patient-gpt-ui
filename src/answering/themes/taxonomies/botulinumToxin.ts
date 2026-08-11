import type { EvidenceClass } from "../../evidence/types";
import type { ThemeTaxonomy } from "../themeModels";

const SOCIAL: EvidenceClass[] = [
  "patient_conversation", "caregiver_conversation", "provider_conversation", "community_conversation",
  "youtube_review", "forum", "podcast", "personal_blog",
];
const AUTHORITATIVE: EvidenceClass[] = [
  "research_journal", "clinical_study", "government_or_regulator", "medical_society",
  "advocacy_organization", "healthcare_trade_publication", "healthcare_news",
];
const PROMOTIONAL: EvidenceClass[] = [
  "corporate_pr", "clinic_marketing", "retail_or_product", "sponsored_content", "influencer_content", "unknown",
];

function theme(
  themeId: string,
  label: string,
  description: string,
  keywords: string[],
  preferredEvidenceClasses: EvidenceClass[] = ["patient_conversation", "provider_conversation", "community_conversation", "clinical_study"]
) {
  return {
    themeId,
    label,
    description,
    keywords,
    preferredEvidenceClasses,
    allowedEvidenceClasses: [...SOCIAL, ...AUTHORITATIVE, "consumer_news" as EvidenceClass],
    excludedEvidenceClasses: PROMOTIONAL,
  };
}

export const botulinumToxinThemeTaxonomy: ThemeTaxonomy = {
  therapeuticArea: "botulinum_toxin",
  themes: [
    theme("natural_expression", "Natural Expression", "Preference for subtle outcomes that soften lines while preserving facial movement.", ["natural result", "not frozen", "still have movement", "subtle botox", "baby botox", "microbotox", "softened lines"]),
    theme("duration_maintenance", "Duration & Maintenance", "How long effects last, when they wear off, and the burden of repeat treatment.", ["wearing off", "wore off", "didn't last", "duration", "maintenance", "touch up", "three months", "six months", "long lasting"]),
    theme("safety_adverse_events", "Safety & Adverse Events", "Reported reactions, complications, contraindication questions, and potential safety signals.", ["side effect", "after botox", "ptosis", "droopy eyelid", "dysphagia", "difficulty swallowing", "muscle weakness", "headache", "asymmetry", "counterfeit"], ["patient_conversation", "provider_conversation", "clinical_study", "government_or_regulator", "medical_society"]),
    theme("brand_choice_switching", "Brand Choice & Switching", "Comparisons and switching among botulinum toxin formulations.", ["botox vs dysport", "xeomin vs botox", "switched from botox", "dysport", "xeomin", "jeuveau", "daxxify", "letybo", "nuceiva"]),
    theme("provider_trust_technique", "Provider Trust & Technique", "How credentials, anatomy expertise, dose, placement, and consultation shape trust and outcomes.", ["injector", "dermatologist", "plastic surgeon", "board certified", "units", "dose", "placement", "technique", "consultation"]),
    theme("access_value", "Access & Value", "Affordability, unit pricing, insurance, treatment access, and perceived value.", ["cost", "price per unit", "expensive", "worth it", "insurance", "access", "maintenance cost"]),
    theme("therapeutic_use", "Therapeutic Use", "Experiences with aesthetic and non-aesthetic botulinum toxin indications.", ["chronic migraine", "hyperhidrosis", "excessive sweating", "spasticity", "cervical dystonia", "overactive bladder", "blepharospasm"], ["patient_conversation", "provider_conversation", "clinical_study", "research_journal", "medical_society"]),
    theme("resistance_response", "Response & Resistance", "Variation in response, non-response, tachyphylaxis, and antibody concerns.", ["didn't work", "did not work", "non responder", "resistance", "antibodies", "stopped working", "dose adjustment"]),
  ],
};
