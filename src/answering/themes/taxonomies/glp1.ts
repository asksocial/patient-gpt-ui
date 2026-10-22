import type { ThemeTaxonomy, ThemeDefinition } from "../themeModels";

function theme(themeId: string, label: string, description: string, keywords: string[]): ThemeDefinition {
  return {
    themeId, label, description, keywords,
    preferredEvidenceClasses: ["patient_conversation", "caregiver_conversation", "provider_conversation", "clinical_study", "research_journal"],
    excludedEvidenceClasses: ["corporate_pr", "clinic_marketing", "retail_or_product", "sponsored_content", "unknown"],
  };
}

export const glp1ThemeTaxonomy: ThemeTaxonomy = {
  therapeuticArea: "glp_1",
  themes: [
    theme("treatment_outcomes", "Treatment Outcomes", "Reported weight, appetite, metabolic, and daily-life outcomes.", ["weight loss", "lost weight", "blood sugar", "a1c", "food noise", "appetite", "cravings", "quality of life"]),
    theme("tolerability_experiences", "Tolerability Experiences", "Reported treatment experiences and safety questions for evidence-qualified analysis.", ["side effect", "nausea", "vomiting", "constipation", "diarrhea", "fatigue", "reflux", "stomach pain"]),
    theme("access_affordability", "Access & Affordability", "Coverage, affordability, availability, and sourcing concerns.", ["insurance", "coverage", "prior authorization", "cost", "expensive", "shortage", "compounded", "out of pocket"]),
    theme("dosing_administration", "Dosing & Administration", "Experiences starting treatment, adjusting doses, and administering medication.", ["dose", "titration", "injection", "shot", "needle", "weekly", "oral glp", "tablet"]),
    theme("choice_switching", "Treatment Choice & Switching", "Comparisons and switching between treatments.", ["ozempic", "wegovy", "mounjaro", "zepbound", "semaglutide", "tirzepatide", "switch", "versus"]),
    theme("maintenance_discontinuation", "Maintenance & Discontinuation", "Long-term treatment, plateaus, stopping, and weight regain.", ["maintenance", "plateau", "regain", "stopping", "stopped taking", "discontinuation", "long term"]),
    theme("stigma_support", "Stigma & Support", "Social perceptions, body image, and support needs.", ["stigma", "judgment", "judgement", "body image", "shame", "support group", "cheating", "easy way out"]),
    theme("evidence_education", "Evidence & Education", "Research discussion, clinician guidance, and unanswered treatment questions.", ["clinical trial", "study", "research", "doctor", "prescriber", "confused", "how does", "long-term safety"]),
  ],
};
