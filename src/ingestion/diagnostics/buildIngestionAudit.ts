import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import {
  auditFindingText,
} from "./auditFindingText";
import type {
  FindingTextDiagnostic,
  IngestionAuditResult,
  IngestionAuditSummary,
} from "./types";

function increment(
  counts: Record<
    string,
    number
  >,
  value?: string
): void {
  const key =
    String(value || "unknown")
      .trim() ||
    "unknown";

  counts[key] =
    (counts[key] || 0) + 1;
}

function getLengthBand(
  length: number
): string {
  if (length === 0) {
    return "0";
  }

  if (length < 20) {
    return "1-19";
  }

  if (length < 40) {
    return "20-39";
  }

  if (length < 80) {
    return "40-79";
  }

  if (length < 140) {
    return "80-139";
  }

  if (length < 280) {
    return "140-279";
  }

  if (length < 500) {
    return "280-499";
  }

  return "500+";
}

function isSocialPost(
  diagnostic:
    FindingTextDiagnostic
): boolean {
  const platform =
    String(
      diagnostic.platform || ""
    ).toLowerCase();

  const publicationType =
    String(
      diagnostic.publicationType ||
        ""
    ).toLowerCase();

  return (
    publicationType ===
      "social_post" ||
    publicationType ===
      "forum_post" ||
    platform.includes("social") ||
    platform.includes("forum")
  );
}

function average(
  values: number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length
  );
}

function median(
  values: number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (first, second) =>
        first - second
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 === 0
  ) {
    return Math.round(
      (
        sorted[middle - 1] +
        sorted[middle]
      ) / 2
    );
  }

  return sorted[middle];
}

function buildSummary(
  diagnostics:
    FindingTextDiagnostic[]
): IngestionAuditSummary {
  const platformCounts:
    Record<string, number> = {};

  const sourceTypeCounts:
    Record<string, number> = {};

  const evidenceClassCounts:
    Record<string, number> = {};

  const analyzableTextLengthBands:
    Record<string, number> = {};

  const populatedFieldCounts:
    Record<string, number> = {};

  const missingFieldCounts:
    Record<string, number> = {};

  const ingestionRiskCounts:
    Record<string, number> = {};

  const socialPosts =
    diagnostics.filter(
      isSocialPost
    );

  for (
    const diagnostic of diagnostics
  ) {
    increment(
      platformCounts,
      diagnostic.platform
    );

    increment(
      sourceTypeCounts,
      diagnostic.sourceType
    );

    increment(
      evidenceClassCounts,
      diagnostic.evidenceClass
    );

    increment(
      analyzableTextLengthBands,
      getLengthBand(
        diagnostic
          .analyzableTextLength
      )
    );

    increment(
      ingestionRiskCounts,
      diagnostic.ingestionRisk
    );

    for (
      const field of diagnostic
        .populatedTextFields
    ) {
      increment(
        populatedFieldCounts,
        field
      );
    }

    for (
      const field of diagnostic
        .emptyTextFields
    ) {
      increment(
        missingFieldCounts,
        field
      );
    }
  }

  const socialUnknown =
    socialPosts.filter(
      (diagnostic) =>
        diagnostic.evidenceClass ===
        "unknown"
    );

  return {
    totalFindings:
      diagnostics.length,

    platformCounts,

    sourceTypeCounts,

    evidenceClassCounts,

    analyzableTextLengthBands,

    populatedFieldCounts,

    missingFieldCounts,

    ingestionRiskCounts,

    socialPostCount:
      socialPosts.length,

    socialPostsBelowMinimumText:
      socialPosts.filter(
        (diagnostic) =>
          !diagnostic.hasMinimumText
      ).length,

    socialPostsWithRichText:
      socialPosts.filter(
        (diagnostic) =>
          diagnostic.hasRichText
      ).length,

    socialPostsClassifiedUnknown:
      socialUnknown.length,

    socialUnknownWithShortText:
      socialUnknown.filter(
        (diagnostic) =>
          !diagnostic.hasMinimumText
      ).length,

    socialUnknownWithRichText:
      socialUnknown.filter(
        (diagnostic) =>
          diagnostic.hasRichText
      ).length,

    findingsWithPossibleIgnoredText:
      diagnostics.filter(
        (diagnostic) =>
          diagnostic
            .possibleIgnoredTextFields
            .length > 0
      ).length,

    averageAnalyzableTextLength:
      average(
        diagnostics.map(
          (diagnostic) =>
            diagnostic
              .analyzableTextLength
        )
      ),

    medianAnalyzableTextLength:
      median(
        diagnostics.map(
          (diagnostic) =>
            diagnostic
              .analyzableTextLength
        )
      ),
  };
}

export function buildIngestionAudit(
  findings: CanonicalFinding[],
  exampleLimit = 20
): IngestionAuditResult {
  const diagnostics =
    findings.map(
      auditFindingText
    );

  const socialPosts =
    diagnostics.filter(
      isSocialPost
    );

  const socialUnknown =
    socialPosts.filter(
      (diagnostic) =>
        diagnostic.evidenceClass ===
        "unknown"
    );

  const possibleIgnored =
    diagnostics.filter(
      (diagnostic) =>
        diagnostic
          .possibleIgnoredTextFields
          .length > 0
    );

  const shortest =
    [...diagnostics].sort(
      (first, second) =>
        first
          .analyzableTextLength -
        second
          .analyzableTextLength
    );

  const longest =
    [...diagnostics].sort(
      (first, second) =>
        second
          .analyzableTextLength -
        first
          .analyzableTextLength
    );

  return {
    summary:
      buildSummary(diagnostics),

    firstSocialPosts:
      socialPosts.slice(
        0,
        exampleLimit
      ),

    socialUnknownExamples:
      socialUnknown.slice(
        0,
        exampleLimit
      ),

    socialUnknownWithRichText:
      socialUnknown
        .filter(
          (diagnostic) =>
            diagnostic.hasRichText
        )
        .slice(
          0,
          exampleLimit
        ),

    shortestFindings:
      shortest.slice(
        0,
        exampleLimit
      ),

    longestFindings:
      longest.slice(
        0,
        exampleLimit
      ),

    possibleIgnoredTextExamples:
      possibleIgnored.slice(
        0,
        exampleLimit
      ),
  };
}