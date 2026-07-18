import {
  CommercialIntentResult,
  DomainClassification,
  NormalizedEvidenceMetadata,
  PlatformClassification,
  PublicationType,
} from "../types";
import {
  PRESS_RELEASE_PATTERNS,
} from "../config/classificationPatterns";

function includesAny(
  text: string,
  patterns: string[]
): boolean {
  return patterns.some((pattern) =>
    text.includes(pattern)
  );
}

export function classifyPublicationType(
  metadata: NormalizedEvidenceMetadata,
  domain: DomainClassification,
  platform: PlatformClassification,
  commercialIntent: CommercialIntentResult
): PublicationType {
  const text = metadata.fullText;

  if (
    domain.category ===
      "press_release" ||
    includesAny(
      text,
      PRESS_RELEASE_PATTERNS
    )
  ) {
    return "press_release";
  }

  if (
    domain.category === "research"
  ) {
    return "journal_article";
  }

  if (
    metadata.domain ===
      "clinicaltrials.gov" ||
    metadata.url?.includes(
      "clinicaltrials.gov/study/"
    )
  ) {
    return "clinical_trial_record";
  }

  if (
    domain.category === "government"
  ) {
    return "government_document";
  }

  if (
    domain.category ===
    "medical_society"
  ) {
    return "medical_society_content";
  }

  if (
    domain.category === "retail"
  ) {
    return "product_page";
  }

  if (
    domain.category === "clinic"
  ) {
    return "clinic_page";
  }

  if (
    commercialIntent.level ===
      "high" &&
    platform.platform === "news"
  ) {
    return "sponsored_article";
  }

  switch (platform.platform) {
    case "social":
      return "social_post";

    case "forum":
      return "forum_post";

    case "review":
      return "review";

    case "news":
      return domain.category ===
        "healthcare_trade"
        ? "trade_article"
        : "news_article";

    case "blog":
      return "blog_post";

    case "video":
      return "video";

    case "podcast":
      return "podcast";

    case "research":
      return "journal_article";

    case "government":
      return "government_document";

    case "retail":
      return "product_page";

    case "event":
      return "conference_content";

    default:
      return "unknown";
  }
}