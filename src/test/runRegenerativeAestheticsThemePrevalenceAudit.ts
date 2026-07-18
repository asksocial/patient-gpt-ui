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
  ingestMeltwaterCsv,
} from "../ingestion";

const CSV_PATH =
  path.resolve(
    __dirname,
    "../../data/regen-aesthetics.csv"
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

  const enriched =
    enrichFindingsWithEvidenceIntelligence(
      rawFindings
    );

  const themed =
    assignThemesToFindings(
      enriched,
      "regenerative_aesthetics"
    );

  const summary =
    aggregateThemes(
      themed,
      "regenerative_aesthetics"
    );

  if (summary.length === 0) {
    throw new Error(
      "Expected at least one aggregated theme."
    );
  }

  for (const theme of summary) {
    if (!theme.prevalence) {
      throw new Error(
        `${theme.themeId} is missing prevalence metrics.`
      );
    }

    if (!theme.sourceAggregation) {
      throw new Error(
        `${theme.themeId} is missing source aggregation metrics.`
      );
    }

    if (
      theme.sourceAggregation
        .totalFindings !==
      theme.count
    ) {
      throw new Error(
        `${theme.themeId} source aggregation count does not match theme count.`
      );
    }

    if (
      theme.count !==
      theme.prevalence
        .matchingFindingCount
    ) {
      throw new Error(
        `${theme.themeId} count does not match prevalence count.`
      );
    }

    if (
      theme.prevalence
        .datasetFindingCount !==
      rawFindings.length
    ) {
      throw new Error(
        `${theme.themeId} has an incorrect dataset denominator.`
      );
    }
  }

  const assignmentShareTotal =
    summary.reduce(
      (sum, theme) =>
        sum +
        (
          theme.prevalence
            ?.shareOfThemeAssignmentsPercent ||
          0
        ),
      0
    );

  if (
    Math.abs(
      assignmentShareTotal -
      100
    ) > 0.1
  ) {
    throw new Error(
      `Theme-assignment shares should total approximately 100; received ${assignmentShareTotal}.`
    );
  }

  console.log(
    JSON.stringify(
      {
        totalFindings:
          rawFindings.length,
        eligibleFindings:
          summary[0]
            .prevalence
            ?.eligibleFindingCount,
        datasetCoveragePercent:
          summary[0]
            .prevalence
            ?.datasetCoveragePercent,
        themeAssignmentCount:
          summary[0]
            .prevalence
            ?.themeAssignmentCount,
        averageThemesPerEligibleFinding:
          summary[0]
            .prevalence
            ?.averageThemesPerEligibleFinding,
        assignmentShareTotal:
          Number(
            assignmentShareTotal
              .toFixed(2)
          ),
        themes:
          summary.map(
            (theme) => ({
              themeId:
                theme.themeId,
              count:
                theme.count,
              rawPercent:
                theme.prevalence
                  ?.rawPercent,
              eligiblePercent:
                theme.prevalence
                  ?.eligiblePercent,
              evidenceWeightedPercent:
                theme.prevalence
                  ?.evidenceWeightedPercent,
              eligibleEvidenceWeightedPercent:
                theme.prevalence
                  ?.eligibleEvidenceWeightedPercent,
              shareOfThemeAssignmentsPercent:
                theme.prevalence
                  ?.shareOfThemeAssignmentsPercent,
              overlapRatePercent:
                theme.prevalence
                  ?.overlapRatePercent,
              sourceCategories:
                theme.sourceAggregation
                  ?.distinctSourceCategoryCount,
              independentSourceCategories:
                theme.sourceAggregation
                  ?.distinctIndependentSourceCategoryCount,
              channels:
                theme.sourceAggregation
                  ?.distinctChannelCount,
              independentPercent:
                theme.sourceAggregation
                  ?.independentPercent,
              commercialPercent:
                theme.sourceAggregation
                  ?.commercialPercent,
              triangulationScore:
                theme.sourceAggregation
                  ?.triangulationScore,
              triangulationLabel:
                theme.sourceAggregation
                  ?.triangulationLabel,
              isCrossSourceCorroborated:
                theme.sourceAggregation
                  ?.isCrossSourceCorroborated,
            })
          ),
      },
      null,
      2
    )
  );
}

main();
