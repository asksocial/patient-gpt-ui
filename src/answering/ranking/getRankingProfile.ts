import { genericRankingProfile } from "./genericRankingProfile";
import { RankingProfile } from "./types";
import { regenerativeAestheticsRankingProfile } from "./profiles/regenerativeAesthetics";
import { botulinumToxinRankingProfile } from "./profiles/botulinumToxin";
import { glp1RankingProfile } from "./profiles/glp1";
import { normalizeTherapeuticAreaId } from "../../lib/analytics/coverage";

const RANKING_PROFILES: Record<string, RankingProfile> = {
  glp_1: glp1RankingProfile,
  regenerative_aesthetics:
    regenerativeAestheticsRankingProfile,
  medical_aesthetics:
    regenerativeAestheticsRankingProfile,
  botulinum_toxin:
    botulinumToxinRankingProfile,
};

export function getRankingProfile(
  therapeuticArea?: string
): RankingProfile {
  if (!therapeuticArea) {
    return genericRankingProfile;
  }

  const normalized = normalizeTherapeuticAreaId(therapeuticArea);
  return (
    RANKING_PROFILES[normalized] ||
    genericRankingProfile
  );
}
