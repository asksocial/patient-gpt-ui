import path from "path";
import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../answering/evidence";
import {
  buildThemeKnowledgeSnapshot,
} from "../answering/knowledge";
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
  buildThemeStrategicImplications,
} from "../answering/themes/buildThemeStrategicImplications";
import {
  detectThemeRelationships,
} from "../answering/themes/detectThemeRelationships";
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
const relationships =
  detectThemeRelationships(
    themed,
    themes,
    "regenerative_aesthetics"
  );
const strategicImplications =
  buildThemeStrategicImplications(
    themes,
    relationships
  );
const longitudinalTracking =
  buildThemeLongitudinalTracking(
    themed,
    themes
  );

const first =
  buildThemeKnowledgeSnapshot({
    therapeuticArea:
      "regenerative_aesthetics",
    themes,
    relationships,
    strategicImplications,
    longitudinalTracking,
    sourceQuery:
      "What themes are changing?",
    createdAt:
      "2026-07-17T12:00:00.000Z",
  });
const second =
  buildThemeKnowledgeSnapshot({
    therapeuticArea:
      "regenerative_aesthetics",
    themes,
    relationships,
    strategicImplications,
    longitudinalTracking,
    sourceQuery:
      "What themes are changing?",
    createdAt:
      "2026-07-17T13:00:00.000Z",
  });

if (
  first.themeRecords.length !==
    themes.length ||
  first.datasetFindingCount !==
    raw.length ||
  first.snapshotKey !==
    second.snapshotKey
) {
  throw new Error(
    "The production knowledge snapshot is incomplete or non-deterministic."
  );
}

for (const record of first.themeRecords) {
  if (
    !record.themeId ||
    record.findingIds.length === 0
  ) {
    throw new Error(
      `${record.themeId || "unknown"} is missing its knowledge identity or finding references.`
    );
  }
}

console.log(
  JSON.stringify(
    {
      snapshotKey:
        first.snapshotKey,
      contentHash:
        first.contentHash,
      therapeuticArea:
        first.therapeuticArea,
      analysisStart:
        first.analysisStart,
      analysisEnd:
        first.analysisEnd,
      datasetFindingCount:
        first.datasetFindingCount,
      temporalCoveragePercent:
        first.temporalCoveragePercent,
      themeRecordCount:
        first.themeRecords.length,
      relationshipCount:
        first.relationships.length,
      implicationCount:
        first.strategicImplications.length,
      themes: first.themeRecords.map(
        (record) => ({
          themeId: record.themeId,
          eligiblePercent:
            record.eligiblePercent,
          confidence:
            record.confidence,
          triangulation:
            record.triangulation,
          trajectory:
            record.trajectory,
          findingReferenceCount:
            record.findingIds.length,
        })
      ),
    },
    null,
    2
  )
);
