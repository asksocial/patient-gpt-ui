import path from "path";
import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
  normalizeEvidenceMetadata,
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

  const enriched =
    enrichFindingsWithEvidenceIntelligence(
      findings
    );

  const unknownFindings =
    enriched.filter(
      (finding: any) =>
        finding
          .evidenceIntelligence
          ?.evidenceClass ===
        "unknown"
    );

  const platformCounts: Record<
    string,
    number
  > = {};

  const contentTypeCounts: Record<
    string,
    number
  > = {};

  const sourceNameCounts: Record<
    string,
    number
  > = {};

  const authorPresenceCounts: Record<
    string,
    number
  > = {};

  const publicationArchetypeCounts: Record<
    string,
    number
  > = {};

  const platformFamilyCounts: Record<
    string,
    number
  > = {};

  const voiceOriginCounts: Record<
    string,
    number
  > = {};

  const platformAndContentTypeCounts: Record<
    string,
    number
  > = {};

  const examples: Array<
    Record<string, unknown>
  > = [];

  for (
    const finding of unknownFindings
  ) {
    const metadata =
      normalizeEvidenceMetadata(
        finding
      );

    const intelligence =
      (finding as any)
        .evidenceIntelligence;

    const ontology =
      intelligence?.ontology;

    increment(
      platformCounts,
      metadata.platform
    );

    increment(
      contentTypeCounts,
      metadata.contentType
    );

    increment(
      sourceNameCounts,
      metadata.sourceName
    );

    increment(
      authorPresenceCounts,
      metadata.author
        ? "author_present"
        : "author_missing"
    );

    increment(
      publicationArchetypeCounts,
      ontology
        ?.publicationArchetype
    );

    increment(
      platformFamilyCounts,
      ontology?.platformFamily
    );

    increment(
      voiceOriginCounts,
      ontology?.isSecondaryVoice
        ? "secondary_voice"
        : "primary_voice"
    );

    increment(
      platformAndContentTypeCounts,
      `${ontology?.platformFamily || "unknown"}::${
        metadata.contentType ||
        "unknown"
      }`
    );

    if (
      examples.length < 50
    ) {
      examples.push({
        findingId:
          (finding as any)
            .findingId ||
          (finding as any).id,

        title:
          metadata.title,

        platform:
          metadata.platform,

        contentType:
          metadata.contentType,

        sourceName:
          metadata.sourceName,

        author:
          metadata.author,

        authorHandle:
          metadata.authorHandle,

        authorBio:
          metadata.authorBio,

        publicationType:
          intelligence
            ?.publicationType,

        publicationArchetype:
          ontology
            ?.publicationArchetype,

        publicationArchetypeConfidence:
          ontology
            ?.publicationArchetypeConfidence,

        platformFamily:
          ontology
            ?.platformFamily,

        isSecondaryVoice:
          ontology
            ?.isSecondaryVoice,

        authorIdentity:
          ontology
            ?.authorIdentity,

        communicationIntent:
          ontology
            ?.communicationIntent,

        authorityLevel:
          ontology
            ?.authorityLevel,

        evidenceRole:
          ontology
            ?.evidenceRole,

        publicationCandidates:
          ontology
            ?.publicationCandidates
            ?.slice(0, 5),

        authorCandidates:
          ontology
            ?.authorCandidates
            ?.slice(0, 3),

        intentCandidates:
          ontology
            ?.intentCandidates
            ?.slice(0, 3),

        fullText:
          metadata.fullText.slice(
            0,
            1_000
          ),
      });
    }
  }

  const completeObservability =
    buildOntologyObservability(
      enriched
    );

  const unknownObservability =
    buildOntologyObservability(
      unknownFindings
    );

  console.log(
    JSON.stringify(
      {
        totalFindings:
          enriched.length,

        totalUnknown:
          unknownFindings.length,

        platformCounts,

        contentTypeCounts,

        sourceNameCounts,

        authorPresenceCounts,

        publicationArchetypeCounts,

        platformFamilyCounts,

        voiceOriginCounts,

        platformAndContentTypeCounts,

        completeObservability,

        unknownObservability,

        examples,
      },
      null,
      2
    )
  );
}

main();