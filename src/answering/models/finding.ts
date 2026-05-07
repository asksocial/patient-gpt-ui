export type EvidenceSourceType = "curated" | "live";

export type FindingType =
  | "symptom_burden"
  | "quality_of_life"
  | "persona_pattern"
  | "country_pattern"
  | "platform_preference"
  | "treatment_concern"
  | "diagnosis_barrier"
  | "safety_signal"
  | "treatment_journey"
  | "perceived_benefit"
  | "other";

export interface EvidenceRef {
  sourceType: EvidenceSourceType;
  sourceId: string;
  documentId?: string;
  sectionId?: string;
  sectionTitle?: string;
  excerpt: string;
  url?: string;
  country?: string;
  platform?: string;
  persona?: string;
  score?: number;
}

export interface CanonicalFinding {
  findingId: string;
  findingType: FindingType;

  canonicalClaim: string;
  summary: string;

  therapeuticArea: string;
  countries: string[];
  personas: string[];
  platforms: string[];
  symptoms: string[];
  treatments: string[];
  lifecycleStages: string[];

  intentLabels: string[];
  confidence: number;
  relevanceScore: number;
  evidenceStrength: number;
  noveltyScore?: number;

  evidence: EvidenceRef[];

  normalizedLabels: string[];
  semanticFingerprint: string;
  duplicateOf?: string;
  clusterId?: string;

  renderPriority?: number;
  answerRole?: "direct" | "supporting" | "market_variation" | "discard";

  structuredData?: {
    symptomBurden?: Array<{
      symptom: string;
      burden: string;
      severity?: string;
    }>;
    marketVariation?: Array<{
      market: string;
      difference: string;
    }>;
    recommendedActions?: string[];
    topThemes?: string[];
    liveDataStatus?: "confirmed" | "not_found" | "extends";

    treatmentJourney?: {
      stage?: "initiation" | "ongoing_use" | "adherence" | "dose_change" | "switch" | "discontinuation" | "unknown";
      action?: "started" | "stopped" | "switched" | "missed" | "restarted" | "dose_increase" | "dose_decrease" | "unknown";
      fromTreatment?: string;
      toTreatment?: string;
      drivers?: string[];
      benefitSignals?: string[];
      adherenceSignals?: string[];
      usagePattern?: string[];
    };
  };
}