import {
  ThemeAnswerContext,
  ThemeMatch,
  ThemeRelationship,
} from "./themeModels";
import {
  meetsMinimumConfidence,
  THEME_QUALITY_CONFIG,
} from "./themeQualityConfig";
import {
  buildThemeStrategicImplications,
} from "./buildThemeStrategicImplications";

function isEligibleForNarrative(
  theme: ThemeMatch
): boolean {
  return (
    theme.count >=
      THEME_QUALITY_CONFIG
        .minimumThemeCount &&
    theme.representativeEvidence
      .length >=
      THEME_QUALITY_CONFIG
        .minimumRepresentativeEvidence &&
    meetsMinimumConfidence(
      theme.confidenceLabel,
      THEME_QUALITY_CONFIG
        .minimumConfidenceForNarrative
    )
  );
}

export function buildThemeAnswerContext(
  themes: ThemeMatch[],
  relationships: ThemeRelationship[]
): ThemeAnswerContext {
  const eligibleThemes =
    themes.filter(
      isEligibleForNarrative
    );

  const dominantThemes =
    eligibleThemes.slice(
      0,
      THEME_QUALITY_CONFIG
        .maxDominantThemes
    );

  const dominantIds = new Set(
    dominantThemes.map(
      (theme) => theme.themeId
    )
  );

  const supportingThemes =
    eligibleThemes
      .filter(
        (theme) =>
          !dominantIds.has(
            theme.themeId
          )
      )
      .slice(
        0,
        THEME_QUALITY_CONFIG
          .maxSupportingThemes
      );

  const lowConfidenceThemes =
    themes.filter(
      (theme) =>
        !isEligibleForNarrative(
          theme
        )
    );

  return {
    dominantThemes,
    supportingThemes,
    lowConfidenceThemes,
    relationships,
    strategicImplications:
      buildThemeStrategicImplications(
        themes,
        relationships
      ),
  };
}
