import path from "path";
import {
  ingestMeltwaterCsv,
} from "../../ingestion";

const CSV_PATH =
  path.resolve(
    __dirname,
    "../../../data/regen-aesthetics.csv"
  );

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

  const liveFinding =
    findings.find(
      (finding: any) =>
        finding.sourceType ===
          "live" &&
        finding.rawMetadata
    );

  if (!liveFinding) {
    throw new Error(
      "No live finding with raw metadata was found."
    );
  }

  const rawMetadata =
    liveFinding.rawMetadata;

  console.log(
    JSON.stringify(
      {
        findingId:
          liveFinding.id ||
          liveFinding.findingId,

        title:
          liveFinding.title,

        fieldCount:
          rawMetadata.fieldCount,

        populatedFieldCount:
          rawMetadata.populatedFieldCount,

        textFieldNames:
          rawMetadata.textFieldNames,

        authorFieldNames:
          rawMetadata.authorFieldNames,

        engagementFieldNames:
          rawMetadata.engagementFieldNames,

        temporalFieldNames:
          rawMetadata.temporalFieldNames,

        urlFieldNames:
          rawMetadata.urlFieldNames,

        sampleFields:
          Object.fromEntries(
            rawMetadata.fieldNames
              .slice(0, 12)
              .map(
                (fieldName: string) => [
                  fieldName,
                  rawMetadata.fields[
                    fieldName
                  ],
                ]
              )
          ),
      },
      null,
      2
    )
  );

  if (
    rawMetadata.fieldCount === 0
  ) {
    throw new Error(
      "Raw metadata contains no preserved fields."
    );
  }

  if (
    !rawMetadata.fields[
      "Document ID"
    ]
  ) {
    throw new Error(
      "Document ID was not preserved."
    );
  }

  if (
    !rawMetadata.fields["Title"] &&
    !rawMetadata.fields[
      "Hit Sentence"
    ] &&
    !rawMetadata.fields[
      "Opening Text"
    ]
  ) {
    throw new Error(
      "No primary Meltwater text field was preserved."
    );
  }
}

main();