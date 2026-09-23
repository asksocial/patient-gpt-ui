import manifestJson from "../../../../../config/pv/training-corpus/botulinum-toxin/regulatory/manifest.json";
import productsJson from "../../../../../config/pv/training-corpus/botulinum-toxin/regulatory/products-2026.01.0.json";
import mappingJson from "../../../../../config/pv/training-corpus/botulinum-toxin/regulatory/openfda-mapping-2026.01.0.json";
import type { BotulinumProductRegistry, OpenFdaRegulatoryMapping } from "./types";

export type BotulinumRegulatoryCorpusManifest = {
  schemaVersion: string;
  configurationVersion: string;
  status: "active" | "draft" | "superseded";
  topic: string;
  source: string;
  sourceDocumentation: string;
  projectManifest: string;
  normalizedRecordSchema: string;
  activeProductRegistry: string;
  activeOpenFdaMapping: string;
  activationPolicy: string;
  regulatoryPosture: string;
};

const manifest = manifestJson as BotulinumRegulatoryCorpusManifest;

const productRegistries: Record<string, BotulinumProductRegistry> = {
  "products-2026.01.0.json": productsJson as unknown as BotulinumProductRegistry,
};

const openFdaMappings: Record<string, OpenFdaRegulatoryMapping> = {
  "openfda-mapping-2026.01.0.json": mappingJson as unknown as OpenFdaRegulatoryMapping,
};

function requireConfiguration<T>(value: T | undefined, message: string): T {
  if (!value) throw new Error(`Invalid botulinum FAERS configuration: ${message}`);
  return value;
}

const productRegistry = requireConfiguration(
  productRegistries[manifest.activeProductRegistry],
  `product registry ${manifest.activeProductRegistry} is not registered`,
);
const sourceMapping = requireConfiguration(
  openFdaMappings[manifest.activeOpenFdaMapping],
  `openFDA mapping ${manifest.activeOpenFdaMapping} is not registered`,
);

function validateConfiguration() {
  requireConfiguration(manifest.status === "active", "manifest must select an active configuration");
  requireConfiguration(productRegistry.status === "active", "product registry must be active");
  requireConfiguration(sourceMapping.status === "active", "openFDA mapping must be active");
  requireConfiguration(sourceMapping.endpoint === "https://api.fda.gov/drug/event.json", "only the official HTTPS drug/event endpoint is permitted");
  requireConfiguration(sourceMapping.paging.strategy === "search_after_link_with_bounded_skip_fallback", "search-after pagination with a bounded skip fallback is required");
  requireConfiguration(sourceMapping.paging.pageSize > 0 && sourceMapping.paging.pageSize <= 1000, "openFDA page size must be between 1 and 1000");
  requireConfiguration(sourceMapping.paging.skipFallbackMaximumTotal === 26000, "the bounded skip fallback must not exceed openFDA's documented 26,000-result window");
  requireConfiguration(sourceMapping.paging.skipFallbackPageSize > 0 && sourceMapping.paging.skipFallbackPageSize <= 100, "the bounded skip fallback page size must be between 1 and 100");
  requireConfiguration(sourceMapping.retry.maxAttempts >= 1, "at least one request attempt is required");
  requireConfiguration(sourceMapping.retry.queryRestartAttempts >= 1, "at least one whole-query pass is required");
  requireConfiguration(sourceMapping.retry.skipFallbackActivationPass > 1 && sourceMapping.retry.skipFallbackActivationPass <= sourceMapping.retry.queryRestartAttempts, "the skip fallback activation pass must follow the primary search-after passes");
  requireConfiguration(sourceMapping.retry.skipFallbackCooldownMs >= sourceMapping.retry.maximumDelayMs, "the skip fallback cooldown must be at least the maximum page-retry delay");
  const targets = productRegistry.families.flatMap((family) => [...family.brands, ...family.activeIngredients]);
  requireConfiguration(new Set(targets.map((value) => value.toUpperCase())).size === targets.length, "target product terms must be unique");
  for (const family of productRegistry.families) {
    requireConfiguration(Boolean(family.familyId && family.brands.length && family.activeIngredients.length), "each product family needs an ID, brand, and active ingredient");
  }
}

validateConfiguration();

export function getBotulinumRegulatoryCorpusManifest() {
  return manifest;
}

export function getBotulinumProductRegistry() {
  return productRegistry;
}

export function getOpenFdaRegulatoryMapping() {
  return sourceMapping;
}
