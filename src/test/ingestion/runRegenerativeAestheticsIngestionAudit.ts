import path from "path";
import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../../answering/evidence";
import {
  ingestMeltwaterCsv,
} from "../../ingestion";
import {
  buildIngestionAudit,
} from "../../ingestion/diagnostics";

const CSV_PATH =
  path.resolve(
    __dirname,
    "../../../data/regen-aesthetics.csv"
  );

function main(): void {
  console.error(
    "Loading Regenerative Aesthetics CSV..."
  );

  const rawFindings =
    ingestMeltwaterCsv(
      CSV_PATH,
      {
        sourceType:
          "meltwater",

        therapeuticArea:
          "regenerative_aesthetics",

        profileId:
          "regenerative_aesthetics",
      }
    ) as unknown as
      CanonicalFinding[];

  console.error(
    `Loaded ${rawFindings.length} findings`
  );

  const enrichedFindings =
    enrichFindingsWithEvidenceIntelligence(
      rawFindings
    );

  const audit =
    buildIngestionAudit(
      enrichedFindings,
      25
    );

  console.log(
    JSON.stringify(
      audit,
      null,
      2
    )
  );
}

main();