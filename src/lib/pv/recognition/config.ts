import pipelineManifestJson from "../../../../config/pv/recognition/botulinum-toxin/manifest.json";
import eventLexiconJson from "../../../../config/pv/recognition/botulinum-toxin/event-lexicon-2026.01.0.json";
import productAliasesJson from "../../../../config/pv/recognition/botulinum-toxin/product-aliases-2026.01.0.json";
import productRegistryJson from "../../../../config/pv/training-corpus/botulinum-toxin/regulatory/products-2026.01.0.json";
import expressionManifestJson from "../../../../config/pv/training-corpus/botulinum-toxin/expressions/manifest.json";
import exampleManifestJson from "../../../../config/pv/training-corpus/botulinum-toxin/examples/manifest.json";
import taxonomyManifestJson from "../../../../config/pv/training-corpus/botulinum-toxin/taxonomy/manifest.json";

export type BotulinumPipelineManifest = typeof pipelineManifestJson;
export type BotulinumEventLexicon = typeof eventLexiconJson;
export type BotulinumProductRegistry = typeof productRegistryJson;
export type BotulinumProductAliases = typeof productAliasesJson;

function assertConfiguration(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid botulinum PV recognition configuration: ${message}`);
}

const manifest = pipelineManifestJson;
const lexicon = eventLexiconJson;
const products = productRegistryJson;
const productAliases = productAliasesJson;

assertConfiguration(manifest.status === "active", "pipeline must be active");
assertConfiguration(manifest.productRegistryVersion === products.registryVersion, "product registry version mismatch");
assertConfiguration(manifest.productAliasVersion === productAliases.aliasVersion && productAliases.productRegistryVersion === products.registryVersion, "product alias version mismatch");
assertConfiguration(manifest.taxonomyVersion === taxonomyManifestJson.taxonomyVersion, "taxonomy version mismatch");
assertConfiguration(manifest.expressionLibraryVersion === expressionManifestJson.libraryVersion, "expression library version mismatch");
assertConfiguration(manifest.contrastTemplatesVersion === exampleManifestJson.datasetVersion, "contrast dataset version mismatch");
assertConfiguration(manifest.specialSituationsVersion === "2026.01.0", "special-situation version mismatch");
assertConfiguration(lexicon.taxonomyVersion === manifest.taxonomyVersion && lexicon.expressionLibraryVersion === manifest.expressionLibraryVersion, "event lexicon source version mismatch");
assertConfiguration(new Set(lexicon.events.map((event) => event.conceptId)).size === lexicon.events.length, "event concept IDs must be unique");
assertConfiguration(lexicon.events.every((event) => event.terms.length && event.meddraPt && event.normalizedConcept), "every event requires terms and normalized mappings");
assertConfiguration(productAliases.aliases.every((alias) => products.families.some((family) => family.familyId === alias.familyId)), "every product alias must reference a registered family");

export function getBotulinumPvRecognitionConfiguration() {
  return { manifest, lexicon, products, productAliases };
}
