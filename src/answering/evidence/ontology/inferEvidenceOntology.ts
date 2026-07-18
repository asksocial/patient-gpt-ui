import type {
  AuthorVoiceResult,
  CommercialIntentResult,
  DomainClassification,
  EvidenceClass,
  NormalizedEvidenceMetadata,
  PlatformClassification,
  PublicationType,
  ResearchCredibilityResult,
  SocialAuthenticityResult,
} from "../types";
import type {
  EvidenceOntology,
  OntologyAuthorIdentity,
  OntologyAuthorityLevel,
  OntologyCandidate,
  OntologyCommunicationIntent,
  OntologyEvidenceRole,
  OntologyPublicationArchetype,
} from "./types";
import {
  ONTOLOGY_PATTERNS,
} from "./ontologyPatterns";
import {
  classifyPlatformAwareSocialArchetype,
} from "./classifyPlatformAwareSocialArchetype";
import {
  rankIntentCandidates,
} from "./rankIntentCandidates";

type InferEvidenceOntologyParams = {
  metadata:
    NormalizedEvidenceMetadata;

  domain:
    DomainClassification;

  platform:
    PlatformClassification;

  publicationType:
    PublicationType;

  commercialIntent:
    CommercialIntentResult;

  authorVoice:
    AuthorVoiceResult;

  research:
    ResearchCredibilityResult;

  socialAuthenticity:
    SocialAuthenticityResult;
};

function normalizeText(
  value: string
): string {
  return ` ${value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()} `;
}

function countMatches(
  text: string,
  patterns: readonly string[]
): {
  count: number;
  matches: string[];
} {
  const matches =
    patterns.filter(
      (pattern) =>
        text.includes(
          pattern.toLowerCase()
        )
    );

  return {
    count:
      matches.length,

    matches,
  };
}

function clampScore(
  value: number
): number {
  return Number(
    Math.max(
      0,
      Math.min(1, value)
    ).toFixed(2)
  );
}

function consolidateCandidates<
  T extends string
>(
  candidates:
    OntologyCandidate<T>[]
): OntologyCandidate<T>[] {
  const consolidated =
    new Map<
      T,
      OntologyCandidate<T>
    >();

  for (
    const candidate of candidates
  ) {
    const existing =
      consolidated.get(
        candidate.value
      );

    if (!existing) {
      consolidated.set(
        candidate.value,
        {
          value:
            candidate.value,

          score:
            candidate.score,

          reasons:
            [...candidate.reasons],
        }
      );

      continue;
    }

    existing.score =
      Math.max(
        existing.score,
        candidate.score
      );

    existing.reasons =
      Array.from(
        new Set([
          ...existing.reasons,
          ...candidate.reasons,
        ])
      );
  }

  return Array.from(
    consolidated.values()
  ).sort(
    (first, second) =>
      second.score -
      first.score
  );
}

function selectCandidate<
  T extends string
>(
  candidates:
    OntologyCandidate<T>[],
  fallback: T
): {
  value: T;
  confidence: number;
} {
  const sorted =
    consolidateCandidates(
      candidates
    );

  const first =
    sorted[0];

  if (
    !first ||
    first.score < 0.3
  ) {
    return {
      value:
        fallback,

      confidence:
        first?.score || 0,
    };
  }

  const second =
    sorted[1]?.score || 0;

  const margin =
    first.score - second;

  return {
    value:
      first.value,

    confidence:
      clampScore(
        first.score * 0.75 +
          Math.max(
            0,
            margin
          ) *
            0.25
      ),
  };
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
      clampScore(score),

    reasons,
  });
}

function inferAuthorCandidates(
  params:
    InferEvidenceOntologyParams,
  text: string,
  isSecondaryVoice: boolean
): OntologyCandidate<OntologyAuthorIdentity>[] {
  const {
    metadata,
    domain,
    authorVoice,
    research,
    socialAuthenticity,
  } = params;

  const candidates:
    OntologyCandidate<OntologyAuthorIdentity>[] =
      [];

  const persona =
    String(
      metadata.persona || ""
    )
      .toLowerCase()
      .trim();

  const authorContext =
    normalizeText(
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

  const combined =
    `${authorContext} ${text}`;

  const patient =
    countMatches(
      combined,
      ONTOLOGY_PATTERNS
        .patientIdentity
    );

  const personalExperience =
    countMatches(
      text,
      ONTOLOGY_PATTERNS
        .personalExperience
    );

  const caregiver =
    countMatches(
      combined,
      ONTOLOGY_PATTERNS
        .caregiverIdentity
    );

  const provider =
    countMatches(
      combined,
      [
        ...ONTOLOGY_PATTERNS
          .providerIdentity,
        ...ONTOLOGY_PATTERNS
          .providerCredential,
      ]
    );

  const providerLanguage =
    countMatches(
      text,
      ONTOLOGY_PATTERNS
        .providerLanguage
    );

  const researcher =
    countMatches(
      combined,
      ONTOLOGY_PATTERNS
        .researcherIdentity
    );

  const journalist =
    countMatches(
      text,
      ONTOLOGY_PATTERNS
        .journalistLanguage
    );

  const influencer =
    countMatches(
      combined,
      ONTOLOGY_PATTERNS
        .influencer
    );

  const advocacy =
    countMatches(
      combined,
      ONTOLOGY_PATTERNS
        .advocacy
    );

  const hasImplicitPatientExperience =
    !isSecondaryVoice &&
    socialAuthenticity
      .isAuthenticConversation &&
    socialAuthenticity
      .hasFirstPersonLanguage &&
    socialAuthenticity
      .hasLivedExperienceLanguage &&
    personalExperience.count > 0 &&
    params.publicationType !==
      "news_article";

  addCandidate(
    candidates,
    "patient",
    (
      persona === "patient"
        ? 0.65
        : 0
    ) +
      patient.count * 0.12 +
      personalExperience.count *
        0.08 +
      (
        authorVoice.voice ===
          "patient" &&
        !isSecondaryVoice
          ? 0.45
          : 0
      ) +
      (
        hasImplicitPatientExperience
          ? 0.5
          : 0
      ),
    [
      ...patient.matches.map(
        (match) =>
          `Patient signal: ${match}`
      ),

      ...personalExperience.matches.map(
        (match) =>
          `Personal-experience signal: ${match}`
      ),

      ...(hasImplicitPatientExperience
        ? [
            "Authentic first-person lived experience supports inferred patient identity",
          ]
        : []),
    ]
  );

  addCandidate(
    candidates,
    "caregiver",
    (
      persona === "caregiver"
        ? 0.65
        : 0
    ) +
      caregiver.count * 0.12 +
      (
        authorVoice.voice ===
          "caregiver" &&
        !isSecondaryVoice
          ? 0.45
          : 0
      ),
    caregiver.matches.map(
      (match) =>
        `Caregiver signal: ${match}`
    )
  );

  addCandidate(
    candidates,
    "provider",
    (
      [
        "provider",
        "hcp",
        "physician",
        "doctor",
      ].includes(persona)
        ? 0.65
        : 0
    ) +
      provider.count * 0.15 +
      providerLanguage.count *
        0.08 +
      (
        authorVoice.voice ===
        "provider"
          ? 0.45
          : 0
      ),
    [
      ...provider.matches.map(
        (match) =>
          `Provider identity signal: ${match}`
      ),

      ...providerLanguage.matches.map(
        (match) =>
          `Clinical language: ${match}`
      ),
    ]
  );

  addCandidate(
    candidates,
    "researcher",
    researcher.count *
      0.12 +
      (
        authorVoice.voice ===
        "researcher"
          ? 0.5
          : 0
      ) +
      (
        research.credibility ===
        "peer_reviewed"
          ? 0.45
          : 0
      ),
    researcher.matches.map(
      (match) =>
        `Researcher signal: ${match}`
    )
  );

  addCandidate(
    candidates,
    "journalist",
    journalist.count *
      0.1 +
      (
        authorVoice.voice ===
        "journalist"
          ? 0.55
          : 0
      ) +
      (
        params.publicationType ===
        "news_article"
          ? 0.4
          : 0
      ),
    journalist.matches.map(
      (match) =>
        `Journalistic signal: ${match}`
    )
  );

  addCandidate(
    candidates,
    "advocacy_organization",
    advocacy.count *
      0.15 +
      (
        authorVoice.voice ===
        "advocacy"
          ? 0.55
          : 0
      ) +
      (
        domain.category ===
        "advocacy"
          ? 0.5
          : 0
      ),
    advocacy.matches.map(
      (match) =>
        `Advocacy signal: ${match}`
    )
  );

  addCandidate(
    candidates,
    "government",
    domain.category ===
      "government"
      ? 0.9
      : 0,
    [
      "Government-domain classification",
    ]
  );

  addCandidate(
    candidates,
    "medical_society",
    domain.category ===
      "medical_society"
      ? 0.9
      : 0,
    [
      "Medical-society domain classification",
    ]
  );

  const clinic =
    countMatches(
      combined,
      ONTOLOGY_PATTERNS
        .clinicAccount
    );

  addCandidate(
    candidates,
    "clinic",
    clinic.count * 0.15 +
      (
        authorVoice.voice ===
        "clinic"
          ? 0.65
          : 0
      ),
    clinic.matches.map(
      (match) =>
        `Clinic signal: ${match}`
    )
  );

  addCandidate(
    candidates,
    "influencer",
    influencer.count *
      0.14 +
      (
        authorVoice.voice ===
        "influencer"
          ? 0.65
          : 0
      ) +
      (
        socialAuthenticity
          .isLikelyInfluencer
          ? 0.5
          : 0
      ),
    influencer.matches.map(
      (match) =>
        `Influencer signal: ${match}`
    )
  );

  const brand =
    countMatches(
      combined,
      ONTOLOGY_PATTERNS
        .brandAccount
    );

  addCandidate(
    candidates,
    "brand",
    brand.count * 0.1 +
      (
        authorVoice.voice ===
        "corporate"
          ? 0.65
          : 0
      ) +
      (
        params.publicationType ===
        "press_release"
          ? 0.5
          : 0
      ),
    brand.matches.map(
      (match) =>
        `Brand signal: ${match}`
    )
  );

  let communityScore =
    socialAuthenticity
      .isAuthenticConversation
      ? Math.max(
          0.42,
          socialAuthenticity.score *
            0.75
        )
      : 0;

  if (
    hasImplicitPatientExperience
  ) {
    communityScore =
      Math.min(
        communityScore,
        0.42
      );
  }

  addCandidate(
    candidates,
    "community_member",
    communityScore,
    [
      "Authentic social conversation detected",
    ]
  );

  return consolidateCandidates(
    candidates
  );
}

function inferIntentCandidates(
  params:
    InferEvidenceOntologyParams,
  text: string
): OntologyCandidate<OntologyCommunicationIntent>[] {
  const candidates:
    OntologyCandidate<OntologyCommunicationIntent>[] =
      [];

  const rules: Array<{
    value:
      OntologyCommunicationIntent;

    patterns:
      readonly string[];

    weight: number;
  }> = [
    {
      value:
        "personal_experience",

      patterns:
        ONTOLOGY_PATTERNS
          .personalExperience,

      weight:
        0.14,
    },
    {
      value:
        "caregiver_experience",

      patterns:
        ONTOLOGY_PATTERNS
          .caregiverIdentity,

      weight:
        0.12,
    },
    {
      value:
        "community_question",

      patterns:
        ONTOLOGY_PATTERNS
          .communityQuestion,

      weight:
        0.15,
    },
    {
      value:
        "provider_education",

      patterns:
        ONTOLOGY_PATTERNS
          .providerEducation,

      weight:
        0.1,
    },
    {
      value:
        "patient_education",

      patterns:
        ONTOLOGY_PATTERNS
          .patientEducation,

      weight:
        0.1,
    },
    {
      value:
        "research_dissemination",

      patterns:
        ONTOLOGY_PATTERNS
          .researchDissemination,

      weight:
        0.12,
    },
    {
      value:
        "clinic_promotion",

      patterns:
        ONTOLOGY_PATTERNS
          .clinicPromotion,

      weight:
        0.12,
    },
    {
      value:
        "product_promotion",

      patterns:
        ONTOLOGY_PATTERNS
          .productPromotion,

      weight:
        0.11,
    },
    {
      value:
        "brand_announcement",

      patterns:
        ONTOLOGY_PATTERNS
          .brandAnnouncement,

      weight:
        0.13,
    },
    {
      value:
        "event_promotion",

      patterns: [
        ...ONTOLOGY_PATTERNS
          .eventPromotion,
        ...ONTOLOGY_PATTERNS
          .eventRecap,
      ],

      weight:
        0.12,
    },
    {
      value:
        "testimonial",

      patterns: [
        ...ONTOLOGY_PATTERNS
          .testimonial,
        ...ONTOLOGY_PATTERNS
          .recommendation,
      ],

      weight:
        0.12,
    },
    {
      value:
        "thought_leadership",

      patterns:
        ONTOLOGY_PATTERNS
          .thoughtLeadership,

      weight:
        0.12,
    },
    {
      value:
        "advocacy",

      patterns:
        ONTOLOGY_PATTERNS
          .advocacy,

      weight:
        0.15,
    },
  ];

  for (const rule of rules) {
    const result =
      countMatches(
        text,
        rule.patterns
      );

    addCandidate(
      candidates,
      rule.value,
      result.count *
        rule.weight,
      result.matches.map(
        (match) =>
          `${rule.value} signal: ${match}`
      )
    );
  }

  if (
    params.socialAuthenticity
      .isAuthenticConversation
  ) {
    addCandidate(
      candidates,
      "community_discussion",
      0.55,
      [
        "Authentic social discussion detected",
      ]
    );
  }

  if (
    params.publicationType ===
    "news_article"
  ) {
    addCandidate(
      candidates,
      "news_reporting",
      0.75,
      [
        "Publication classified as news article",
      ]
    );
  }

  return consolidateCandidates(
    candidates
  );
}

function inferPublicationCandidates(
  params:
    InferEvidenceOntologyParams
): OntologyCandidate<OntologyPublicationArchetype>[] {
  const candidates:
    OntologyCandidate<OntologyPublicationArchetype>[] =
      [];

  if (
    params.publicationType ===
    "social_post"
  ) {
    addCandidate(
      candidates,
      "social_post",
      0.55,
      [
        "Source publication type is social post",
      ]
    );

    if (
      params.authorVoice.voice ===
      "provider"
    ) {
      addCandidate(
        candidates,
        "provider_social_post",
        0.85,
        [
          "Provider-authored social post",
        ]
      );
    }

    if (
      params.authorVoice.voice ===
      "clinic"
    ) {
      addCandidate(
        candidates,
        "clinic_social_post",
        0.85,
        [
          "Clinic-authored social post",
        ]
      );
    }

    if (
      params.authorVoice.voice ===
      "corporate"
    ) {
      addCandidate(
        candidates,
        "brand_social_post",
        0.85,
        [
          "Brand-authored social post",
        ]
      );
    }
  }

  if (
    params.publicationType ===
    "forum_post"
  ) {
    addCandidate(
      candidates,
      "forum_post",
      0.9,
      [
        "Publication classified as forum post",
      ]
    );
  }

  if (
    params.publicationType ===
    "review"
  ) {
    addCandidate(
      candidates,
      "community_review",
      0.85,
      [
        "Publication classified as review",
      ]
    );
  }

  if (
    params.publicationType ===
    "video"
  ) {
    addCandidate(
      candidates,
      "educational_video",
      0.6,
      [
        "Generic video fallback",
      ]
    );
  }

  const directMappings: Partial<
    Record<
      PublicationType,
      OntologyPublicationArchetype
    >
  > = {
    podcast:
      "podcast_episode",

    news_article:
      "news_article",

    trade_article:
      "trade_article",

    journal_article:
      "journal_article",

    clinical_trial_record:
      "clinical_trial_record",

    government_document:
      "government_document",

    medical_society_content:
      "medical_society_content",

    press_release:
      "press_release",

    clinic_page:
      "clinic_page",

    product_page:
      "product_page",

    conference_content:
      "event_content",

    blog_post:
      "blog_post",
  };

  const mapped =
    directMappings[
      params.publicationType
    ];

  if (mapped) {
    addCandidate(
      candidates,
      mapped,
      0.9,
      [
        `Mapped from publication type: ${params.publicationType}`,
      ]
    );
  }

  return consolidateCandidates(
    candidates
  );
}

function deriveAuthorityLevel(
  author:
    OntologyAuthorIdentity,
  intent:
    OntologyCommunicationIntent,
  research:
    ResearchCredibilityResult
): OntologyAuthorityLevel {
  if (
    [
      "peer_reviewed",
      "clinical_trial_registry",
      "government_evidence",
      "medical_society",
    ].includes(
      research.credibility
    )
  ) {
    return "authoritative";
  }

  if (
    [
      "provider",
      "researcher",
      "medical_society",
      "government",
    ].includes(author)
  ) {
    return "professional";
  }

  if (
    [
      "patient",
      "caregiver",
    ].includes(author)
  ) {
    return "lived_experience";
  }

  if (
    author ===
    "community_member"
  ) {
    return "community";
  }

  if (
    [
      "journalist",
      "advocacy_organization",
    ].includes(author)
  ) {
    return "editorial";
  }

  if (
    [
      "clinic",
      "brand",
      "retailer",
      "influencer",
      "event_organizer",
    ].includes(author) ||
    [
      "clinic_promotion",
      "product_promotion",
      "brand_announcement",
      "event_promotion",
      "commercial_review",
    ].includes(intent)
  ) {
    return "commercial";
  }

  return "unknown";
}

function deriveEvidenceRole(
  author:
    OntologyAuthorIdentity,
  intent:
    OntologyCommunicationIntent,
  authority:
    OntologyAuthorityLevel
): OntologyEvidenceRole {
  if (
    [
      "personal_experience",
      "caregiver_experience",
      "testimonial",
    ].includes(intent) &&
    [
      "patient",
      "caregiver",
    ].includes(author)
  ) {
    return "primary_experience";
  }

  if (
    [
      "provider_education",
      "patient_education",
      "thought_leadership",
    ].includes(intent) &&
    authority ===
      "professional"
  ) {
    return "professional_interpretation";
  }

  if (
    intent ===
    "research_dissemination"
  ) {
    return "research_evidence";
  }

  if (
    [
      "government",
      "medical_society",
    ].includes(author)
  ) {
    return "regulatory_evidence";
  }

  if (
    [
      "community_question",
      "community_discussion",
    ].includes(intent)
  ) {
    return "community_signal";
  }

  if (
    [
      "news_reporting",
      "advocacy",
    ].includes(intent)
  ) {
    return "market_context";
  }

  if (
    [
      "clinic_promotion",
      "product_promotion",
      "brand_announcement",
      "event_promotion",
      "commercial_review",
    ].includes(intent)
  ) {
    return "commercial_signal";
  }

  return "noise_or_low_trust";
}

function deriveEvidenceClass(
  author:
    OntologyAuthorIdentity,
  intent:
    OntologyCommunicationIntent,
  archetype:
    OntologyPublicationArchetype,
  params:
    InferEvidenceOntologyParams,
  isSecondaryVoice: boolean
): EvidenceClass {
  const {
    research,
    commercialIntent,
    socialAuthenticity,
    domain,
  } = params;

  if (
    archetype ===
    "press_release"
  ) {
    return "corporate_pr";
  }

  if (
    archetype ===
      "product_page" ||
    author === "retailer" ||
    intent ===
      "product_promotion"
  ) {
    return "retail_or_product";
  }

  if (
    author === "influencer" ||
    archetype ===
      "influencer_social_post"
  ) {
    return "influencer_content";
  }

  if (
    author === "clinic" ||
    archetype ===
      "clinic_page" ||
    archetype ===
      "clinic_social_post" ||
    intent ===
      "clinic_promotion"
  ) {
    return "clinic_marketing";
  }

  if (
    intent ===
      "event_promotion" ||
    archetype ===
      "event_content"
  ) {
    return "event_or_conference";
  }

  if (
    intent ===
      "brand_announcement" ||
    archetype ===
      "brand_social_post"
  ) {
    return commercialIntent.level ===
      "high"
      ? "sponsored_content"
      : "corporate_pr";
  }

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

  if (
    author === "provider"
  ) {
    return "provider_conversation";
  }

  if (
    !isSecondaryVoice &&
    author === "patient" &&
    [
      "personal_experience",
      "testimonial",
      "community_discussion",
    ].includes(intent)
  ) {
    return archetype ===
      "testimonial_video"
      ? "youtube_review"
      : "patient_conversation";
  }

  if (
    !isSecondaryVoice &&
    author === "caregiver"
  ) {
    return "caregiver_conversation";
  }

  if (
    author ===
    "advocacy_organization"
  ) {
    return "advocacy_organization";
  }

  if (
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
    archetype ===
    "news_article"
  ) {
    return "consumer_news";
  }

  if (
    archetype ===
    "podcast_episode"
  ) {
    return "podcast";
  }

  if (
    archetype ===
    "blog_post"
  ) {
    return "personal_blog";
  }

  if (
    archetype ===
    "forum_post"
  ) {
    return socialAuthenticity
      .isAuthenticConversation
      ? "community_conversation"
      : "forum";
  }

  if (
    archetype ===
    "testimonial_video"
  ) {
    return "youtube_review";
  }

  if (
    [
      "social_reply",
      "social_comment",
    ].includes(archetype) &&
    [
      "community_question",
      "community_discussion",
    ].includes(intent)
  ) {
    return "community_conversation";
  }

  if (
    archetype ===
      "social_repost" ||
    archetype ===
      "social_quote"
  ) {
    return "unknown";
  }

  if (
    author ===
      "community_member" &&
    [
      "community_question",
      "community_discussion",
      "testimonial",
    ].includes(intent) &&
    socialAuthenticity
      .isAuthenticConversation
  ) {
    return "community_conversation";
  }

  return "unknown";
}

export function inferEvidenceOntology(
  params:
    InferEvidenceOntologyParams
): EvidenceOntology {
  const text =
    normalizeText(
      params.metadata.fullText
    );

  const platformLayer =
    classifyPlatformAwareSocialArchetype({
      metadata:
        params.metadata,

      publicationType:
        params.publicationType,

      socialAuthenticity:
        params.socialAuthenticity,

      commercialIntentLevel:
        params.commercialIntent
          .level,
    });

  const authorCandidates =
    consolidateCandidates([
      ...inferAuthorCandidates(
        params,
        text,
        platformLayer
          .isSecondaryVoice
      ),

      ...platformLayer
        .authorCandidates,
    ]);

  const intentCandidates =
    consolidateCandidates([
      ...inferIntentCandidates(
        params,
        text
      ),

      ...platformLayer
        .intentCandidates,
    ]);

  const publicationCandidates =
    consolidateCandidates([
      ...inferPublicationCandidates(
        params
      ),

      ...platformLayer
        .publicationCandidates,
    ]);

  const selectedAuthor =
    selectCandidate(
      authorCandidates,
      "unknown"
    );

  const selectedPublication =
    selectCandidate(
      publicationCandidates,
      "unknown"
    );

  const intentRanking =
    rankIntentCandidates({
      candidates:
        intentCandidates,

      authorIdentity:
        selectedAuthor.value,

      publicationArchetype:
        selectedPublication.value,

      publicationType:
        params.publicationType,

      commercialIntentLevel:
        params.commercialIntent
          .level,

      research:
        params.research,

      socialAuthenticity:
        params.socialAuthenticity,

      isSecondaryVoice:
        platformLayer
          .isSecondaryVoice,
    });

  const selectedIntent = {
    value:
      intentRanking.value,

    confidence:
      intentRanking.confidence,
  };

  const authorityLevel =
    deriveAuthorityLevel(
      selectedAuthor.value,
      selectedIntent.value,
      params.research
    );

  const evidenceRole =
    deriveEvidenceRole(
      selectedAuthor.value,
      selectedIntent.value,
      authorityLevel
    );

  const derivedEvidenceClass =
    deriveEvidenceClass(
      selectedAuthor.value,
      selectedIntent.value,
      selectedPublication.value,
      params,
      platformLayer
        .isSecondaryVoice
    );

  const overallConfidence =
    clampScore(
      selectedAuthor.confidence *
        0.35 +
        selectedIntent.confidence *
          0.35 +
        selectedPublication.confidence *
          0.2 +
        params.socialAuthenticity
          .score *
          0.1
    );

  return {
    authorIdentity:
      selectedAuthor.value,

    communicationIntent:
      selectedIntent.value,

    publicationArchetype:
      selectedPublication.value,

    authorityLevel,

    evidenceRole,

    commercialIntent:
      params.commercialIntent
        .level,

    researchCredibility:
      params.research
        .credibility,

    sourcePublicationType:
      params.publicationType,

    derivedEvidenceClass,

    platformFamily:
      platformLayer
        .platformFamily,

    isSecondaryVoice:
      platformLayer
        .isSecondaryVoice,

    authorIdentityConfidence:
      selectedAuthor.confidence,

    communicationIntentConfidence:
      selectedIntent.confidence,

    intentRanking,

    publicationArchetypeConfidence:
      selectedPublication.confidence,

    overallConfidence,

    authorCandidates,

    intentCandidates,

    publicationCandidates,

    reasons: [
      ...(
        authorCandidates[0]
          ?.reasons || []
      ),

      ...intentRanking
        .selectedReasons,

      `Intent selected by ${intentRanking.selectionMethod}`,

      ...(intentRanking
        .overrideReason
        ? [
            `Intent override: ${intentRanking.overrideReason}`,
          ]
        : []),

      ...(
        publicationCandidates[0]
          ?.reasons || []
      ),

      ...platformLayer.reasons,

      `Derived authority level: ${authorityLevel}`,

      `Derived evidence role: ${evidenceRole}`,

      `Derived evidence class: ${derivedEvidenceClass}`,
    ],
  };
}
