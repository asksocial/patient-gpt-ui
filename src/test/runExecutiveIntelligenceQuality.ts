import {
  buildExecutiveIntelligenceBrief,
} from "../answering/executive";
import type {
  ThemeKnowledgeRecord,
  ThemeKnowledgeSnapshot,
} from "../answering/knowledge";

function record(
  overrides: Partial<ThemeKnowledgeRecord> &
    Pick<ThemeKnowledgeRecord, "themeId" | "label">
): ThemeKnowledgeRecord {
  return {
    themeId: overrides.themeId,
    label: overrides.label,
    count: 25,
    eligiblePercent: 25,
    evidenceWeightedPercent: 25,
    confidence: "high",
    triangulation: "strong",
    triangulationScore: 85,
    independentSourceCategoryCount: 3,
    channelCount: 3,
    trajectory: "stable",
    longitudinalConfidence: "high",
    percentagePointChange: 0,
    persistencePercent: 100,
    findingIds: [
      `${overrides.themeId}:finding`,
    ],
    representativeEvidenceIds: [
      `${overrides.themeId}:evidence`,
    ],
    ...overrides,
  };
}

const snapshot: ThemeKnowledgeSnapshot = {
  schemaVersion:
    "theme_knowledge_snapshot_v1",
  snapshotKey: "step-4-quality",
  therapeuticArea: "Test Area",
  createdAt:
    "2026-07-18T12:00:00.000Z",
  analysisStart: "2026-01-01",
  analysisEnd: "2026-06-30",
  granularity: "month",
  datasetFindingCount: 120,
  datedFindingCount: 114,
  temporalCoveragePercent: 95,
  themeRecords: [
    record({
      themeId: "momentum_theme",
      label: "Momentum Theme",
      eligiblePercent: 42,
      trajectory: "accelerating",
      percentagePointChange: 14,
    }),
    record({
      themeId: "declining_theme",
      label: "Declining Theme",
      eligiblePercent: 28,
      trajectory: "declining",
      percentagePointChange: -9,
    }),
    record({
      themeId: "validation_theme",
      label: "Validation Theme",
      count: 4,
      eligiblePercent: 5,
      confidence: "insufficient",
      triangulation: "single_source",
      triangulationScore: 20,
      independentSourceCategoryCount: 1,
      channelCount: 1,
      trajectory: "insufficient",
      longitudinalConfidence: "insufficient",
      persistencePercent: 25,
    }),
  ],
  relationships: [],
  strategicImplications: [
    {
      implicationId: "priority:momentum",
      type: "priority_narrative",
      priority: "high",
      confidence: "high",
      themeIds: ["momentum_theme"],
      statement:
        "Momentum Theme is both prevalent and accelerating.",
      recommendedAction:
        "Prioritize the accelerating narrative in leadership planning.",
      evidenceBasis: [
        "Strong cross-source support",
      ],
    },
    {
      implicationId: "weak:validation",
      type: "evidence_validation",
      priority: "low",
      confidence: "insufficient",
      themeIds: ["validation_theme"],
      statement:
        "Validation Theme is not sufficiently supported.",
      recommendedAction:
        "Do not escalate without more evidence.",
      evidenceBasis: [
        "Single-source support",
      ],
    },
  ],
  longitudinalTracking: {
    methodVersion: "theme_longitudinal_v1",
    granularity: "month",
    windowSize: 2,
    minimumFindingsPerPeriod: 10,
    datasetFindingCount: 120,
    datedFindingCount: 114,
    undatedFindingCount: 6,
    temporalCoveragePercent: 95,
    dateRangeStart: "2026-01-01",
    dateRangeEnd: "2026-06-30",
    periodCount: 6,
    themes: [],
    warnings: [],
  },
  contentHash: "quality-hash",
};

const brief =
  buildExecutiveIntelligenceBrief({
    snapshot,
    generatedAt:
      "2026-07-18T13:00:00.000Z",
  });

function requireSignal(
  id: string,
  type: string,
  priority: string
) {
  const signal =
    brief.decisionSignals.find(
      (item) =>
        item.signalId === id
    );

  if (
    !signal ||
    signal.type !== type ||
    signal.priority !== priority
  ) {
    throw new Error(
      `Expected ${id} to be a ${priority}-priority ${type} signal.`
    );
  }
}

requireSignal(
  "momentum:momentum_theme",
  "momentum",
  "high"
);
requireSignal(
  "risk:declining_theme",
  "risk",
  "high"
);
requireSignal(
  "gap:validation_theme",
  "evidence_gap",
  "low"
);

if (
  brief.recommendedActions.length !==
    1 ||
  brief.recommendedActions[0]
    .themeIds[0] !== "momentum_theme"
) {
  throw new Error(
    "Executive actions must include supported strategic implications and exclude low-confidence validation hypotheses."
  );
}

if (
  !brief.watchlist.some(
    (item) =>
      item.themeId ===
      "validation_theme"
  )
) {
  throw new Error(
    "Single-source insufficient themes must remain visible on the executive watchlist."
  );
}

console.log(
  JSON.stringify(
    {
      headline: brief.headline,
      decisionSignals:
        brief.decisionSignals,
      recommendedActions:
        brief.recommendedActions,
      watchlist: brief.watchlist,
      dataQuality:
        brief.dataQuality,
    },
    null,
    2
  )
);
