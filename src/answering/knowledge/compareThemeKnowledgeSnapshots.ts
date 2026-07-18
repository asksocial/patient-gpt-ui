import type {
  ThemeKnowledgeChange,
  ThemeKnowledgeChangeType,
  ThemeKnowledgeComparison,
  ThemeKnowledgeRecord,
  ThemeKnowledgeSnapshot,
} from "./types";

const MATERIAL_CHANGE_POINTS = 3;

function missingRecord(
  themeId: string,
  label: string
): ThemeKnowledgeRecord {
  return {
    themeId,
    label,
    count: 0,
    eligiblePercent: 0,
    evidenceWeightedPercent: 0,
    confidence: "insufficient",
    triangulation: "insufficient",
    triangulationScore: 0,
    independentSourceCategoryCount: 0,
    channelCount: 0,
    trajectory: "insufficient",
    longitudinalConfidence:
      "insufficient",
    percentagePointChange: 0,
    persistencePercent: 0,
    findingIds: [],
    representativeEvidenceIds: [],
  };
}

export function compareThemeKnowledgeSnapshots(
  baseline: ThemeKnowledgeSnapshot,
  current: ThemeKnowledgeSnapshot
): ThemeKnowledgeComparison {
  if (
    baseline.therapeuticArea !==
    current.therapeuticArea
  ) {
    throw new Error(
      "Knowledge snapshots must belong to the same therapeutic area."
    );
  }

  const baselineMap = new Map(
    baseline.themeRecords.map(
      (record) => [
        record.themeId,
        record,
      ]
    )
  );
  const currentMap = new Map(
    current.themeRecords.map(
      (record) => [
        record.themeId,
        record,
      ]
    )
  );
  const themeIds = Array.from(
    new Set([
      ...baselineMap.keys(),
      ...currentMap.keys(),
    ])
  );

  const changes:
    ThemeKnowledgeChange[] =
    themeIds.map((themeId) => {
      const previous =
        baselineMap.get(themeId);
      const next =
        currentMap.get(themeId);
      const resolvedPrevious =
        previous ||
        missingRecord(
          themeId,
          next?.label || themeId
        );
      const resolvedNext =
        next ||
        missingRecord(
          themeId,
          previous?.label || themeId
        );
      const pointChange =
        Number(
          (
            resolvedNext
              .eligiblePercent -
            resolvedPrevious
              .eligiblePercent
          ).toFixed(2)
        );
      const changeTypes:
        ThemeKnowledgeChangeType[] =
        [];

      if (!previous && next) {
        changeTypes.push(
          "new_theme"
        );
      }

      if (previous && !next) {
        changeTypes.push(
          "no_longer_observed"
        );
      }

      if (
        pointChange >=
        MATERIAL_CHANGE_POINTS
      ) {
        changeTypes.push(
          "prevalence_increase"
        );
      } else if (
        pointChange <=
        -MATERIAL_CHANGE_POINTS
      ) {
        changeTypes.push(
          "prevalence_decrease"
        );
      }

      if (
        previous &&
        next &&
        previous.trajectory !==
          next.trajectory
      ) {
        changeTypes.push(
          "trajectory_change"
        );
      }

      if (
        previous &&
        next &&
        previous.confidence !==
          next.confidence
      ) {
        changeTypes.push(
          "confidence_change"
        );
      }

      if (changeTypes.length === 0) {
        changeTypes.push("stable");
      }

      return {
        themeId,
        label:
          next?.label ||
          previous?.label ||
          themeId,
        changeTypes,
        previousEligiblePercent:
          resolvedPrevious
            .eligiblePercent,
        currentEligiblePercent:
          resolvedNext
            .eligiblePercent,
        percentagePointChange:
          pointChange,
        previousTrajectory:
          resolvedPrevious
            .trajectory,
        currentTrajectory:
          resolvedNext.trajectory,
        previousConfidence:
          resolvedPrevious
            .confidence,
        currentConfidence:
          resolvedNext.confidence,
      };
    });

  return {
    therapeuticArea:
      current.therapeuticArea,
    baselineSnapshotKey:
      baseline.snapshotKey,
    currentSnapshotKey:
      current.snapshotKey,
    baselineCreatedAt:
      baseline.createdAt,
    currentCreatedAt:
      current.createdAt,
    newThemeIds: changes
      .filter((item) =>
        item.changeTypes.includes(
          "new_theme"
        )
      )
      .map((item) => item.themeId),
    noLongerObservedThemeIds:
      changes
        .filter((item) =>
          item.changeTypes.includes(
            "no_longer_observed"
          )
        )
        .map(
          (item) => item.themeId
        ),
    increasingThemeIds: changes
      .filter((item) =>
        item.changeTypes.includes(
          "prevalence_increase"
        )
      )
      .map((item) => item.themeId),
    decreasingThemeIds: changes
      .filter((item) =>
        item.changeTypes.includes(
          "prevalence_decrease"
        )
      )
      .map((item) => item.themeId),
    trajectoryChangedThemeIds:
      changes
        .filter((item) =>
          item.changeTypes.includes(
            "trajectory_change"
          )
        )
        .map(
          (item) => item.themeId
        ),
    changes: changes.sort(
      (first, second) =>
        Math.abs(
          second.percentagePointChange
        ) -
        Math.abs(
          first.percentagePointChange
        )
    ),
  };
}
