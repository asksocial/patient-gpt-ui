import type {
  CanonicalFinding,
} from "../models/finding";
import {
  normalizeEvidenceMetadata,
} from "../evidence/normalizeEvidenceMetadata";
import {
  buildThemePrevalenceContext,
  calculateThemePrevalence,
} from "./calculateThemePrevalence";
import type {
  ThemeConfidenceLabel,
  ThemeLongitudinalSignal,
  ThemeLongitudinalTracking,
  ThemeMatch,
  ThemeTimeBucket,
  ThemeTimeGranularity,
  ThemeTrajectoryLabel,
} from "./themeModels";

export type BuildThemeLongitudinalTrackingOptions = {
  granularity?:
    | "auto"
    | ThemeTimeGranularity;

  windowSize?: number;

  minimumFindingsPerPeriod?:
    number;
};

type DatedFinding = {
  finding: CanonicalFinding;
  date: Date;
};

function round(
  value: number,
  digits = 2
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;

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

function parseFindingDate(
  finding: CanonicalFinding
): Date | undefined {
  const direct = finding as any;

  const value =
    direct.publishedAt ||
    direct.date ||
    direct.structuredData
      ?.publishedAt ||
    normalizeEvidenceMetadata(
      finding
    ).publishedAt;

  if (!value) {
    return undefined;
  }

  const normalized =
    String(value).trim();

  const dateOnly =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  const parsed = dateOnly
    ? new Date(
        Date.UTC(
          Number(dateOnly[1]),
          Number(dateOnly[2]) - 1,
          Number(dateOnly[3])
        )
      )
    : new Date(normalized);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return undefined;
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate()
    )
  );
}

function startOfPeriod(
  date: Date,
  granularity:
    ThemeTimeGranularity
): Date {
  const year =
    date.getUTCFullYear();
  const month =
    date.getUTCMonth();
  const day = date.getUTCDate();

  if (granularity === "month") {
    return new Date(
      Date.UTC(year, month, 1)
    );
  }

  if (granularity === "quarter") {
    return new Date(
      Date.UTC(
        year,
        Math.floor(month / 3) * 3,
        1
      )
    );
  }

  const current = new Date(
    Date.UTC(year, month, day)
  );
  const weekday =
    current.getUTCDay();
  const daysSinceMonday =
    (weekday + 6) % 7;

  current.setUTCDate(
    current.getUTCDate() -
      daysSinceMonday
  );

  return current;
}

function addPeriod(
  date: Date,
  granularity:
    ThemeTimeGranularity
): Date {
  const next = new Date(
    date.getTime()
  );

  if (granularity === "week") {
    next.setUTCDate(
      next.getUTCDate() + 7
    );
  } else if (
    granularity === "month"
  ) {
    next.setUTCMonth(
      next.getUTCMonth() + 1
    );
  } else {
    next.setUTCMonth(
      next.getUTCMonth() + 3
    );
  }

  return next;
}

function endOfPeriod(
  start: Date,
  granularity:
    ThemeTimeGranularity
): Date {
  const next = addPeriod(
    start,
    granularity
  );

  return new Date(
    next.getTime() - 1
  );
}

function isoDate(
  date: Date
): string {
  return date
    .toISOString()
    .slice(0, 10);
}

function periodLabel(
  date: Date,
  granularity:
    ThemeTimeGranularity
): string {
  if (granularity === "quarter") {
    return `${date.getUTCFullYear()} Q${Math.floor(
      date.getUTCMonth() / 3
    ) + 1}`;
  }

  if (granularity === "week") {
    return `Week of ${isoDate(
      date
    )}`;
  }

  return date.toLocaleString(
    "en-US",
    {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  );
}

function chooseGranularity(
  dates: Date[],
  requested:
    | "auto"
    | ThemeTimeGranularity
): ThemeTimeGranularity {
  if (requested !== "auto") {
    return requested;
  }

  if (dates.length < 2) {
    return "month";
  }

  const spanDays =
    (
      dates[dates.length - 1]
        .getTime() -
      dates[0].getTime()
    ) /
    86_400_000;

  if (spanDays <= 90) {
    return "week";
  }

  if (spanDays <= 730) {
    return "month";
  }

  return "quarter";
}

function average(
  values: number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  return round(
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length
  );
}

function linearSlope(
  values: number[]
): number {
  if (values.length < 2) {
    return 0;
  }

  const xAverage =
    (values.length - 1) / 2;
  const yAverage =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length;

  let numerator = 0;
  let denominator = 0;

  values.forEach(
    (value, index) => {
      numerator +=
        (index - xAverage) *
        (value - yAverage);
      denominator +=
        (index - xAverage) ** 2;
    }
  );

  return denominator > 0
    ? round(
        numerator / denominator
      )
    : 0;
}

function standardDeviation(
  values: number[]
): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance =
    values.reduce(
      (sum, value) =>
        sum +
        (value - mean) ** 2,
      0
    ) / values.length;

  return round(
    Math.sqrt(variance)
  );
}

function signalConfidence(
  analyzablePeriodCount: number,
  averagePeriodVolume: number,
  temporalCoveragePercent: number,
  totalMatchingFindings: number,
  activePeriodCount: number
): ThemeConfidenceLabel {
  if (analyzablePeriodCount < 3) {
    return "insufficient";
  }

  if (
    analyzablePeriodCount >= 5 &&
    averagePeriodVolume >= 20 &&
    temporalCoveragePercent >= 80 &&
    totalMatchingFindings >= 20 &&
    activePeriodCount >= 4
  ) {
    return "high";
  }

  if (
    analyzablePeriodCount >= 3 &&
    averagePeriodVolume >= 10 &&
    temporalCoveragePercent >= 60 &&
    totalMatchingFindings >= 10 &&
    activePeriodCount >= 3
  ) {
    return "moderate";
  }

  return "directional";
}

function classifyTrajectory(
  values: number[],
  previousAverage: number,
  recentAverage: number,
  change: number,
  slope: number,
  persistencePercent: number
): ThemeTrajectoryLabel {
  if (values.length < 3) {
    return "insufficient";
  }

  const firstActiveIndex =
    values.findIndex(
      (value) => value > 0
    );

  if (
    firstActiveIndex >=
      Math.ceil(
        values.length / 2
      ) &&
    recentAverage >= 5
  ) {
    return "emerging";
  }

  const recentValues =
    values.slice(-3);
  const recentSlope =
    linearSlope(recentValues);

  if (
    change >= 5 &&
    recentSlope >= 3 &&
    recentSlope > slope
  ) {
    return "accelerating";
  }

  if (
    change >= 4 ||
    slope >= 2
  ) {
    return "rising";
  }

  if (
    change <= -4 ||
    slope <= -2
  ) {
    return "declining";
  }

  if (
    standardDeviation(values) >=
      Math.max(
        6,
        average(values) * 0.45
      )
  ) {
    return "volatile";
  }

  if (
    persistencePercent >= 60 ||
    Math.abs(
      recentAverage -
        previousAverage
    ) < 4
  ) {
    return "stable";
  }

  return "volatile";
}

function buildSignal(
  theme: ThemeMatch,
  buckets: ThemeTimeBucket[],
  temporalCoveragePercent: number,
  windowSize: number
): ThemeLongitudinalSignal {
  const analyzable =
    buckets.filter(
      (bucket) =>
        bucket.hasSufficientVolume &&
        bucket.eligibleFindingCount > 0
    );

  const values = analyzable.map(
    (bucket) =>
      bucket.eligiblePercent
  );

  const recent = values.slice(
    -windowSize
  );
  const previous = values.slice(
    -windowSize * 2,
    -windowSize
  );

  const recentAverage =
    average(recent);
  const previousAverage =
    average(previous);
  const change = round(
    recentAverage -
      previousAverage
  );
  const relativeChange =
    previousAverage > 0
      ? round(
          change /
            previousAverage *
            100
        )
      : recentAverage > 0
        ? 100
        : 0;
  const slope =
    linearSlope(values);
  const activePeriodCount =
    values.filter(
      (value) => value > 0
    ).length;
  const persistence = percent(
    activePeriodCount,
    values.length
  );
  const averageVolume =
    average(
      analyzable.map(
        (bucket) =>
          bucket.datasetFindingCount
      )
    );
  const totalMatchingFindings =
    analyzable.reduce(
      (sum, bucket) =>
        sum +
        bucket.matchingFindingCount,
      0
    );
  const confidence =
    signalConfidence(
      analyzable.length,
      averageVolume,
      temporalCoveragePercent,
      totalMatchingFindings,
      activePeriodCount
    );
  const trajectory =
    confidence === "insufficient"
      ? "insufficient"
      : classifyTrajectory(
          values,
          previousAverage,
          recentAverage,
          change,
          slope,
          persistence
        );
  const peak = analyzable
    .slice()
    .sort(
      (first, second) =>
        second.eligiblePercent -
        first.eligiblePercent
    )[0];

  return {
    themeId: theme.themeId,
    label: theme.label,
    trajectory,
    confidence,
    buckets,
    analyzablePeriodCount:
      analyzable.length,
    activePeriodCount,
    persistencePercent:
      persistence,
    previousWindowAveragePercent:
      previousAverage,
    recentWindowAveragePercent:
      recentAverage,
    percentagePointChange: change,
    relativeChangePercent:
      relativeChange,
    slopePerPeriod: slope,
    peakPeriod:
      peak?.periodLabel,
    peakEligiblePercent:
      peak?.eligiblePercent || 0,
    reasons: [
      `${analyzable.length} analyzable periods`,
      `${persistence}% period persistence`,
      `${change} percentage-point recent-window change`,
      `${slope} percentage-point slope per period`,
      `${temporalCoveragePercent}% temporal coverage`,
      `${totalMatchingFindings} matching findings across analyzable periods`,
      `Trajectory classified as ${trajectory}`,
    ],
  };
}

export function buildThemeLongitudinalTracking(
  findings: CanonicalFinding[],
  themes: ThemeMatch[],
  options: BuildThemeLongitudinalTrackingOptions = {}
): ThemeLongitudinalTracking {
  const windowSize = Math.max(
    1,
    Math.floor(
      options.windowSize || 2
    )
  );
  const minimumFindingsPerPeriod =
    Math.max(
      1,
      Math.floor(
        options.minimumFindingsPerPeriod ||
          10
      )
    );

  const dated: DatedFinding[] = [];

  for (const finding of findings) {
    const date =
      parseFindingDate(finding);

    if (date) {
      dated.push({
        finding,
        date,
      });
    }
  }

  dated.sort(
    (first, second) =>
      first.date.getTime() -
      second.date.getTime()
  );

  const coverage = percent(
    dated.length,
    findings.length
  );
  const granularity =
    chooseGranularity(
      dated.map(
        (item) => item.date
      ),
      options.granularity ||
        "auto"
    );
  const themeIds = themes.map(
    (theme) => theme.themeId
  );
  const warnings: string[] = [];

  if (coverage < 80) {
    warnings.push(
      `Only ${coverage}% of findings contain usable publication dates.`
    );
  }

  if (dated.length === 0) {
    return {
      methodVersion:
        "theme_longitudinal_v1",
      granularity,
      windowSize,
      minimumFindingsPerPeriod,
      datasetFindingCount:
        findings.length,
      datedFindingCount: 0,
      undatedFindingCount:
        findings.length,
      temporalCoveragePercent: 0,
      periodCount: 0,
      themes: themes.map(
        (theme) =>
          buildSignal(
            theme,
            [],
            0,
            windowSize
          )
      ),
      warnings: [
        "No usable publication dates were found; longitudinal classification is unavailable.",
      ],
    };
  }

  const firstPeriod =
    startOfPeriod(
      dated[0].date,
      granularity
    );
  const lastPeriod =
    startOfPeriod(
      dated[dated.length - 1]
        .date,
      granularity
    );
  const periods: Date[] = [];

  for (
    let cursor = firstPeriod;
    cursor.getTime() <=
    lastPeriod.getTime();
    cursor = addPeriod(
      cursor,
      granularity
    )
  ) {
    periods.push(
      new Date(cursor.getTime())
    );
  }

  const findingsByPeriod = new Map<
    string,
    CanonicalFinding[]
  >();

  for (const item of dated) {
    const key = isoDate(
      startOfPeriod(
        item.date,
        granularity
      )
    );
    const values =
      findingsByPeriod.get(key) ||
      [];

    values.push(item.finding);
    findingsByPeriod.set(
      key,
      values
    );
  }

  const bucketMap = new Map<
    string,
    Map<string, ThemeTimeBucket>
  >();

  for (const period of periods) {
    const periodFindings =
      findingsByPeriod.get(
        isoDate(period)
      ) || [];
    const context =
      buildThemePrevalenceContext(
        periodFindings,
        themeIds
      );

    for (const theme of themes) {
      const prevalence =
        calculateThemePrevalence(
          context,
          theme.themeId
        );
      const themeBuckets =
        bucketMap.get(
          theme.themeId
        ) || new Map();

      themeBuckets.set(
        isoDate(period),
        {
          periodStart:
            isoDate(period),
          periodEnd: isoDate(
            endOfPeriod(
              period,
              granularity
            )
          ),
          periodLabel:
            periodLabel(
              period,
              granularity
            ),
          datasetFindingCount:
            prevalence.datasetFindingCount,
          eligibleFindingCount:
            prevalence.eligibleFindingCount,
          matchingFindingCount:
            prevalence.matchingFindingCount,
          rawPercent:
            prevalence.rawPercent,
          eligiblePercent:
            prevalence.eligiblePercent,
          eligibleEvidenceWeightedPercent:
            prevalence.eligibleEvidenceWeightedPercent,
          hasSufficientVolume:
            prevalence.datasetFindingCount >=
            minimumFindingsPerPeriod,
        }
      );

      bucketMap.set(
        theme.themeId,
        themeBuckets
      );
    }
  }

  const signals = themes.map(
    (theme) =>
      buildSignal(
        theme,
        periods.map(
          (period) =>
            bucketMap
              .get(theme.themeId)
              ?.get(
                isoDate(period)
              ) as ThemeTimeBucket
        ),
        coverage,
        windowSize
      )
  );

  return {
    methodVersion:
      "theme_longitudinal_v1",
    granularity,
    windowSize,
    minimumFindingsPerPeriod,
    datasetFindingCount:
      findings.length,
    datedFindingCount:
      dated.length,
    undatedFindingCount:
      findings.length -
      dated.length,
    temporalCoveragePercent:
      coverage,
    dateRangeStart:
      isoDate(dated[0].date),
    dateRangeEnd: isoDate(
      dated[dated.length - 1]
        .date
    ),
    periodCount: periods.length,
    themes: signals,
    warnings,
  };
}
