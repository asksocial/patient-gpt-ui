export type AnswerIntent =
  | "symptom_qol_burden"
  | "treatment_decision_drivers"
  | "diagnosis_barriers"
  | "safety_signals"
  | "market_landscape"
  | "general";

export type SectionKey =
  | "direct_answer"
  | "top_burdens"
  | "top_drivers"
  | "barriers"
  | "top_safety_signals"
  | "market_variation"
  | "platforms"
  | "supporting_findings"
  | "evidence"
  | "live_data_check";

export interface AnswerTemplateRule {
  intent: AnswerIntent;
  requiredSections: SectionKey[];
  maxDirectAnswerSentences: number;
  maxSupportingCards: number;
  allowedFindingTypes: string[];
  disallowedFindingTypes?: string[];
}

export const TEMPLATE_REGISTRY: Record<AnswerIntent, AnswerTemplateRule> = {
  symptom_qol_burden: {
    intent: "symptom_qol_burden",
    requiredSections: [
      "direct_answer",
      "top_burdens",
      "market_variation",
      "evidence",
      "live_data_check",
    ],
    maxDirectAnswerSentences: 4,
    maxSupportingCards: 5,
    allowedFindingTypes: [
      "symptom_burden",
      "quality_of_life",
      "persona_pattern",
      "country_pattern",
    ],
    disallowedFindingTypes: ["platform_preference"],
  },

  treatment_decision_drivers: {
    intent: "treatment_decision_drivers",
    requiredSections: [
      "direct_answer",
      "top_drivers",
      "market_variation",
      "evidence",
      "live_data_check",
    ],
    maxDirectAnswerSentences: 4,
    maxSupportingCards: 5,
    allowedFindingTypes: [
      "treatment_concern",
      "treatment_journey",
      "perceived_benefit",
      "persona_pattern",
      "country_pattern",
    ],
  },

  diagnosis_barriers: {
    intent: "diagnosis_barriers",
    requiredSections: [
      "direct_answer",
      "barriers",
      "market_variation",
      "evidence",
      "live_data_check",
    ],
    maxDirectAnswerSentences: 4,
    maxSupportingCards: 5,
    allowedFindingTypes: [
      "diagnosis_barrier",
      "persona_pattern",
      "country_pattern",
    ],
  },

  safety_signals: {
    intent: "safety_signals",
    requiredSections: [
      "direct_answer",
      "top_safety_signals",
      "market_variation",
      "evidence",
      "live_data_check",
    ],
    maxDirectAnswerSentences: 4,
    maxSupportingCards: 5,
    allowedFindingTypes: [
      "safety_signal",
      "country_pattern",
    ],
  },

  market_landscape: {
    intent: "market_landscape",
    requiredSections: [
      "direct_answer",
      "market_variation",
      "platforms",
      "evidence",
      "live_data_check",
    ],
    maxDirectAnswerSentences: 4,
    maxSupportingCards: 6,
    allowedFindingTypes: [
      "country_pattern",
      "platform_preference",
      "persona_pattern",
    ],
  },

  general: {
    intent: "general",
    requiredSections: [
      "direct_answer",
      "supporting_findings",
      "evidence",
      "live_data_check",
    ],
    maxDirectAnswerSentences: 4,
    maxSupportingCards: 5,
    allowedFindingTypes: [
      "symptom_burden",
      "quality_of_life",
      "persona_pattern",
      "country_pattern",
      "platform_preference",
      "treatment_concern",
      "diagnosis_barrier",
      "safety_signal",
      "treatment_journey",
      "perceived_benefit",
      "other",
    ],
  },
};