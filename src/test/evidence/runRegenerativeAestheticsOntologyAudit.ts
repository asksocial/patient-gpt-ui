import path from "path";
import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../../answering/evidence";
import {
  buildOntologyObservability,
} from "../../answering/evidence/ontology";
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
  value: unknown
): void {
  const key =
    String(
      value || "unknown"
    ).trim() ||
    "unknown";

  counts[key] =
    (counts[key] || 0) +
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
    ) as unknown as
      CanonicalFinding[];

  console.error(
    `Loaded ${findings.length} findings`
  );

  const enriched =
    enrichFindingsWithEvidenceIntelligence(
      findings
    );

  const authorIdentityCounts: Record<
    string,
    number
  > = {};

  const communicationIntentCounts: Record<
    string,
    number
  > = {};

  const authorityLevelCounts: Record<
    string,
    number
  > = {};

  const evidenceRoleCounts: Record<
    string,
    number
  > = {};

  const evidenceClassCounts: Record<
    string,
    number
  > = {};

  const unknownExamples: Array<
    Record<string, unknown>
  > = [];

  for (
    const finding of enriched as any[]
  ) {
    const intelligence =
      finding.evidenceIntelligence;

    const ontology =
      intelligence?.ontology;

    increment(
      authorIdentityCounts,
      ontology?.authorIdentity
    );

    increment(
      communicationIntentCounts,
      ontology
        ?.communicationIntent
    );

    increment(
      authorityLevelCounts,
      ontology?.authorityLevel
    );

    increment(
      evidenceRoleCounts,
      ontology?.evidenceRole
    );

    increment(
      evidenceClassCounts,
      intelligence?.evidenceClass
    );

    const isUnknown =
      ontology
        ?.publicationArchetype ===
        "unknown" ||
      ontology
        ?.authorIdentity ===
        "unknown" ||
      ontology
        ?.communicationIntent ===
        "unknown";

    if (
      isUnknown &&
      unknownExamples.length <
        40
    ) {
      unknownExamples.push({
        findingId:
          finding.findingId ||
          finding.id ||
          finding.sourceId,

        title:
          finding.title,

        platform:
          finding.platform,

        evidenceClass:
          intelligence
            ?.evidenceClass,

        authorIdentity:
          ontology
            ?.authorIdentity,

        communicationIntent:
          ontology
            ?.communicationIntent,

        publicationArchetype:
          ontology
            ?.publicationArchetype,

        platformFamily:
          ontology
            ?.platformFamily,

        isSecondaryVoice:
          ontology
            ?.isSecondaryVoice,

        authorityLevel:
          ontology
            ?.authorityLevel,

        evidenceRole:
          ontology
            ?.evidenceRole,

        authorIdentityConfidence:
          ontology
            ?.authorIdentityConfidence,

        communicationIntentConfidence:
          ontology
            ?.communicationIntentConfidence,

        publicationArchetypeConfidence:
          ontology
            ?.publicationArchetypeConfidence,

        overallConfidence:
          ontology
            ?.overallConfidence,

        authorCandidates:
          ontology
            ?.authorCandidates
            ?.slice(0, 3),

        intentCandidates:
          ontology
            ?.intentCandidates
            ?.slice(0, 3),

        publicationCandidates:
          ontology
            ?.publicationCandidates
            ?.slice(0, 3),
      });
    }
  }

  const observability =
    buildOntologyObservability(
      enriched
    );

  console.log(
    JSON.stringify(
      {
        totalFindings:
          enriched.length,

        authorIdentityCounts,

        communicationIntentCounts,

        authorityLevelCounts,

        evidenceRoleCounts,

        evidenceClassCounts,

        publicationObservability:
          observability,

        unknownExampleCount:
          unknownExamples.length,

        unknownExamples,
      },
      null,
      2
    )
  );
}

main();