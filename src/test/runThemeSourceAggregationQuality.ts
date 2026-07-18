import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  buildThemeSourceAggregation,
} from "../answering/themes/buildThemeSourceAggregation";
import type {
  EvidenceClass,
  PublicationType,
} from "../answering/evidence/types";

function createFinding(params: {
  id: string;
  evidenceClass: EvidenceClass;
  publicationType:
    PublicationType;
  qualityScore: number;
  sourceType:
    "live" | "curated";
  platform: string;
}): CanonicalFinding {
  return {
    findingId: params.id,
    findingType:
      "market_interest",
    canonicalClaim:
      `Finding ${params.id}`,
    summary:
      `Finding ${params.id}`,
    therapeuticArea:
      "regenerative_aesthetics",
    countries: [],
    personas: [],
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
    platform:
      params.platform,
    evidenceIntelligence: {
      evidenceClass:
        params.evidenceClass,
      publicationType:
        params.publicationType,
      platform:
        params.platform,
      qualityScore:
        params.qualityScore,
      classificationConfidence: 1,
      ontology: {
        platformFamily:
          params.platform ===
          "YouTube"
            ? "youtube"
            : "not_social",
      },
    },
  } as unknown as CanonicalFinding;
}

const triangulated =
  buildThemeSourceAggregation([
    createFinding({
      id: "patient",
      evidenceClass:
        "patient_conversation",
      publicationType:
        "forum_post",
      qualityScore: 100,
      sourceType: "live",
      platform: "Forum",
    }),
    createFinding({
      id: "provider",
      evidenceClass:
        "provider_conversation",
      publicationType:
        "blog_post",
      qualityScore: 80,
      sourceType: "live",
      platform: "Blog",
    }),
    createFinding({
      id: "research",
      evidenceClass:
        "research_journal",
      publicationType:
        "journal_article",
      qualityScore: 100,
      sourceType: "curated",
      platform: "Research",
    }),
    createFinding({
      id: "editorial",
      evidenceClass:
        "healthcare_news",
      publicationType:
        "news_article",
      qualityScore: 50,
      sourceType: "live",
      platform: "Online News",
    }),
    createFinding({
      id: "commercial",
      evidenceClass:
        "clinic_marketing",
      publicationType:
        "clinic_page",
      qualityScore: 0,
      sourceType: "live",
      platform: "Website",
    }),
  ]);

const singleSource =
  buildThemeSourceAggregation([
    createFinding({
      id: "patient-1",
      evidenceClass:
        "patient_conversation",
      publicationType:
        "forum_post",
      qualityScore: 90,
      sourceType: "live",
      platform: "Forum",
    }),
    createFinding({
      id: "patient-2",
      evidenceClass:
        "patient_conversation",
      publicationType:
        "forum_post",
      qualityScore: 85,
      sourceType: "live",
      platform: "Forum",
    }),
  ]);

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
  "independent categories",
  triangulated
    .distinctIndependentSourceCategoryCount,
  4
);

assertEqual(
  "distinct channels",
  triangulated
    .distinctChannelCount,
  5
);

assertEqual(
  "data origins",
  triangulated
    .distinctDataOriginCount,
  2
);

assertEqual(
  "commercial findings",
  triangulated
    .commercialFindingCount,
  1
);

assertEqual(
  "cross-source corroboration",
  triangulated
    .isCrossSourceCorroborated,
  true
);

assertEqual(
  "triangulation label",
  triangulated
    .triangulationLabel,
  "strong"
);

assertEqual(
  "single-source safeguard",
  singleSource
    .triangulationLabel,
  "single_source"
);

assertEqual(
  "single-source corroboration",
  singleSource
    .isCrossSourceCorroborated,
  false
);

console.log(
  JSON.stringify(
    {
      triangulated,
      singleSource,
    },
    null,
    2
  )
);
