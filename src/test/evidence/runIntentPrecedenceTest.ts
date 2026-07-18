import type {
  CommercialIntentLevel,
  PublicationType,
  ResearchCredibility,
} from "../../answering/evidence/types";
import {
  rankIntentCandidates,
} from "../../answering/evidence/ontology";
import type {
  OntologyAuthorIdentity,
  OntologyCandidate,
  OntologyCommunicationIntent,
  OntologyPublicationArchetype,
} from "../../answering/evidence/ontology";

type Scenario = {
  name: string;
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
  researchCredibility:
    ResearchCredibility;
  researchConfidence?: number;
  authentic?: boolean;
  firstPerson?: boolean;
  livedExperience?: boolean;
  isSecondaryVoice?: boolean;
  expected:
    OntologyCommunicationIntent;
};

function candidate(
  value:
    OntologyCommunicationIntent,
  score: number
): OntologyCandidate<OntologyCommunicationIntent> {
  return {
    value,
    score,
    reasons: [
      `Synthetic ${value} signal`,
    ],
  };
}

const scenarios: Scenario[] = [
  {
    name:
      "specific lived experience beats generic discussion",
    candidates: [
      candidate(
        "personal_experience",
        0.42
      ),
      candidate(
        "community_discussion",
        0.55
      ),
    ],
    authorIdentity: "patient",
    publicationArchetype:
      "social_post",
    publicationType: "social_post",
    commercialIntentLevel: "none",
    researchCredibility:
      "not_research",
    authentic: true,
    firstPerson: true,
    livedExperience: true,
    expected:
      "personal_experience",
  },
  {
    name:
      "provider education beats generic discussion",
    candidates: [
      candidate(
        "provider_education",
        0.4
      ),
      candidate(
        "community_discussion",
        0.72
      ),
    ],
    authorIdentity: "provider",
    publicationArchetype:
      "provider_social_post",
    publicationType: "social_post",
    commercialIntentLevel: "none",
    researchCredibility:
      "not_research",
    authentic: true,
    expected:
      "provider_education",
  },
  {
    name:
      "high commercial intent overrides personal language",
    candidates: [
      candidate(
        "personal_experience",
        0.7
      ),
      candidate(
        "commercial_review",
        0.5
      ),
    ],
    authorIdentity: "influencer",
    publicationArchetype:
      "influencer_social_post",
    publicationType: "social_post",
    commercialIntentLevel: "high",
    researchCredibility:
      "not_research",
    authentic: true,
    firstPerson: true,
    expected:
      "commercial_review",
  },
  {
    name:
      "validated research source overrides incidental commercial language",
    candidates: [
      candidate(
        "product_promotion",
        0.8
      ),
      candidate(
        "research_dissemination",
        0.48
      ),
    ],
    authorIdentity: "researcher",
    publicationArchetype:
      "journal_article",
    publicationType:
      "journal_article",
    commercialIntentLevel: "high",
    researchCredibility:
      "peer_reviewed",
    researchConfidence: 0.9,
    expected:
      "research_dissemination",
  },
  {
    name:
      "secondary voice safeguard prevents primary intent inference",
    candidates: [
      candidate(
        "personal_experience",
        0.9
      ),
      candidate(
        "community_discussion",
        0.7
      ),
    ],
    authorIdentity: "unknown",
    publicationArchetype:
      "social_repost",
    publicationType: "social_post",
    commercialIntentLevel: "none",
    researchCredibility:
      "not_research",
    authentic: true,
    firstPerson: true,
    livedExperience: true,
    isSecondaryVoice: true,
    expected: "unknown",
  },
  {
    name:
      "press release establishes brand announcement intent",
    candidates: [
      candidate(
        "news_reporting",
        0.75
      ),
    ],
    authorIdentity: "brand",
    publicationArchetype:
      "press_release",
    publicationType:
      "press_release",
    commercialIntentLevel:
      "moderate",
    researchCredibility:
      "not_research",
    expected:
      "brand_announcement",
  },
  {
    name:
      "generic discussion remains the eligible fallback",
    candidates: [
      candidate(
        "community_discussion",
        0.55
      ),
    ],
    authorIdentity:
      "community_member",
    publicationArchetype:
      "social_post",
    publicationType: "social_post",
    commercialIntentLevel: "none",
    researchCredibility:
      "not_research",
    authentic: true,
    expected:
      "community_discussion",
  },
];

const output =
  scenarios.map(
    (scenario) => {
      const decision =
        rankIntentCandidates({
          candidates:
            scenario.candidates,
          authorIdentity:
            scenario.authorIdentity,
          publicationArchetype:
            scenario.publicationArchetype,
          publicationType:
            scenario.publicationType,
          commercialIntentLevel:
            scenario
              .commercialIntentLevel,
          research: {
            credibility:
              scenario
                .researchCredibility,
            confidence:
              scenario
                .researchConfidence ??
              0.8,
            reasons: [],
          },
          socialAuthenticity: {
            isSocialCompatible: true,
            isAuthenticConversation:
              scenario.authentic ??
              false,
            isLikelyPromotional:
              scenario
                .commercialIntentLevel ===
              "high",
            isLikelyInfluencer:
              scenario.authorIdentity ===
              "influencer",
            hasFirstPersonLanguage:
              scenario.firstPerson ??
              false,
            hasLivedExperienceLanguage:
              scenario
                .livedExperience ??
              false,
            hasQuestionOrDiscussionLanguage:
              scenario.authentic ??
              false,
            hasClinicalDiscussionLanguage:
              scenario.authorIdentity ===
              "provider",
            score:
              scenario.authentic
                ? 0.8
                : 0.2,
            reasons: [],
          },
          isSecondaryVoice:
            scenario
              .isSecondaryVoice ??
            false,
        });

      if (
        decision.value !==
        scenario.expected
      ) {
        throw new Error(
          `${scenario.name}: expected ${scenario.expected}, received ${decision.value}`
        );
      }

      return {
        scenario:
          scenario.name,
        selectedIntent:
          decision.value,
        selectionMethod:
          decision
            .selectionMethod,
        precedenceTier:
          decision
            .selectedPrecedenceTier,
        overrideReason:
          decision
            .overrideReason,
      };
    }
  );

console.log(
  JSON.stringify(
    output,
    null,
    2
  )
);
