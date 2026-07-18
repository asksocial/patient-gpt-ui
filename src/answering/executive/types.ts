import type {
  ThemeConfidenceLabel,
  ThemeStrategicPriority,
  ThemeTrajectoryLabel,
} from "../themes/themeModels";

export type ExecutiveSignalType =
  | "momentum"
  | "opportunity"
  | "risk"
  | "evidence_gap"
  | "stability";

export type ExecutiveDecisionSignal = {
  signalId: string;

  type: ExecutiveSignalType;

  priority:
    ThemeStrategicPriority;

  confidence:
    ThemeConfidenceLabel;

  themeIds: string[];

  title: string;

  statement: string;

  evidenceBasis: string[];
};

export type ExecutiveThemeSummary = {
  themeId: string;

  label: string;

  eligiblePercent: number;

  confidence:
    ThemeConfidenceLabel;

  trajectory:
    ThemeTrajectoryLabel;

  percentagePointChange: number;

  triangulation: string;
};

export type ExecutiveRecommendedAction = {
  actionId: string;

  priority:
    ThemeStrategicPriority;

  confidence:
    ThemeConfidenceLabel;

  action: string;

  rationale: string;

  themeIds: string[];
};

export type ExecutiveWatchlistItem = {
  themeId: string;

  label: string;

  reason: string;

  trigger: string;

  confidence:
    ThemeConfidenceLabel;
};

export type ExecutiveDataQuality = {
  datasetFindingCount: number;

  temporalCoveragePercent: number;

  highConfidenceThemeCount:
    number;

  corroboratedThemeCount: number;

  directionalThemeCount: number;

  warnings: string[];
};

export type ExecutiveIntelligenceBrief = {
  methodVersion:
    "executive_intelligence_v1";

  briefId: string;

  therapeuticArea: string;

  generatedAt: string;

  analysisStart?: string;

  analysisEnd?: string;

  headline: string;

  executiveSummary: string[];

  topThemes:
    ExecutiveThemeSummary[];

  decisionSignals:
    ExecutiveDecisionSignal[];

  recommendedActions:
    ExecutiveRecommendedAction[];

  watchlist:
    ExecutiveWatchlistItem[];

  dataQuality:
    ExecutiveDataQuality;
};
