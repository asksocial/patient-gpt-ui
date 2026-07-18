import path from "path";
import type {
  CanonicalFinding,
} from "../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../answering/evidence";
import {
  buildExecutiveIntelligenceBrief,
} from "../answering/executive";
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
const snapshot =
  buildThemeKnowledgeSnapshot({
    therapeuticArea:
      "regenerative_aesthetics",
    themes,
    relationships,
    strategicImplications,
    longitudinalTracking,
    sourceQuery:
      "What should leadership know now?",
    createdAt:
      "2026-07-18T12:00:00.000Z",
  });
const brief =
  buildExecutiveIntelligenceBrief({
    snapshot,
    generatedAt:
      "2026-07-18T13:00:00.000Z",
  });

if (
  !brief.headline ||
  brief.topThemes.length === 0 ||
  brief.dataQuality.datasetFindingCount !==
    raw.length
) {
  throw new Error(
    "The production executive brief is missing its headline, priority themes, or dataset traceability."
  );
}

for (const action of
  brief.recommendedActions) {
  if (
    action.priority === "low" ||
    action.confidence ===
      "insufficient"
  ) {
    throw new Error(
      `${action.actionId} improperly elevated a weak implication into an executive recommendation.`
    );
  }
}

const insufficientRecords =
  snapshot.themeRecords.filter(
    (record) =>
      record.confidence ===
        "insufficient" ||
      record.triangulation ===
        "single_source"
  );

for (const record of
  insufficientRecords) {
  const isVisible =
    brief.watchlist.some(
      (item) =>
        item.themeId ===
        record.themeId
    ) ||
    brief.decisionSignals.some(
      (item) =>
        item.type ===
          "evidence_gap" &&
        item.themeIds.includes(
          record.themeId
        )
    );

  if (!isVisible) {
    throw new Error(
      `${record.themeId} is weakly supported but disappeared from executive evidence guardrails.`
    );
  }
}

console.log(
  JSON.stringify(
    {
      briefId: brief.briefId,
      headline: brief.headline,
      executiveSummary:
        brief.executiveSummary,
      dataQuality:
        brief.dataQuality,
      topThemes:
        brief.topThemes,
      decisionSignals:
        brief.decisionSignals,
      recommendedActions:
        brief.recommendedActions,
      watchlist:
        brief.watchlist,
    },
    null,
    2
  )
);
