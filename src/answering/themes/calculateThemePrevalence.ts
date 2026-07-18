import type {
  CanonicalFinding,
} from "../models/finding";
import {
  filterMeaningfulDimensionValues,
} from "./dimensionQualityConfig";
import type {
  ThemeDimensionPrevalence,
  ThemePrevalence,
  ThemePrevalenceBreakdowns,
} from "./themeModels";

type DimensionDefinition = {
  pluralField: string;

  singularField?: string;
};

export type ThemePrevalenceContext = {
  findings: CanonicalFinding[];

  taxonomyThemeIds: Set<string>;

  eligibleFindings:
    CanonicalFinding[];

  themeAssignmentCount: number;

  datasetEvidenceWeight: number;

  eligibleEvidenceWeight: number;
};

const DIMENSIONS: Record<
  keyof ThemePrevalenceBreakdowns,
  DimensionDefinition
> = {
  countries: {
    pluralField: "countries",
    singularField: "country",
  },

  platforms: {
    pluralField: "platforms",
    singularField: "platform",
  },

  personas: {
    pluralField: "personas",
    singularField: "persona",
  },

  sourceTypes: {
    pluralField: "sourceTypes",
    singularField: "sourceType",
  },
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

function clamp01(
  value: number
): number {
  return Math.max(
    0,
    Math.min(1, value)
  );
}

function numericValue(
  value: unknown
): number | undefined {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

/**
 * Produces a 0-1 analytical weight for prevalence.
 * Evidence Intelligence is authoritative when present;
 * canonical confidence fields provide a safe fallback for
 * synthetic, curated, and legacy findings.
 */
export function getThemePrevalenceEvidenceWeight(
  finding: CanonicalFinding
): number {
  const value =
    finding as any;

  const intelligence =
    value.evidenceIntelligence;

  const qualityScore =
    numericValue(
      intelligence?.qualityScore
    );

  if (
    qualityScore !== undefined
  ) {
    const quality =
      clamp01(
        qualityScore / 100
      );

    const classificationConfidence =
      clamp01(
        numericValue(
          intelligence
            ?.classificationConfidence
        ) ?? 0.5
      );

    return round(
      quality *
        (
          0.7 +
          classificationConfidence *
            0.3
        ),
      4
    );
  }

  const fallbackValues = [
    numericValue(
      value.evidenceStrength
    ),
    numericValue(
      value.confidence
    ),
    numericValue(
      value.relevanceScore
    ),
  ].filter(
    (item): item is number =>
      item !== undefined
  );

  if (
    fallbackValues.length === 0
  ) {
    return 0.5;
  }

  return round(
    fallbackValues.reduce(
      (sum, item) =>
        sum + clamp01(item),
      0
    ) /
      fallbackValues.length,
    4
  );
}

function toArray(
  value: unknown
): unknown[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value)
    ? value
    : [value];
}

function getThemeIds(
  finding: CanonicalFinding,
  taxonomyThemeIds: Set<string>
): string[] {
  const rawThemes =
    toArray(
      (finding as any).themes
    );

  return Array.from(
    new Set(
      rawThemes
        .map((theme) =>
          String(
            theme || ""
          ).trim()
        )
        .filter(
          (theme) =>
            taxonomyThemeIds.has(
              theme
            )
        )
    )
  );
}

function hasTheme(
  finding: CanonicalFinding,
  themeId: string,
  taxonomyThemeIds: Set<string>
): boolean {
  return getThemeIds(
    finding,
    taxonomyThemeIds
  ).includes(themeId);
}

function getDimensionValues(
  finding: CanonicalFinding,
  definition: DimensionDefinition
): string[] {
  const value =
    finding as any;

  const rawValues = [
    ...toArray(
      value[
        definition.pluralField
      ]
    ),
  ];

  if (
    definition.singularField
  ) {
    rawValues.push(
      ...toArray(
        value[
          definition
            .singularField
        ]
      )
    );
  }

  return filterMeaningfulDimensionValues(
    rawValues
  );
}

function sumEvidenceWeight(
  findings: CanonicalFinding[]
): number {
  return round(
    findings.reduce(
      (sum, finding) =>
        sum +
        getThemePrevalenceEvidenceWeight(
          finding
        ),
      0
    ),
    4
  );
}

function buildDimensionBreakdown(
  findings: CanonicalFinding[],
  matchingFindings:
    CanonicalFinding[],
  definition: DimensionDefinition
): Record<
  string,
  ThemeDimensionPrevalence
> {
  const denominatorMap =
    new Map<
      string,
      CanonicalFinding[]
    >();

  const matchingMap =
    new Map<
      string,
      CanonicalFinding[]
    >();

  for (const finding of findings) {
    for (
      const dimensionValue of
      getDimensionValues(
        finding,
        definition
      )
    ) {
      const values =
        denominatorMap.get(
          dimensionValue
        ) || [];

      values.push(finding);

      denominatorMap.set(
        dimensionValue,
        values
      );
    }
  }

  for (
    const finding of
    matchingFindings
  ) {
    for (
      const dimensionValue of
      getDimensionValues(
        finding,
        definition
      )
    ) {
      const values =
        matchingMap.get(
          dimensionValue
        ) || [];

      values.push(finding);

      matchingMap.set(
        dimensionValue,
        values
      );
    }
  }

  return Object.fromEntries(
    Array.from(
      denominatorMap.entries()
    )
      .map(
        ([
          dimensionValue,
          denominatorFindings,
        ]): [
          string,
          ThemeDimensionPrevalence
        ] => {
          const matching =
            matchingMap.get(
              dimensionValue
            ) || [];

          const evidenceWeight =
            sumEvidenceWeight(
              matching
            );

          const denominatorEvidenceWeight =
            sumEvidenceWeight(
              denominatorFindings
            );

          return [
            dimensionValue,
            {
              count:
                matching.length,

              denominator:
                denominatorFindings
                  .length,

              rawPercent:
                percent(
                  matching.length,
                  denominatorFindings
                    .length
                ),

              evidenceWeight,

              denominatorEvidenceWeight,

              evidenceWeightedPercent:
                percent(
                  evidenceWeight,
                  denominatorEvidenceWeight
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
          second.rawPercent -
            first.rawPercent ||
          second.count -
            first.count
      )
  );
}

export function buildThemePrevalenceContext(
  findings: CanonicalFinding[],
  taxonomyThemeIds:
    Iterable<string>
): ThemePrevalenceContext {
  const supportedThemeIds =
    new Set(
      taxonomyThemeIds
    );

  const eligibleFindings =
    findings.filter(
      (finding) =>
        getThemeIds(
          finding,
          supportedThemeIds
        ).length > 0
    );

  const themeAssignmentCount =
    eligibleFindings.reduce(
      (sum, finding) =>
        sum +
        getThemeIds(
          finding,
          supportedThemeIds
        ).length,
      0
    );

  return {
    findings,

    taxonomyThemeIds:
      supportedThemeIds,

    eligibleFindings,

    themeAssignmentCount,

    datasetEvidenceWeight:
      sumEvidenceWeight(
        findings
      ),

    eligibleEvidenceWeight:
      sumEvidenceWeight(
        eligibleFindings
      ),
  };
}

export function calculateThemePrevalence(
  context:
    ThemePrevalenceContext,
  themeId: string
): ThemePrevalence {
  const matchingFindings =
    context.findings.filter(
      (finding) =>
        hasTheme(
          finding,
          themeId,
          context
            .taxonomyThemeIds
        )
    );

  const matchingEvidenceWeight =
    sumEvidenceWeight(
      matchingFindings
    );

  const overlappingMatchingFindingCount =
    matchingFindings.filter(
      (finding) =>
        getThemeIds(
          finding,
          context
            .taxonomyThemeIds
        ).length > 1
    ).length;

  const breakdowns =
    Object.fromEntries(
      Object.entries(
        DIMENSIONS
      ).map(
        ([key, definition]) => [
          key,
          buildDimensionBreakdown(
            context.findings,
            matchingFindings,
            definition
          ),
        ]
      )
    ) as ThemePrevalenceBreakdowns;

  return {
    methodVersion:
      "theme_prevalence_v1",

    datasetFindingCount:
      context.findings.length,

    eligibleFindingCount:
      context.eligibleFindings
        .length,

    matchingFindingCount:
      matchingFindings.length,

    themeAssignmentCount:
      context.themeAssignmentCount,

    datasetCoveragePercent:
      percent(
        context.eligibleFindings
          .length,
        context.findings.length
      ),

    rawPercent:
      percent(
        matchingFindings.length,
        context.findings.length
      ),

    eligiblePercent:
      percent(
        matchingFindings.length,
        context.eligibleFindings
          .length
      ),

    evidenceWeightedPercent:
      percent(
        matchingEvidenceWeight,
        context
          .datasetEvidenceWeight
      ),

    eligibleEvidenceWeightedPercent:
      percent(
        matchingEvidenceWeight,
        context
          .eligibleEvidenceWeight
      ),

    shareOfThemeAssignmentsPercent:
      percent(
        matchingFindings.length,
        context
          .themeAssignmentCount
      ),

    matchingEvidenceWeight:
      round(
        matchingEvidenceWeight,
        4
      ),

    datasetEvidenceWeight:
      round(
        context
          .datasetEvidenceWeight,
        4
      ),

    eligibleEvidenceWeight:
      round(
        context
          .eligibleEvidenceWeight,
        4
      ),

    overlappingMatchingFindingCount,

    overlapRatePercent:
      percent(
        overlappingMatchingFindingCount,
        matchingFindings.length
      ),

    averageThemesPerEligibleFinding:
      context.eligibleFindings
        .length > 0
        ? round(
            context
              .themeAssignmentCount /
              context
                .eligibleFindings
                .length
          )
        : 0,

    breakdowns,
  };
}
