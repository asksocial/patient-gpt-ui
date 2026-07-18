import type {
  ThemeKnowledgeComparison,
  ThemeKnowledgeRecord,
  ThemeKnowledgeSnapshot,
} from "../knowledge";
import type {
  ExecutiveDecisionSignal,
  ExecutiveIntelligenceBrief,
  ExecutiveRecommendedAction,
  ExecutiveWatchlistItem,
} from "./types";

export type BuildExecutiveIntelligenceBriefParams = {
  snapshot: ThemeKnowledgeSnapshot;

  comparison?:
    ThemeKnowledgeComparison;

  generatedAt?: string;
};

function signed(
  value: number
): string {
  return value > 0
    ? `+${value}`
    : String(value);
}

function strongestTheme(
  records: ThemeKnowledgeRecord[]
): ThemeKnowledgeRecord | undefined {
  return records
    .slice()
    .sort(
      (first, second) =>
        second.eligiblePercent -
        first.eligiblePercent
    )[0];
}

function buildHeadline(
  records: ThemeKnowledgeRecord[]
): string {
  const priority =
    records.find(
      (record) =>
        [
          "accelerating",
          "emerging",
          "rising",
        ].includes(
          record.trajectory
        ) &&
        record.longitudinalConfidence !==
          "insufficient"
    ) || strongestTheme(records);

  if (!priority) {
    return "No sufficiently supported executive theme signal is currently available.";
  }

  if (
    priority.trajectory ===
      "accelerating" ||
    priority.trajectory ===
      "rising" ||
    priority.trajectory ===
      "emerging"
  ) {
    return `${priority.label} is ${priority.trajectory}, reaching ${priority.eligiblePercent}% of qualifying discussion with ${priority.triangulation} cross-source support.`;
  }

  return `${priority.label} remains the leading theme at ${priority.eligiblePercent}% of qualifying discussion with ${priority.confidence} confidence.`;
}

function buildDecisionSignals(
  snapshot: ThemeKnowledgeSnapshot,
  comparison?:
    ThemeKnowledgeComparison
): ExecutiveDecisionSignal[] {
  const signals:
    ExecutiveDecisionSignal[] = [];

  for (const record of snapshot.themeRecords) {
    if (
      [
        "accelerating",
        "rising",
        "emerging",
      ].includes(record.trajectory) &&
      record.longitudinalConfidence !==
        "insufficient" &&
      record.confidence !==
        "insufficient" &&
      ![
        "single_source",
        "insufficient",
      ].includes(
        record.triangulation
      )
    ) {
      signals.push({
        signalId:
          `momentum:${record.themeId}`,
        type: "momentum",
        priority:
          record.confidence ===
            "high" &&
          record.triangulation ===
            "strong"
            ? "high"
            : "medium",
        confidence:
          record.longitudinalConfidence,
        themeIds: [record.themeId],
        title:
          `${record.label} momentum`,
        statement:
          `${record.label} is ${record.trajectory} with a ${signed(
            record.percentagePointChange
          )} percentage-point recent-window change and ${record.persistencePercent}% period persistence.`,
        evidenceBasis: [
          `${record.eligiblePercent}% eligible prevalence`,
          `${record.triangulation} triangulation`,
          `${record.longitudinalConfidence} longitudinal confidence`,
        ],
      });
    }

    if (
      record.trajectory ===
        "declining" &&
      record.longitudinalConfidence !==
        "insufficient" &&
      record.confidence !==
        "insufficient" &&
      ![
        "single_source",
        "insufficient",
      ].includes(
        record.triangulation
      )
    ) {
      signals.push({
        signalId:
          `risk:${record.themeId}`,
        type: "risk",
        priority:
          record.eligiblePercent >= 20
            ? "high"
            : "medium",
        confidence:
          record.longitudinalConfidence,
        themeIds: [record.themeId],
        title:
          `${record.label} decline`,
        statement:
          `${record.label} remains visible at ${record.eligiblePercent}% but is declining across the longitudinal window.`,
        evidenceBasis: [
          `${signed(
            record.percentagePointChange
          )} percentage-point recent-window change`,
          `${record.persistencePercent}% period persistence`,
          `${record.longitudinalConfidence} longitudinal confidence`,
        ],
      });
    }

    if (
      record.confidence ===
        "insufficient" ||
      record.triangulation ===
        "single_source" ||
      record.triangulation ===
        "insufficient"
    ) {
      signals.push({
        signalId:
          `gap:${record.themeId}`,
        type: "evidence_gap",
        priority: "low",
        confidence: "directional",
        themeIds: [record.themeId],
        title:
          `${record.label} requires validation`,
        statement:
          `${record.label} is visible but does not yet have enough independent evidence to support an executive-level conclusion.`,
        evidenceBasis: [
          `${record.count} findings`,
          `${record.triangulation} triangulation`,
          `${record.confidence} theme confidence`,
        ],
      });
    }
  }

  if (comparison) {
    for (const themeId of
      comparison.newThemeIds) {
      const record =
        snapshot.themeRecords.find(
          (item) =>
            item.themeId === themeId
        );

      if (!record) {
        continue;
      }

      if (
        record.confidence ===
          "insufficient" ||
        [
          "single_source",
          "insufficient",
        ].includes(
          record.triangulation
        )
      ) {
        continue;
      }

      signals.push({
        signalId:
          `opportunity:${themeId}`,
        type: "opportunity",
        priority: "medium",
        confidence:
          record.confidence,
        themeIds: [themeId],
        title:
          `New theme: ${record.label}`,
        statement:
          `${record.label} was not observed in the baseline snapshot and now represents ${record.eligiblePercent}% of qualifying discussion.`,
        evidenceBasis: [
          "New relative to baseline snapshot",
          `${record.count} findings`,
          `${record.triangulation} triangulation`,
        ],
      });
    }
  }

  const priorityOrder = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return signals
    .filter(
      (signal, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.signalId ===
            signal.signalId
        ) === index
    )
    .sort(
      (first, second) =>
        priorityOrder[
          second.priority
        ] -
        priorityOrder[
          first.priority
        ]
    )
    .slice(0, 6);
}

function buildRecommendedActions(
  snapshot: ThemeKnowledgeSnapshot
): ExecutiveRecommendedAction[] {
  return snapshot
    .strategicImplications
    .filter(
      (implication) =>
        implication.priority !==
          "low" &&
        ["high", "moderate"].includes(
          implication.confidence
        )
    )
    .map((implication) => ({
      actionId:
        `action:${implication.implicationId}`,
      priority:
        implication.priority,
      confidence:
        implication.confidence,
      action:
        implication.recommendedAction,
      rationale:
        implication.statement,
      themeIds:
        implication.themeIds,
    }))
    .slice(0, 4);
}

function buildWatchlist(
  snapshot: ThemeKnowledgeSnapshot
): ExecutiveWatchlistItem[] {
  return snapshot.themeRecords
    .filter(
      (record) =>
        record.confidence ===
          "directional" ||
        record.confidence ===
          "insufficient" ||
        record.triangulation ===
          "single_source" ||
        record.trajectory ===
          "emerging" ||
        record.trajectory ===
          "volatile"
    )
    .map((record) => ({
      themeId: record.themeId,
      label: record.label,
      reason:
        record.triangulation ===
          "single_source"
          ? "Current support comes from only one independent source category or channel."
          : record.trajectory ===
              "emerging"
            ? "The theme appears in the latter portion of the analysis window."
            : record.trajectory ===
                "volatile"
              ? "Prevalence varies materially across periods."
              : "The current evidence does not meet the threshold for a firm executive conclusion.",
      trigger:
        "Escalate when the theme is corroborated across at least two independent source categories and two channels with moderate-or-higher confidence.",
      confidence:
        record.confidence,
    }))
    .slice(0, 4);
}

export function buildExecutiveIntelligenceBrief(
  params:
    BuildExecutiveIntelligenceBriefParams
): ExecutiveIntelligenceBrief {
  const snapshot =
    params.snapshot;
  const records =
    snapshot.themeRecords;
  const top = strongestTheme(
    records
  );
  const accelerating =
    records.find(
      (record) =>
        record.trajectory ===
        "accelerating"
    );
  const declining =
    records.find(
      (record) =>
        record.trajectory ===
        "declining"
    );
  const summary: string[] = [];

  if (top) {
    summary.push(
      `${top.label} leads at ${top.eligiblePercent}% of qualifying discussion with ${top.confidence} confidence and ${top.triangulation} cross-source support.`
    );
  }

  if (
    accelerating &&
    accelerating.themeId !==
      top?.themeId
  ) {
    summary.push(
      `${accelerating.label} is the clearest acceleration signal, changing ${signed(
        accelerating.percentagePointChange
      )} percentage points in the recent comparison window.`
    );
  } else if (accelerating) {
    summary.push(
      `The leading theme is also accelerating, increasing ${signed(
        accelerating.percentagePointChange
      )} percentage points in the recent comparison window.`
    );
  }

  if (declining) {
    summary.push(
      `${declining.label} is declining despite ${declining.persistencePercent}% period persistence and should be monitored as a changing decision signal.`
    );
  }

  if (summary.length === 0) {
    summary.push(
      "The current snapshot does not contain enough supported theme evidence for a reliable executive synthesis."
    );
  }

  const warnings = [
    ...(snapshot.longitudinalTracking
      ?.warnings || []),
  ];

  if (
    snapshot.temporalCoveragePercent <
    80
  ) {
    warnings.push(
      `Temporal coverage is ${snapshot.temporalCoveragePercent}%; trend conclusions should be treated as directional.`
    );
  }

  return {
    methodVersion:
      "executive_intelligence_v1",
    briefId:
      `executive:${snapshot.snapshotKey}`,
    therapeuticArea:
      snapshot.therapeuticArea,
    generatedAt:
      params.generatedAt ||
      new Date().toISOString(),
    analysisStart:
      snapshot.analysisStart,
    analysisEnd:
      snapshot.analysisEnd,
    headline:
      buildHeadline(records),
    executiveSummary:
      summary.slice(0, 3),
    topThemes: records
      .slice()
      .sort(
        (first, second) =>
          second.eligiblePercent -
          first.eligiblePercent
      )
      .slice(0, 5)
      .map((record) => ({
        themeId: record.themeId,
        label: record.label,
        eligiblePercent:
          record.eligiblePercent,
        confidence:
          record.confidence,
        trajectory:
          record.trajectory,
        percentagePointChange:
          record.percentagePointChange,
        triangulation:
          record.triangulation,
      })),
    decisionSignals:
      buildDecisionSignals(
        snapshot,
        params.comparison
      ),
    recommendedActions:
      buildRecommendedActions(
        snapshot
      ),
    watchlist:
      buildWatchlist(snapshot),
    dataQuality: {
      datasetFindingCount:
        snapshot.datasetFindingCount,
      temporalCoveragePercent:
        snapshot.temporalCoveragePercent,
      highConfidenceThemeCount:
        records.filter(
          (record) =>
            record.confidence ===
            "high"
        ).length,
      corroboratedThemeCount:
        records.filter(
          (record) =>
            record.independentSourceCategoryCount >=
              2 &&
            record.channelCount >= 2
        ).length,
      directionalThemeCount:
        records.filter(
          (record) =>
            record.confidence ===
              "directional" ||
            record.confidence ===
              "insufficient"
        ).length,
      warnings: Array.from(
        new Set(warnings)
      ),
    },
  };
}
