import products from "../../../../config/pv/glp-1/products-2026.01.0.json";
import { botulinumRegulatoryConfiguration, type RegulatoryCorpusConfiguration } from "../training/regulatory/config";

export const GLP1_PV_VERSION = "glp-1-pv-2026.01.0";
export const GLP1_PV_LIBRARY_NAME = "GLP-1 FAERS-informed PV detection library";
export const glp1RegulatoryConfiguration: RegulatoryCorpusConfiguration = {
  manifest: {
    ...botulinumRegulatoryConfiguration.manifest,
    topic: "GLP-1",
    configurationVersion: GLP1_PV_VERSION,
    projectManifest: "config/pv/glp-1/products-2026.01.0.json",
    normalizedRecordSchema: "config/pv/glp-1/regulatory-case.schema.json",
    activeProductRegistry: "products-2026.01.0.json",
    activeOpenFdaMapping: "glp-1-openfda-2026.01.0",
  },
  productRegistry: products as RegulatoryCorpusConfiguration["productRegistry"],
  mapping: {
    ...botulinumRegulatoryConfiguration.mapping,
    mappingVersion: "glp-1-openfda-2026.01.0",
    // Retrieve recent reports first. Limits remain explicit in each snapshot.
    paging: { ...botulinumRegulatoryConfiguration.mapping.paging, pageSize: 100, sort: "receivedate:desc" },
  },
};
