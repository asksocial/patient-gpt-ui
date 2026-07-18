import {
  buildThemeKnowledgeSnapshot,
  compareThemeKnowledgeSnapshots,
} from "../answering/knowledge";
import type {
  ThemeLongitudinalSignal,
  ThemeLongitudinalTracking,
  ThemeMatch,
  ThemeTrajectoryLabel,
} from "../answering/themes/themeModels";

function theme(
  themeId: string,
  eligiblePercent: number
): ThemeMatch {
  return {
    themeId,
    label: themeId,
    count: Math.round(
      eligiblePercent
    ),
    percent: eligiblePercent,
    prevalence: {
      eligiblePercent,
      eligibleEvidenceWeightedPercent:
        eligiblePercent,
    },
    findingIds: [
      `${themeId}:finding`,
    ],
    representativeEvidence: [
      {
        findingId:
          `${themeId}:finding`,
      },
    ],
    confidenceLabel: "high",
  } as unknown as ThemeMatch;
}

function signal(
  themeId: string,
  trajectory:
    ThemeTrajectoryLabel
): ThemeLongitudinalSignal {
  return {
    themeId,
    label: themeId,
    trajectory,
    confidence: "high",
    buckets: [],
    analyzablePeriodCount: 6,
    activePeriodCount: 6,
    persistencePercent: 100,
    previousWindowAveragePercent: 20,
    recentWindowAveragePercent: 30,
    percentagePointChange: 10,
    relativeChangePercent: 50,
    slopePerPeriod: 2,
    peakEligiblePercent: 30,
    reasons: [],
  };
}

function tracking(
  signals:
    ThemeLongitudinalSignal[]
): ThemeLongitudinalTracking {
  return {
    methodVersion:
      "theme_longitudinal_v1",
    granularity: "month",
    windowSize: 2,
    minimumFindingsPerPeriod: 10,
    datasetFindingCount: 100,
    datedFindingCount: 100,
    undatedFindingCount: 0,
    temporalCoveragePercent: 100,
    dateRangeStart:
      "2026-01-01",
    dateRangeEnd:
      "2026-06-30",
    periodCount: 6,
    themes: signals,
    warnings: [],
  };
}

const baseline =
  buildThemeKnowledgeSnapshot({
    therapeuticArea:
      "Test Area",
    themes: [
      theme("theme_a", 20),
      theme("theme_b", 15),
    ],
    longitudinalTracking:
      tracking([
        signal(
          "theme_a",
          "stable"
        ),
        signal(
          "theme_b",
          "declining"
        ),
      ]),
    createdAt:
      "2026-06-30T12:00:00.000Z",
  });

const duplicateBaseline =
  buildThemeKnowledgeSnapshot({
    therapeuticArea:
      "Test Area",
    themes: [
      theme("theme_a", 20),
      theme("theme_b", 15),
    ],
    longitudinalTracking:
      tracking([
        signal(
          "theme_a",
          "stable"
        ),
        signal(
          "theme_b",
          "declining"
        ),
      ]),
    createdAt:
      "2026-07-01T12:00:00.000Z",
  });

if (
  baseline.snapshotKey !==
    duplicateBaseline.snapshotKey ||
  baseline.contentHash !==
    duplicateBaseline.contentHash
) {
  throw new Error(
    "Identical analytical content must produce a deterministic snapshot identity."
  );
}

const currentTracking = tracking([
  signal("theme_a", "rising"),
  signal("theme_c", "emerging"),
]);

const current =
  buildThemeKnowledgeSnapshot({
    therapeuticArea:
      "test_area",
    themes: [
      theme("theme_a", 30),
      theme("theme_c", 5),
    ],
    longitudinalTracking: {
      ...currentTracking,
      dateRangeStart:
        "2026-02-01",
      dateRangeEnd:
        "2026-07-31",
    },
    createdAt:
      "2026-07-31T12:00:00.000Z",
  });

const comparison =
  compareThemeKnowledgeSnapshots(
    baseline,
    current
  );

if (
  !comparison.newThemeIds.includes(
    "theme_c"
  ) ||
  !comparison.noLongerObservedThemeIds.includes(
    "theme_b"
  ) ||
  !comparison.increasingThemeIds.includes(
    "theme_a"
  ) ||
  !comparison.trajectoryChangedThemeIds.includes(
    "theme_a"
  )
) {
  throw new Error(
    "Snapshot comparison did not identify the expected knowledge changes."
  );
}

console.log(
  JSON.stringify(
    {
      baselineKey:
        baseline.snapshotKey,
      duplicateBaselineKey:
        duplicateBaseline.snapshotKey,
      currentKey:
        current.snapshotKey,
      comparison,
    },
    null,
    2
  )
);
