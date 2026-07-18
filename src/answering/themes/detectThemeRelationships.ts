import { CanonicalFinding } from "../models/finding";
import { getThemeTaxonomy } from "./taxonomies";
import {
  RelationshipConfidence,
  ThemeMatch,
  ThemeRelationship,
} from "./themeModels";
import {
  THEME_QUALITY_CONFIG,
} from "./themeQualityConfig";

function getThemes(
  finding: CanonicalFinding
): string[] {
  const themes = Array.isArray(
    (finding as any).themes
  )
    ? (finding as any).themes
    : [];

  return Array.from(
    new Set(
      themes
        .map((theme: unknown) =>
          String(
            theme || ""
          ).trim()
        )
        .filter(Boolean)
    )
  );
}

function createPairKey(
  first: string,
  second: string
): string {
  return [first, second]
    .sort()
    .join("::");
}

function getRelationshipConfidence(
  coOccurrenceCount: number,
  strength: number
): RelationshipConfidence {
  if (
    coOccurrenceCount >= 10 &&
    strength >= 0.4
  ) {
    return "high";
  }

  if (
    coOccurrenceCount >= 5 &&
    strength >= 0.25
  ) {
    return "moderate";
  }

  return "directional";
}

function calculateCoOccurrenceRelationships(
  findings: CanonicalFinding[],
  themeSummary: ThemeMatch[]
): ThemeRelationship[] {
  const themeCounts =
    new Map<string, number>(
      themeSummary.map(
        (theme) => [
          theme.themeId,
          theme.count,
        ]
      )
    );

  const pairCounts =
    new Map<string, number>();

  for (const finding of findings) {
    const themes =
      getThemes(finding);

    for (
      let firstIndex = 0;
      firstIndex <
      themes.length;
      firstIndex += 1
    ) {
      for (
        let secondIndex =
          firstIndex + 1;
        secondIndex <
        themes.length;
        secondIndex += 1
      ) {
        const key =
          createPairKey(
            themes[firstIndex],
            themes[secondIndex]
          );

        pairCounts.set(
          key,
          (pairCounts.get(key) ||
            0) + 1
        );
      }
    }
  }

  const relationships:
    ThemeRelationship[] = [];

  for (const [
    key,
    coOccurrenceCount,
  ] of pairCounts.entries()) {
    const [
      sourceThemeId,
      targetThemeId,
    ] = key.split("::");

    const sourceCount =
      themeCounts.get(
        sourceThemeId
      ) || 0;

    const targetCount =
      themeCounts.get(
        targetThemeId
      ) || 0;

    const denominator =
      Math.min(
        sourceCount,
        targetCount
      );

    if (denominator === 0) {
      continue;
    }

    const strength =
      coOccurrenceCount /
      denominator;

    if (
      coOccurrenceCount <
        THEME_QUALITY_CONFIG
          .minimumCoOccurrenceCount ||
      strength <
        THEME_QUALITY_CONFIG
          .minimumRelationshipStrength
    ) {
      continue;
    }

    relationships.push({
      sourceThemeId,
      targetThemeId,
      relationshipType:
        "co_occurs_with",

      strength: Number(
        strength.toFixed(2)
      ),

      coOccurrenceCount,

      confidence:
        getRelationshipConfidence(
          coOccurrenceCount,
          strength
        ),
    });
  }

  return relationships;
}

function applyTaxonomyRelationships(
  relationships:
    ThemeRelationship[],
  therapeuticArea?: string
): ThemeRelationship[] {
  const taxonomy =
    getThemeTaxonomy(
      therapeuticArea
    );

  if (
    !taxonomy?.relationships ||
    taxonomy.relationships
      .length === 0
  ) {
    return relationships;
  }

  const output = [
    ...relationships,
  ];

  for (const definition of taxonomy.relationships) {
    const existing =
      output.find(
        (relationship) =>
          relationship.sourceThemeId ===
            definition.sourceThemeId &&
          relationship.targetThemeId ===
            definition.targetThemeId &&
          relationship.relationshipType ===
            definition.relationshipType
      );

    if (existing) {
      continue;
    }

    output.push({
      sourceThemeId:
        definition.sourceThemeId,

      targetThemeId:
        definition.targetThemeId,

      relationshipType:
        definition.relationshipType,

      strength: 1,

      confidence:
        "directional",
    });
  }

  return output;
}

function attachRelationshipsToThemes(
  themeSummary: ThemeMatch[],
  relationships:
    ThemeRelationship[]
): void {
  for (const theme of themeSummary) {
    theme.relationships =
      relationships.filter(
        (relationship) =>
          relationship.sourceThemeId ===
            theme.themeId ||
          relationship.targetThemeId ===
            theme.themeId
      );
  }
}

export function detectThemeRelationships(
  findings: CanonicalFinding[],
  themeSummary: ThemeMatch[],
  therapeuticArea?: string
): ThemeRelationship[] {
  const coOccurrenceRelationships =
    calculateCoOccurrenceRelationships(
      findings,
      themeSummary
    );

  const relationships =
    applyTaxonomyRelationships(
      coOccurrenceRelationships,
      therapeuticArea
    ).sort(
      (first, second) =>
        second.strength -
        first.strength
    );

  attachRelationshipsToThemes(
    themeSummary,
    relationships
  );

  return relationships;
}