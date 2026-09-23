import manifestJson from "../../../../../config/pv/training-corpus/botulinum-toxin/expressions/manifest.json";
import templatesJson from "../../../../../config/pv/training-corpus/botulinum-toxin/expressions/generation-templates-2026.01.0.json";
import curatedSeedsJson from "../../../../../config/pv/training-corpus/botulinum-toxin/expressions/curated-seeds-2026.01.0.json";
import { EXPRESSION_FIELDS, type CuratedSeeds, type ExpressionLibraryConfiguration, type ExpressionTemplates } from "./types";

const configuration = manifestJson as ExpressionLibraryConfiguration;
const templatesRegistry: Record<string, ExpressionTemplates> = {
  "generation-templates-2026.01.0.json": templatesJson as unknown as ExpressionTemplates,
};
const seedsRegistry: Record<string, CuratedSeeds> = {
  "curated-seeds-2026.01.0.json": curatedSeedsJson as unknown as CuratedSeeds,
};
const templates = templatesRegistry[configuration.activeTemplates];
const curatedSeeds = seedsRegistry[configuration.activeCuratedSeeds];

function requireConfiguration(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Invalid botulinum social-expression configuration: ${message}`);
}

function validateConfiguration() {
  requireConfiguration(configuration.status === "draft_pending_pv_medical_review" || configuration.status === "active", "library must be draft or active");
  requireConfiguration(templates?.status === "active", "selected templates must be registered and active");
  requireConfiguration(curatedSeeds?.status === "active", "selected curated seeds must be registered and active");
  requireConfiguration(curatedSeeds.reviewStatus === "pending_pv_medical_review", "curated seeds must remain pending review until approved");
  requireConfiguration(configuration.minimumHighPriorityCoverage.lay_synonyms >= 10, "high-priority concepts need at least ten lay expressions");
  requireConfiguration(configuration.minimumHighPriorityCoverage.colloquial_expressions >= 5, "high-priority concepts need at least five colloquial expressions");
  requireConfiguration(configuration.minimumHighPriorityCoverage.temporal_expressions >= 5, "high-priority concepts need at least five temporal expressions");
  for (const [profile, profileTemplates] of Object.entries(templates.profiles)) {
    for (const field of Object.keys(profileTemplates)) requireConfiguration(EXPRESSION_FIELDS.includes(field as never), `profile ${profile} contains unknown field ${field}`);
  }
  const seeded = new Set<string>();
  for (const seed of curatedSeeds.concepts) {
    requireConfiguration(seed.meddra_pt && !seeded.has(seed.meddra_pt), `curated seed PT ${seed.meddra_pt} must be present and unique`);
    seeded.add(seed.meddra_pt);
  }
}

validateConfiguration();

export function getExpressionLibraryConfiguration() {
  return configuration;
}

export function getExpressionTemplates() {
  return templates;
}

export function getCuratedExpressionSeeds() {
  return curatedSeeds;
}
