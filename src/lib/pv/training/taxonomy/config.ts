import manifestJson from "../../../../../config/pv/training-corpus/botulinum-toxin/taxonomy/manifest.json";
import rulesJson from "../../../../../config/pv/training-corpus/botulinum-toxin/taxonomy/semantic-rules-2026.01.0.json";
import { PV_SEMANTIC_CATEGORIES, type TaxonomyConfiguration, type TaxonomyRules } from "./types";

const configuration = manifestJson as TaxonomyConfiguration;
const rulesRegistry: Record<string, TaxonomyRules> = {
  "semantic-rules-2026.01.0.json": rulesJson as unknown as TaxonomyRules,
};
const rules = rulesRegistry[configuration.activeSemanticRules];

function requireConfiguration(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Invalid botulinum AE/ADR taxonomy configuration: ${message}`);
}

function validateConfiguration() {
  requireConfiguration(configuration.status === "draft_pending_pv_review" || configuration.status === "active", "configuration must be draft or active");
  requireConfiguration(configuration.categorySystemIsOfficialMeddraHierarchy === false, "internal categories must not be represented as official MedDRA hierarchy");
  requireConfiguration(rules, `semantic rules ${configuration.activeSemanticRules} are not registered`);
  requireConfiguration(rules.status === "active", "selected semantic rules must be active");
  requireConfiguration(configuration.exampleCaseLimit > 0, "example case limit must be positive");
  requireConfiguration(configuration.summaryLimit === 50, "the required summary limit is 50");
  const knownCategories = new Set<string>(PV_SEMANTIC_CATEGORIES);
  const categoryIds = rules.categories.map((item) => item.id);
  requireConfiguration(new Set(categoryIds).size === categoryIds.length, "semantic category rule IDs must be unique");
  requireConfiguration(categoryIds.every((item) => item !== "other" && knownCategories.has(item)), "rules may only use declared non-fallback semantic categories");
  for (const category of rules.categories) requireConfiguration(category.patterns.length > 0, `category ${category.id} needs patterns`);
  const mappedTerms = new Set<string>();
  for (const mapping of rules.explicitConceptMappings) {
    requireConfiguration(mapping.meddra_pts.length > 0 && mapping.normalized_concept.trim(), "explicit mappings need terms and a normalized concept");
    requireConfiguration(mapping.confidence >= 0 && mapping.confidence <= 1, "mapping confidence must be between zero and one");
    for (const term of mapping.meddra_pts) {
      requireConfiguration(!mappedTerms.has(term), `MedDRA PT ${term} appears in more than one explicit mapping`);
      mappedTerms.add(term);
    }
  }
}

validateConfiguration();

export function getTaxonomyConfiguration() {
  return configuration;
}

export function getTaxonomyRules() {
  return rules;
}
