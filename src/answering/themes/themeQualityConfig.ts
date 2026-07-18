import type {
  ThemeConfidenceLabel,
} from "./themeModels";

export type ThemeQualityConfig = {
  minimumThemeCount: number;
  minimumRepresentativeEvidence: number;

  maxDominantThemes: number;
  maxSupportingThemes: number;
  maxRepresentativeEvidencePerTheme: number;

  minimumConfidenceForNarrative:
    ThemeConfidenceLabel;

  minimumRelationshipStrength: number;
  minimumCoOccurrenceCount: number;

  minimumThemeEvidenceRelevance: number;
  minimumClientFacingEvidenceScore: number;
  minimumHighQualityEvidenceScore: number;
  minimumEvidenceIntelligenceQualityScore: number;

  maximumEvidencePerPlatform: number;
  maximumEvidencePerSourceType: number;
  maximumEvidencePerCountry: number;
  maximumEvidencePerPersona: number;

  minimumDirectVoiceEvidence: number;
  maximumAuthoritativeEvidence: number;
  maximumCredibleContextEvidence: number;
  maximumFallbackEvidence: number;
  maximumConsumerNewsEvidence: number;
  maximumUnknownEvidence: number;

  minimumQuoteLength: number;
  maximumQuoteLength: number;
};

export const THEME_QUALITY_CONFIG: ThemeQualityConfig =
  {
    minimumThemeCount: 2,
    minimumRepresentativeEvidence: 1,

    maxDominantThemes: 5,
    maxSupportingThemes: 5,
    maxRepresentativeEvidencePerTheme: 3,

    minimumConfidenceForNarrative:
      "directional",

    minimumRelationshipStrength: 0.2,
    minimumCoOccurrenceCount: 3,

    minimumThemeEvidenceRelevance:
      0.25,

    minimumClientFacingEvidenceScore:
      70,

    minimumHighQualityEvidenceScore:
      70,

    minimumEvidenceIntelligenceQualityScore:
      55,

    maximumEvidencePerPlatform: 1,
    maximumEvidencePerSourceType: 2,
    maximumEvidencePerCountry: 2,
    maximumEvidencePerPersona: 2,

    minimumDirectVoiceEvidence: 1,
    maximumAuthoritativeEvidence: 2,
    maximumCredibleContextEvidence: 1,
    maximumFallbackEvidence: 1,

    /**
     * Consumer news can still contribute to theme volume,
     * but it is not used as client-facing evidence.
     */
    maximumConsumerNewsEvidence: 0,

    maximumUnknownEvidence: 0,

    minimumQuoteLength: 40,
    maximumQuoteLength: 280,
  };

const CONFIDENCE_ORDER: Record<
  ThemeConfidenceLabel,
  number
> = {
  insufficient: 0,
  directional: 1,
  moderate: 2,
  high: 3,
};

export function meetsMinimumConfidence(
  actual: ThemeConfidenceLabel,
  minimum: ThemeConfidenceLabel
): boolean {
  return (
    CONFIDENCE_ORDER[actual] >=
    CONFIDENCE_ORDER[minimum]
  );
}