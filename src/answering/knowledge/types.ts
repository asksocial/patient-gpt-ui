import type {
  ThemeConfidenceLabel,
  ThemeLongitudinalTracking,
  ThemeRelationship,
  ThemeStrategicImplication,
  ThemeTrajectoryLabel,
  ThemeTriangulationLabel,
} from "../themes/themeModels";

export type KnowledgeSnapshotSchemaVersion =
  "theme_knowledge_snapshot_v1";

export type ThemeKnowledgeRecord = {
  themeId: string;

  label: string;

  description?: string;

  count: number;

  eligiblePercent: number;

  evidenceWeightedPercent: number;

  confidence:
    ThemeConfidenceLabel;

  triangulation:
    ThemeTriangulationLabel;

  triangulationScore: number;

  independentSourceCategoryCount:
    number;

  channelCount: number;

  trajectory:
    ThemeTrajectoryLabel;

  longitudinalConfidence:
    ThemeConfidenceLabel;

  percentagePointChange: number;

  persistencePercent: number;

  findingIds: string[];

  representativeEvidenceIds:
    string[];
};

export type ThemeKnowledgeSnapshot = {
  schemaVersion:
    KnowledgeSnapshotSchemaVersion;

  snapshotKey: string;

  therapeuticArea: string;

  createdAt: string;

  analysisStart?: string;

  analysisEnd?: string;

  granularity?: string;

  datasetFindingCount: number;

  datedFindingCount: number;

  temporalCoveragePercent: number;

  sourceQuery?: string;

  themeRecords:
    ThemeKnowledgeRecord[];

  relationships:
    ThemeRelationship[];

  strategicImplications:
    ThemeStrategicImplication[];

  longitudinalTracking?:
    ThemeLongitudinalTracking;

  contentHash: string;
};

export type ThemeKnowledgeChangeType =
  | "new_theme"
  | "no_longer_observed"
  | "prevalence_increase"
  | "prevalence_decrease"
  | "trajectory_change"
  | "confidence_change"
  | "stable";

export type ThemeKnowledgeChange = {
  themeId: string;

  label: string;

  changeTypes:
    ThemeKnowledgeChangeType[];

  previousEligiblePercent:
    number;

  currentEligiblePercent: number;

  percentagePointChange: number;

  previousTrajectory:
    ThemeTrajectoryLabel;

  currentTrajectory:
    ThemeTrajectoryLabel;

  previousConfidence:
    ThemeConfidenceLabel;

  currentConfidence:
    ThemeConfidenceLabel;
};

export type ThemeKnowledgeComparison = {
  therapeuticArea: string;

  baselineSnapshotKey: string;

  currentSnapshotKey: string;

  baselineCreatedAt: string;

  currentCreatedAt: string;

  newThemeIds: string[];

  noLongerObservedThemeIds:
    string[];

  increasingThemeIds: string[];

  decreasingThemeIds: string[];

  trajectoryChangedThemeIds:
    string[];

  changes: ThemeKnowledgeChange[];
};
