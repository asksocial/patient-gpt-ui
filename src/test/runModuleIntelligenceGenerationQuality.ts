import fs from "node:fs";
import path from "node:path";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import {
  buildModuleIntelligence,
  MODULE_INTELLIGENCE_PROFILES,
  type GeneratableModuleId,
} from "../lib/module-intelligence/buildModuleIntelligence";

const expectedModules: GeneratableModuleId[] = [
  "medical_affairs",
  "clinical_trials",
  "corporate_affairs",
  "commercial",
  "competitive",
  "advocacy",
];

if (JSON.stringify(Object.keys(MODULE_INTELLIGENCE_PROFILES)) !== JSON.stringify(expectedModules)) {
  throw new Error("Every non-patient module must have a generation profile in catalog order.");
}

const corpus = loadCanonicalFindingsForAsk("Medical Aesthetics");
if (corpus.status !== "available") throw new Error("Medical Aesthetics corpus is required for module generation quality checks.");

const results = expectedModules.map((moduleId) =>
  buildModuleIntelligence(moduleId, "Medical Aesthetics", corpus.findings, "2026-08-08T17:00:00.000Z")
);

for (const result of results) {
  if (
    result.schemaVersion !== "module_intelligence_v1" ||
    result.therapeuticArea !== "Medical Aesthetics" ||
    result.sections.length !== 4 ||
    result.sections.some((section) => !section.label || !section.description) ||
    !result.dataQuality.selectedFindingCount ||
    !result.evidence.length ||
    result.recommendations.length < 3 ||
    !result.dataQuality.limitations.length
  ) {
    throw new Error(`${result.moduleId} did not produce a complete evidence-qualified module contract.`);
  }
}

const sectionSignatures = new Set(
  results.map((result) => result.sections.map((section) => section.id).join("|"))
);
if (sectionSignatures.size !== expectedModules.length) {
  throw new Error("Module generators must use distinct decision-section contracts.");
}

const medical = results.find((result) => result.moduleId === "medical_affairs");
const commercial = results.find((result) => result.moduleId === "commercial");
if (!medical || !commercial) throw new Error("Medical and Commercial module outputs are required.");
if (medical.dataQuality.promotionalContextCount !== 0) {
  throw new Error("Medical Affairs must exclude promotional evidence from its selected subset.");
}
if (!commercial.dataQuality.limitations.some((item) => item.includes("labeled context"))) {
  throw new Error("Commercial Intelligence must disclose promotional context handling.");
}

const workspaceSource = fs.readFileSync(path.resolve(process.cwd(), "src/components/WorkspaceShell.jsx"), "utf8");
const viewSource = fs.readFileSync(path.resolve(process.cwd(), "src/components/ModuleIntelligenceView.jsx"), "utf8");
const routeSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/module-intelligence/route.ts"), "utf8");
if (
  !workspaceSource.includes("<ModuleIntelligenceView") ||
  !viewSource.includes("Generate ${module.name} Intelligence") ||
  !routeSource.includes("MODULE_ENTITLEMENTS[moduleId]") ||
  !routeSource.includes('kind: "report"')
) {
  throw new Error("Module generation must remain wired through the licensed workspace, API, and governed work-product store.");
}
if (!workspaceSource.includes("<PatientIntelligenceView")) {
  throw new Error("The existing Patient Intelligence experience must remain intact.");
}

console.log(JSON.stringify({
  generatedModules: results.map((result) => ({
    moduleId: result.moduleId,
    selectedFindings: result.dataQuality.selectedFindingCount,
    leadingSection: result.sections[0]?.label,
    evidenceCount: result.evidence.length,
  })),
  distinctOutputContracts: sectionSignatures.size,
  patientExperiencePreserved: true,
}, null, 2));
