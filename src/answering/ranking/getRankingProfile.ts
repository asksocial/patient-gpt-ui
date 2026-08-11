import { genericRankingProfile } from "./genericRankingProfile";
import { RankingProfile } from "./types";
import { regenerativeAestheticsRankingProfile } from "./profiles/regenerativeAesthetics";
import { botulinumToxinRankingProfile } from "./profiles/botulinumToxin";

const RANKING_PROFILES: Record<string, RankingProfile> = {
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

  const normalized = therapeuticArea.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (
    RANKING_PROFILES[normalized] ||
    genericRankingProfile
  );
}
