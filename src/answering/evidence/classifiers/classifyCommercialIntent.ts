import {
  COMMERCIAL_HIGH_PATTERNS,
  COMMERCIAL_MODERATE_PATTERNS,
  COMMERCIAL_SPONSORSHIP_PATTERNS,
} from "../config/classificationPatterns";
import {
  CommercialIntentResult,
  NormalizedEvidenceMetadata,
} from "../types";

function matchedPatterns(
  text: string,
  patterns: string[]
): string[] {
  return patterns.filter((pattern) =>
    text.includes(pattern)
  );
}

export function classifyCommercialIntent(
  metadata: NormalizedEvidenceMetadata
): CommercialIntentResult {
  const text = metadata.fullText;

  const highMatches =
    matchedPatterns(
      text,
      COMMERCIAL_HIGH_PATTERNS
    );

  const sponsorshipMatches =
    matchedPatterns(
      text,
      COMMERCIAL_SPONSORSHIP_PATTERNS
    );

  const moderateMatches =
    matchedPatterns(
      text,
      COMMERCIAL_MODERATE_PATTERNS
    );

  if (
    highMatches.length > 0 ||
    sponsorshipMatches.length > 1
  ) {
    return {
      level: "high",
      score: Math.min(
        1,
        0.75 +
          highMatches.length * 0.08 +
          sponsorshipMatches.length * 0.08
      ),
      reasons: [
        ...highMatches.map(
          (value) =>
            `High-commercial-intent phrase: ${value}`
        ),
        ...sponsorshipMatches.map(
          (value) =>
            `Sponsorship phrase: ${value}`
        ),
      ],
    };
  }

  if (
    sponsorshipMatches.length > 0 ||
    moderateMatches.length >= 2
  ) {
    return {
      level: "moderate",
      score: 0.6,
      reasons: [
        ...sponsorshipMatches.map(
          (value) =>
            `Sponsorship phrase: ${value}`
        ),
        ...moderateMatches.map(
          (value) =>
            `Commercial phrase: ${value}`
        ),
      ],
    };
  }

  if (moderateMatches.length === 1) {
    return {
      level: "low",
      score: 0.3,
      reasons: [
        `Possible commercial phrase: ${moderateMatches[0]}`,
      ],
    };
  }

  return {
    level: "none",
    score: 0,
    reasons: [
      "No meaningful commercial-intent signals detected",
    ],
  };
}