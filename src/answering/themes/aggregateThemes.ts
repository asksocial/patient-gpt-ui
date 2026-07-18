import type {
  CanonicalFinding,
} from "../models/finding";
import {
  getThemeTaxonomy,
} from "./taxonomies";
import type {
  ThemeMatch,
} from "./themeModels";
import {
  scoreThemeEvidence,
} from "./scoreThemeEvidence";
import {
  selectRepresentativeEvidence,
} from "./selectRepresentativeEvidence";
import {
  filterClientFacingEvidence,
} from "./filterClientFacingEvidence";
import {
  getThemeConfidenceLabel,
} from "./getThemeConfidenceLabel";
import {
  THEME_QUALITY_CONFIG,
} from "./themeQualityConfig";
import {
  filterMeaningfulDimensionValues,
} from "./dimensionQualityConfig";
import {
  buildThemePrevalenceContext,
  calculateThemePrevalence,
} from "./calculateThemePrevalence";
import {
  buildThemeSourceAggregation,
} from "./buildThemeSourceAggregation";

function toArray(
  value: unknown
): unknown[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value)
    ? value
    : [value];
}

function countValues(
  findings: CanonicalFinding[],
  pluralField: string,
  singularField?: string
): Record<string, number> {
  const counts: Record<
    string,
    number
  > = {};

  for (const finding of findings) {
    const value = finding as any;

    const rawValues: unknown[] = [
      ...toArray(
        value[pluralField]
      ),
    ];

    if (singularField) {
      rawValues.push(
        ...toArray(
          value[singularField]
        )
      );
    }

    const values =
      filterMeaningfulDimensionValues(
        rawValues
      );

    for (const item of values) {
      counts[item] =
        (counts[item] || 0) + 1;
    }
  }

  return counts;
}

function countEvidenceField(
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
      intelligence?.[field] || ""
    ).trim();

    if (!value) {
      continue;
    }

    counts[value] =
      (counts[value] || 0) + 1;
  }

  return counts;
}

function getFindingId(
  finding: CanonicalFinding
): string {
  const value = finding as any;

  return String(
    value.findingId ||
      value.id ||
      value.sourceId ||
      ""
  );
}

function getClaim(
  finding: CanonicalFinding
): string {
  const value = finding as any;

  return String(
    value.canonicalClaim ||
      value.summary ||
      value.title ||
      value.description ||
      ""
  ).trim();
}

function uniqueClaims(
  findings: CanonicalFinding[],
  limit = 5
): string[] {
  const seen =
    new Set<string>();

  const claims: string[] = [];

  for (const finding of findings) {
    const claim =
      getClaim(finding);

    if (!claim) {
      continue;
    }

    const key = claim
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 180);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    claims.push(claim);

    if (claims.length >= limit) {
      break;
    }
  }

  return claims;
}

function hasTheme(
  finding: CanonicalFinding,
  themeId: string
): boolean {
  const themes = Array.isArray(
    (finding as any).themes
  )
    ? (finding as any).themes
    : [];

  return themes.includes(themeId);
}

export function aggregateThemes(
  findings: CanonicalFinding[],
  therapeuticArea?: string
): ThemeMatch[] {
  const taxonomy =
    getThemeTaxonomy(
      therapeuticArea
    );

  if (!taxonomy) {
    return [];
  }

  const totalFindings =
    findings.length;

  if (totalFindings === 0) {
    return [];
  }

  const prevalenceContext =
    buildThemePrevalenceContext(
      findings,
      taxonomy.themes.map(
        (theme) =>
          theme.themeId
      )
    );

  return taxonomy.themes
    .map((theme): ThemeMatch => {
      const matchingFindings =
        findings.filter((finding) =>
          hasTheme(
            finding,
            theme.themeId
          )
        );

      const count =
        matchingFindings.length;

      const prevalence =
        calculateThemePrevalence(
          prevalenceContext,
          theme.themeId
        );

      const sourceAggregation =
        buildThemeSourceAggregation(
          matchingFindings
        );

      const percent =
        prevalence.rawPercent;

      const selectionResult =
        selectRepresentativeEvidence(
          matchingFindings,
          theme,
          {
            limit:
              THEME_QUALITY_CONFIG
                .maxRepresentativeEvidencePerTheme,

            minimumRelevance:
              THEME_QUALITY_CONFIG
                .minimumThemeEvidenceRelevance,

            maximumPerPlatform:
              THEME_QUALITY_CONFIG
                .maximumEvidencePerPlatform,

            maximumPerSourceType:
              THEME_QUALITY_CONFIG
                .maximumEvidencePerSourceType,

            maximumPerCountry:
              THEME_QUALITY_CONFIG
                .maximumEvidencePerCountry,

            maximumPerPersona:
              THEME_QUALITY_CONFIG
                .maximumEvidencePerPersona,

            minimumDirectVoiceEvidence:
              THEME_QUALITY_CONFIG
                .minimumDirectVoiceEvidence,

            maximumAuthoritativeEvidence:
              THEME_QUALITY_CONFIG
                .maximumAuthoritativeEvidence,

            maximumCredibleContextEvidence:
              THEME_QUALITY_CONFIG
                .maximumCredibleContextEvidence,

            maximumFallbackEvidence:
              THEME_QUALITY_CONFIG
                .maximumFallbackEvidence,

            maximumConsumerNewsEvidence:
              THEME_QUALITY_CONFIG
                .maximumConsumerNewsEvidence,

            maximumUnknownEvidence:
              THEME_QUALITY_CONFIG
                .maximumUnknownEvidence,
          }
        );

      const representativeEvidence =
        selectionResult.evidence;

      const clientFacingEvidence =
        filterClientFacingEvidence(
          representativeEvidence
        );

      const evidenceForScoring =
        clientFacingEvidence.length > 0
          ? clientFacingEvidence
          : representativeEvidence;

      const evidenceScore =
        scoreThemeEvidence(
          matchingFindings,
          evidenceForScoring
        );

      const confidenceLabel =
        getThemeConfidenceLabel(
          evidenceScore,
          evidenceForScoring,
          count
        );

      return {
        themeId: theme.themeId,
        label: theme.label,
        description:
          theme.description,

        count,
        percent,
        prevalence,
        sourceAggregation,

        findingIds:
          matchingFindings
            .map(getFindingId)
            .filter(Boolean),

        representativeClaims:
          uniqueClaims(
            matchingFindings
          ),

        representativeEvidence,
        clientFacingEvidence,

        evidenceScore,
        confidenceLabel,

        countries:
          countValues(
            matchingFindings,
            "countries",
            "country"
          ),

        platforms:
          countValues(
            matchingFindings,
            "platforms",
            "platform"
          ),

        personas:
          countValues(
            matchingFindings,
            "personas",
            "persona"
          ),

        sourceTypes:
          countValues(
            matchingFindings,
            "sourceTypes",
            "sourceType"
          ),

        evidenceClassCounts:
          countEvidenceField(
            matchingFindings,
            "evidenceClass"
          ),

        evidenceVoiceCounts:
          countEvidenceField(
            matchingFindings,
            "voice"
          ),

        publicationTypeCounts:
          countEvidenceField(
            matchingFindings,
            "publicationType"
          ),

        evidenceQualityBandCounts:
          countEvidenceField(
            matchingFindings,
            "qualityBand"
          ),

        relationships: [],

        qualityDiagnostics:
          selectionResult.diagnostics,
      };
    })
    .filter(
      (theme) =>
        theme.count > 0
    )
    .sort(
      (first, second) =>
        second.count -
          first.count ||
        second.evidenceScore
          .totalScore -
          first.evidenceScore
            .totalScore
    );
}
