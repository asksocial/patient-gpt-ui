export {
  analyzeEvidence,
} from "./analyzeEvidence";

export {
  enrichFindingWithEvidenceIntelligence,
  enrichFindingsWithEvidenceIntelligence,
} from "./enrichFindingsWithEvidenceIntelligence";

export {
  normalizeEvidenceMetadata,
} from "./normalizeEvidenceMetadata";

export {
  scoreEvidenceQuality,
} from "./scoreEvidenceQuality";

export * from "./ontology";

export type {
  AuthorVoiceResult,
  CommercialIntentLevel,
  CommercialIntentResult,
  DomainCategory,
  DomainClassification,
  EvidenceClass,
  EvidenceIntelligence,
  EvidenceQualityBand,
  EvidenceQualityResult,
  EvidenceVoice,
  NormalizedEvidenceMetadata,
  NormalizedPlatform,
  PlatformClassification,
  PublicationType,
  ResearchCredibility,
  ResearchCredibilityResult,
  SocialAuthenticityResult,
} from "./types";
