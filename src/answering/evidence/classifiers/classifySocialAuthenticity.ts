import {
  COMMUNITY_DISCUSSION_PATTERNS,
  FIRST_PERSON_PATTERNS,
  INFLUENCER_PATTERNS,
  LIVED_EXPERIENCE_PATTERNS,
  PROVIDER_CLINICAL_PATTERNS,
  SOCIAL_PROMOTIONAL_PATTERNS,
  TREATMENT_DISCUSSION_PATTERNS,
} from "../config/classificationPatterns";
import type {
  CommercialIntentResult,
  NormalizedEvidenceMetadata,
  PublicationType,
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

function countMatches(
  text: string,
  patterns: string[]
): number {
  return patterns.reduce(
    (count, pattern) =>
      text.includes(pattern)
        ? count + 1
        : count,
    0
  );
}

function isSocialCompatiblePublication(
  publicationType: PublicationType
): boolean {
  return [
    "social_post",
    "forum_post",
    "review",
    "blog_post",
    "video",
    "podcast",
  ].includes(publicationType);
}

export function classifySocialAuthenticity(
  metadata: NormalizedEvidenceMetadata,
  publicationType: PublicationType,
  commercialIntent: CommercialIntentResult
): SocialAuthenticityResult {
  const text = ` ${metadata.fullText} `;

  const isSocialCompatible =
    isSocialCompatiblePublication(
      publicationType
    );

  const firstPersonMatches =
    countMatches(
      text,
      FIRST_PERSON_PATTERNS
    );

  const livedExperienceMatches =
    countMatches(
      text,
      LIVED_EXPERIENCE_PATTERNS
    );

  const discussionMatches =
    countMatches(
      text,
      COMMUNITY_DISCUSSION_PATTERNS
    );

  const treatmentMatches =
    countMatches(
      text,
      TREATMENT_DISCUSSION_PATTERNS
    );

  const clinicalDiscussionMatches =
    countMatches(
      text,
      PROVIDER_CLINICAL_PATTERNS
    );

  const promotionalMatches =
    countMatches(
      text,
      SOCIAL_PROMOTIONAL_PATTERNS
    );

  const influencerMatches =
    countMatches(
      text,
      INFLUENCER_PATTERNS
    );

  const hasFirstPersonLanguage =
    firstPersonMatches > 0;

  const hasLivedExperienceLanguage =
    livedExperienceMatches > 0;

  const hasQuestionOrDiscussionLanguage =
    discussionMatches > 0;

  const hasClinicalDiscussionLanguage =
    clinicalDiscussionMatches > 0;

  let score = 0;

  const reasons: string[] = [];

  if (isSocialCompatible) {
    score += 0.25;

    reasons.push(
      "Publication type supports social or community conversation"
    );
  }

  if (hasFirstPersonLanguage) {
    score += Math.min(
      0.18,
      firstPersonMatches * 0.06
    );

    reasons.push(
      "Contains first-person language"
    );
  }

  if (hasLivedExperienceLanguage) {
    score += Math.min(
      0.25,
      livedExperienceMatches * 0.08
    );

    reasons.push(
      "Contains lived-experience language"
    );
  }

  if (
    hasQuestionOrDiscussionLanguage
  ) {
    score += Math.min(
      0.2,
      discussionMatches * 0.07
    );

    reasons.push(
      "Contains community-question or discussion language"
    );
  }

  if (treatmentMatches > 0) {
    score += Math.min(
      0.15,
      treatmentMatches * 0.03
    );

    reasons.push(
      "Contains treatment or outcome discussion"
    );
  }

  if (
    hasClinicalDiscussionLanguage
  ) {
    score += Math.min(
      0.15,
      clinicalDiscussionMatches *
        0.05
    );

    reasons.push(
      "Contains clinical discussion language"
    );
  }

  const isLikelyPromotional =
    commercialIntent.level ===
      "high" ||
    promotionalMatches >= 2;

  const isLikelyInfluencer =
    influencerMatches >= 2 ||
    (
      influencerMatches >= 1 &&
      commercialIntent.level !==
        "none"
    );

  if (isLikelyPromotional) {
    score -= 0.55;

    reasons.push(
      "Promotional language reduces authenticity"
    );
  }

  if (isLikelyInfluencer) {
    score -= 0.35;

    reasons.push(
      "Influencer or affiliate language reduces authenticity"
    );
  }

  if (
    commercialIntent.level ===
    "moderate"
  ) {
    score -= 0.2;

    reasons.push(
      "Moderate commercial intent reduces authenticity"
    );
  }

  if (
    commercialIntent.level ===
    "low"
  ) {
    score -= 0.08;
  }

  score = Math.max(
    0,
    Math.min(1, score)
  );

  const isAuthenticConversation =
    isSocialCompatible &&
    score >= 0.5 &&
    !isLikelyPromotional &&
    !isLikelyInfluencer;

  if (isAuthenticConversation) {
    reasons.push(
      "Meets threshold for authentic social conversation"
    );
  }

  return {
    isSocialCompatible,

    isAuthenticConversation,

    isLikelyPromotional,

    isLikelyInfluencer,

    hasFirstPersonLanguage,

    hasLivedExperienceLanguage,

    hasQuestionOrDiscussionLanguage,

    hasClinicalDiscussionLanguage,

    score: Number(
      score.toFixed(2)
    ),

    reasons,
  };
}