import type {
  NormalizedEvidenceMetadata,
  PublicationType,
  SocialAuthenticityResult,
} from "../types";
import type {
  OntologyAuthorIdentity,
  OntologyCandidate,
  OntologyCommunicationIntent,
  OntologyPublicationArchetype,
  PlatformAwareSocialArchetypeResult,
} from "./types";
import {
  ONTOLOGY_PATTERNS,
} from "./ontologyPatterns";

type PlatformClassifierParams = {
  metadata:
    NormalizedEvidenceMetadata;

  publicationType:
    PublicationType;

  socialAuthenticity:
    SocialAuthenticityResult;

  commercialIntentLevel:
    "none" | "low" | "moderate" | "high";
};

function normalize(
  value?: string
): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(
  text: string,
  patterns: readonly string[]
): boolean {
  return patterns.some(
    (pattern) =>
      text.includes(
        pattern.toLowerCase()
      )
  );
}

function countMatches(
  text: string,
  patterns: readonly string[]
): number {
  return patterns.filter(
    (pattern) =>
      text.includes(
        pattern.toLowerCase()
      )
  ).length;
}

function addCandidate<
  T extends string
>(
  candidates:
    OntologyCandidate<T>[],
  value: T,
  score: number,
  reasons: string[]
): void {
  if (score <= 0) {
    return;
  }

  candidates.push({
    value,

    score:
      Number(
        Math.max(
          0,
          Math.min(1, score)
        ).toFixed(2)
      ),

    reasons,
  });
}

function detectPlatformFamily(
  sourceName?: string,
  platform?: string
): PlatformAwareSocialArchetypeResult["platformFamily"] {
  const source =
    normalize(sourceName);

  const rawPlatform =
    normalize(platform);

  if (
    source.includes("youtube")
  ) {
    return "youtube";
  }

  if (
    source.includes("linkedin")
  ) {
    return "linkedin";
  }

  if (
    source.includes("twitter") ||
    source === "x" ||
    source.includes("x.com")
  ) {
    return "twitter";
  }

  if (
    source.includes("pinterest")
  ) {
    return "pinterest";
  }

  if (
    source.includes("tiktok")
  ) {
    return "tiktok";
  }

  if (
    source.includes("bluesky")
  ) {
    return "bluesky";
  }

  if (
    source.includes("snapchat")
  ) {
    return "snapchat";
  }

  if (
    source.includes("line voom")
  ) {
    return "line_voom";
  }

  if (
    rawPlatform.includes("social")
  ) {
    return "other_social";
  }

  return "not_social";
}

function isSecondaryContentType(
  contentType?: string
): boolean {
  const value =
    normalize(contentType);

  return [
    "repost",
    "quote",
  ].includes(value);
}

export function classifyPlatformAwareSocialArchetype(
  params:
    PlatformClassifierParams
): PlatformAwareSocialArchetypeResult {
  const {
    metadata,
    publicationType,
    socialAuthenticity,
    commercialIntentLevel,
  } = params;

  const sourceName =
    metadata.sourceName ||
    metadata.publication;

  const contentType =
    metadata.contentType;

  const platformFamily =
    detectPlatformFamily(
      sourceName,
      metadata.platform
    );

  const isSecondaryVoice =
    isSecondaryContentType(
      contentType
    );

  const text =
    normalize(
      [
        metadata.title,
        metadata.summary,
        metadata.excerpt,
        metadata.description,
        metadata.openingText,
        metadata.hitSentence,
        metadata.fullText,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const authorContext =
    normalize(
      [
        metadata.author,
        metadata.authorHandle,
        metadata.authorBio,
        metadata.sourceName,
        metadata.publication,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const content =
    normalize(contentType);

  const authorCandidates:
    OntologyCandidate<OntologyAuthorIdentity>[] =
      [];

  const intentCandidates:
    OntologyCandidate<OntologyCommunicationIntent>[] =
      [];

  const publicationCandidates:
    OntologyCandidate<OntologyPublicationArchetype>[] =
      [];

  const reasons: string[] = [];

  const providerSignal =
    includesAny(
      `${authorContext} ${text}`,
      [
        ...ONTOLOGY_PATTERNS.providerIdentity,
        ...ONTOLOGY_PATTERNS.providerCredential,
      ]
    );

  const providerEducationSignal =
    includesAny(
      text,
      ONTOLOGY_PATTERNS
        .providerEducation
    );

  const patientEducationSignal =
    includesAny(
      text,
      ONTOLOGY_PATTERNS
        .patientEducation
    );

  const livedExperienceSignal =
    includesAny(
      text,
      ONTOLOGY_PATTERNS
        .personalExperience
    ) &&
    socialAuthenticity
      .hasFirstPersonLanguage;

  const questionSignal =
    includesAny(
      text,
      ONTOLOGY_PATTERNS
        .communityQuestion
    );

  const testimonialSignal =
    includesAny(
      text,
      [
        ...ONTOLOGY_PATTERNS.testimonial,
        ...ONTOLOGY_PATTERNS.recommendation,
      ]
    );

  const clinicSignal =
    includesAny(
      `${authorContext} ${text}`,
      [
        ...ONTOLOGY_PATTERNS.clinicAccount,
        ...ONTOLOGY_PATTERNS.clinicPromotion,
      ]
    );

  const productSignal =
    includesAny(
      text,
      ONTOLOGY_PATTERNS
        .productPromotion
    );

  const brandSignal =
    includesAny(
      `${authorContext} ${text}`,
      [
        ...ONTOLOGY_PATTERNS.brandAccount,
        ...ONTOLOGY_PATTERNS.brandAnnouncement,
      ]
    );

  const eventSignal =
    includesAny(
      text,
      [
        ...ONTOLOGY_PATTERNS.eventPromotion,
        ...ONTOLOGY_PATTERNS.eventRecap,
      ]
    );

  const influencerSignal =
    includesAny(
      `${authorContext} ${text}`,
      ONTOLOGY_PATTERNS
        .influencer
    ) ||
    socialAuthenticity
      .isLikelyInfluencer;

  const thoughtLeadershipSignal =
    includesAny(
      text,
      ONTOLOGY_PATTERNS
        .thoughtLeadership
    );

  const highCommercial =
    commercialIntentLevel ===
      "high" ||
    socialAuthenticity
      .isLikelyPromotional;

  if (
    platformFamily ===
    "youtube"
  ) {
    reasons.push(
      "YouTube-specific archetype rules applied"
    );

    if (
      highCommercial ||
      clinicSignal ||
      productSignal
    ) {
      addCandidate(
        publicationCandidates,
        "promotional_video",
        0.92,
        [
          "YouTube video contains strong commercial, clinic, or product signals",
        ]
      );

      addCandidate(
        intentCandidates,
        clinicSignal
          ? "clinic_promotion"
          : "product_promotion",
        0.82,
        [
          "Promotional YouTube content",
        ]
      );

      if (clinicSignal) {
        addCandidate(
          authorCandidates,
          "clinic",
          0.8,
          [
            "YouTube author or content indicates a clinic",
          ]
        );
      }
    } else if (
      providerSignal &&
      (
        providerEducationSignal ||
        patientEducationSignal
      )
    ) {
      addCandidate(
        publicationCandidates,
        "educational_video",
        0.94,
        [
          "YouTube video combines provider identity with educational content",
        ]
      );

      addCandidate(
        authorCandidates,
        "provider",
        0.86,
        [
          "YouTube author metadata or content indicates a provider",
        ]
      );

      addCandidate(
        intentCandidates,
        "provider_education",
        0.88,
        [
          "Provider-authored educational video",
        ]
      );
    } else if (
      livedExperienceSignal ||
      testimonialSignal
    ) {
      addCandidate(
        publicationCandidates,
        "testimonial_video",
        0.9,
        [
          "YouTube video contains first-person experience or testimonial language",
        ]
      );

      addCandidate(
        intentCandidates,
        livedExperienceSignal
          ? "personal_experience"
          : "testimonial",
        0.8,
        [
          "Consumer experience presented in video format",
        ]
      );

      if (
        socialAuthenticity
          .isAuthenticConversation
      ) {
        addCandidate(
          authorCandidates,
          "patient",
          0.7,
          [
            "Authentic first-person YouTube experience",
          ]
        );
      }
    } else {
      addCandidate(
        publicationCandidates,
        "educational_video",
        0.68,
        [
          "YouTube video lacks strong promotional or testimonial signals",
        ]
      );

      if (
        providerEducationSignal ||
        patientEducationSignal
      ) {
        addCandidate(
          intentCandidates,
          "patient_education",
          0.58,
          [
            "Informational YouTube content",
          ]
        );
      }
    }
  }

  if (
    platformFamily ===
    "linkedin"
  ) {
    reasons.push(
      "LinkedIn-specific archetype rules applied"
    );

    if (brandSignal) {
      addCandidate(
        publicationCandidates,
        "brand_social_post",
        0.94,
        [
          "LinkedIn post contains corporate or announcement language",
        ]
      );

      addCandidate(
        authorCandidates,
        "brand",
        0.84,
        [
          "LinkedIn author or source appears organizational",
        ]
      );

      addCandidate(
        intentCandidates,
        "brand_announcement",
        0.88,
        [
          "LinkedIn announcement language",
        ]
      );
    } else if (
      eventSignal
    ) {
      addCandidate(
        publicationCandidates,
        "brand_social_post",
        0.76,
        [
          "LinkedIn event post",
        ]
      );

      addCandidate(
        authorCandidates,
        "event_organizer",
        0.66,
        [
          "LinkedIn content promotes or recaps an event",
        ]
      );

      addCandidate(
        intentCandidates,
        "event_promotion",
        0.8,
        [
          "LinkedIn event-oriented content",
        ]
      );
    } else if (
      providerSignal
    ) {
      addCandidate(
        publicationCandidates,
        "provider_social_post",
        0.9,
        [
          "LinkedIn author metadata indicates a healthcare professional",
        ]
      );

      addCandidate(
        authorCandidates,
        "provider",
        0.86,
        [
          "Provider-authored LinkedIn content",
        ]
      );

      addCandidate(
        intentCandidates,
        providerEducationSignal
          ? "provider_education"
          : "thought_leadership",
        providerEducationSignal
          ? 0.84
          : 0.7,
        [
          "Professional LinkedIn commentary",
        ]
      );
    } else if (
      thoughtLeadershipSignal
    ) {
      addCandidate(
        publicationCandidates,
        "social_post",
        0.7,
        [
          "LinkedIn thought-leadership post",
        ]
      );

      addCandidate(
        intentCandidates,
        "thought_leadership",
        0.72,
        [
          "Perspective or industry-analysis language",
        ]
      );
    }
  }

  if (
    platformFamily ===
    "pinterest"
  ) {
    reasons.push(
      "Pinterest-specific archetype rules applied"
    );

    if (
      influencerSignal ||
      productSignal ||
      highCommercial
    ) {
      addCandidate(
        publicationCandidates,
        "influencer_social_post",
        0.82,
        [
          "Pinterest post contains product, affiliate, or influencer signals",
        ]
      );

      addCandidate(
        authorCandidates,
        influencerSignal
          ? "influencer"
          : "retailer",
        influencerSignal
          ? 0.72
          : 0.65,
        [
          "Pinterest account or content has commercial recommendation signals",
        ]
      );

      addCandidate(
        intentCandidates,
        productSignal
          ? "product_promotion"
          : "commercial_review",
        0.76,
        [
          "Pinterest commercial recommendation content",
        ]
      );
    } else if (
      livedExperienceSignal ||
      testimonialSignal
    ) {
      addCandidate(
        publicationCandidates,
        "community_review",
        0.72,
        [
          "Pinterest post contains non-commercial personal recommendation language",
        ]
      );

      addCandidate(
        authorCandidates,
        "community_member",
        0.58,
        [
          "Pinterest consumer recommendation",
        ]
      );

      addCandidate(
        intentCandidates,
        testimonialSignal
          ? "testimonial"
          : "personal_experience",
        0.64,
        [
          "Pinterest personal recommendation or experience",
        ]
      );
    }
  }

  if (
    [
      "twitter",
      "bluesky",
    ].includes(
      platformFamily
    )
  ) {
    reasons.push(
      "Short-form conversation-platform rules applied"
    );

    if (
      content === "reply"
    ) {
      addCandidate(
        publicationCandidates,
        "social_reply",
        0.94,
        [
          "Meltwater content type is Reply",
        ]
      );
    } else if (
      content === "comment"
    ) {
      addCandidate(
        publicationCandidates,
        "social_comment",
        0.94,
        [
          "Meltwater content type is Comment",
        ]
      );
    } else if (
      content === "quote"
    ) {
      addCandidate(
        publicationCandidates,
        "social_quote",
        0.94,
        [
          "Meltwater content type is Quote",
        ]
      );
    } else if (
      content === "repost"
    ) {
      addCandidate(
        publicationCandidates,
        "social_repost",
        0.96,
        [
          "Meltwater content type is Repost",
        ]
      );
    }

    if (
      (
        content === "reply" ||
        content === "comment"
      ) &&
      questionSignal
    ) {
      addCandidate(
        authorCandidates,
        "community_member",
        0.65,
        [
          "Reply or comment contains a direct community question",
        ]
      );

      addCandidate(
        intentCandidates,
        "community_question",
        0.84,
        [
          "Conversational reply asks for information or experience",
        ]
      );
    } else if (
      (
        content === "reply" ||
        content === "comment"
      ) &&
      socialAuthenticity
        .isAuthenticConversation
    ) {
      addCandidate(
        authorCandidates,
        "community_member",
        0.62,
        [
          "Authentic reply or comment",
        ]
      );

      addCandidate(
        intentCandidates,
        "community_discussion",
        0.72,
        [
          "Conversational reply or comment",
        ]
      );
    }

    if (
      providerSignal &&
      !isSecondaryVoice
    ) {
      addCandidate(
        publicationCandidates,
        "provider_social_post",
        0.8,
        [
          "Original short-form post appears provider-authored",
        ]
      );

      addCandidate(
        authorCandidates,
        "provider",
        0.78,
        [
          "Provider signals in original short-form post",
        ]
      );

      addCandidate(
        intentCandidates,
        providerEducationSignal
          ? "provider_education"
          : "thought_leadership",
        0.7,
        [
          "Provider commentary on short-form social platform",
        ]
      );
    }
  }

  if (
    platformFamily ===
      "tiktok" ||
    platformFamily ===
      "snapchat" ||
    platformFamily ===
      "line_voom"
  ) {
    reasons.push(
      "Short-form video/social archetype rules applied"
    );

    if (
      influencerSignal ||
      highCommercial
    ) {
      addCandidate(
        publicationCandidates,
        "influencer_social_post",
        0.88,
        [
          "Short-form social post contains influencer or commercial signals",
        ]
      );

      addCandidate(
        authorCandidates,
        "influencer",
        0.78,
        [
          "Creator or affiliate behavior detected",
        ]
      );

      addCandidate(
        intentCandidates,
        "commercial_review",
        0.78,
        [
          "Commercial creator review",
        ]
      );
    } else if (
      livedExperienceSignal
    ) {
      addCandidate(
        publicationCandidates,
        "testimonial_video",
        0.82,
        [
          "Short-form video contains first-person treatment experience",
        ]
      );

      addCandidate(
        authorCandidates,
        "patient",
        0.68,
        [
          "Authentic first-person short-form experience",
        ]
      );

      addCandidate(
        intentCandidates,
        "personal_experience",
        0.8,
        [
          "First-person treatment experience",
        ]
      );
    } else if (
      clinicSignal
    ) {
      addCandidate(
        publicationCandidates,
        "clinic_social_post",
        0.84,
        [
          "Short-form social account or content indicates a clinic",
        ]
      );

      addCandidate(
        authorCandidates,
        "clinic",
        0.74,
        [
          "Clinic-authored short-form social content",
        ]
      );

      addCandidate(
        intentCandidates,
        "clinic_promotion",
        0.76,
        [
          "Clinic-oriented short-form content",
        ]
      );
    }
  }

  if (
    platformFamily !==
      "not_social" &&
    publicationCandidates.length ===
      0 &&
    publicationType ===
      "social_post"
  ) {
    addCandidate(
      publicationCandidates,
      "social_post",
      0.58,
      [
        "Generic social post fallback",
      ]
    );
  }

  if (isSecondaryVoice) {
    reasons.push(
      "Content is a repost or quote; primary author identity must not be inferred solely from quoted content"
    );
  }

  return {
    sourceName,

    contentType,

    platformFamily,

    isSecondaryVoice,

    authorCandidates,

    intentCandidates,

    publicationCandidates,

    reasons,
  };
}