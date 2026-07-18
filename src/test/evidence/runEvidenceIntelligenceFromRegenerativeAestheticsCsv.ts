import path from "path";
import {
  ingestMeltwaterCsv,
} from "../../ingestion";
import {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../../answering/evidence";

const CSV_PATH =
  path.resolve(
    __dirname,
    "../../../data/regen-aesthetics.csv"
  );

function countByField(
  findings: CanonicalFinding[],
  field: string
): Record<string, number> {
  const counts: Record<
    string,
    number
  > = {};

  for (const finding of findings) {
    const intelligence =
      (finding as any)
        .evidenceIntelligence;

    const value = String(
      intelligence?.[field] ||
        "unknown"
    );

    counts[value] =
      (counts[value] || 0) + 1;
  }

  return counts;
}

function summarizeFinding(
  finding: CanonicalFinding
) {
  const f = finding as any;

  return {
    findingId:
      f.findingId || f.id,

    title:
      f.title,

    summary:
      f.summary ||
      f.canonicalClaim,

    platform:
      f.platform,

    url:
      f.url,

    evidenceIntelligence:
      f.evidenceIntelligence,
  };
}

function main() {
  console.log(
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

  const enrichedFindings =
    enrichFindingsWithEvidenceIntelligence(
      rawFindings
    );

  const sortedByQuality =
    [...enrichedFindings].sort(
      (first, second) =>
        Number(
          (second as any)
            .evidenceIntelligence
            ?.qualityScore || 0
        ) -
        Number(
          (first as any)
            .evidenceIntelligence
            ?.qualityScore || 0
        )
    );

  const possibleMisclassifications =
    enrichedFindings.filter(
      (finding: any) => {
        const intelligence =
          finding.evidenceIntelligence;

        const platform =
          String(
            finding.platform || ""
          ).toLowerCase();

        return (
          (
            platform.includes(
              "news"
            ) &&
            [
              "patient_conversation",
              "provider_conversation",
            ].includes(
              intelligence
                ?.evidenceClass
            )
          ) ||
          (
            intelligence
              ?.researchCredibility ===
              "peer_reviewed" &&
            intelligence
              ?.domainCategory !==
              "research"
          )
        );
      }
    );

  console.log(
    JSON.stringify(
      {
        totalFindings:
          enrichedFindings.length,

        evidenceClassCounts:
          countByField(
            enrichedFindings,
            "evidenceClass"
          ),

        voiceCounts:
          countByField(
            enrichedFindings,
            "voice"
          ),

        publicationTypeCounts:
          countByField(
            enrichedFindings,
            "publicationType"
          ),

        commercialIntentCounts:
          countByField(
            enrichedFindings,
            "commercialIntent"
          ),

        researchCredibilityCounts:
          countByField(
            enrichedFindings,
            "researchCredibility"
          ),

        qualityBandCounts:
          countByField(
            enrichedFindings,
            "qualityBand"
          ),

        highestQuality:
          sortedByQuality
            .slice(0, 10)
            .map(
              summarizeFinding
            ),

        lowestQuality:
          sortedByQuality
            .slice(-10)
            .reverse()
            .map(
              summarizeFinding
            ),

        possibleMisclassifications:
          possibleMisclassifications
            .slice(0, 20)
            .map(
              summarizeFinding
            ),
      },
      null,
      2
    )
  );
}

main();