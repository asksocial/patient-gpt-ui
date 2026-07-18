import {
  enrichHybridAnswerWithAnalytical,
} from "../lib/answers/enrichHybridAnswerWithAnalytical";
import type {
  HybridAnswer,
} from "../lib/answers/composeHybridAnswer";

const emptyHybridAnswer: HybridAnswer = {
  directAnswer: "No hybrid evidence was available.",
  curatedIntelligence: {
    themes: [],
  },
  liveData: {
    themes: [],
    emergingNarratives: [],
  },
  whatThisMeans: "Coverage is unavailable.",
  recommendedActions: [
    "Load or approve a dataset.",
  ],
};

const enriched = enrichHybridAnswerWithAnalytical(
  emptyHybridAnswer,
  {
    themeSummary: [
      {
        themeId: "skin_quality",
        label: "Skin quality concerns",
        description:
          "People discuss texture, firmness, and gradual improvement.",
        percent: 19.84,
        confidenceLabel: "high",
        countries: {
          "United States": 12,
          Switzerland: 5,
        },
        platforms: {
          YouTube: 9,
          Instagram: 7,
        },
        personas: {
          Patient: 8,
        },
      },
    ],
    themeStrategicImplications: [
      {
        recommendedAction:
          "Validate skin-quality language with independent patient and provider evidence.",
      },
    ],
  }
);

const theme = enriched.liveData.themes[0];

if (!theme) {
  throw new Error(
    "Analytical themes must populate an otherwise empty live-intelligence panel."
  );
}

if (
  theme.relationship !== "live" ||
  theme.sourceType !== "analytical_corpus" ||
  theme.confidenceLabel !== "high" ||
  theme.percent !== 19.8 ||
  theme.personas?.[0] !== "Patient" ||
  theme.platforms?.[0] !== "YouTube" ||
  theme.countries?.[0] !== "United States"
) {
  throw new Error(
    "Analytical live-theme metadata was not normalized for UI tags."
  );
}

if (
  enriched.recommendedActions[0] !==
  "Validate skin-quality language with independent patient and provider evidence."
) {
  throw new Error(
    "Evidence-qualified strategic actions must replace false no-data recommendations."
  );
}

const existingHybridAnswer: HybridAnswer = {
  ...emptyHybridAnswer,
  liveData: {
    themes: [
      {
        name: "Existing theme",
        description: "Existing hybrid evidence",
      },
    ],
    emergingNarratives: [],
  },
  recommendedActions: [
    "Keep the existing hybrid action.",
  ],
};

const preserved = enrichHybridAnswerWithAnalytical(
  existingHybridAnswer,
  {
    themeSummary: [
      {
        label: "Analytical fallback",
      },
    ],
    themeStrategicImplications: [
      {
        recommendedAction: "Fallback action",
      },
    ],
  }
);

if (
  preserved.liveData.themes[0]?.name !== "Existing theme" ||
  preserved.recommendedActions[0] !==
    "Keep the existing hybrid action."
) {
  throw new Error(
    "Analytical enrichment must not overwrite existing hybrid intelligence."
  );
}

console.log(
  JSON.stringify(
    {
      liveThemeFallback: true,
      intelligenceTags: true,
      strategicActions: true,
      existingHybridEvidencePreserved: true,
    },
    null,
    2
  )
);
