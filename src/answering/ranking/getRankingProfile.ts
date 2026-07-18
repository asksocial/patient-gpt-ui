import { genericRankingProfile } from "./genericRankingProfile";
import { RankingProfile } from "./types";
import { regenerativeAestheticsRankingProfile } from "./profiles/regenerativeAesthetics";

const RANKING_PROFILES: Record<string, RankingProfile> = {
  regenerative_aesthetics:
    regenerativeAestheticsRankingProfile,
};

export function getRankingProfile(
  therapeuticArea?: string
): RankingProfile {
  if (!therapeuticArea) {
    return genericRankingProfile;
  }

  return (
    RANKING_PROFILES[therapeuticArea] ||
    genericRankingProfile
  );
}