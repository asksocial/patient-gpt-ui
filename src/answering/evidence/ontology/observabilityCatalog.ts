import type {
  OntologyPublicationArchetype,
  PlatformAwareSocialArchetypeResult,
} from "./types";

export const ALL_ONTOLOGY_PUBLICATION_ARCHETYPES: readonly OntologyPublicationArchetype[] =
  [
    "social_post",
    "social_comment",
    "social_reply",
    "social_quote",
    "social_repost",
    "forum_post",
    "community_review",
    "provider_social_post",
    "clinic_social_post",
    "brand_social_post",
    "influencer_social_post",
    "educational_video",
    "testimonial_video",
    "promotional_video",
    "podcast_episode",
    "news_article",
    "trade_article",
    "journal_article",
    "clinical_trial_record",
    "government_document",
    "medical_society_content",
    "advocacy_content",
    "press_release",
    "clinic_page",
    "product_page",
    "event_content",
    "blog_post",
    "unknown",
  ];

export const ALL_PLATFORM_FAMILIES: readonly PlatformAwareSocialArchetypeResult["platformFamily"][] =
  [
    "youtube",
    "linkedin",
    "twitter",
    "pinterest",
    "tiktok",
    "bluesky",
    "snapchat",
    "line_voom",
    "other_social",
    "not_social",
  ];

export const ALL_VOICE_ORIGIN_TYPES = [
  "primary_voice",
  "secondary_voice",
] as const;

export type VoiceOriginType =
  (typeof ALL_VOICE_ORIGIN_TYPES)[number];