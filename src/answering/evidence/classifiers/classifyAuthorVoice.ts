import {
  ADVOCACY_PATTERNS,
  CAREGIVER_PATTERNS,
  JOURNALIST_PATTERNS,
  LIVED_EXPERIENCE_PATTERNS,
  PATIENT_IDENTITY_PATTERNS,
  PROVIDER_CLINICAL_PATTERNS,
  PROVIDER_IDENTITY_PATTERNS,
} from "../config/classificationPatterns";
import type {
  AuthorVoiceResult,
  CommercialIntentResult,
  NormalizedEvidenceMetadata,
  PublicationType,
  SocialAuthenticityResult,
} from "../types";

const PROVIDER_CREDENTIAL_PATTERNS = [
  "md",
  "m.d.",
  "do",
  "d.o.",
  "mbbs",
  "phd",
  "ph.d.",
  "rn",
  "r.n.",
  "np",
  "pa-c",
  "dermatologist",
  "physician",
  "doctor",
  "surgeon",
  "plastic surgeon",
  "nurse",
  "nurse practitioner",
  "injector",
  "aesthetician",
  "esthetician",
  "clinician",
  "medical director",
  "board-certified",
  "board certified",
];

const CLINIC_ACCOUNT_PATTERNS = [
  "clinic",
  "medspa",
  "med spa",
  "medical spa",
  "aesthetics clinic",
  "aesthetic clinic",
  "dermatology",
  "plastic surgery",
  "cosmetic surgery",
  "skin clinic",
  "wellness clinic",
  "laser clinic",
];

const CORPORATE_ACCOUNT_PATTERNS = [
  "inc.",
  "inc ",
  "llc",
  "ltd",
  "limited",
  "corporation",
  "company",
  "official",
  "global",
  "pharmaceutical",
  "pharma",
  "biotech",
  "laboratories",
  "labs",
];

const INFLUENCER_ACCOUNT_PATTERNS = [
  "creator",
  "content creator",
  "influencer",
  "beauty blogger",
  "skincare blogger",
  "lifestyle blogger",
  "ambassador",
  "affiliate",
  "collabs",
  "collaboration",
  "dm for collabs",
  "link in bio",
];

function normalizeText(
  value?: string
): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(
  text: string,
  patterns: string[]
): boolean {
  return patterns.some(
    (pattern) =>
      text.includes(
        pattern.toLowerCase()
      )
  );
}

function isPersonalVoiceCompatible(
  publicationType:
    PublicationType
): boolean {
  return [
    "social_post",
    "forum_post",
    "review",
    "blog_post",
    "video",
    "podcast",
  ].includes(
    publicationType
  );
}

function buildAuthorContext(
  metadata:
    NormalizedEvidenceMetadata
): string {
  return normalizeText(
    [
      metadata.author,
      metadata.authorHandle,
      metadata.authorBio,
      metadata.publication,
      metadata.sourceName,
      metadata.contentType,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function classifyAuthorVoice(
  metadata:
    NormalizedEvidenceMetadata,
  publicationType:
    PublicationType,
  commercialIntent:
    CommercialIntentResult,
  socialAuthenticity:
    SocialAuthenticityResult
): AuthorVoiceResult {
  const text =
    normalizeText(
      metadata.fullText
    );

  const authorContext =
    buildAuthorContext(
      metadata
    );

  const combinedContext =
    `${authorContext} ${text}`
      .trim();

  const persona =
    metadata.persona
      ?.toLowerCase()
      .trim();

  if (
    publicationType ===
    "press_release"
  ) {
    return {
      voice:
        "corporate",

      confidence:
        0.98,

      reasons: [
        "Publication is classified as a press release",
      ],
    };
  }

  if (
    publicationType ===
    "product_page"
  ) {
    return {
      voice:
        "retail",

      confidence:
        0.95,

      reasons: [
        "Retail or product-page publication",
      ],
    };
  }

  const authorLooksLikeClinic =
    includesAny(
      authorContext,
      CLINIC_ACCOUNT_PATTERNS
    );

  if (
    publicationType ===
      "clinic_page" ||
    (
      authorLooksLikeClinic &&
      commercialIntent.level !==
        "none"
    ) ||
    (
      commercialIntent.level ===
        "high" &&
      text.includes("clinic")
    )
  ) {
    return {
      voice:
        "clinic",

      confidence:
        authorLooksLikeClinic
          ? 0.94
          : 0.9,

      reasons: [
        ...(authorLooksLikeClinic
          ? [
              "Author or source metadata indicates a clinic account",
            ]
          : []),

        "Clinic content with commercial intent",
      ],
    };
  }

  const authorLooksLikeInfluencer =
    includesAny(
      authorContext,
      INFLUENCER_ACCOUNT_PATTERNS
    );

  if (
    socialAuthenticity
      .isLikelyInfluencer ||
    authorLooksLikeInfluencer
  ) {
    return {
      voice:
        "influencer",

      confidence:
        authorLooksLikeInfluencer
          ? 0.9
          : 0.85,

      reasons: [
        ...(authorLooksLikeInfluencer
          ? [
              "Author biography or account metadata indicates creator or influencer activity",
            ]
          : []),

        ...(socialAuthenticity
          .isLikelyInfluencer
          ? [
              "Influencer, affiliate, or sponsored language detected",
            ]
          : []),
      ],
    };
  }

  const authorLooksLikeProvider =
    includesAny(
      authorContext,
      PROVIDER_CREDENTIAL_PATTERNS
    );

  const providerIdentity =
    persona === "provider" ||
    persona === "hcp" ||
    authorLooksLikeProvider ||
    includesAny(
      combinedContext,
      PROVIDER_IDENTITY_PATTERNS
    );

  const clinicalLanguage =
    includesAny(
      combinedContext,
      PROVIDER_CLINICAL_PATTERNS
    );

  if (
    providerIdentity &&
    clinicalLanguage &&
    commercialIntent.level !==
      "high"
  ) {
    return {
      voice:
        "provider",

      confidence:
        authorLooksLikeProvider
          ? 0.95
          : 0.92,

      reasons: [
        ...(authorLooksLikeProvider
          ? [
              "Author metadata contains a professional healthcare credential or role",
            ]
          : []),

        "Professional identity signal",

        "Clinical or patient-care language",
      ],
    };
  }

  /**
   * Provider metadata can establish provider voice even
   * when the post itself is brief, provided the content is
   * not strongly commercial.
   */
  if (
    authorLooksLikeProvider &&
    commercialIntent.level ===
      "none" &&
    isPersonalVoiceCompatible(
      publicationType
    )
  ) {
    return {
      voice:
        "provider",

      confidence:
        0.86,

      reasons: [
        "Author metadata contains a professional healthcare credential or role",

        "Publication format supports provider-authored commentary",

        "No strong commercial signal detected",
      ],
    };
  }

  if (
    includesAny(
      combinedContext,
      CAREGIVER_PATTERNS
    ) &&
    commercialIntent.level !==
      "high"
  ) {
    return {
      voice:
        "caregiver",

      confidence:
        0.88,

      reasons: [
        "Caregiver identity or family-care language",
      ],
    };
  }

  const explicitPatientIdentity =
    persona === "patient" ||
    includesAny(
      combinedContext,
      PATIENT_IDENTITY_PATTERNS
    );

  const livedExperience =
    includesAny(
      text,
      LIVED_EXPERIENCE_PATTERNS
    );

  if (
    explicitPatientIdentity &&
    livedExperience &&
    commercialIntent.level !==
      "high" &&
    isPersonalVoiceCompatible(
      publicationType
    )
  ) {
    return {
      voice:
        "patient",

      confidence:
        0.9,

      reasons: [
        "Patient identity signal",

        "Lived-experience language",

        "Publication type supports personal voice",
      ],
    };
  }

  if (
    socialAuthenticity
      .isAuthenticConversation &&
    socialAuthenticity
      .hasLivedExperienceLanguage &&
    socialAuthenticity
      .hasFirstPersonLanguage &&
    isPersonalVoiceCompatible(
      publicationType
    )
  ) {
    return {
      voice:
        "patient",

      confidence:
        0.78,

      reasons: [
        "Authentic social conversation",

        "First-person lived-experience language",

        "No strong promotional signal",
      ],
    };
  }

  if (
    includesAny(
      combinedContext,
      ADVOCACY_PATTERNS
    )
  ) {
    return {
      voice:
        "advocacy",

      confidence:
        0.82,

      reasons: [
        "Patient-advocacy organization language",
      ],
    };
  }

  if (
    publicationType ===
      "journal_article" ||
    publicationType ===
      "clinical_trial_record"
  ) {
    return {
      voice:
        "researcher",

      confidence:
        0.9,

      reasons: [
        "Research-oriented publication type",
      ],
    };
  }

  if (
    publicationType ===
      "news_article" ||
    publicationType ===
      "trade_article" ||
    includesAny(
      text,
      JOURNALIST_PATTERNS
    )
  ) {
    return {
      voice:
        "journalist",

      confidence:
        0.8,

      reasons: [
        "News or reporting publication structure",
      ],
    };
  }

  const authorLooksCorporate =
    includesAny(
      authorContext,
      CORPORATE_ACCOUNT_PATTERNS
    );

  if (
    authorLooksCorporate &&
    commercialIntent.level !==
      "none"
  ) {
    return {
      voice:
        "corporate",

      confidence:
        0.82,

      reasons: [
        "Author or source metadata indicates a corporate account",

        "Commercial or announcement-oriented signal detected",
      ],
    };
  }

  if (
    socialAuthenticity
      .isAuthenticConversation
  ) {
    return {
      voice:
        "community",

      confidence:
        Math.max(
          0.6,
          socialAuthenticity.score
        ),

      reasons: [
        "Authentic non-promotional social discussion",

        "Specific patient or provider identity not established",
      ],
    };
  }

  return {
    voice:
      "unknown",

    confidence:
      0.25,

    reasons: [
      metadata.author ||
      metadata.authorHandle
        ? "Author metadata exists, but it does not establish a reliable voice category"
        : "No reliable author-voice classification",
    ],
  };
}