import type {
  CommercialIntentLevel,
  EvidenceClass,
  EvidenceQualityBand,
  EvidenceVoice,
  PublicationType,
  ResearchCredibility,
} from "../evidence/types";

export type EvidenceSourceCategory =
  | "first_person"
  | "caregiver_voice"
  | "provider_voice"
  | "community_voice"
  | "research_or_science"
  | "independent_editorial"
  | "brand_owned"
  | "clinic_marketing"
  | "retail_or_product"
  | "press_release"
  | "event_or_conference"
  | "unknown";

export type EvidenceSelectionTier =
  | "direct_voice"
  | "credible_context"
  | "fallback";

export type ThemeDefinition = {
  themeId: string;

  label: string;

  description: string;

  keywords: string[];

  excludedKeywords?: string[];

  minimumMatches?: number;

  preferredSourceCategories?:
    EvidenceSourceCategory[];

  allowedSourceCategories?:
    EvidenceSourceCategory[];

  excludedSourceCategories?:
    EvidenceSourceCategory[];

  preferredEvidenceClasses?:
    EvidenceClass[];

  allowedEvidenceClasses?:
    EvidenceClass[];

  excludedEvidenceClasses?:
    EvidenceClass[];
};

export type ThemeEvidenceScore = {
  supportScore: number;

  diversityScore: number;

  confidenceScore: number;

  qualityScore: number;

  evidenceCompositionScore?: number;

  totalScore: number;
};

export type ThemeConfidenceLabel =
  | "high"
  | "moderate"
  | "directional"
  | "insufficient";

export type RelationshipConfidence =
  | "high"
  | "moderate"
  | "directional";

export type RepresentativeEvidence = {
  findingId: string;

  claim: string;

  quote: string;

  sourceCategory:
    EvidenceSourceCategory;

  evidenceClass?: EvidenceClass;

  evidenceVoice?: EvidenceVoice;

  publicationType?: PublicationType;

  commercialIntent?:
    CommercialIntentLevel;

  researchCredibility?:
    ResearchCredibility;

  evidenceQualityScore?: number;

  evidenceQualityBand?:
    EvidenceQualityBand;

  sourceType?: string;

  selectionTier:
    EvidenceSelectionTier;

  platform?: string;

  country?: string;

  persona?: string;

  url?: string;

  themeRelevanceScore: number;

  sourceCompatibilityScore: number;

  qualityScore: number;

  score: number;
};

export type ThemeQualityDiagnostics = {
  totalCandidates: number;

  lowRelevanceRejected: number;

  /**
   * Only actual PR, clinic marketing, retail,
   * and sponsored content.
   */
  promotionalRejected: number;

  /**
   * Evidence classified as unknown.
   */
  unknownClassRejected: number;

  /**
   * Influencer or event content.
   */
  lowTrustRejected: number;

  /**
   * Evidence excluded by the theme taxonomy.
   */
  taxonomyExcluded: number;

  /**
   * Retained for backward compatibility.
   */
  excludedCategoryRejected: number;

  belowQualityRejected: number;

  duplicateRejected: number;

  diversityRejected: number;

  directVoiceSelected: number;

  editorialSelected: number;

  fallbackSelected: number;

  selectedCount: number;
};

export type ThemeDimensionPrevalence = {
  count: number;

  denominator: number;

  rawPercent: number;

  evidenceWeight: number;

  denominatorEvidenceWeight:
    number;

  evidenceWeightedPercent:
    number;
};

export type ThemePrevalenceBreakdowns = {
  countries: Record<
    string,
    ThemeDimensionPrevalence
  >;

  platforms: Record<
    string,
    ThemeDimensionPrevalence
  >;

  personas: Record<
    string,
    ThemeDimensionPrevalence
  >;

  sourceTypes: Record<
    string,
    ThemeDimensionPrevalence
  >;
};

export type ThemePrevalence = {
  methodVersion:
    "theme_prevalence_v1";

  datasetFindingCount: number;

  eligibleFindingCount: number;

  matchingFindingCount: number;

  themeAssignmentCount: number;

  datasetCoveragePercent: number;

  rawPercent: number;

  eligiblePercent: number;

  evidenceWeightedPercent:
    number;

  eligibleEvidenceWeightedPercent:
    number;

  shareOfThemeAssignmentsPercent:
    number;

  matchingEvidenceWeight: number;

  datasetEvidenceWeight: number;

  eligibleEvidenceWeight: number;

  overlappingMatchingFindingCount:
    number;

  overlapRatePercent: number;

  averageThemesPerEligibleFinding:
    number;

  breakdowns:
  ThemePrevalenceBreakdowns;
};

export type ThemeSourceChannel =
  | "social"
  | "forum"
  | "review"
  | "video"
  | "news"
  | "research"
  | "government"
  | "medical_society"
  | "advocacy"
  | "blog"
  | "podcast"
  | "event"
  | "commercial_owned"
  | "other";

export type ThemeDataOrigin =
  | "live"
  | "curated"
  | "unknown";

export type ThemeSourceSupport = {
  count: number;

  percentOfThemeFindings: number;

  evidenceWeight: number;

  weightedSharePercent: number;

  averageEvidenceQualityScore:
    number;
};

export type ThemeTriangulationLabel =
  | "strong"
  | "moderate"
  | "directional"
  | "single_source"
  | "insufficient";

export type ThemeTimeGranularity =
  | "week"
  | "month"
  | "quarter";

export type ThemeTrajectoryLabel =
  | "emerging"
  | "accelerating"
  | "rising"
  | "stable"
  | "declining"
  | "volatile"
  | "insufficient";

export type ThemeTimeBucket = {
  periodStart: string;

  periodEnd: string;

  periodLabel: string;

  datasetFindingCount: number;

  eligibleFindingCount: number;

  matchingFindingCount: number;

  rawPercent: number;

  eligiblePercent: number;

  eligibleEvidenceWeightedPercent:
    number;

  hasSufficientVolume: boolean;
};

export type ThemeLongitudinalSignal = {
  themeId: string;

  label: string;

  trajectory:
    ThemeTrajectoryLabel;

  confidence:
    ThemeConfidenceLabel;

  buckets: ThemeTimeBucket[];

  analyzablePeriodCount: number;

  activePeriodCount: number;

  persistencePercent: number;

  previousWindowAveragePercent:
    number;

  recentWindowAveragePercent:
    number;

  percentagePointChange: number;

  relativeChangePercent: number;

  slopePerPeriod: number;

  peakPeriod?: string;

  peakEligiblePercent: number;

  reasons: string[];
};

export type ThemeLongitudinalTracking = {
  methodVersion:
    "theme_longitudinal_v1";

  granularity:
    ThemeTimeGranularity;

  windowSize: number;

  minimumFindingsPerPeriod: number;

  datasetFindingCount: number;

  datedFindingCount: number;

  undatedFindingCount: number;

  temporalCoveragePercent: number;

  dateRangeStart?: string;

  dateRangeEnd?: string;

  periodCount: number;

  themes:
    ThemeLongitudinalSignal[];

  warnings: string[];
};

export type ThemeSourceAggregation = {
  methodVersion:
    "theme_source_aggregation_v1";

  totalFindings: number;

  totalEvidenceWeight: number;

  sourceCategories: Partial<
    Record<
      EvidenceSourceCategory,
      ThemeSourceSupport
    >
  >;

  channels: Partial<
    Record<
      ThemeSourceChannel,
      ThemeSourceSupport
    >
  >;

  dataOrigins: Partial<
    Record<
      ThemeDataOrigin,
      ThemeSourceSupport
    >
  >;

  distinctSourceCategoryCount:
    number;

  distinctIndependentSourceCategoryCount:
    number;

  distinctChannelCount: number;

  distinctDataOriginCount: number;

  independentFindingCount: number;

  commercialFindingCount: number;

  lowTrustFindingCount: number;

  unknownFindingCount: number;

  independentPercent: number;

  commercialPercent: number;

  livePercent: number;

  curatedPercent: number;

  triangulationScore: number;

  triangulationLabel:
    ThemeTriangulationLabel;

  isCrossSourceCorroborated:
    boolean;

  reasons: string[];
};

export type RepresentativeEvidenceSelectionResult = {
  evidence:
    RepresentativeEvidence[];

  diagnostics:
    ThemeQualityDiagnostics;
};

export type ThemeRelationshipType =
  | "supports"
  | "drives"
  | "overlaps"
  | "contrasts_with"
  | "co_occurs_with";

export type ThemeRelationship = {
  sourceThemeId: string;

  targetThemeId: string;

  relationshipType:
    ThemeRelationshipType;

  strength: number;

  coOccurrenceCount?: number;

  confidence:
    RelationshipConfidence;
};

export type ThemeRelationshipDefinition = {
  sourceThemeId: string;

  targetThemeId: string;

  relationshipType: Exclude<
    ThemeRelationshipType,
    "co_occurs_with"
  >;
};

export type ThemeStrategicImplicationType =
  | "priority_narrative"
  | "integrated_narrative"
  | "audience_activation"
  | "evidence_validation"
  | "commercial_safeguard";

export type ThemeStrategicPriority =
  | "high"
  | "medium"
  | "low";

export type ThemeStrategicImplication = {
  implicationId: string;

  type:
    ThemeStrategicImplicationType;

  priority:
    ThemeStrategicPriority;

  confidence:
    ThemeConfidenceLabel;

  themeIds: string[];

  relationshipType?:
    ThemeRelationshipType;

  statement: string;

  recommendedAction: string;

  evidenceBasis: string[];
};

export type ThemeMatch = {
  themeId: string;

  label: string;

  description?: string;

  count: number;

  percent: number;

  prevalence?: ThemePrevalence;

  sourceAggregation?:
    ThemeSourceAggregation;

  findingIds: string[];

  representativeClaims: string[];

  representativeEvidence:
    RepresentativeEvidence[];

  clientFacingEvidence:
    RepresentativeEvidence[];

  evidenceScore:
    ThemeEvidenceScore;

  confidenceLabel:
    ThemeConfidenceLabel;

  countries:
    Record<string, number>;

  platforms:
    Record<string, number>;

  personas:
    Record<string, number>;

  sourceTypes:
    Record<string, number>;

  evidenceClassCounts?:
    Record<string, number>;

  evidenceVoiceCounts?:
    Record<string, number>;

  publicationTypeCounts?:
    Record<string, number>;

  evidenceQualityBandCounts?:
    Record<string, number>;

  relationships?:
    ThemeRelationship[];

  qualityDiagnostics:
    ThemeQualityDiagnostics;
};

export type ThemeTaxonomy = {
  therapeuticArea: string;

  themes: ThemeDefinition[];

  relationships?:
    ThemeRelationshipDefinition[];
};

export type ThemeAnswerContext = {
  dominantThemes: ThemeMatch[];

  supportingThemes: ThemeMatch[];

  lowConfidenceThemes: ThemeMatch[];

  relationships:
    ThemeRelationship[];

  strategicImplications:
    ThemeStrategicImplication[];
};
