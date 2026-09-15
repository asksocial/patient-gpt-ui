import manifestJson from "../../../../config/pv/e2b-r3/manifest.json";
import mappingJson from "../../../../config/pv/e2b-r3/mappings/asksocial-e2b-r3-2026.01.0.json";
import emailJson from "../../../../config/pv/e2b-r3/email/client-ae-notification-1.0.0.json";
import codeListJson from "../../../../config/pv/e2b-r3/code-lists/ich-2.11.json";
import type { PvE2bMappingEntry, PvE2bMappingPackage, PvEmailMappingPackage, PvIchCodeListPackage } from "./types";

export type PvE2bManifest = {
  schemaVersion: string;
  activeMappingVersion: string;
  activeMappingFile: string;
  activeEmailMappingVersion: string;
  activeEmailMappingFile: string;
  ichPackageVersion: string;
  ichImplementationGuideVersion: string;
  ichControlledTerminologyVersion: string;
  activeCodeListFile: string;
  fdaRegionalGuideVersion: string;
  fdaBusinessRulesVersion: string;
  meddraVersion: string | null;
  lastRegulatoryReviewDate: string;
  activationPolicy: string;
  sources: Record<string, string>;
};

function assertVersionedPackage(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid PV E2B configuration: ${message}`);
}

function validateConfiguration(
  manifest: PvE2bManifest,
  mapping: PvE2bMappingPackage,
  email: PvEmailMappingPackage,
  codeLists: PvIchCodeListPackage,
) {
  assertVersionedPackage(mapping.mappingVersion === manifest.activeMappingVersion, "active mapping version does not match the manifest");
  assertVersionedPackage(email.emailMappingVersion === manifest.activeEmailMappingVersion, "active email mapping version does not match the manifest");
  assertVersionedPackage(mapping.status === "active" && email.status === "active", "manifest may only select active packages");
  assertVersionedPackage(mapping.sources.ichPackage === manifest.ichPackageVersion, "ICH package versions do not match");
  assertVersionedPackage(mapping.sources.ichControlledTerminology.startsWith(manifest.ichControlledTerminologyVersion), "ICH terminology versions do not match");
  assertVersionedPackage(codeLists.packageVersion === manifest.ichControlledTerminologyVersion, "active code-list package does not match the manifest");
  assertVersionedPackage(codeLists.sourcePackageVersion === manifest.ichPackageVersion, "code-list source package does not match the ICH package");
  assertVersionedPackage(new Set(mapping.mappings.map((entry) => entry.askSocialField)).size === mapping.mappings.length, "AskSocial field mappings must be unique");
  assertVersionedPackage(new Set(email.fields.map((entry) => `${entry.section}:${entry.field}`)).size === email.fields.length, "email field mappings must be unique per section");
  for (const entry of mapping.mappings) {
    assertVersionedPackage(Boolean(entry.askSocialField && entry.displayName && entry.description), "every mapping needs a field, display name, and description");
    assertVersionedPackage(entry.regulatorySource === "AskSocial-only" || entry.e2bElement || entry.notes.includes("REGULATORY VERIFICATION REQUIRED"), `${entry.askSocialField} needs an E2B element or verification flag`);
    assertVersionedPackage(!entry.e2bElement || /^[C-H]\./.test(entry.e2bElement), `${entry.askSocialField} has an invalid E2B element identifier`);
  }
}

const manifest = manifestJson as PvE2bManifest;

// The registry is the only build-time wiring required for a new immutable
// package. Runtime behavior and activation remain controlled by the manifest.
const mappingRegistry: Record<string, PvE2bMappingPackage> = {
  "mappings/asksocial-e2b-r3-2026.01.0.json": mappingJson as unknown as PvE2bMappingPackage,
};
const emailMappingRegistry: Record<string, PvEmailMappingPackage> = {
  "email/client-ae-notification-1.0.0.json": emailJson as unknown as PvEmailMappingPackage,
};
const codeListRegistry: Record<string, PvIchCodeListPackage> = {
  "code-lists/ich-2.11.json": codeListJson as unknown as PvIchCodeListPackage,
};

const mappingPackage = mappingRegistry[manifest.activeMappingFile];
const emailMappingPackage = emailMappingRegistry[manifest.activeEmailMappingFile];
const codeListPackage = codeListRegistry[manifest.activeCodeListFile];
assertVersionedPackage(mappingPackage, `active mapping file ${manifest.activeMappingFile} is not registered`);
assertVersionedPackage(emailMappingPackage, `active email mapping file ${manifest.activeEmailMappingFile} is not registered`);
assertVersionedPackage(codeListPackage, `active code-list file ${manifest.activeCodeListFile} is not registered`);
validateConfiguration(manifest, mappingPackage, emailMappingPackage, codeListPackage);

const mappingByField = new Map(mappingPackage.mappings.map((entry) => [entry.askSocialField, entry]));

export function getActivePvE2bManifest() {
  return manifest;
}

export function getActivePvE2bMapping() {
  return mappingPackage;
}

export function getActivePvEmailMapping() {
  return emailMappingPackage;
}

export function getActivePvIchCodeLists() {
  return codeListPackage;
}

export function getPvE2bMappingEntry(field: string): PvE2bMappingEntry | undefined {
  return mappingByField.get(field);
}

export function pvE2bVersionSnapshot() {
  return {
    mappingVersion: mappingPackage.mappingVersion,
    emailMappingVersion: emailMappingPackage.emailMappingVersion,
    ichPackageVersion: manifest.ichPackageVersion,
    ichImplementationGuideVersion: manifest.ichImplementationGuideVersion,
    controlledTerminologyVersion: manifest.ichControlledTerminologyVersion,
    fdaRegionalGuideVersion: manifest.fdaRegionalGuideVersion,
    fdaBusinessRulesVersion: manifest.fdaBusinessRulesVersion,
    meddraVersion: manifest.meddraVersion,
    lastRegulatoryReviewDate: manifest.lastRegulatoryReviewDate,
  };
}
