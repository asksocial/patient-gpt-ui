import type {
  HybridAnswer,
} from "./composeHybridAnswer";

type AnalyticalTheme = {
  themeId?: string;
  label?: string;
  description?: string;
  percent?: number;
  confidenceLabel?: string;
  representativeClaims?: string[];
  countries?: Record<string, number>;
  platforms?: Record<string, number>;
  personas?: Record<string, number>;
};

type AnalyticalImplication = {
  recommendedAction?: string;
};

type AnalyticalIntelligence = {
  themeSummary?: AnalyticalTheme[];
  themeStrategicImplications?: AnalyticalImplication[];
} | null;

function compactText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function topDimensionValues(
  values?: Record<string, number>,
  limit = 2
): string[] {
  if (!values) {
    return [];
  }

  return Object.entries(values)
    .filter(
      ([label, count]) =>
        compactText(label) && Number(count) > 0
    )
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([label]) => label);
}

function analyticalLiveThemes(themes: AnalyticalTheme[] = []) {
  return themes
    .filter((theme) => compactText(theme.label))
    .slice(0, 6)
    .map((theme) => {
      const percent =
        typeof theme.percent === "number"
          ? Math.round(theme.percent * 10) / 10
          : undefined;
      const description =
        compactText(theme.description) ||
        compactText(theme.representativeClaims?.[0]) ||
        (typeof percent === "number"
          ? `${theme.label} appears in approximately ${percent}% of the validated live finding set.`
          : "Validated theme detected in the live social corpus.");

      return {
        name: compactText(theme.label) || "Unnamed live theme",
        description,
        sourceType: "analytical_corpus",
        relationship: "live",
        confidenceLabel:
          compactText(theme.confidenceLabel) || undefined,
        percent,
        countries: topDimensionValues(theme.countries),
        platforms: topDimensionValues(theme.platforms),
        personas: topDimensionValues(theme.personas),
      };
    });
}

function analyticalRecommendedActions(
  implications: AnalyticalImplication[] = []
): string[] {
  return Array.from(
    new Set(
      implications
        .map((item) => compactText(item.recommendedAction))
        .filter(Boolean)
    )
  ).slice(0, 4);
}

export function enrichHybridAnswerWithAnalytical(
  answer: HybridAnswer,
  intelligence: AnalyticalIntelligence
): HybridAnswer {
  if (!intelligence) {
    return answer;
  }

  const existingLiveThemes = answer.liveData?.themes || [];
  const fallbackLiveThemes = analyticalLiveThemes(
    intelligence.themeSummary
  );
  const liveThemes =
    existingLiveThemes.length > 0
      ? existingLiveThemes
      : fallbackLiveThemes;
  const analyticalActions = analyticalRecommendedActions(
    intelligence.themeStrategicImplications
  );
  const shouldUseAnalyticalActions =
    existingLiveThemes.length === 0 && analyticalActions.length > 0;

  return {
    ...answer,
    liveData: {
      ...answer.liveData,
      themes: liveThemes,
    },
    recommendedActions: shouldUseAnalyticalActions
      ? analyticalActions
      : answer.recommendedActions,
  };
}
