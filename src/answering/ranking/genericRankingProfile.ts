import { RankingProfile } from "./types";

export const genericRankingProfile: RankingProfile = {
  profileId: "generic",

  globalBoosts: [
    { term: "patient", weight: 2 },
    { term: "caregiver", weight: 2 },
    { term: "experience", weight: 2 },
    { term: "results", weight: 1 },
    { term: "concern", weight: 1 },
  ],

  globalPenalties: [
    { term: "click here", weight: 20 },
    { term: "link in bio", weight: 20 },
    { term: "promo code", weight: 25 },
    { term: "discount", weight: 20 },
    { term: "giveaway", weight: 25 },
    { term: "shop now", weight: 25 },
    { term: "press release", weight: 20 },
    { term: "media contact", weight: 20 },
  ],

  globalHardRejectTerms: [
    "crypto",
    "forex",
    "onlyfans",
    "copy and paste",
  ],

  intentRules: {
    symptom_qol_burden: {
      preferredFindingTypes: [
        "symptom_burden",
        "quality_of_life",
        "persona_pattern",
        "country_pattern",
      ],
      boosts: [
        { term: "daily life", weight: 4 },
        { term: "day-to-day", weight: 4 },
        { term: "quality of life", weight: 5 },
        { term: "burden", weight: 3 },
      ],
    },

    treatment_decision_drivers: {
      preferredFindingTypes: [
        "treatment_concern",
        "treatment_journey",
        "perceived_benefit",
        "persona_pattern",
      ],
      boosts: [
        { term: "choose", weight: 3 },
        { term: "decision", weight: 3 },
        { term: "preference", weight: 3 },
        { term: "switch", weight: 3 },
      ],
    },

    diagnosis_barriers: {
      preferredFindingTypes: [
        "diagnosis_barrier",
        "persona_pattern",
        "country_pattern",
      ],
      boosts: [
        { term: "delay", weight: 4 },
        { term: "misdiagnosed", weight: 5 },
        { term: "access", weight: 3 },
        { term: "diagnosis", weight: 3 },
      ],
    },

    safety_signals: {
      preferredFindingTypes: [
        "safety_signal",
        "country_pattern",
      ],
      boosts: [
        { term: "side effect", weight: 5 },
        { term: "adverse", weight: 5 },
        { term: "safety", weight: 4 },
        { term: "tolerability", weight: 4 },
      ],
    },

    market_interest: {
      preferredFindingTypes: [
        "market_interest",
        "adoption_driver",
      ],
      boosts: [
        { term: "growing interest", weight: 5 },
        { term: "demand", weight: 4 },
        { term: "trend", weight: 3 },
        { term: "adoption", weight: 3 },
      ],
    },

    education_barriers: {
      preferredFindingTypes: [
        "education_barrier",
        "unmet_need",
      ],
      boosts: [
        { term: "confused", weight: 4 },
        { term: "misunderstanding", weight: 4 },
        { term: "knowledge gap", weight: 5 },
        { term: "skeptical", weight: 3 },
      ],
    },

    competitive_alternatives: {
      preferredFindingTypes: [
        "competitive_alternative",
        "treatment_concern",
      ],
      boosts: [
        { term: "versus", weight: 4 },
        { term: "instead of", weight: 4 },
        { term: "alternative", weight: 4 },
        { term: "compare", weight: 3 },
      ],
    },

    adoption_drivers: {
      preferredFindingTypes: [
        "adoption_driver",
        "perceived_benefit",
      ],
      boosts: [
        { term: "why i chose", weight: 5 },
        { term: "worth it", weight: 4 },
        { term: "results", weight: 3 },
        { term: "benefit", weight: 3 },
      ],
    },

    market_opportunities: {
      preferredFindingTypes: [
        "market_opportunity",
        "market_interest",
        "education_barrier",
        "adoption_driver",
      ],
      boosts: [
        { term: "opportunity", weight: 5 },
        { term: "white space", weight: 5 },
        { term: "unmet need", weight: 4 },
        { term: "gap", weight: 3 },
      ],
    },

    market_landscape: {
      preferredFindingTypes: [
        "country_pattern",
        "platform_preference",
        "persona_pattern",
        "market_interest",
      ],
    },

    general: {
      preferredFindingTypes: [],
    },
  },
};