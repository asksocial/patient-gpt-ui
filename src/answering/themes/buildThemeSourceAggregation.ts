import type {
  CanonicalFinding,
} from "../models/finding";
import type {
  EvidenceClass,
  PublicationType,
} from "../evidence/types";
import {
  getThemePrevalenceEvidenceWeight,
} from "./calculateThemePrevalence";
import {
  classifyEvidenceSource,
} from "./classifyEvidenceSource";
import type {
  EvidenceSourceCategory,
  ThemeDataOrigin,
  ThemeSourceAggregation,
  ThemeSourceChannel,
  ThemeSourceSupport,
  ThemeTriangulationLabel,
} from "./themeModels";

const INDEPENDENT_SOURCE_CATEGORIES =
  new Set<EvidenceSourceCategory>([
    "first_person",
    "caregiver_voice",
    "provider_voice",
    "community_voice",
    "research_or_science",
    "independent_editorial",
  ]);

const COMMERCIAL_SOURCE_CATEGORIES =
  new Set<EvidenceSourceCategory>([
    "brand_owned",
    "clinic_marketing",
    "retail_or_product",
    "press_release",
  ]);

const LOW_TRUST_SOURCE_CATEGORIES =
  new Set<EvidenceSourceCategory>([
    "event_or_conference",
  ]);

const EVIDENCE_CLASS_TO_SOURCE_CATEGORY:
  Partial<
    Record<
      EvidenceClass,
      EvidenceSourceCategory
    >
  > = {
    patient_conversation:
      "first_person",
    caregiver_conversation:
      "caregiver_voice",
    provider_conversation:
      "provider_voice",
    community_conversation:
      "community_voice",
    research_journal:
      "research_or_science",
    clinical_study:
      "research_or_science",
    government_or_regulator:
      "research_or_science",
    medical_society:
      "research_or_science",
    advocacy_organization:
      "independent_editorial",
    healthcare_trade_publication:
      "independent_editorial",
    healthcare_news:
      "independent_editorial",
    consumer_news:
      "independent_editorial",
    corporate_pr:
      "press_release",
    clinic_marketing:
      "clinic_marketing",
    retail_or_product:
      "retail_or_product",
    sponsored_content:
      "brand_owned",
    influencer_content:
      "brand_owned",
    event_or_conference:
      "event_or_conference",
  };

type ClassifiedFinding = {
  finding: CanonicalFinding;

  sourceCategory:
    EvidenceSourceCategory;

  channel:
    ThemeSourceChannel;

  dataOrigin:
    ThemeDataOrigin;

  evidenceWeight: number;

  evidenceQualityScore: number;
};

function round(
  value: number,
  digits = 2
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** digits;

  return Math.round(
    value * factor
  ) / factor;
}

function percent(
  numerator: number,
  denominator: number
): number {
  if (denominator <= 0) {
    return 0;
  }

  return round(
    numerator /
      denominator *
      100
  );
}

function normalize(
  value: unknown
): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getEvidenceClass(
  finding: CanonicalFinding
): EvidenceClass | undefined {
  return (finding as any)
    .evidenceIntelligence
    ?.evidenceClass;
}

function getSourceCategory(
  finding: CanonicalFinding
): EvidenceSourceCategory {
  const evidenceClass =
    getEvidenceClass(finding);

  if (
    evidenceClass &&
    EVIDENCE_CLASS_TO_SOURCE_CATEGORY[
      evidenceClass
    ]
  ) {
    return EVIDENCE_CLASS_TO_SOURCE_CATEGORY[
      evidenceClass
    ] as EvidenceSourceCategory;
  }

  return classifyEvidenceSource(
    finding,
    ""
  );
}

function getPublicationType(
  finding: CanonicalFinding
): PublicationType | undefined {
  return (finding as any)
    .evidenceIntelligence
    ?.publicationType;
}

function getChannel(
  finding: CanonicalFinding,
  sourceCategory:
    EvidenceSourceCategory
): ThemeSourceChannel {
  const value =
    finding as any;

  const intelligence =
    value.evidenceIntelligence;

  const publicationType =
    getPublicationType(
      finding
    );

  const archetype =
    normalize(
      intelligence?.ontology
        ?.publicationArchetype
    );

  const platformFamily =
    normalize(
      intelligence?.ontology
        ?.platformFamily
    );

  if (
    publicationType ===
      "journal_article" ||
    publicationType ===
      "clinical_trial_record"
  ) {
    return "research";
  }

  if (
    publicationType ===
    "government_document"
  ) {
    return "government";
  }

  if (
    publicationType ===
    "medical_society_content"
  ) {
    return "medical_society";
  }

  if (
    publicationType ===
    "forum_post"
  ) {
    return "forum";
  }

  if (
    publicationType === "review"
  ) {
    return "review";
  }

  if (
    publicationType === "video" ||
    platformFamily === "youtube" ||
    [
      "educational_video",
      "testimonial_video",
      "promotional_video",
    ].includes(archetype)
  ) {
    return "video";
  }

  if (
    [
      "news_article",
      "trade_article",
      "press_release",
      "sponsored_article",
    ].includes(
      String(publicationType)
    )
  ) {
    return "news";
  }

  if (
    publicationType === "blog_post"
  ) {
    return "blog";
  }

  if (
    publicationType === "podcast"
  ) {
    return "podcast";
  }

  if (
    publicationType ===
      "conference_content" ||
    archetype === "event_content"
  ) {
    return "event";
  }

  if (
    publicationType ===
      "clinic_page" ||
    publicationType ===
      "product_page" ||
    [
      "brand_owned",
      "clinic_marketing",
      "retail_or_product",
    ].includes(sourceCategory)
  ) {
    return "commercial_owned";
  }

  if (
    publicationType ===
      "social_post" ||
    [
      "twitter",
      "linkedin",
      "pinterest",
      "tiktok",
      "bluesky",
      "snapchat",
      "line_voom",
      "other_social",
    ].includes(platformFamily)
  ) {
    return "social";
  }

  const rawPlatform =
    normalize(
      intelligence?.platform ||
      value.platform ||
      value.platforms?.[0]
    );

  if (
    rawPlatform.includes("social")
  ) {
    return "social";
  }

  if (
    rawPlatform.includes("forum")
  ) {
    return "forum";
  }

  if (
    rawPlatform.includes("research")
  ) {
    return "research";
  }

  if (
    rawPlatform.includes("news")
  ) {
    return "news";
  }

  if (
    sourceCategory ===
    "independent_editorial"
  ) {
    return "advocacy";
  }

  return "other";
}

function getDataOrigin(
  finding: CanonicalFinding
): ThemeDataOrigin {
  const value =
    finding as any;

  const sourceType =
    normalize(
      value.sourceType ||
      value.structuredData
        ?.sourceType
    );

  if (
    sourceType === "live" ||
    sourceType === "meltwater"
  ) {
    return "live";
  }

  if (
    sourceType === "curated"
  ) {
    return "curated";
  }

  return "unknown";
}

function getEvidenceQualityScore(
  finding: CanonicalFinding
): number {
  const value = Number(
    (finding as any)
      .evidenceIntelligence
      ?.qualityScore
  );

  if (!Number.isFinite(value)) {
    return round(
      getThemePrevalenceEvidenceWeight(
        finding
      ) * 100
    );
  }

  return Math.max(
    0,
    Math.min(100, value)
  );
}

function classifyFindings(
  findings: CanonicalFinding[]
): ClassifiedFinding[] {
  return findings.map(
    (finding) => {
      const sourceCategory =
        getSourceCategory(
          finding
        );

      return {
        finding,
        sourceCategory,
        channel:
          getChannel(
            finding,
            sourceCategory
          ),
        dataOrigin:
          getDataOrigin(
            finding
          ),
        evidenceWeight:
          getThemePrevalenceEvidenceWeight(
            finding
          ),
        evidenceQualityScore:
          getEvidenceQualityScore(
            finding
          ),
      };
    }
  );
}

function buildSupportMap<
  T extends string
>(
  findings: ClassifiedFinding[],
  getKey: (
    finding: ClassifiedFinding
  ) => T,
  totalEvidenceWeight: number
): Partial<
  Record<T, ThemeSourceSupport>
> {
  const grouped =
    new Map<
      T,
      ClassifiedFinding[]
    >();

  for (const finding of findings) {
    const key =
      getKey(finding);

    const values =
      grouped.get(key) || [];

    values.push(finding);
    grouped.set(key, values);
  }

  return Object.fromEntries(
    Array.from(
      grouped.entries()
    )
      .map(
        ([key, values]): [
          T,
          ThemeSourceSupport
        ] => {
          const evidenceWeight =
            values.reduce(
              (sum, finding) =>
                sum +
                finding
                  .evidenceWeight,
              0
            );

          const averageQuality =
            values.length > 0
              ? values.reduce(
                  (sum, finding) =>
                    sum +
                    finding
                      .evidenceQualityScore,
                  0
                ) /
                values.length
              : 0;

          return [
            key,
            {
              count:
                values.length,
              percentOfThemeFindings:
                percent(
                  values.length,
                  findings.length
                ),
              evidenceWeight:
                round(
                  evidenceWeight,
                  4
                ),
              weightedSharePercent:
                percent(
                  evidenceWeight,
                  totalEvidenceWeight
                ),
              averageEvidenceQualityScore:
                round(
                  averageQuality
                ),
            },
          ];
        }
      )
      .sort(
        (
          [, first],
          [, second]
        ) =>
          second
            .weightedSharePercent -
            first
              .weightedSharePercent ||
          second.count -
            first.count
      )
  ) as Partial<
    Record<T, ThemeSourceSupport>
  >;
}

function getTriangulationLabel(
  score: number,
  corroborated: boolean,
  totalFindings: number,
  independentSourceCount: number,
  channelCount: number
): ThemeTriangulationLabel {
  if (totalFindings < 2) {
    return "insufficient";
  }

  if (
    independentSourceCount < 2 ||
    channelCount < 2
  ) {
    return "single_source";
  }

  if (
    corroborated &&
    score >= 75
  ) {
    return "strong";
  }

  if (
    corroborated &&
    score >= 55
  ) {
    return "moderate";
  }

  return "directional";
}

export function buildThemeSourceAggregation(
  findings: CanonicalFinding[]
): ThemeSourceAggregation {
  const classified =
    classifyFindings(findings);

  const totalEvidenceWeight =
    classified.reduce(
      (sum, finding) =>
        sum +
        finding.evidenceWeight,
      0
    );

  const sourceCategories =
    buildSupportMap(
      classified,
      (finding) =>
        finding.sourceCategory,
      totalEvidenceWeight
    );

  const channels =
    buildSupportMap(
      classified,
      (finding) =>
        finding.channel,
      totalEvidenceWeight
    );

  const dataOrigins =
    buildSupportMap(
      classified,
      (finding) =>
        finding.dataOrigin,
      totalEvidenceWeight
    );

  const independent =
    classified.filter(
      (finding) =>
        INDEPENDENT_SOURCE_CATEGORIES.has(
          finding.sourceCategory
        )
    );

  const commercial =
    classified.filter(
      (finding) =>
        COMMERCIAL_SOURCE_CATEGORIES.has(
          finding.sourceCategory
        )
    );

  const lowTrust =
    classified.filter(
      (finding) =>
        LOW_TRUST_SOURCE_CATEGORIES.has(
          finding.sourceCategory
        )
    );

  const unknown =
    classified.filter(
      (finding) =>
        finding.sourceCategory ===
        "unknown"
    );

  const independentCategories =
    new Set(
      independent.map(
        (finding) =>
          finding.sourceCategory
      )
    );

  const channelSet =
    new Set(
      classified.map(
        (finding) =>
          finding.channel
      )
    );

  const knownOriginSet =
    new Set(
      classified
        .map(
          (finding) =>
            finding.dataOrigin
        )
        .filter(
          (origin) =>
            origin !== "unknown"
        )
    );

  const independentEvidenceWeight =
    independent.reduce(
      (sum, finding) =>
        sum +
        finding.evidenceWeight,
      0
    );

  const sourceDiversityScore =
    Math.min(
      1,
      independentCategories
        .size / 4
    ) * 35;

  const channelDiversityScore =
    Math.min(
      1,
      channelSet.size / 4
    ) * 25;

  const originDiversityScore =
    knownOriginSet.size >= 2
      ? 10
      : knownOriginSet.size === 1
        ? 5
        : 0;

  const independentSupportScore =
    totalEvidenceWeight > 0
      ? independentEvidenceWeight /
        totalEvidenceWeight *
        20
      : 0;

  const volumeScore =
    Math.min(
      1,
      findings.length / 10
    ) * 10;

  const commercialPenalty =
    findings.length > 0
      ? commercial.length /
        findings.length *
        15
      : 0;

  const triangulationScore =
    round(
      Math.max(
        0,
        Math.min(
          100,
          sourceDiversityScore +
            channelDiversityScore +
            originDiversityScore +
            independentSupportScore +
            volumeScore -
            commercialPenalty
        )
      )
    );

  const isCrossSourceCorroborated =
    independentCategories.size >=
      2 &&
    channelSet.size >= 2 &&
    independent.length >= 2;

  const triangulationLabel =
    getTriangulationLabel(
      triangulationScore,
      isCrossSourceCorroborated,
      findings.length,
      independentCategories.size,
      channelSet.size
    );

  const reasons = [
    `${independentCategories.size} independent source categories support the theme`,
    `${channelSet.size} delivery channels support the theme`,
    `${knownOriginSet.size} known data origins support the theme`,
    `${independent.length} of ${findings.length} findings are independently sourced`,
    `${commercial.length} of ${findings.length} findings are commercially influenced`,
    `Triangulation classified as ${triangulationLabel}`,
  ];

  return {
    methodVersion:
      "theme_source_aggregation_v1",

    totalFindings:
      findings.length,

    totalEvidenceWeight:
      round(
        totalEvidenceWeight,
        4
      ),

    sourceCategories,
    channels,
    dataOrigins,

    distinctSourceCategoryCount:
      Object.keys(
        sourceCategories
      ).length,

    distinctIndependentSourceCategoryCount:
      independentCategories.size,

    distinctChannelCount:
      channelSet.size,

    distinctDataOriginCount:
      knownOriginSet.size,

    independentFindingCount:
      independent.length,

    commercialFindingCount:
      commercial.length,

    lowTrustFindingCount:
      lowTrust.length,

    unknownFindingCount:
      unknown.length,

    independentPercent:
      percent(
        independent.length,
        findings.length
      ),

    commercialPercent:
      percent(
        commercial.length,
        findings.length
      ),

    livePercent:
      dataOrigins.live
        ?.percentOfThemeFindings ||
      0,

    curatedPercent:
      dataOrigins.curated
        ?.percentOfThemeFindings ||
      0,

    triangulationScore,
    triangulationLabel,
    isCrossSourceCorroborated,
    reasons,
  };
}
