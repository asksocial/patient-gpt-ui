import type {
  AuthorVoiceResult,
  CommercialIntentResult,
  DomainClassification,
  EvidenceClass,
  EvidenceQualityBand,
  EvidenceQualityResult,
  NormalizedEvidenceMetadata,
  ResearchCredibilityResult,
  SocialAuthenticityResult,
} from "./types";
import {
  applyEvidenceClassQualityCap,
  getEvidenceClassWeight,
} from "./config/evidenceQualityConfig";

function clamp(
  value: number,
  minimum = 0,
  maximum = 100
): number {
  return Math.max(
    minimum,
    Math.min(maximum, value)
  );
}

function getBand(
  score: number
): EvidenceQualityBand {
  if (score >= 90) {
    return "very_high";
  }

  if (score >= 75) {
    return "high";
  }

  if (score >= 55) {
    return "moderate";
  }

  if (score >= 35) {
    return "low";
  }

  return "very_low";
}

function countMetadataFields(
  metadata: NormalizedEvidenceMetadata
): number {
  return [
    metadata.url,
    metadata.title,
    metadata.summary,
    metadata.excerpt,
    metadata.platform,
    metadata.publication,
    metadata.author,
    metadata.publishedAt,
  ].filter(Boolean).length;
}

function getVoiceAuthenticityAdjustment(
  evidenceClass: EvidenceClass,
  authorVoice: AuthorVoiceResult
): number {
  if (
    authorVoice.confidence < 0.6
  ) {
    return 0;
  }

  if (
    evidenceClass ===
      "patient_conversation" &&
    authorVoice.voice === "patient"
  ) {
    return 15;
  }

  if (
    evidenceClass ===
      "caregiver_conversation" &&
    authorVoice.voice === "caregiver"
  ) {
    return 14;
  }

  if (
    evidenceClass ===
      "provider_conversation" &&
    authorVoice.voice === "provider"
  ) {
    return 15;
  }

  if (
    evidenceClass ===
      "community_conversation" &&
    authorVoice.voice === "community"
  ) {
    return 8;
  }

  if (
    evidenceClass ===
      "research_journal" &&
    authorVoice.voice === "researcher"
  ) {
    return 10;
  }

  return 4;
}

function getResearchAdjustment(
  research: ResearchCredibilityResult
): number {
  switch (research.credibility) {
    case "peer_reviewed":
      return 18;

    case "clinical_trial_registry":
      return 18;

    case "government_evidence":
      return 15;

    case "medical_society":
      return 14;

    case "research_reporting":
      return 5;

    case "research_claim_only":
      return -15;

    default:
      return 0;
  }
}

function getCommercialPenalty(
  commercialIntent: CommercialIntentResult
): number {
  switch (commercialIntent.level) {
    case "high":
      return -30;

    case "moderate":
      return -15;

    case "low":
      return -5;

    default:
      return 0;
  }
}

function getDomainAdjustment(
  domain: DomainClassification
): number {
  if (domain.confidence >= 0.9) {
    return 8;
  }

  if (domain.confidence >= 0.7) {
    return 5;
  }

  if (
    domain.category === "unknown"
  ) {
    return -10;
  }

  return 0;
}

function getContentSpecificityAdjustment(
  metadata: NormalizedEvidenceMetadata
): number {
  const text =
    metadata.fullText || "";

  if (text.length >= 250) {
    return 5;
  }

  if (text.length >= 100) {
    return 3;
  }

  if (text.length < 40) {
    return -8;
  }

  return 0;
}

function getSocialAuthenticityAdjustment(
  evidenceClass: EvidenceClass,
  socialAuthenticity: SocialAuthenticityResult
): number {
  if (
    !socialAuthenticity
      .isSocialCompatible
  ) {
    return 0;
  }

  if (
    socialAuthenticity
      .isLikelyPromotional ||
    socialAuthenticity
      .isLikelyInfluencer
  ) {
    return -15;
  }

  if (
    evidenceClass ===
      "patient_conversation" ||
    evidenceClass ===
      "caregiver_conversation" ||
    evidenceClass ===
      "provider_conversation"
  ) {
    return Math.round(
      socialAuthenticity.score *
        12
    );
  }

  if (
    evidenceClass ===
    "community_conversation"
  ) {
    return Math.round(
      socialAuthenticity.score *
        15
    );
  }

  return Math.round(
    socialAuthenticity.score *
      5
  );
}

export function scoreEvidenceQuality(params: {
  evidenceClass: EvidenceClass;
  metadata: NormalizedEvidenceMetadata;
  domain: DomainClassification;
  commercialIntent: CommercialIntentResult;
  authorVoice: AuthorVoiceResult;
  research: ResearchCredibilityResult;
  socialAuthenticity: SocialAuthenticityResult;
}): EvidenceQualityResult {
  const {
    evidenceClass,
    metadata,
    domain,
    commercialIntent,
    authorVoice,
    research,
    socialAuthenticity,
  } = params;

  let score = 45;

  const reasons: string[] = [];

  const classWeight =
    getEvidenceClassWeight(
      evidenceClass
    );

  score += classWeight;

  reasons.push(
    `Evidence-class adjustment: ${classWeight}`
  );

  const voiceAdjustment =
    getVoiceAuthenticityAdjustment(
      evidenceClass,
      authorVoice
    );

  score += voiceAdjustment;

  if (voiceAdjustment !== 0) {
    reasons.push(
      `Voice-authenticity adjustment: ${voiceAdjustment}`
    );
  }

  const socialAdjustment =
    getSocialAuthenticityAdjustment(
      evidenceClass,
      socialAuthenticity
    );

  score += socialAdjustment;

  if (socialAdjustment !== 0) {
    reasons.push(
      `Social-authenticity adjustment: ${socialAdjustment}`
    );
  }

  const researchAdjustment =
    getResearchAdjustment(
      research
    );

  score += researchAdjustment;

  if (researchAdjustment !== 0) {
    reasons.push(
      `Research-credibility adjustment: ${researchAdjustment}`
    );
  }

  const commercialPenalty =
    getCommercialPenalty(
      commercialIntent
    );

  score += commercialPenalty;

  if (commercialPenalty !== 0) {
    reasons.push(
      `Commercial-intent adjustment: ${commercialPenalty}`
    );
  }

  const domainAdjustment =
    getDomainAdjustment(
      domain
    );

  score += domainAdjustment;

  if (domainAdjustment !== 0) {
    reasons.push(
      `Domain-confidence adjustment: ${domainAdjustment}`
    );
  }

  const metadataCount =
    countMetadataFields(
      metadata
    );

  if (metadataCount >= 6) {
    score += 5;

    reasons.push(
      "Strong metadata completeness"
    );
  } else if (metadataCount <= 2) {
    score -= 5;

    reasons.push(
      "Limited metadata completeness"
    );
  }

  const specificityAdjustment =
    getContentSpecificityAdjustment(
      metadata
    );

  score += specificityAdjustment;

  if (
    specificityAdjustment !== 0
  ) {
    reasons.push(
      `Content-specificity adjustment: ${specificityAdjustment}`
    );
  }

  const uncappedScore =
    Math.round(clamp(score));

  const cappedScore =
    Math.round(
      applyEvidenceClassQualityCap(
        evidenceClass,
        uncappedScore
      )
    );

  if (cappedScore < uncappedScore) {
    reasons.push(
      `Evidence-class quality cap applied: ${cappedScore}`
    );
  }

  return {
    score: cappedScore,

    band:
      getBand(cappedScore),

    reasons,
  };
}