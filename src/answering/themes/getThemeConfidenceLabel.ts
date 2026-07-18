import {
  RepresentativeEvidence,
  ThemeConfidenceLabel,
  ThemeEvidenceScore,
} from "./themeModels";
import { THEME_QUALITY_CONFIG } from "./themeQualityConfig";

export function getThemeConfidenceLabel(
  evidenceScore: ThemeEvidenceScore,
  representativeEvidence: RepresentativeEvidence[],
  count: number
): ThemeConfidenceLabel {
  if (
    count <
    THEME_QUALITY_CONFIG
      .minimumThemeCount
  ) {
    return "insufficient";
  }

  if (
    representativeEvidence.length ===
    0
  ) {
    return "insufficient";
  }

  const highQualityEvidenceCount =
    representativeEvidence.filter(
      (item) =>
        item.qualityScore >=
        THEME_QUALITY_CONFIG
          .minimumHighQualityEvidenceScore
    ).length;

  if (
    evidenceScore.totalScore >=
      75 &&
    highQualityEvidenceCount >= 2
  ) {
    return "high";
  }

  if (
    evidenceScore.totalScore >=
      55 &&
    highQualityEvidenceCount >= 1
  ) {
    return "moderate";
  }

  if (
    evidenceScore.totalScore >=
    35
  ) {
    return "directional";
  }

  return "insufficient";
}