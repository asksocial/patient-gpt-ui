import type {
  ThemeKnowledgeSnapshot,
  ThemeKnowledgeRecord,
} from "./types";
import type {
  ThemeLongitudinalTracking,
  ThemeMatch,
  ThemeRelationship,
  ThemeStrategicImplication,
} from "../themes/themeModels";

export type BuildThemeKnowledgeSnapshotParams = {
  therapeuticArea: string;

  themes: ThemeMatch[];

  relationships?:
    ThemeRelationship[];

  strategicImplications?:
    ThemeStrategicImplication[];

  longitudinalTracking?:
    ThemeLongitudinalTracking;

  sourceQuery?: string;

  createdAt?: string;
};

function stableSerialize(
  value: unknown
): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value
      .map(stableSerialize)
      .join(",")}]`;
  }

  const object = value as Record<
    string,
    unknown
  >;

  return `{${Object.keys(object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(
          key
        )}:${stableSerialize(
          object[key]
        )}`
    )
    .join(",")}}`;
}

function fnv1a(
  value: string
): string {
  let hash = 0x811c9dc5;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(
      index
    );
    hash = Math.imul(
      hash,
      0x01000193
    );
  }

  return (
    hash >>> 0
  )
    .toString(16)
    .padStart(8, "0");
}

function normalizedArea(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildRecord(
  theme: ThemeMatch,
  longitudinalTracking?:
    ThemeLongitudinalTracking
): ThemeKnowledgeRecord {
  const longitudinal =
    longitudinalTracking
      ?.themes.find(
        (signal) =>
          signal.themeId ===
          theme.themeId
      );

  return {
    themeId: theme.themeId,
    label: theme.label,
    description:
      theme.description,
    count: theme.count,
    eligiblePercent:
      theme.prevalence
        ?.eligiblePercent ??
      theme.percent,
    evidenceWeightedPercent:
      theme.prevalence
        ?.eligibleEvidenceWeightedPercent ??
      theme.percent,
    confidence:
      theme.confidenceLabel,
    triangulation:
      theme.sourceAggregation
        ?.triangulationLabel ||
      "insufficient",
    triangulationScore:
      theme.sourceAggregation
        ?.triangulationScore || 0,
    independentSourceCategoryCount:
      theme.sourceAggregation
        ?.distinctIndependentSourceCategoryCount ||
      0,
    channelCount:
      theme.sourceAggregation
        ?.distinctChannelCount || 0,
    trajectory:
      longitudinal
        ?.trajectory ||
      "insufficient",
    longitudinalConfidence:
      longitudinal
        ?.confidence ||
      "insufficient",
    percentagePointChange:
      longitudinal
        ?.percentagePointChange ||
      0,
    persistencePercent:
      longitudinal
        ?.persistencePercent || 0,
    findingIds: Array.from(
      new Set(
        theme.findingIds.filter(
          Boolean
        )
      )
    ),
    representativeEvidenceIds:
      Array.from(
        new Set(
          theme.representativeEvidence
            .map(
              (evidence) =>
                evidence.findingId
            )
            .filter(Boolean)
        )
      ),
  };
}

export function buildThemeKnowledgeSnapshot(
  params:
    BuildThemeKnowledgeSnapshotParams
): ThemeKnowledgeSnapshot {
  const therapeuticArea =
    normalizedArea(
      params.therapeuticArea
    );

  if (!therapeuticArea) {
    throw new Error(
      "therapeuticArea is required to build a knowledge snapshot."
    );
  }

  const createdAt =
    params.createdAt ||
    new Date().toISOString();

  const themeRecords =
    params.themes
      .map((theme) =>
        buildRecord(
          theme,
          params.longitudinalTracking
        )
      )
      .sort(
        (first, second) =>
          second.eligiblePercent -
            first.eligiblePercent ||
          first.themeId.localeCompare(
            second.themeId
          )
      );

  const content = {
    therapeuticArea,
    analysisStart:
      params.longitudinalTracking
        ?.dateRangeStart,
    analysisEnd:
      params.longitudinalTracking
        ?.dateRangeEnd,
    themeRecords,
    relationships:
      params.relationships || [],
    strategicImplications:
      params.strategicImplications ||
      [],
  };

  const contentHash = fnv1a(
    stableSerialize(content)
  );
  const periodKey =
    params.longitudinalTracking
      ?.dateRangeEnd ||
    createdAt.slice(0, 10);

  return {
    schemaVersion:
      "theme_knowledge_snapshot_v1",
    snapshotKey:
      `${therapeuticArea}:${periodKey}:${contentHash}`,
    therapeuticArea,
    createdAt,
    analysisStart:
      params.longitudinalTracking
        ?.dateRangeStart,
    analysisEnd:
      params.longitudinalTracking
        ?.dateRangeEnd,
    granularity:
      params.longitudinalTracking
        ?.granularity,
    datasetFindingCount:
      params.longitudinalTracking
        ?.datasetFindingCount || 0,
    datedFindingCount:
      params.longitudinalTracking
        ?.datedFindingCount || 0,
    temporalCoveragePercent:
      params.longitudinalTracking
        ?.temporalCoveragePercent ||
      0,
    sourceQuery:
      params.sourceQuery,
    themeRecords,
    relationships:
      params.relationships || [],
    strategicImplications:
      params.strategicImplications ||
      [],
    longitudinalTracking:
      params.longitudinalTracking,
    contentHash,
  };
}
