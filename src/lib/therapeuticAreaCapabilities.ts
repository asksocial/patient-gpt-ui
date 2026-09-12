import { getRankingProfile } from "../answering/ranking/getRankingProfile";
import { THEME_TAXONOMIES } from "../answering/themes/taxonomies";
import { DISEASE_PROFILES } from "../ingestion/profiles";
import {
  getTherapeuticAreaCoverage,
  normalizeTherapeuticAreaId,
  type TherapeuticAreaCoverage,
} from "./analytics/coverage";
import { INTELLIGENCE_MODULE_IDS, WORKFLOW_IDS } from "./intelligence-platform/ids";
import { MODE_ANALYSIS_PROFILES } from "./intelligence-platform/modeAnalysis";

export const SHARED_INTELLIGENCE_FRAMEWORKS = [
  "natural_language_search",
  "evidence_ranking",
  "source_citations",
  "confidence_scoring",
  "theme_detection",
  "cross_source_corroboration",
  "longitudinal_theme_tracking",
  "theme_knowledge_snapshots",
  "executive_intelligence",
] as const;

export const SHARED_PV_DETECTION_CATEGORIES = [
  "product",
  "adverse_experience",
  "severity",
  "treatment_change",
  "lack_of_efficacy",
  "medication_error",
  "overdose",
  "pregnancy",
  "misuse_abuse",
  "product_quality",
] as const;

export const SHARED_PV_ONTOLOGY_FIELDS = [
  "product_or_procedure",
  "adverse_event",
  "seriousness",
  "outcome",
  "time_to_onset",
  "severity",
  "unexpectedness",
  "causality_language",
  "patient_identifiability",
  "reporter_identifiability",
] as const;

export type TherapeuticAreaCapabilityContract = ReturnType<
  typeof getTherapeuticAreaCapabilityContract
>;

/**
 * Describes the invariant platform behavior available to every therapeutic
 * area. Area-specific profiles improve precision; they do not enable or disable
 * the underlying intelligence, module, workflow, or PV frameworks.
 */
export function getTherapeuticAreaCapabilityContract(
  therapeuticArea: string,
  coverageOverride?: TherapeuticAreaCoverage
) {
  const therapeuticAreaId = normalizeTherapeuticAreaId(therapeuticArea);
  const coverage = coverageOverride || getTherapeuticAreaCoverage(therapeuticArea);
  const customIngestionProfile = Boolean(DISEASE_PROFILES[therapeuticAreaId]);
  const customThemeTaxonomy = Boolean(THEME_TAXONOMIES[therapeuticAreaId]);
  const rankingProfile = getRankingProfile(therapeuticArea);

  return {
    schemaVersion: "therapeutic_area_capability_v1" as const,
    therapeuticArea,
    therapeuticAreaId,
    frameworks: {
      intelligence: [...SHARED_INTELLIGENCE_FRAMEWORKS],
      modules: [...INTELLIGENCE_MODULE_IDS],
      intelligenceModes: MODE_ANALYSIS_PROFILES.map((profile) => profile.modeId),
      workflows: [...WORKFLOW_IDS],
      pvCompliance: {
        supported: true,
        detectionSegments: ["ae_adr", "health_experience"] as const,
        detectionCategories: [...SHARED_PV_DETECTION_CATEGORIES],
        ontologyFields: [...SHARED_PV_ONTOLOGY_FIELDS],
        dayZeroTrigger: "qualified_reviewer_confirms_minimum_icsr_criteria" as const,
        humanReviewRequired: true,
      },
    },
    dataReadiness: {
      analyticalCoverage: coverage.status,
      analyticalReason: coverage.reason || null,
      pvRequirements: [
        "active_therapeutic_area_detection_library",
        "configured_product_or_procedure_concepts",
        "configured_health_experience_or_special_situation_concepts",
        "approved_source_scope",
      ],
    },
    precision: {
      ingestionProfile: customIngestionProfile ? "custom" : "generic",
      themeTaxonomy: customThemeTaxonomy ? "custom" : "generic",
      rankingProfile: rankingProfile.profileId === "generic" ? "generic" : "custom",
    },
  };
}
