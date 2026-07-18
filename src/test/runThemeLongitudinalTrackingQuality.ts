import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  buildThemeLongitudinalTracking,
} from "../answering/themes/buildThemeLongitudinalTracking";
import type {
  ThemeMatch,
  ThemeTrajectoryLabel,
} from "../answering/themes/themeModels";

const MONTHS = [
  "2026-01-15",
  "2026-02-15",
  "2026-03-15",
  "2026-04-15",
  "2026-05-15",
  "2026-06-15",
];

const COUNTS: Record<
  string,
  number[]
> = {
  accelerating: [
    2, 3, 4, 6, 10, 14,
  ],
  stable: [
    6, 6, 6, 6, 6, 6,
  ],
  emerging: [
    0, 0, 0, 2, 6, 10,
  ],
  declining: [
    14, 12, 10, 7, 4, 2,
  ],
};

function finding(
  findingId: string,
  publishedAt: string,
  themes: string[]
): CanonicalFinding {
  return {
    findingId,
    findingType:
      "market_interest",
    canonicalClaim: findingId,
    summary: findingId,
    therapeuticArea: "test",
    countries: [],
    personas: [],
    platforms: ["forum"],
    symptoms: [],
    treatments: [],
    lifecycleStages: [],
    intentLabels: [],
    confidence: 0.9,
    relevanceScore: 0.9,
    evidenceStrength: 0.9,
    evidence: [],
    normalizedLabels: [],
    semanticFingerprint:
      findingId,
    publishedAt,
    themes,
  } as unknown as CanonicalFinding;
}

const findings:
  CanonicalFinding[] = [];

MONTHS.forEach(
  (publishedAt, monthIndex) => {
    for (
      let index = 0;
      index < 20;
      index += 1
    ) {
      const themes = ["baseline"];

      for (const [
        themeId,
        counts,
      ] of Object.entries(COUNTS)) {
        if (
          index <
          counts[monthIndex]
        ) {
          themes.push(themeId);
        }
      }

      findings.push(
        finding(
          `${monthIndex}:${index}`,
          publishedAt,
          themes
        )
      );
    }
  }
);

const themes = [
  "baseline",
  ...Object.keys(COUNTS),
].map(
  (themeId) =>
    ({
      themeId,
      label: themeId,
    }) as ThemeMatch
);

const tracking =
  buildThemeLongitudinalTracking(
    findings,
    themes,
    {
      granularity: "month",
      minimumFindingsPerPeriod: 10,
      windowSize: 2,
    }
  );

const expected: Record<
  string,
  ThemeTrajectoryLabel
> = {
  accelerating: "accelerating",
  stable: "stable",
  emerging: "emerging",
  declining: "declining",
};

for (const [
  themeId,
  trajectory,
] of Object.entries(expected)) {
  const actual =
    tracking.themes.find(
      (signal) =>
        signal.themeId ===
        themeId
    );

  if (
    actual?.trajectory !==
    trajectory
  ) {
    throw new Error(
      `${themeId} expected ${trajectory} but received ${actual?.trajectory}.`
    );
  }
}

if (
  tracking.temporalCoveragePercent !==
    100 ||
  tracking.periodCount !== 6
) {
  throw new Error(
    "Expected complete coverage across six monthly periods."
  );
}

const insufficient =
  buildThemeLongitudinalTracking(
    findings.filter(
      (item) =>
        String(
          (item as any)
            .publishedAt
        ) < "2026-03"
    ),
    themes,
    {
      granularity: "month",
      minimumFindingsPerPeriod: 10,
    }
  );

if (
  insufficient.themes.some(
    (signal) =>
      signal.trajectory !==
      "insufficient"
  )
) {
  throw new Error(
    "Two periods must not produce a longitudinal trajectory claim."
  );
}

console.log(
  JSON.stringify(
    tracking,
    null,
    2
  )
);
