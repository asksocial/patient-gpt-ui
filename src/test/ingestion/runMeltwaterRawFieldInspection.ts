import path from "path";
import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  ingestMeltwaterCsv,
} from "../../ingestion";

const CSV_PATH =
  path.resolve(
    __dirname,
    "../../../data/regen-aesthetics.csv"
  );

const RECORD_LIMIT = 20;

function sortObject(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      value as Record<
        string,
        unknown
      >
    ).sort(
      ([first], [second]) =>
        first.localeCompare(second)
    )
  );
}

function summarizeFinding(
  finding: CanonicalFinding
): Record<string, unknown> {
  const value = finding as any;

  const primaryEvidence =
    Array.isArray(
      value.evidence
    )
      ? value.evidence[0]
      : undefined;

  return {
    findingId:
      value.findingId ||
      value.id ||
      value.sourceId,

    topLevelKeys:
      Object.keys(value).sort(),

    title:
      value.title,

    summary:
      value.summary,

    excerpt:
      value.excerpt,

    description:
      value.description,

    canonicalClaim:
      value.canonicalClaim,

    text:
      value.text,

    body:
      value.body,

    content:
      value.content,

    message:
      value.message,

    postText:
      value.postText,

    originalText:
      value.originalText,

    platform:
      value.platform,

    platforms:
      value.platforms,

    sourceType:
      value.sourceType,

    url:
      value.url,

    structuredData:
      sortObject(
        value.structuredData
      ),

    primaryEvidence:
      sortObject(
        primaryEvidence
      ),
  };
}

function isSocialFinding(
  finding: CanonicalFinding
): boolean {
  const value = finding as any;

  const platform = String(
    value.platform ||
      value.platforms?.[0] ||
      value.structuredData
        ?.platform ||
      ""
  ).toLowerCase();

  return (
    platform.includes("social") ||
    platform.includes("forum") ||
    platform.includes("review")
  );
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
    ) as unknown as
      CanonicalFinding[];

  const socialFindings =
    findings.filter(
      isSocialFinding
    );

  console.error(
    `Found ${socialFindings.length} social findings`
  );

  console.log(
    JSON.stringify(
      socialFindings
        .slice(0, RECORD_LIMIT)
        .map(
          summarizeFinding
        ),
      null,
      2
    )
  );
}

main();