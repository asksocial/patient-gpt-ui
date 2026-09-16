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
  requireConfiguration(sourceMapping.paging.strategy === "search_after_link", "search-after pagination is required for result sets above the skip limit");
  requireConfiguration(sourceMapping.paging.pageSize > 0 && sourceMapping.paging.pageSize <= 1000, "openFDA page size must be between 1 and 1000");
  requireConfiguration(sourceMapping.retry.maxAttempts >= 1, "at least one request attempt is required");
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
