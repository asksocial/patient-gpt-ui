import type { RankingProfile } from "../types";
import { genericRankingProfile } from "../genericRankingProfile";

export const glp1RankingProfile: RankingProfile = {
  ...genericRankingProfile,
  profileId: "glp_1",
  globalBoosts: [
    ...(genericRankingProfile.globalBoosts || []),
    ...["glp-1", "semaglutide", "tirzepatide", "ozempic", "wegovy", "mounjaro", "zepbound", "food noise", "insurance coverage", "dose adjustment"].map((term) => ({ term, weight: 6 })),
  ],
  globalPenalties: [
    ...(genericRankingProfile.globalPenalties || []),
    { term: "investor alert", weight: 100 },
    { term: "securities class action", weight: 100 },
    { term: "market report", weight: 50 },
  ],
};
