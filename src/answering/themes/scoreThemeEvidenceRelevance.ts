import { CanonicalFinding } from "../models/finding";
import { ThemeDefinition } from "./themeModels";

function clamp(
  value: number,
  minimum = 0,
  maximum = 1
): number {
  return Math.max(
    minimum,
    Math.min(maximum, value)
  );
}

function normalizeText(
  value: unknown
): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTextFields(
  finding: CanonicalFinding
) {
  const f = finding as any;

  return {
    claim: normalizeText(
      f.canonicalClaim
    ),
    summary: normalizeText(
      f.summary
    ),
    title: normalizeText(
      f.title
    ),
    description: normalizeText(
      f.description
    ),
    excerpt: normalizeText(
      f.excerpt
    ),
    fullText: normalizeText(
      [
        f.canonicalClaim,
        f.summary,
        f.title,
        f.description,
        f.text,
        f.excerpt,
        ...(f.labels || []),
        ...(f.normalizedLabels || []),
        ...(f.symptoms || []),
        ...(f.treatments || []),
      ]
        .filter(Boolean)
        .join(" ")
    ),
  };
}

function getMatchedKeywords(
  text: string,
  theme: ThemeDefinition
): string[] {
  return theme.keywords
    .map(normalizeText)
    .filter(Boolean)
    .filter((keyword) =>
      text.includes(keyword)
    );
}

function hasExcludedKeyword(
  text: string,
  theme: ThemeDefinition
): boolean {
  return (
    theme.excludedKeywords || []
  )
    .map(normalizeText)
    .filter(Boolean)
    .some((keyword) =>
      text.includes(keyword)
    );
}

function containsThemeKeyword(
  text: string,
  theme: ThemeDefinition
): boolean {
  return getMatchedKeywords(
    text,
    theme
  ).length > 0;
}

export function scoreThemeEvidenceRelevance(
  finding: CanonicalFinding,
  theme: ThemeDefinition
): number {
  const fields =
    getTextFields(finding);

  if (
    hasExcludedKeyword(
      fields.fullText,
      theme
    )
  ) {
    return 0;
  }

  const matchedKeywords =
    getMatchedKeywords(
      fields.fullText,
      theme
    );

  if (
    matchedKeywords.length === 0
  ) {
    return 0;
  }

  const keywordCoverage =
    matchedKeywords.length /
    Math.max(
      theme.keywords.length,
      1
    );

  let score =
    Math.min(
      keywordCoverage * 1.75,
      0.55
    );

  if (
    containsThemeKeyword(
      fields.claim,
      theme
    )
  ) {
    score += 0.25;
  }

  if (
    containsThemeKeyword(
      fields.summary,
      theme
    )
  ) {
    score += 0.2;
  }

  if (
    containsThemeKeyword(
      fields.title,
      theme
    )
  ) {
    score += 0.15;
  }

  if (
    containsThemeKeyword(
      fields.excerpt,
      theme
    )
  ) {
    score += 0.15;
  }

  /**
   * Reward direct, repeated alignment.
   */
  if (
    matchedKeywords.length >= 2
  ) {
    score += 0.1;
  }

  return Number(
    clamp(score).toFixed(2)
  );
}