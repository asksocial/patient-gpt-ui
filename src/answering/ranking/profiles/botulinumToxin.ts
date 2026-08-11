import type { RankingProfile } from "../types";

export const botulinumToxinRankingProfile: RankingProfile = {
  profileId: "botulinum_toxin",
  globalBoosts: [
    { term: "botulinum toxin", weight: 10 }, { term: "botox", weight: 8 }, { term: "dysport", weight: 7 },
    { term: "xeomin", weight: 7 }, { term: "jeuveau", weight: 7 }, { term: "daxxify", weight: 7 },
    { term: "letybo", weight: 7 }, { term: "patient", weight: 5 }, { term: "injector", weight: 5 },
    { term: "side effect", weight: 7 }, { term: "natural result", weight: 6 }, { term: "wearing off", weight: 6 },
  ],
  globalPenalties: [
    { term: "book now", weight: 150 }, { term: "limited offer", weight: 150 }, { term: "discount", weight: 100 },
    { term: "training course", weight: 100 }, { term: "market report", weight: 100 }, { term: "press release", weight: 100 },
    { term: "brand ambassador", weight: 100 }, { term: "now hiring", weight: 150 },
  ],
  globalHardRejectTerms: ["dm to book", "call today", "price list", "injector training models needed", "prnewswire"],
  intentRules: {
    market_interest: {
      preferredFindingTypes: ["market_interest", "adoption_driver"],
      boosts: [{ term: "demand", weight: 8 }, { term: "first time", weight: 7 }, { term: "preventative", weight: 7 }, { term: "natural", weight: 7 }],
    },
    education_barriers: {
      preferredFindingTypes: ["education_barrier", "treatment_concern"],
      boosts: [{ term: "is it safe", weight: 10 }, { term: "side effect", weight: 9 }, { term: "units", weight: 6 }, { term: "confused", weight: 7 }],
    },
    competitive_alternatives: {
      preferredFindingTypes: ["competitive_alternative", "treatment_concern"],
      boosts: [{ term: "vs", weight: 8 }, { term: "switched", weight: 10 }, { term: "dysport", weight: 7 }, { term: "xeomin", weight: 7 }, { term: "daxxify", weight: 7 }],
    },
    adoption_drivers: {
      preferredFindingTypes: ["adoption_driver", "market_interest"],
      boosts: [{ term: "natural result", weight: 9 }, { term: "still have movement", weight: 10 }, { term: "worked", weight: 6 }, { term: "long lasting", weight: 7 }],
    },
    market_opportunities: {
      preferredFindingTypes: ["market_opportunity", "market_interest", "education_barrier"],
      boosts: [{ term: "provider trust", weight: 8 }, { term: "duration", weight: 7 }, { term: "access", weight: 7 }, { term: "therapeutic", weight: 7 }],
    },
  },
};
