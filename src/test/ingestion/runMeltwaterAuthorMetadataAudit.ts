import path from "path";
import {
  ingestMeltwaterCsv,
} from "../../ingestion";

const CSV_PATH =
  path.resolve(
    __dirname,
    "../../../data/regen-aesthetics.csv"
  );

function increment(
  counts: Record<
    string,
    number
  >,
  value: string
): void {
  counts[value] =
    (counts[value] || 0) +
    1;
}

function main(): void {
  console.error(
    "Loading Regenerative Aesthetics CSV..."
  );

  const findings =
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
    );

  const liveFindings =
    findings.filter(
      (finding: any) =>
        finding.sourceType ===
          "live" &&
        finding.rawMetadata
    );

  const authorFieldCounts:
    Record<string, number> =
      {};

  const populatedAuthorExamples:
    Array<
      Record<string, unknown>
    > = [];

  for (
    const finding of liveFindings as any[]
  ) {
    const metadata =
      finding.rawMetadata;

    for (
      const fieldName of
        metadata.authorFieldNames
    ) {
      increment(
        authorFieldCounts,
        fieldName
      );
    }

    if (
      metadata.authorFieldNames
        .length > 0 &&
      populatedAuthorExamples
        .length < 20
    ) {
      populatedAuthorExamples.push({
        findingId:
          finding.id ||
          finding.findingId,

        title:
          finding.title,

        platform:
          finding.platform,

        authorFields:
          Object.fromEntries(
            metadata.authorFieldNames.map(
              (
                fieldName: string
              ) => [
                fieldName,
                metadata.fields[
                  fieldName
                ],
              ]
            )
          ),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        totalLiveFindings:
          liveFindings.length,

        findingsWithAuthorMetadata:
          liveFindings.filter(
            (finding: any) =>
              finding.rawMetadata
                .authorFieldNames
                .length > 0
          ).length,

        authorFieldCounts,

        populatedAuthorExamples,
      },
      null,
      2
    )
  );
}

main();