import type {
  CommercialIntentLevel,
  EvidenceClass,
  PublicationType,
  ResearchCredibility,
} from "../types";

export type OntologyAuthorIdentity =
  | "patient"
  | "caregiver"
  | "provider"
  | "researcher"
  | "journalist"
  | "advocacy_organization"
  | "government"
  | "medical_society"
  | "clinic"
  | "brand"
  | "retailer"
  | "influencer"
  | "community_member"
  | "event_organizer"
  | "unknown";

export type OntologyCommunicationIntent =
  | "personal_experience"
  | "caregiver_experience"
  | "community_question"
  | "community_discussion"
  | "provider_education"
  | "patient_education"
  | "research_dissemination"
  | "news_reporting"
  | "advocacy"
  | "product_promotion"
  | "clinic_promotion"
  | "brand_announcement"
  | "event_promotion"
  | "thought_leadership"
  | "testimonial"
  | "commercial_review"
  | "unknown";

export type OntologyPublicationArchetype =
  | "social_post"
  | "social_comment"
  | "social_reply"
  | "social_quote"
  | "social_repost"
  | "forum_post"
  | "community_review"
  | "provider_social_post"
  | "clinic_social_post"
  | "brand_social_post"
  | "influencer_social_post"
  | "educational_video"
  | "testimonial_video"
  | "promotional_video"
  | "podcast_episode"
  | "news_article"
  | "trade_article"
  | "journal_article"
  | "clinical_trial_record"
  | "government_document"
  | "medical_society_content"
  | "advocacy_content"
  | "press_release"
  | "clinic_page"
  | "product_page"
  | "event_content"
  | "blog_post"
  | "unknown";

export type OntologyAuthorityLevel =
  | "authoritative"
  | "professional"
  | "lived_experience"
  | "community"
  | "editorial"
  | "commercial"
  | "unknown";

export type OntologyEvidenceRole =
  | "primary_experience"
  | "professional_interpretation"
  | "research_evidence"
  | "regulatory_evidence"
  | "community_signal"
  | "market_context"
  | "commercial_signal"
  | "noise_or_low_trust";

export type OntologyCandidate<
  T extends string
> = {
  value: T;

  score: number;

  reasons: string[];
};

export type IntentSelectionMethod =
  | "semantic_override"
  | "precedence"
  | "fallback";

export type RankedIntentCandidate =
  OntologyCandidate<OntologyCommunicationIntent> & {
    eligible: boolean;

    precedenceTier: number;

    exclusionReasons: string[];
  };

export type IntentRankingDecision = {
  value:
    OntologyCommunicationIntent;

  confidence: number;

  selectionMethod:
    IntentSelectionMethod;

  selectedPrecedenceTier?: number;

  overrideReason?: string;

  selectedReasons: string[];

  rankedCandidates:
    RankedIntentCandidate[];
};

export type PlatformAwareSocialArchetypeResult = {
  sourceName?: string;

  contentType?: string;

  platformFamily:
    | "youtube"
    | "linkedin"
    | "twitter"
    | "pinterest"
    | "tiktok"
    | "bluesky"
    | "snapchat"
    | "line_voom"
    | "other_social"
    | "not_social";

  isSecondaryVoice: boolean;

  authorCandidates:
    OntologyCandidate<OntologyAuthorIdentity>[];

  intentCandidates:
    OntologyCandidate<OntologyCommunicationIntent>[];

  publicationCandidates:
    OntologyCandidate<OntologyPublicationArchetype>[];

  reasons: string[];
};

export type EvidenceOntology = {
  authorIdentity:
    OntologyAuthorIdentity;

  communicationIntent:
    OntologyCommunicationIntent;

  publicationArchetype:
    OntologyPublicationArchetype;

  authorityLevel:
    OntologyAuthorityLevel;

  evidenceRole:
    OntologyEvidenceRole;

  commercialIntent:
    CommercialIntentLevel;

  researchCredibility:
    ResearchCredibility;

  sourcePublicationType:
    PublicationType;

  derivedEvidenceClass:
    EvidenceClass;

  platformFamily?:
    PlatformAwareSocialArchetypeResult["platformFamily"];

  isSecondaryVoice?: boolean;

  authorIdentityConfidence:
    number;

  communicationIntentConfidence:
    number;

  intentRanking:
    IntentRankingDecision;

  publicationArchetypeConfidence:
    number;

  overallConfidence:
    number;

  authorCandidates:
    OntologyCandidate<OntologyAuthorIdentity>[];

  intentCandidates:
    OntologyCandidate<OntologyCommunicationIntent>[];

  publicationCandidates:
    OntologyCandidate<OntologyPublicationArchetype>[];

  reasons: string[];
};
