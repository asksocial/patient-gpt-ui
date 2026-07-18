import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  buildThemePrevalenceContext,
  calculateThemePrevalence,
} from "../answering/themes/calculateThemePrevalence";
import {
  aggregateThemes,
} from "../answering/themes/aggregateThemes";

function createFinding(params: {
  id: string;
  themes: string[];
  qualityScore: number;
  platform: string;
  persona: string;
  country: string;
  sourceType: string;
}): CanonicalFinding {
  return {
    findingId: params.id,
    findingType:
      "market_interest",
    canonicalClaim:
      `Finding ${params.id}`,
    countries: [
      params.country,
    ],
    personas: [
      params.persona,
    ],
    platforms: [
      params.platform,
    ],
    symptoms: [],
    treatments: [],
    lifecycleStages: [],
    intentLabels: [],
    confidence: 1,
    relevanceScore: 1,
    evidenceStrength: 1,
    evidence: [],
    normalizedLabels: [],
    semanticFingerprint:
      params.id,
    structuredData: {},
    sourceType:
      params.sourceType,
    themes:
      params.themes,
    evidenceIntelligence: {
      qualityScore:
        params.qualityScore,
      classificationConfidence:
        1,
    },
  } as unknown as CanonicalFinding;
}

const findings = [
  createFinding({
    id: "a-b-high",
    themes: ["a", "b"],
    qualityScore: 100,
    platform: "Forum",
    persona: "Patient",
    country: "United States",
    sourceType: "live",
  }),
  createFinding({
    id: "a-medium",
    themes: ["a"],
    qualityScore: 50,
    platform: "Forum",
    persona: "Patient",
    country: "United States",
    sourceType: "curated",
  }),
  createFinding({
    id: "b-high",
    themes: ["b"],
    qualityScore: 100,
    platform: "News",
    persona: "Provider",
    country: "Canada",
    sourceType: "live",
  }),
  createFinding({
    id: "unthemed-high",
    themes: [],
    qualityScore: 100,
    platform: "Forum",
    persona: "Patient",
    country: "United States",
    sourceType: "live",
  }),
  createFinding({
    id: "a-b-zero-quality",
    themes: ["a", "b"],
    qualityScore: 0,
    platform: "Social Network",
    persona: "Brand",
    country: "United States",
    sourceType: "live",
  }),
];

const context =
  buildThemePrevalenceContext(
    findings,
    ["a", "b"]
  );

const prevalence =
  calculateThemePrevalence(
    context,
    "a"
  );

function assertEqual(
  label: string,
  actual: unknown,
  expected: unknown
): void {
  if (actual !== expected) {
    throw new Error(
      `${label} expected ${String(
        expected
      )}, received ${String(
        actual
      )}`
    );
  }
}

assertEqual(
  "datasetFindingCount",
  prevalence.datasetFindingCount,
  5
);

assertEqual(
  "eligibleFindingCount",
  prevalence.eligibleFindingCount,
  4
);

assertEqual(
  "matchingFindingCount",
  prevalence.matchingFindingCount,
  3
);

assertEqual(
  "themeAssignmentCount",
  prevalence.themeAssignmentCount,
  6
);

assertEqual(
  "datasetCoveragePercent",
  prevalence.datasetCoveragePercent,
  80
);

assertEqual(
  "rawPercent",
  prevalence.rawPercent,
  60
);

assertEqual(
  "eligiblePercent",
  prevalence.eligiblePercent,
  75
);

assertEqual(
  "evidenceWeightedPercent",
  prevalence.evidenceWeightedPercent,
  42.86
);

assertEqual(
  "eligibleEvidenceWeightedPercent",
  prevalence
    .eligibleEvidenceWeightedPercent,
  60
);

assertEqual(
  "shareOfThemeAssignmentsPercent",
  prevalence
    .shareOfThemeAssignmentsPercent,
  50
);

assertEqual(
  "overlapRatePercent",
  prevalence.overlapRatePercent,
  66.67
);

assertEqual(
  "averageThemesPerEligibleFinding",
  prevalence
    .averageThemesPerEligibleFinding,
  1.5
);

assertEqual(
  "forum denominator",
  prevalence.breakdowns
    .platforms.forum
    .denominator,
  3
);

assertEqual(
  "forum raw prevalence",
  prevalence.breakdowns
    .platforms.forum
    .rawPercent,
  66.67
);

assertEqual(
  "forum weighted prevalence",
  prevalence.breakdowns
    .platforms.forum
    .evidenceWeightedPercent,
  60
);

console.log(
  JSON.stringify(
    prevalence,
    null,
    2
  )
);

const integratedFindings =
  findings.map(
    (finding) => {
      const currentThemes =
        (finding as any)
          .themes as string[];

      return {
        ...(finding as any),
        therapeuticArea:
          "regenerative_aesthetics",
        themes:
          currentThemes.map(
            (theme) =>
              theme === "a"
                ? "natural_results"
                : "preventative_aesthetics"
          ),
      } as CanonicalFinding;
    }
  );

const aggregated =
  aggregateThemes(
    integratedFindings,
    "regenerative_aesthetics"
  );

const integratedNaturalResults =
  aggregated.find(
    (theme) =>
      theme.themeId ===
      "natural_results"
  );

if (!integratedNaturalResults) {
  throw new Error(
    "Expected natural_results in aggregated output."
  );
}

assertEqual(
  "integrated legacy percent",
  integratedNaturalResults.percent,
  60
);

assertEqual(
  "integrated eligible percent",
  integratedNaturalResults
    .prevalence
    ?.eligiblePercent,
  75
);

assertEqual(
  "integrated method version",
  integratedNaturalResults
    .prevalence
    ?.methodVersion,
  "theme_prevalence_v1"
);
