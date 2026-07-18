import { CanonicalFinding } from "../models/finding";
import { getThemeTaxonomy } from "./taxonomies";
import { ThemeDefinition } from "./themeModels";

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getFindingText(
  finding: CanonicalFinding
): string {
  const f = finding as any;

  return normalize(
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
      ...(f.barriers || []),
      ...(f.unmetNeeds || []),
      ...(f.emotions || []),
      ...(f.channels || []),
      ...(f.markets || []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getKeywordMatches(
  text: string,
  theme: ThemeDefinition
): number {
  return theme.keywords.reduce(
    (count, keyword) => {
      const normalizedKeyword =
        normalize(keyword);

      if (
        normalizedKeyword &&
        text.includes(normalizedKeyword)
      ) {
        return count + 1;
      }

      return count;
    },
    0
  );
}

function containsExcludedKeyword(
  text: string,
  theme: ThemeDefinition
): boolean {
  return (
    theme.excludedKeywords || []
  ).some((keyword) => {
    const normalizedKeyword =
      normalize(keyword);

    return (
      normalizedKeyword &&
      text.includes(normalizedKeyword)
    );
  });
}

function matchesTheme(
  text: string,
  theme: ThemeDefinition
): boolean {
  if (
    containsExcludedKeyword(
      text,
      theme
    )
  ) {
    return false;
  }

  const minimumMatches =
    theme.minimumMatches || 1;

  return (
    getKeywordMatches(text, theme) >=
    minimumMatches
  );
}

export function assignThemesToFindings(
  findings: CanonicalFinding[],
  therapeuticArea?: string
): CanonicalFinding[] {
  const taxonomy =
    getThemeTaxonomy(therapeuticArea);

  if (!taxonomy) {
    return findings;
  }

  return findings.map((finding) => {
    const text =
      getFindingText(finding);

    const assignedThemes =
      taxonomy.themes
        .filter((theme) =>
          matchesTheme(text, theme)
        )
        .map(
          (theme) => theme.themeId
        );

    const existingThemes =
      Array.isArray(
        (finding as any).themes
      )
        ? (finding as any).themes
        : [];

    return {
      ...(finding as any),
      themes: Array.from(
        new Set([
          ...existingThemes,
          ...assignedThemes,
        ])
      ),
    };
  }) as CanonicalFinding[];
}