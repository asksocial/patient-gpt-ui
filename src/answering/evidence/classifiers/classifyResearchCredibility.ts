import {
  RESEARCH_CLAIM_PATTERNS,
  RESEARCH_LANGUAGE_PATTERNS,
} from "../config/classificationPatterns";
import {
  DomainClassification,
  NormalizedEvidenceMetadata,
  PublicationType,
  ResearchCredibilityResult,
} from "../types";

function includesAny(
  text: string,
  patterns: string[]
): boolean {
  return patterns.some((pattern) =>
    text.includes(pattern)
  );
}

export function classifyResearchCredibility(
  metadata: NormalizedEvidenceMetadata,
  domain: DomainClassification,
  publicationType: PublicationType
): ResearchCredibilityResult {
  const text = metadata.fullText;

  if (
    publicationType ===
    "clinical_trial_record"
  ) {
    return {
      credibility:
        "clinical_trial_registry",
      confidence: 1,
      reasons: [
        "Clinical-trial registry publication",
      ],
    };
  }

  if (
    domain.category ===
      "government" &&
    publicationType ===
      "government_document"
  ) {
    return {
      credibility:
        "government_evidence",
      confidence: 0.95,
      reasons: [
        "Government or regulator source",
      ],
    };
  }

  if (
    domain.category ===
    "medical_society"
  ) {
    return {
      credibility: "medical_society",
      confidence: 0.92,
      reasons: [
        "Recognized medical-society source",
      ],
    };
  }

  if (
    domain.category ===
      "research" &&
    publicationType ===
      "journal_article"
  ) {
    return {
      credibility: "peer_reviewed",
      confidence: 0.9,
      reasons: [
        "Research-domain journal content",
      ],
    };
  }

  if (
    includesAny(
      text,
      RESEARCH_LANGUAGE_PATTERNS
    ) &&
    [
      "news_article",
      "trade_article",
    ].includes(publicationType)
  ) {
    return {
      credibility:
        "research_reporting",
      confidence: 0.7,
      reasons: [
        "News or trade content reporting research",
      ],
    };
  }

  if (
    includesAny(
      text,
      RESEARCH_CLAIM_PATTERNS
    )
  ) {
    return {
      credibility:
        "research_claim_only",
      confidence: 0.75,
      reasons: [
        "Research language appears without validated research-source metadata",
      ],
    };
  }

  return {
    credibility: "not_research",
    confidence: 0.8,
    reasons: [
      "No validated research indicators",
    ],
  };
}