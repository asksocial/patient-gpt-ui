import {
  EXCLUDED_CLIENT_EVIDENCE_CLASSES,
} from "../evidence/config/evidenceQualityConfig";
import type {
  RepresentativeEvidence,
} from "./themeModels";
import {
  THEME_QUALITY_CONFIG,
} from "./themeQualityConfig";

function normalizeText(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function filterClientFacingEvidence(
  evidence: RepresentativeEvidence[]
): RepresentativeEvidence[] {
  const seen =
    new Set<string>();

  let consumerNewsCount = 0;

  return evidence.filter((item) => {
    if (
      item.evidenceClass &&
      EXCLUDED_CLIENT_EVIDENCE_CLASSES.has(
        item.evidenceClass
      )
    ) {
      return false;
    }

    if (
      item.evidenceClass ===
      "consumer_news"
    ) {
      if (
        consumerNewsCount >=
        THEME_QUALITY_CONFIG
          .maximumConsumerNewsEvidence
      ) {
        return false;
      }

      consumerNewsCount += 1;
    }

    if (
      item.themeRelevanceScore <
      THEME_QUALITY_CONFIG
        .minimumThemeEvidenceRelevance
    ) {
      return false;
    }

    if (
      (
        item.evidenceQualityScore ??
        0
      ) <
      THEME_QUALITY_CONFIG
        .minimumEvidenceIntelligenceQualityScore
    ) {
      return false;
    }

    if (
      item.qualityScore <
      THEME_QUALITY_CONFIG
        .minimumClientFacingEvidenceScore
    ) {
      return false;
    }

    if (
      item.quote.length <
      THEME_QUALITY_CONFIG
        .minimumQuoteLength
    ) {
      return false;
    }

    const key =
      normalizeText(item.quote);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}