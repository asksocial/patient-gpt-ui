import {
  INFLUENCER_PATTERNS,
} from "../config/classificationPatterns";
import type {
  AuthorVoiceResult,
  CommercialIntentResult,
  DomainClassification,
  EvidenceClass,
  NormalizedEvidenceMetadata,
  PublicationType,
  ResearchCredibilityResult,
  SocialAuthenticityResult,
} from "../types";

function includesAny(
  text: string,
  patterns: string[]
): boolean {
  return patterns.some((pattern) =>
    text.includes(pattern)
  );
}

export function classifyEvidenceClass(params: {
  metadata: NormalizedEvidenceMetadata;
  domain: DomainClassification;
  publicationType: PublicationType;
  commercialIntent: CommercialIntentResult;
  authorVoice: AuthorVoiceResult;
  research: ResearchCredibilityResult;
  socialAuthenticity: SocialAuthenticityResult;
}): EvidenceClass {
  const {
    metadata,
    domain,
    publicationType,
    commercialIntent,
    authorVoice,
    research,
    socialAuthenticity,
  } = params;

  /**
   * Highly explicit source types should be resolved first.
   */
  if (
    publicationType ===
    "press_release"
  ) {
    return "corporate_pr";
  }

  if (
    publicationType ===
    "product_page"
  ) {
    return "retail_or_product";
  }

  if (
    publicationType ===
      "clinic_page" ||
    authorVoice.voice === "clinic"
  ) {
    return "clinic_marketing";
  }

  /**
   * Influencer content must be classified before the
   * generic sponsored-content rule. Influencers commonly
   * have high commercial intent, but retaining the more
   * specific class provides better diagnostics and allows
   * separate ranking and exclusion policies.
   */
  if (
    socialAuthenticity
      .isLikelyInfluencer ||
    authorVoice.voice ===
      "influencer" ||
    includesAny(
      metadata.fullText,
      INFLUENCER_PATTERNS
    )
  ) {
    return "influencer_content";
  }

  /**
   * Generic paid or commercially driven content that is
   * not specifically influencer-authored.
   */
  if (
    publicationType ===
      "sponsored_article" ||
    commercialIntent.level ===
      "high" ||
    socialAuthenticity
      .isLikelyPromotional
  ) {
    return "sponsored_content";
  }

  /**
   * Authoritative evidence classes.
   */
  if (
    research.credibility ===
    "clinical_trial_registry"
  ) {
    return "clinical_study";
  }

  if (
    research.credibility ===
    "peer_reviewed"
  ) {
    return "research_journal";
  }

  if (
    research.credibility ===
    "government_evidence"
  ) {
    return "government_or_regulator";
  }

  if (
    research.credibility ===
    "medical_society"
  ) {
    return "medical_society";
  }

  /**
   * Identified direct voices.
   */
  if (
    authorVoice.voice ===
    "patient"
  ) {
    if (
      publicationType ===
      "video"
    ) {
      return "youtube_review";
    }

    return "patient_conversation";
  }

  if (
    authorVoice.voice ===
    "caregiver"
  ) {
    return "caregiver_conversation";
  }

  if (
    authorVoice.voice ===
    "provider"
  ) {
    return "provider_conversation";
  }

  if (
    authorVoice.voice ===
    "advocacy"
  ) {
    return "advocacy_organization";
  }

  /**
   * Preserve authentic social discussion when the precise
   * participant identity cannot be established.
   */
  if (
    authorVoice.voice ===
      "community" ||
    socialAuthenticity
      .isAuthenticConversation
  ) {
    return "community_conversation";
  }

  /**
   * Remaining publication-based classifications.
   */
  if (
    publicationType ===
    "forum_post"
  ) {
    return "forum";
  }

  if (
    publicationType ===
    "podcast"
  ) {
    return "podcast";
  }

  if (
    publicationType ===
    "conference_content"
  ) {
    return "event_or_conference";
  }

  if (
    publicationType ===
    "blog_post"
  ) {
    return "personal_blog";
  }

  if (
    publicationType ===
      "trade_article" ||
    domain.category ===
      "healthcare_trade"
  ) {
    return "healthcare_trade_publication";
  }

  if (
    domain.category ===
    "healthcare_news"
  ) {
    return "healthcare_news";
  }

  if (
    publicationType ===
    "news_article"
  ) {
    return "consumer_news";
  }

  return "unknown";
}