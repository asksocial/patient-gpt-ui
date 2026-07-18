import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  detectThemeRelationships,
} from "../answering/themes/detectThemeRelationships";
import type {
  ThemeMatch,
  ThemeQualityDiagnostics,
} from "../answering/themes/themeModels";

function createFinding(
  id: string,
  themes: string[]
): CanonicalFinding {
  return {
    findingId: id,

    findingType:
      "market_interest",

    canonicalClaim:
      `Finding ${id}`,

    summary:
      `Finding ${id}`,

    therapeuticArea:
      "test_new_area",

    countries: [],

    personas: [],

    platforms: [],

    symptoms: [],

    treatments: [],

    lifecycleStages: [],

    intentLabels: [],

    confidence: 0.8,

    relevanceScore: 0.8,

    evidenceStrength: 0.8,

    evidence: [],

    normalizedLabels: [],

    semanticFingerprint: id,

    structuredData: {},

    themes,
  } as unknown as CanonicalFinding;
}

const findings:
  CanonicalFinding[] = [
    createFinding("1", [
      "theme_a",
      "theme_b",
    ]),

    createFinding("2", [
      "theme_a",
      "theme_b",
    ]),

    createFinding("3", [
      "theme_a",
      "theme_b",
    ]),

    createFinding("4", [
      "theme_a",
      "theme_b",
    ]),

    createFinding("5", [
      "theme_a",
      "theme_c",
    ]),

    createFinding("6", [
      "theme_a",
    ]),

    createFinding("7", [
      "theme_b",
    ]),

    createFinding("8", [
      "theme_b",
    ]),
  ];

const emptyDiagnostics:
  ThemeQualityDiagnostics = {
    totalCandidates: 0,

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
  };

function createTheme(
  themeId: string,
  count: number
): ThemeMatch {
  return {
    themeId,

    label: themeId,

    description:
      `Test theme ${themeId}`,

    count,

    percent: 0,

    findingIds: [],

    representativeClaims: [],

    representativeEvidence: [],

    clientFacingEvidence: [],

    evidenceScore: {
      supportScore: 0,

      diversityScore: 0,

      confidenceScore: 0,

      qualityScore: 0,

      evidenceCompositionScore: 0,

      totalScore: 0,
    },

    confidenceLabel:
      "directional",

    countries: {},

    platforms: {},

    personas: {},

    sourceTypes: {},

    evidenceClassCounts: {},

    evidenceVoiceCounts: {},

    publicationTypeCounts: {},

    evidenceQualityBandCounts: {},

    relationships: [],

    qualityDiagnostics: {
      ...emptyDiagnostics,
    },
  };
}

const themeSummary:
  ThemeMatch[] = [
    createTheme(
      "theme_a",
      6
    ),

    createTheme(
      "theme_b",
      6
    ),

    createTheme(
      "theme_c",
      1
    ),
  ];

const relationships =
  detectThemeRelationships(
    findings,
    themeSummary,
    "test_new_area"
  );

console.log(
  JSON.stringify(
    relationships,
    null,
    2
  )
);