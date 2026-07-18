import {
  buildThemeStrategicImplications,
} from "../answering/themes/buildThemeStrategicImplications";
import type {
  ThemeMatch,
  ThemeSourceAggregation,
} from "../answering/themes/themeModels";

function sourceAggregation(
  overrides: Partial<
    ThemeSourceAggregation
  > = {}
): ThemeSourceAggregation {
  return {
    methodVersion:
      "theme_source_aggregation_v1",
    totalFindings: 40,
    totalEvidenceWeight: 30,
    sourceCategories: {
      first_person: {
        count: 18,
        percentOfThemeFindings: 45,
        evidenceWeight: 16,
        weightedSharePercent: 53.33,
        averageEvidenceQualityScore: 88,
      },
      provider_voice: {
        count: 12,
        percentOfThemeFindings: 30,
        evidenceWeight: 10,
        weightedSharePercent: 33.33,
        averageEvidenceQualityScore: 84,
      },
      research_or_science: {
        count: 10,
        percentOfThemeFindings: 25,
        evidenceWeight: 4,
        weightedSharePercent: 13.34,
        averageEvidenceQualityScore: 92,
      },
    },
    channels: {
      social: {
        count: 18,
        percentOfThemeFindings: 45,
        evidenceWeight: 16,
        weightedSharePercent: 53.33,
        averageEvidenceQualityScore: 88,
      },
      blog: {
        count: 12,
        percentOfThemeFindings: 30,
        evidenceWeight: 10,
        weightedSharePercent: 33.33,
        averageEvidenceQualityScore: 84,
      },
      research: {
        count: 10,
        percentOfThemeFindings: 25,
        evidenceWeight: 4,
        weightedSharePercent: 13.34,
        averageEvidenceQualityScore: 92,
      },
    },
    dataOrigins: {
      live: {
        count: 30,
        percentOfThemeFindings: 75,
        evidenceWeight: 24,
        weightedSharePercent: 80,
        averageEvidenceQualityScore: 86,
      },
      curated: {
        count: 10,
        percentOfThemeFindings: 25,
        evidenceWeight: 6,
        weightedSharePercent: 20,
        averageEvidenceQualityScore: 92,
      },
    },
    distinctSourceCategoryCount: 3,
    distinctIndependentSourceCategoryCount: 3,
    distinctChannelCount: 3,
    distinctDataOriginCount: 2,
    independentFindingCount: 40,
    commercialFindingCount: 0,
    lowTrustFindingCount: 0,
    unknownFindingCount: 0,
    independentPercent: 100,
    commercialPercent: 0,
    livePercent: 75,
    curatedPercent: 25,
    triangulationScore: 88,
    triangulationLabel: "strong",
    isCrossSourceCorroborated: true,
    reasons: [
      "Three independent categories support the theme",
    ],
    ...overrides,
  };
}

function theme(
  themeId: string,
  label: string,
  count: number,
  eligiblePercent: number,
  aggregation:
    ThemeSourceAggregation,
  confidenceLabel:
    ThemeMatch["confidenceLabel"] =
      "high"
): ThemeMatch {
  return {
    themeId,
    label,
    count,
    percent: eligiblePercent,
    prevalence: {
      methodVersion:
        "theme_prevalence_v1",
      datasetFindingCount: 100,
      eligibleFindingCount: 80,
      matchingFindingCount: count,
      themeAssignmentCount: 90,
      datasetCoveragePercent: 80,
      rawPercent: count,
      eligiblePercent,
      evidenceWeightedPercent:
        eligiblePercent,
      eligibleEvidenceWeightedPercent:
        eligiblePercent,
      shareOfThemeAssignmentsPercent:
        eligiblePercent,
      matchingEvidenceWeight: count,
      datasetEvidenceWeight: 80,
      eligibleEvidenceWeight: 70,
      overlappingMatchingFindingCount: 0,
      overlapRatePercent: 0,
      averageThemesPerEligibleFinding: 1.13,
      breakdowns: {
        countries: {},
        platforms: {},
        personas: {},
        sourceTypes: {},
      },
    },
    sourceAggregation:
      aggregation,
    findingIds: [],
    representativeClaims: [],
    representativeEvidence: [],
    clientFacingEvidence: [],
    evidenceScore: {
      supportScore: 90,
      diversityScore: 90,
      confidenceScore: 90,
      qualityScore: 90,
      totalScore: 90,
    },
    confidenceLabel,
    countries: {},
    platforms: {},
    personas: {},
    sourceTypes: {},
    relationships: [],
    qualityDiagnostics: {
      totalCandidates: count,
      lowRelevanceRejected: 0,
      promotionalRejected: 0,
      unknownClassRejected: 0,
      lowTrustRejected: 0,
      taxonomyExcluded: 0,
      excludedCategoryRejected: 0,
      belowQualityRejected: 0,
      duplicateRejected: 0,
      diversityRejected: 0,
      directVoiceSelected: 0,
      editorialSelected: 0,
      fallbackSelected: 0,
      selectedCount: 0,
    },
  };
}

const primary = theme(
  "primary",
  "Primary Theme",
  40,
  50,
  sourceAggregation()
);

const related = theme(
  "related",
  "Related Theme",
  25,
  31.25,
  sourceAggregation({
    totalFindings: 25,
  }),
  "moderate"
);

const commercial = theme(
  "commercial",
  "Commercially Amplified Theme",
  20,
  25,
  sourceAggregation({
    totalFindings: 20,
    independentFindingCount: 8,
    commercialFindingCount: 12,
    independentPercent: 40,
    commercialPercent: 60,
  }),
  "moderate"
);

const weak = theme(
  "weak",
  "Emerging Theme",
  5,
  6.25,
  sourceAggregation({
    totalFindings: 5,
    distinctSourceCategoryCount: 1,
    distinctIndependentSourceCategoryCount: 1,
    distinctChannelCount: 1,
    distinctDataOriginCount: 1,
    independentFindingCount: 5,
    triangulationScore: 45,
    triangulationLabel:
      "single_source",
    isCrossSourceCorroborated: false,
  }),
  "directional"
);

const implications =
  buildThemeStrategicImplications(
    [
      primary,
      related,
      commercial,
      weak,
    ],
    [
      {
        sourceThemeId: "primary",
        targetThemeId: "related",
        relationshipType: "supports",
        strength: 0.68,
        coOccurrenceCount: 18,
        confidence: "moderate",
      },
    ]
  );

const byType = new Map(
  implications.map((item) => [
    item.type,
    item,
  ])
);

for (const required of [
  "priority_narrative",
  "integrated_narrative",
  "audience_activation",
  "commercial_safeguard",
  "evidence_validation",
] as const) {
  if (!byType.has(required)) {
    throw new Error(
      `Missing ${required} implication.`
    );
  }
}

if (
  byType.get("priority_narrative")
    ?.themeIds[0] !== "primary"
) {
  throw new Error(
    "The strongest corroborated theme should lead the strategic implications."
  );
}

if (
  !byType
    .get("evidence_validation")
    ?.themeIds.includes("weak")
) {
  throw new Error(
    "A single-source theme must produce a validation implication."
  );
}

if (
  byType.get("commercial_safeguard")
    ?.priority === "high"
) {
  throw new Error(
    "Commercially amplified evidence must not create a high-priority recommendation."
  );
}

console.log(
  JSON.stringify(
    implications,
    null,
    2
  )
);
