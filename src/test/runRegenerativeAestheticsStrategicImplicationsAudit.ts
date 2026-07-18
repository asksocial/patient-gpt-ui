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

const implications =
  buildThemeStrategicImplications(
    themes,
    relationships
  );

if (implications.length === 0) {
  throw new Error(
    "Expected real-data strategic implications."
  );
}

for (const implication of implications) {
  if (
    implication.themeIds.length === 0 ||
    implication.evidenceBasis.length ===
      0 ||
    !implication.statement ||
    !implication.recommendedAction
  ) {
    throw new Error(
      `${implication.implicationId} is missing its structured evidence contract.`
    );
  }
}

const preventative = themes.find(
  (theme) =>
    theme.themeId ===
    "preventative_aesthetics"
);

if (
  preventative &&
  !preventative.sourceAggregation
    ?.isCrossSourceCorroborated &&
  !implications.some(
    (item) =>
      item.type ===
        "evidence_validation" &&
      item.themeIds.includes(
        preventative.themeId
      )
  )
) {
  throw new Error(
    "The single-source preventative-aesthetics theme should remain a validation hypothesis."
  );
}

console.log(
  JSON.stringify(
    {
      totalFindings: raw.length,
      themeCount: themes.length,
      relationshipCount:
        relationships.length,
      implications,
    },
    null,
    2
  )
);
