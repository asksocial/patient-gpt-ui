import type {
  CanonicalFinding,
} from "../models/finding";
import {
  classifyAuthorVoice,
} from "./classifiers/classifyAuthorVoice";
import {
  classifyCommercialIntent,
} from "./classifiers/classifyCommercialIntent";
import {
  classifyDomain,
} from "./classifiers/classifyDomain";
import {
  classifyPlatform,
} from "./classifiers/classifyPlatform";
import {
  classifyPublicationType,
} from "./classifiers/classifyPublicationType";
import {
  classifyResearchCredibility,
} from "./classifiers/classifyResearchCredibility";
import {
  classifySocialAuthenticity,
} from "./classifiers/classifySocialAuthenticity";
import {
  normalizeEvidenceMetadata,
} from "./normalizeEvidenceMetadata";
import {
  scoreEvidenceQuality,
} from "./scoreEvidenceQuality";
import {
  inferEvidenceOntology,
} from "./ontology";
import type {
  EvidenceIntelligence,
} from "./types";

export function analyzeEvidence(
  finding: CanonicalFinding
): EvidenceIntelligence {
  const metadata =
    normalizeEvidenceMetadata(
      finding
    );

  const domain =
    classifyDomain(metadata);

  const platform =
    classifyPlatform(metadata);

  const commercialIntent =
    classifyCommercialIntent(
      metadata
    );

  const publicationType =
    classifyPublicationType(
      metadata,
      domain,
      platform,
      commercialIntent
    );

  const socialAuthenticity =
    classifySocialAuthenticity(
      metadata,
      publicationType,
      commercialIntent
    );

  const authorVoice =
    classifyAuthorVoice(
      metadata,
      publicationType,
      commercialIntent,
      socialAuthenticity
    );

  const research =
    classifyResearchCredibility(
      metadata,
      domain,
      publicationType
    );

  const ontology =
    inferEvidenceOntology({
      metadata,
      domain,
      platform,
      publicationType,
      commercialIntent,
      authorVoice,
      research,
      socialAuthenticity,
    });

  const evidenceClass =
    ontology.derivedEvidenceClass;

  const quality =
    scoreEvidenceQuality({
      evidenceClass,
      metadata,
      domain,
      commercialIntent,
      authorVoice,
      research,
      socialAuthenticity,
    });

  const baseClassificationConfidence =
    (
      domain.confidence +
      platform.confidence +
      authorVoice.confidence +
      research.confidence +
      socialAuthenticity.score
    ) / 5;

  const classificationConfidence =
    Number(
      (
        baseClassificationConfidence *
          0.45 +
        ontology.overallConfidence *
          0.55
      ).toFixed(2)
    );

  return {
    evidenceClass,

    voice:
      authorVoice.voice,

    publicationType,

    commercialIntent:
      commercialIntent.level,

    commercialIntentScore:
      commercialIntent.score,

    researchCredibility:
      research.credibility,

    domain:
      metadata.domain,

    domainCategory:
      domain.category,

    platform:
      platform.platform,

    sourceType:
      metadata.sourceType,

    socialAuthenticityScore:
      socialAuthenticity.score,

    isAuthenticConversation:
      socialAuthenticity
        .isAuthenticConversation,

    isCommunityConversation:
      evidenceClass ===
      "community_conversation",

    isFirstParty: [
      "corporate_pr",
      "clinic_marketing",
      "retail_or_product",
    ].includes(evidenceClass),

    isPromotional: [
      "corporate_pr",
      "clinic_marketing",
      "retail_or_product",
      "sponsored_content",
      "influencer_content",
      "event_or_conference",
    ].includes(evidenceClass),

    isPeerReviewed:
      research.credibility ===
      "peer_reviewed",

    classificationConfidence,

    qualityScore:
      quality.score,

    qualityBand:
      quality.band,

    ontology,

    reasons: [
      ...(domain.matchedRule
        ? [
            `Domain rule: ${domain.matchedRule}`,
          ]
        : []),

      ...commercialIntent.reasons,

      ...socialAuthenticity.reasons,

      ...authorVoice.reasons,

      ...research.reasons,

      ...ontology.reasons,

      ...quality.reasons,
    ],
  };
}