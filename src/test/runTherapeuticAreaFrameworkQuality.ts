import type { CanonicalFinding } from "../answering/models/finding";
import { getRankingProfile } from "../answering/ranking/getRankingProfile";
import { assignThemesToFindings } from "../answering/themes/assignThemes";
import { getThemeTaxonomy } from "../answering/themes/taxonomies";
import { getDiseaseProfile } from "../ingestion/profiles";
import { getCanonicalCorpusFileCandidates } from "../lib/answers/loadCanonicalFindingsForAsk";
import {
  INTELLIGENCE_MODULE_IDS,
  MODE_ANALYSIS_PROFILES,
  WORKFLOW_IDS,
  runModeTherapeuticAreaEvaluation,
} from "../lib/intelligence-platform";
import {
  MODULE_INTELLIGENCE_PROFILES,
  buildModuleIntelligence,
} from "../lib/module-intelligence/buildModuleIntelligence";
import { buildPatientIntelligence } from "../lib/patient-intelligence/buildPatientIntelligence";
import { classifyPvContent } from "../lib/pv/detection";
import type { PvDetectionConcept } from "../lib/pv/types";
import { getTherapeuticAreaCapabilityContract } from "../lib/therapeuticAreaCapabilities";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const therapeuticArea = "Future Oncology Area";
const therapeuticAreaId = "future_oncology_area";

function finding(id: string, text: string, persona = "patient"): CanonicalFinding {
  return {
    findingId: id,
    findingType: "treatment_journey",
    canonicalClaim: text,
    summary: text,
    therapeuticArea,
    countries: ["US"],
    personas: [persona],
    platforms: ["Reddit"],
    symptoms: ["fatigue"],
    treatments: ["Nova therapy"],
    lifecycleStages: ["Treatment"],
    intentLabels: ["treatment_decision_drivers"],
    confidence: 0.9,
    relevanceScore: 0.9,
    evidenceStrength: 0.9,
    evidence: [{ sourceType: "live", sourceId: id, excerpt: text, platform: "Reddit" }],
    normalizedLabels: ["patient experience", "clinical evidence"],
    semanticFingerprint: id,
  };
}

const findings = Array.from({ length: 12 }, (_, index) =>
  finding(
    `future-${index + 1}`,
    index % 3 === 0
      ? "I received Nova therapy and fatigue affected my daily life, cost, and treatment access."
      : index % 3 === 1
        ? "A clinical study discussed efficacy, safety, eligibility, enrollment, and patient outcomes for Nova therapy."
        : "My caregiver and doctor discussed side effects, unmet needs, trust, and whether I should switch treatment.",
    index % 3 === 1 ? "researcher" : "patient"
  )
);

const profile = getDiseaseProfile(therapeuticAreaId, therapeuticArea);
assert(profile.profileId === therapeuticAreaId, "A future therapeutic area must receive a stable generic ingestion profile.");
assert(profile.diseaseNames.includes(therapeuticArea), "The generic ingestion profile must preserve the configured display name.");
assert(profile.patientIndicators?.length && profile.caregiverIndicators?.length, "The generic profile must support patient and caregiver classification.");

assert(getRankingProfile(therapeuticArea).profileId === "generic", "Future areas must use the safe generic evidence-ranking profile until enhanced.");
const taxonomy = getThemeTaxonomy(therapeuticArea);
assert(taxonomy?.therapeuticArea === therapeuticAreaId && taxonomy.themes.length >= 8, "Future areas must receive the shared theme-intelligence taxonomy.");
assert(assignThemesToFindings(findings, therapeuticArea).some((item) => (item as any).themes?.length), "The generic taxonomy must assign supported themes.");

const coreCandidates = getCanonicalCorpusFileCandidates(therapeuticAreaId);
const moduleCandidates = getCanonicalCorpusFileCandidates(therapeuticAreaId, "clinical_trials");
assert(coreCandidates.includes("data/future-oncology-area.csv"), "Future core corpora must support convention-based discovery.");
assert(moduleCandidates.includes("data/future-oncology-area-clinical-trials.csv"), "Future module corpora must support convention-based discovery.");

for (const [moduleId, moduleProfile] of Object.entries(MODULE_INTELLIGENCE_PROFILES)) {
  const result = buildModuleIntelligence(moduleId as keyof typeof MODULE_INTELLIGENCE_PROFILES, therapeuticArea, findings);
  assert(result.therapeuticArea === therapeuticArea, `${moduleProfile.label} must retain future therapeutic-area scope.`);
  assert(result.sections.length === moduleProfile.sections.length, `${moduleProfile.label} must satisfy its module output contract.`);
}
const patient = buildPatientIntelligence(therapeuticArea, findings);
assert(patient.therapeuticArea === therapeuticArea, "Patient Intelligence must support a future therapeutic area.");

for (const modeProfile of MODE_ANALYSIS_PROFILES) {
  const evaluation = runModeTherapeuticAreaEvaluation({
    profile: modeProfile,
    therapeuticArea,
    findings,
    themeSummary: [],
  });
  assert(evaluation.passed, `${modeProfile.label} failed the future therapeutic-area contract: ${evaluation.failures.join(", ")}`);
}

function concept(
  id: string,
  category: PvDetectionConcept["category"],
  term: string,
  weight = 100
): PvDetectionConcept {
  return { id, category, canonicalTerm: term, terms: [term], exclusions: [], language: "en", weight, version: 1, active: true };
}
const pvConcepts = [
  concept("future-product", "product", "Nova therapy"),
  concept("future-event", "adverse_experience", "rash"),
  concept("future-pregnancy", "pregnancy", "pregnant"),
];
const aeAdr = classifyPvContent({
  externalId: "future-ae",
  sourceType: "social",
  sourceUrl: "https://example.com/future-ae",
  verbatim: "After Nova therapy, I developed a rash.",
  postedAt: "2026-09-12T12:00:00.000Z",
}, pvConcepts);
const healthExperience = classifyPvContent({
  externalId: "future-health",
  sourceType: "social",
  sourceUrl: "https://example.com/future-health",
  verbatim: "I received Nova therapy while pregnant.",
  postedAt: "2026-09-12T12:00:00.000Z",
}, pvConcepts);
assert(aeAdr.shouldCreateRecord && aeAdr.detectionSegment === "ae_adr", "A future-area AE/ADR must enter governed human review.");
assert(healthExperience.shouldCreateRecord && healthExperience.detectionSegment === "health_experience", "A future-area special situation must remain separate in Health Experience Detection.");

const contract = getTherapeuticAreaCapabilityContract(therapeuticArea);
assert(contract.frameworks.modules.length === INTELLIGENCE_MODULE_IDS.length, "Every module must be available to future areas subject to entitlement and data readiness.");
assert(contract.frameworks.workflows.length === WORKFLOW_IDS.length, "Every workflow must be available to future areas subject to entitlement and data readiness.");
assert(contract.frameworks.intelligenceModes.length === MODE_ANALYSIS_PROFILES.length, "Every intelligence-mode framework must support future areas.");
assert(contract.frameworks.pvCompliance.supported, "PV Compliance must expose a future-area capability contract.");
assert(contract.precision.ingestionProfile === "generic" && contract.precision.themeTaxonomy === "generic", "Future areas must disclose generic precision until enhanced profiles are configured.");

console.log(JSON.stringify({
  therapeuticArea,
  genericThemeCount: taxonomy.themes.length,
  moduleCount: contract.frameworks.modules.length,
  modeCount: contract.frameworks.intelligenceModes.length,
  workflowCount: contract.frameworks.workflows.length,
  pvSegments: contract.frameworks.pvCompliance.detectionSegments,
  corpusConventions: { core: coreCandidates, clinicalTrials: moduleCandidates },
}, null, 2));
