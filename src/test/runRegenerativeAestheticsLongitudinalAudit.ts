import path from "path";
import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../answering/evidence";
import {
  aggregateThemes,
} from "../answering/themes/aggregateThemes";
import {
  assignThemesToFindings,
} from "../answering/themes/assignThemes";
import {
  buildThemeLongitudinalTracking,
} from "../answering/themes/buildThemeLongitudinalTracking";
import {
  ingestMeltwaterCsv,
} from "../ingestion";

const CSV_PATH = path.resolve(
  __dirname,
  "../../data/regen-aesthetics.csv"
);

console.error(
  "Loading Regenerative Aesthetics CSV..."
);

const raw = ingestMeltwaterCsv(
  CSV_PATH,
  {
    sourceType: "meltwater",
    therapeuticArea:
      "regenerative_aesthetics",
    profileId:
      "regenerative_aesthetics",
  }
) as unknown as CanonicalFinding[];

const enriched =
  enrichFindingsWithEvidenceIntelligence(
    raw
  );
const themed = assignThemesToFindings(
  enriched,
  "regenerative_aesthetics"
);
const themes = aggregateThemes(
  themed,
  "regenerative_aesthetics"
);
const tracking =
  buildThemeLongitudinalTracking(
    themed,
    themes
  );

if (
  tracking.temporalCoveragePercent <
  80
) {
  throw new Error(
    `Temporal coverage is too low for production tracking: ${tracking.temporalCoveragePercent}%.`
  );
}

if (tracking.periodCount < 3) {
  throw new Error(
    "Expected at least three analyzable production periods."
  );
}

if (
  tracking.themes.some(
    (signal) =>
      signal.buckets.length !==
      tracking.periodCount
  )
) {
  throw new Error(
    "Every theme should expose the complete period series, including zero-match periods."
  );
}

console.log(
  JSON.stringify(
    {
      methodVersion:
        tracking.methodVersion,
      granularity:
        tracking.granularity,
      totalFindings:
        tracking.datasetFindingCount,
      datedFindings:
        tracking.datedFindingCount,
      temporalCoveragePercent:
        tracking.temporalCoveragePercent,
      dateRangeStart:
        tracking.dateRangeStart,
      dateRangeEnd:
        tracking.dateRangeEnd,
      periodCount:
        tracking.periodCount,
      warnings: tracking.warnings,
      themes: tracking.themes.map(
        (signal) => ({
          themeId: signal.themeId,
          trajectory:
            signal.trajectory,
          confidence:
            signal.confidence,
          persistencePercent:
            signal.persistencePercent,
          previousWindowAveragePercent:
            signal.previousWindowAveragePercent,
          recentWindowAveragePercent:
            signal.recentWindowAveragePercent,
          percentagePointChange:
            signal.percentagePointChange,
          relativeChangePercent:
            signal.relativeChangePercent,
          slopePerPeriod:
            signal.slopePerPeriod,
          peakPeriod:
            signal.peakPeriod,
          peakEligiblePercent:
            signal.peakEligiblePercent,
          buckets: signal.buckets,
        })
      ),
    },
    null,
    2
  )
);
