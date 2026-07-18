import type {
  EvidenceOntology,
} from "./ontology/types";

export type EvidenceClass =
  | "patient_conversation"
  | "caregiver_conversation"
  | "provider_conversation"
  | "community_conversation"
  | "advocacy_organization"
  | "research_journal"
  | "clinical_study"
  | "medical_society"
  | "government_or_regulator"
  | "healthcare_trade_publication"
  | "healthcare_news"
  | "consumer_news"
  | "corporate_pr"
  | "clinic_marketing"
  | "retail_or_product"
  | "sponsored_content"
  | "influencer_content"
  | "youtube_review"
  | "podcast"
  | "forum"
  | "personal_blog"
  | "event_or_conference"
  | "unknown";

export type EvidenceVoice =
  | "patient"
  | "caregiver"
  | "provider"
  | "community"
  | "researcher"
  | "advocacy"
  | "journalist"
  | "corporate"
  | "clinic"
  | "retail"
  | "influencer"
  | "unknown";

export type NormalizedPlatform =
  | "social"
  | "forum"
  | "review"
  | "news"
  | "blog"
  | "video"
  | "podcast"
  | "research"
  | "government"
  | "retail"
  | "event"
  | "unknown";

export type PublicationType =
  | "social_post"
  | "forum_post"
  | "review"
  | "news_article"
  | "trade_article"
  | "journal_article"
  | "clinical_trial_record"
  | "government_document"
  | "medical_society_content"
  | "press_release"
  | "clinic_page"
  | "product_page"
  | "sponsored_article"
  | "blog_post"
  | "video"
  | "podcast"
  | "conference_content"
  | "unknown";

export type CommercialIntentLevel =
  | "none"
  | "low"
  | "moderate"
  | "high";

export type ResearchCredibility =
  | "peer_reviewed"
  | "clinical_trial_registry"
  | "government_evidence"
  | "medical_society"
  | "research_reporting"
  | "research_claim_only"
  | "not_research"
  | "unknown";

export type DomainCategory =
  | "research"
  | "government"
  | "medical_society"
  | "advocacy"
  | "forum"
  | "social"
  | "video"
  | "podcast"
  | "retail"
  | "press_release"
  | "healthcare_trade"
  | "healthcare_news"
  | "consumer_news"
  | "clinic"
  | "blog"
  | "unknown";

export type EvidenceQualityBand =
  | "very_high"
  | "high"
  | "moderate"
  | "low"
  | "very_low";

export type NormalizedEvidenceMetadata = {
  url?: string;

  domain?: string;

  hostname?: string;

  platform?: string;

  normalizedPlatform:
    NormalizedPlatform;

  sourceType?: string;

  sourceName?: string;

  contentType?: string;

  title?: string;

  summary?: string;

  excerpt?: string;

  description?: string;

  openingText?: string;

  hitSentence?: string;

  fullText: string;

  author?: string;

  authorHandle?: string;

  authorBio?: string;

  publication?: string;

  persona?: string;

  country?: string;

  publishedAt?: string;

  engagement?: number;

  reach?: number;

  tags: string[];

  rawMetadataFieldCount?: number;

  rawMetadataPopulatedFieldCount?: number;
};

export type DomainClassification = {
  domain?: string;

  category:
    DomainCategory;

  confidence: number;

  matchedRule?: string;
};

export type PlatformClassification = {
  rawPlatform?: string;

  platform:
    NormalizedPlatform;

  confidence: number;
};

export type CommercialIntentResult = {
  level:
    CommercialIntentLevel;

  score: number;

  reasons: string[];
};

export type SocialAuthenticityResult = {
  isSocialCompatible: boolean;

  isAuthenticConversation: boolean;

  isLikelyPromotional: boolean;

  isLikelyInfluencer: boolean;

  hasFirstPersonLanguage: boolean;

  hasLivedExperienceLanguage: boolean;

  hasQuestionOrDiscussionLanguage: boolean;

  hasClinicalDiscussionLanguage: boolean;

  score: number;

  reasons: string[];
};

export type AuthorVoiceResult = {
  voice:
    EvidenceVoice;

  confidence: number;

  reasons: string[];
};

export type ResearchCredibilityResult = {
  credibility:
    ResearchCredibility;

  confidence: number;

  reasons: string[];
};

export type EvidenceQualityResult = {
  score: number;

  band:
    EvidenceQualityBand;

  reasons: string[];
};

export type EvidenceIntelligence = {
  evidenceClass:
    EvidenceClass;

  voice:
    EvidenceVoice;

  publicationType:
    PublicationType;

  commercialIntent:
    CommercialIntentLevel;

  commercialIntentScore:
    number;

  researchCredibility:
    ResearchCredibility;

  domain?: string;

  domainCategory:
    DomainCategory;

  platform:
    NormalizedPlatform;

  sourceType?: string;

  socialAuthenticityScore:
    number;

  isAuthenticConversation:
    boolean;

  isCommunityConversation:
    boolean;

  isFirstParty:
    boolean;

  isPromotional:
    boolean;

  isPeerReviewed:
    boolean;

  classificationConfidence:
    number;

  qualityScore:
    number;

  qualityBand:
    EvidenceQualityBand;

  ontology:
    EvidenceOntology;

  reasons: string[];
};