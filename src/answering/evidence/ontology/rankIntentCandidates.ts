import type {
  CommercialIntentLevel,
  PublicationType,
  ResearchCredibilityResult,
  SocialAuthenticityResult,
} from "../types";
import type {
  IntentRankingDecision,
  OntologyAuthorIdentity,
  OntologyCandidate,
  OntologyCommunicationIntent,
  OntologyPublicationArchetype,
  RankedIntentCandidate,
} from "./types";

export type RankIntentCandidatesParams = {
  candidates:
    OntologyCandidate<OntologyCommunicationIntent>[];

  authorIdentity:
    OntologyAuthorIdentity;

  publicationArchetype:
    OntologyPublicationArchetype;

  publicationType:
    PublicationType;

  commercialIntentLevel:
    CommercialIntentLevel;

  research:
    ResearchCredibilityResult;

  socialAuthenticity:
    SocialAuthenticityResult;

  isSecondaryVoice: boolean;
};

const INTENT_PRECEDENCE: Record<
  OntologyCommunicationIntent,
  number
> = {
  personal_experience: 1,
  caregiver_experience: 1,
  provider_education: 2,
  research_dissemination: 2,
  community_question: 3,
  testimonial: 3,
  patient_education: 4,
  thought_leadership: 4,
  news_reporting: 4,
  advocacy: 4,
  clinic_promotion: 5,
  product_promotion: 5,
  brand_announcement: 5,
  event_promotion: 5,
  commercial_review: 5,
  community_discussion: 6,
  unknown: 7,
};

const MINIMUM_ELIGIBLE_SCORE: Record<
  OntologyCommunicationIntent,
  number
> = {
  personal_experience: 0.28,
  caregiver_experience: 0.24,
  provider_education: 0.3,
  research_dissemination: 0.36,
  community_question: 0.3,
  testimonial: 0.3,
  patient_education: 0.3,
  thought_leadership: 0.3,
  news_reporting: 0.3,
  advocacy: 0.3,
  clinic_promotion: 0.3,
  product_promotion: 0.3,
  brand_announcement: 0.3,
  event_promotion: 0.24,
  commercial_review: 0.3,
  community_discussion: 0.3,
  unknown: 1,
};

const COMMERCIAL_INTENTS = new Set<
  OntologyCommunicationIntent
>([
  "clinic_promotion",
  "product_promotion",
  "brand_announcement",
  "event_promotion",
  "commercial_review",
]);

const VALIDATED_RESEARCH = new Set([
  "peer_reviewed",
  "clinical_trial_registry",
  "government_evidence",
  "medical_society",
]);

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

function consolidateCandidates(
  candidates:
    OntologyCandidate<OntologyCommunicationIntent>[]
): OntologyCandidate<OntologyCommunicationIntent>[] {
  const consolidated = new Map<
    OntologyCommunicationIntent,
    OntologyCandidate<OntologyCommunicationIntent>
  >();

  for (const candidate of candidates) {
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
  );
}

function evaluateEligibility(
  candidate:
    OntologyCandidate<OntologyCommunicationIntent>,
  params:
    RankIntentCandidatesParams
): RankedIntentCandidate {
  const exclusions: string[] = [];
  const value = candidate.value;
  const hasProfessionalProviderContext =
    value === "provider_education" &&
    [
      "provider",
      "researcher",
      "medical_society",
    ].includes(
      params.authorIdentity
    );

  const effectiveMinimumScore =
    hasProfessionalProviderContext
      ? 0.2
      : MINIMUM_ELIGIBLE_SCORE[
          value
        ];

  if (
    candidate.score <
    effectiveMinimumScore
  ) {
    exclusions.push(
      `Score ${candidate.score.toFixed(2)} is below the ${effectiveMinimumScore.toFixed(2)} eligibility threshold`
    );
  }

  if (
    params.isSecondaryVoice &&
    [
      "personal_experience",
      "caregiver_experience",
      "provider_education",
      "testimonial",
      "community_question",
      "community_discussion",
      "thought_leadership",
    ].includes(value)
  ) {
    exclusions.push(
      "Reposts and quotes cannot establish the republisher's primary intent"
    );
  }

  if (
    value === "personal_experience" &&
    ![
      "patient",
      "community_member",
      "unknown",
    ].includes(
      params.authorIdentity
    )
  ) {
    exclusions.push(
      "Personal experience is incompatible with the resolved author identity"
    );
  }

  if (
    value === "personal_experience" &&
    !params.socialAuthenticity
      .hasFirstPersonLanguage &&
    candidate.score < 0.65
  ) {
    exclusions.push(
      "Personal experience lacks first-person evidence"
    );
  }

  if (
    value === "caregiver_experience" &&
    params.authorIdentity !==
      "caregiver"
  ) {
    exclusions.push(
      "Caregiver experience requires a caregiver author identity"
    );
  }

  if (
    value === "provider_education" &&
    ![
      "provider",
      "researcher",
      "medical_society",
    ].includes(
      params.authorIdentity
    ) &&
    candidate.score < 0.65
  ) {
    exclusions.push(
      "Provider education lacks a professional author or strong provider signal"
    );
  }

  if (
    value ===
      "research_dissemination" &&
    !VALIDATED_RESEARCH.has(
      params.research
        .credibility
    ) &&
    candidate.score < 0.55
  ) {
    exclusions.push(
      "Research dissemination lacks validated research-source evidence"
    );
  }

  if (
    value === "news_reporting" &&
    ![
      "news_article",
      "trade_article",
    ].includes(
      params.publicationType
    )
  ) {
    exclusions.push(
      "News reporting requires a news or trade publication type"
    );
  }

  if (
    value === "testimonial" &&
    params.commercialIntentLevel ===
      "high"
  ) {
    exclusions.push(
      "High commercial intent makes a non-commercial testimonial ineligible"
    );
  }

  if (
    value ===
      "community_discussion" &&
    !params.socialAuthenticity
      .isAuthenticConversation
  ) {
    exclusions.push(
      "Community discussion requires authentic conversational evidence"
    );
  }

  if (
    COMMERCIAL_INTENTS.has(
      value
    ) &&
    params.commercialIntentLevel ===
      "none" &&
    ![
      "clinic",
      "brand",
      "retailer",
      "influencer",
      "event_organizer",
    ].includes(
      params.authorIdentity
    ) &&
    ![
      "clinic_page",
      "clinic_social_post",
      "product_page",
      "promotional_video",
      "brand_social_post",
      "influencer_social_post",
      "event_content",
    ].includes(
      params.publicationArchetype
    ) &&
    candidate.score <
      (
        value ===
        "event_promotion"
          ? 0.24
          : 0.4
      )
  ) {
    exclusions.push(
      "Commercial intent lacks commercial source, author, or archetype evidence"
    );
  }

  return {
    ...candidate,

    eligible:
      exclusions.length === 0,

    precedenceTier:
      INTENT_PRECEDENCE[value],

    exclusionReasons:
      exclusions,
  };
}

function calculateConfidence(
  selected:
    RankedIntentCandidate,
  eligible:
    RankedIntentCandidate[]
): number {
  const sameTierRunnerUp =
    eligible.find(
      (candidate) =>
        candidate.value !==
          selected.value &&
        candidate
          .precedenceTier ===
          selected
            .precedenceTier
    );

  const margin =
    selected.score -
    (sameTierRunnerUp
      ?.score || 0);

  return clampScore(
    selected.score * 0.75 +
      Math.max(
        0,
        margin
      ) * 0.25
  );
}

function findCandidate(
  candidates:
    RankedIntentCandidate[],
  value:
    OntologyCommunicationIntent
): RankedIntentCandidate | undefined {
  return candidates.find(
    (candidate) =>
      candidate.value === value &&
      candidate.eligible
  );
}

function syntheticOverride(
  value:
    OntologyCommunicationIntent,
  score: number,
  reason: string
): RankedIntentCandidate {
  return {
    value,

    score,

    reasons: [reason],

    eligible: true,

    precedenceTier:
      INTENT_PRECEDENCE[value],

    exclusionReasons: [],
  };
}

function resolveSemanticOverride(
  ranked:
    RankedIntentCandidate[],
  params:
    RankIntentCandidatesParams
): {
  candidate:
    RankedIntentCandidate;
  reason: string;
} | undefined {
  if (
    params.isSecondaryVoice
  ) {
    return {
      candidate:
        syntheticOverride(
          "unknown",
          0.8,
          "Secondary-voice content does not establish the republisher's intent"
        ),

      reason:
        "Repost or quote secondary-voice safeguard",
    };
  }

  if (
    params.publicationArchetype ===
      "press_release" ||
    params.publicationType ===
      "press_release"
  ) {
    return {
      candidate:
        findCandidate(
          ranked,
          "brand_announcement"
        ) ||
        syntheticOverride(
          "brand_announcement",
          0.9,
          "Press release establishes announcement intent"
        ),

      reason:
        "Press-release semantic override",
    };
  }

  if (
    VALIDATED_RESEARCH.has(
      params.research
        .credibility
    )
  ) {
    return {
      candidate:
        findCandidate(
          ranked,
          "research_dissemination"
        ) ||
        syntheticOverride(
          "research_dissemination",
          Math.max(
            0.8,
            params.research
              .confidence
          ),
          "Validated research source establishes research-dissemination intent"
        ),

      reason:
        "Validated-research semantic override",
    };
  }

  if (
    params.commercialIntentLevel ===
      "high"
  ) {
    const existingCommercial =
      ranked
        .filter(
          (candidate) =>
            candidate.eligible &&
            COMMERCIAL_INTENTS.has(
              candidate.value
            )
        )
        .sort(
          (first, second) =>
            second.score -
            first.score
        )[0];

    let inferredCommercial:
      OntologyCommunicationIntent =
        "commercial_review";

    if (
      params.authorIdentity ===
        "clinic" ||
      [
        "clinic_page",
        "clinic_social_post",
      ].includes(
        params.publicationArchetype
      )
    ) {
      inferredCommercial =
        "clinic_promotion";
    } else if (
      params.authorIdentity ===
        "brand" ||
      params.publicationArchetype ===
        "brand_social_post"
    ) {
      inferredCommercial =
        "brand_announcement";
    } else if (
      params.authorIdentity ===
        "event_organizer" ||
      params.publicationArchetype ===
        "event_content"
    ) {
      inferredCommercial =
        "event_promotion";
    } else if (
      [
        "product_page",
        "promotional_video",
      ].includes(
        params.publicationArchetype
      )
    ) {
      inferredCommercial =
        "product_promotion";
    }

    return {
      candidate:
        existingCommercial ||
        syntheticOverride(
          inferredCommercial,
          0.82,
          "High commercial intent requires a commercial communication intent"
        ),

      reason:
        "High-commercial-intent semantic override",
    };
  }

  const providerEducation =
    findCandidate(
      ranked,
      "provider_education"
    );

  if (
    params.authorIdentity ===
      "provider" &&
    providerEducation
  ) {
    return {
      candidate:
        providerEducation,

      reason:
        "Provider-credential semantic override",
    };
  }

  return undefined;
}

export function rankIntentCandidates(
  params:
    RankIntentCandidatesParams
): IntentRankingDecision {
  const ranked =
    consolidateCandidates(
      params.candidates
    )
      .map(
        (candidate) =>
          evaluateEligibility(
            candidate,
            params
          )
      )
      .sort(
        (first, second) => {
          if (
            first.eligible !==
            second.eligible
          ) {
            return first.eligible
              ? -1
              : 1;
          }

          return (
            first.precedenceTier -
              second.precedenceTier ||
            second.score -
              first.score
          );
        }
      );

  const override =
    resolveSemanticOverride(
      ranked,
      params
    );

  if (override) {
    return {
      value:
        override.candidate
          .value,

      confidence:
        clampScore(
          override.candidate
            .score
        ),

      selectionMethod:
        "semantic_override",

      selectedPrecedenceTier:
        override.candidate
          .precedenceTier,

      overrideReason:
        override.reason,

      selectedReasons:
        override.candidate
          .reasons,

      rankedCandidates:
        ranked,
    };
  }

  const eligible =
    ranked.filter(
      (candidate) =>
        candidate.eligible
    );

  const selected =
    eligible[0];

  if (!selected) {
    return {
      value: "unknown",

      confidence:
        ranked[0]?.score || 0,

      selectionMethod:
        "fallback",

      selectedReasons: [
        "No intent candidate satisfied eligibility requirements",
      ],

      rankedCandidates:
        ranked,
    };
  }

  return {
    value:
      selected.value,

    confidence:
      calculateConfidence(
        selected,
        eligible
      ),

    selectionMethod:
      "precedence",

    selectedPrecedenceTier:
      selected
        .precedenceTier,

    selectedReasons:
      selected.reasons,

    rankedCandidates:
      ranked,
  };
}
