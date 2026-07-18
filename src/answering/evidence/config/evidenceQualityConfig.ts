import type {
  EvidenceClass,
} from "../types";

export type EvidenceHierarchyTier =
  | "direct_voice"
  | "authoritative"
  | "credible_context"
  | "limited_fallback"
  | "excluded";

export const EVIDENCE_CLASS_WEIGHTS: Record<
  EvidenceClass,
  number
> = {
  patient_conversation: 30,
  caregiver_conversation: 27,
  provider_conversation: 30,

  /**
   * Recovered authentic social discussion with
   * no confidently identified persona.
   */
  community_conversation: 12,

  research_journal: 30,
  clinical_study: 30,
  government_or_regulator: 26,
  medical_society: 25,

  advocacy_organization: 18,
  healthcare_trade_publication: 15,
  healthcare_news: 10,

  youtube_review: 10,
  forum: 5,
  podcast: 4,
  personal_blog: 2,
  consumer_news: -5,

  influencer_content: -15,
  event_or_conference: -12,
  unknown: -20,

  corporate_pr: -45,
  sponsored_content: -45,
  clinic_marketing: -50,
  retail_or_product: -55,
};

export const EVIDENCE_CLASS_QUALITY_CAPS: Partial<
  Record<EvidenceClass, number>
> = {
  consumer_news: 65,

  /**
   * Community conversation may be client-facing,
   * but cannot outrank clearly identified patient,
   * provider, or authoritative evidence.
   */
  community_conversation: 78,

  personal_blog: 68,
  podcast: 72,
  forum: 72,
  youtube_review: 78,

  healthcare_news: 82,
  healthcare_trade_publication: 88,
  advocacy_organization: 90,

  influencer_content: 45,
  event_or_conference: 50,
  unknown: 40,

  corporate_pr: 40,
  sponsored_content: 35,
  clinic_marketing: 25,
  retail_or_product: 20,
};

export const DIRECT_VOICE_EVIDENCE_CLASSES =
  new Set<EvidenceClass>([
    "patient_conversation",
    "caregiver_conversation",
    "provider_conversation",
  ]);

export const AUTHORITATIVE_EVIDENCE_CLASSES =
  new Set<EvidenceClass>([
    "research_journal",
    "clinical_study",
    "government_or_regulator",
    "medical_society",
  ]);

export const CREDIBLE_CONTEXT_EVIDENCE_CLASSES =
  new Set<EvidenceClass>([
    "advocacy_organization",
    "healthcare_trade_publication",
    "healthcare_news",
  ]);

export const LIMITED_FALLBACK_EVIDENCE_CLASSES =
  new Set<EvidenceClass>([
    "community_conversation",
    "youtube_review",
    "forum",
    "podcast",
    "personal_blog",
    "consumer_news",
  ]);

export const PROMOTIONAL_EVIDENCE_CLASSES =
  new Set<EvidenceClass>([
    "corporate_pr",
    "clinic_marketing",
    "retail_or_product",
    "sponsored_content",
  ]);

export const LOW_TRUST_EVIDENCE_CLASSES =
  new Set<EvidenceClass>([
    "influencer_content",
    "event_or_conference",
  ]);

export const EXCLUDED_CLIENT_EVIDENCE_CLASSES =
  new Set<EvidenceClass>([
    ...PROMOTIONAL_EVIDENCE_CLASSES,
    ...LOW_TRUST_EVIDENCE_CLASSES,
    "unknown",
  ]);

export function getEvidenceHierarchyTier(
  evidenceClass: EvidenceClass
): EvidenceHierarchyTier {
  if (
    DIRECT_VOICE_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    return "direct_voice";
  }

  if (
    AUTHORITATIVE_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    return "authoritative";
  }

  if (
    CREDIBLE_CONTEXT_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    return "credible_context";
  }

  if (
    LIMITED_FALLBACK_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    return "limited_fallback";
  }

  return "excluded";
}

export function getEvidenceClassWeight(
  evidenceClass: EvidenceClass
): number {
  return (
    EVIDENCE_CLASS_WEIGHTS[
      evidenceClass
    ] ?? 0
  );
}

export function applyEvidenceClassQualityCap(
  evidenceClass: EvidenceClass,
  score: number
): number {
  const cap =
    EVIDENCE_CLASS_QUALITY_CAPS[
      evidenceClass
    ];

  if (
    typeof cap !== "number"
  ) {
    return score;
  }

  return Math.min(
    score,
    cap
  );
}