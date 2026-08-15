import fs from "node:fs";
import path from "node:path";
import { askSocial } from "../app/api/ask";
import { getRankingProfile } from "../answering/ranking/getRankingProfile";
import { getThemeTaxonomy } from "../answering/themes/taxonomies";
import { loadCanonicalFindingsForAsk, loadCanonicalFindingsForModule } from "../lib/answers/loadCanonicalFindingsForAsk";
import { getTherapeuticAreaCoverage } from "../lib/analytics/coverage";
import { buildModuleIntelligence, type GeneratableModuleId } from "../lib/module-intelligence/buildModuleIntelligence";
import { buildPatientIntelligence } from "../lib/patient-intelligence/buildPatientIntelligence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const coverage = getTherapeuticAreaCoverage("Botulinum toxin");
assert(coverage.status === "validated", "Botulinum toxin must have validated analytical coverage.");
assert(coverage.executiveIntelligenceAvailable && coverage.longitudinalIntelligenceAvailable, "Botulinum toxin must support executive and longitudinal intelligence.");

const corpus = loadCanonicalFindingsForAsk("Botulinum toxin");
assert(corpus.status === "available", "Botulinum toxin canonical corpus must load.");
assert(corpus.findings.length >= 1_000, "Botulinum toxin corpus must retain a substantive evidence set after quality filtering.");
assert(corpus.findings.every((finding) => finding.therapeuticArea === "Botulinum toxin"), "Every Botulinum toxin finding must retain the canonical therapeutic-area label.");
const liveFindings = corpus.findings as Array<any>;
assert(liveFindings.some((finding) => finding.title), "Headline aliases must populate finding titles.");
assert(liveFindings.some((finding) => finding.platform), "Source aliases must populate evidence platforms.");

const taxonomy = getThemeTaxonomy("Botulinum toxin");
assert(taxonomy?.themes.length === 8, "Botulinum toxin must have a dedicated domain taxonomy.");
for (const themeId of ["natural_expression", "duration_maintenance", "safety_adverse_events", "brand_choice_switching", "provider_trust_technique", "access_value", "therapeutic_use", "resistance_response"]) {
  assert(taxonomy.themes.some((theme) => theme.themeId === themeId), `Botulinum toxin taxonomy is missing ${themeId}.`);
}
assert(getRankingProfile("Botulinum toxin").profileId === "botulinum_toxin", "Botulinum toxin must use its dedicated evidence-ranking profile.");

const intelligence = askSocial("What are people saying right now about benefits, safety, duration, and brand choice?", corpus.findings);
assert(intelligence.themeSummary.length > 0, "Botulinum toxin search must produce evidence-qualified themes.");
assert(intelligence.knowledgeSnapshot?.therapeuticArea === "botulinum_toxin", "Botulinum toxin search must build a canonical knowledge snapshot.");
assert(Boolean(intelligence.executiveIntelligence), "Botulinum toxin search must build an executive brief.");
assert(intelligence.themeLongitudinalTracking.datedFindingCount > 0 && intelligence.themeLongitudinalTracking.themes.length > 0, "Botulinum toxin search must execute longitudinal analysis.");

const modules: GeneratableModuleId[] = ["medical_affairs", "clinical_trials", "corporate_affairs", "commercial", "competitive", "advocacy"];
const clinicalTrialsCorpus = loadCanonicalFindingsForModule("Botulinum toxin", "clinical_trials");
assert(clinicalTrialsCorpus.status === "available", "The Botulinum toxin Clinical Trials corpus must load.");
assert(clinicalTrialsCorpus.sourceLabel === "Botulinum toxin Clinical Trials Meltwater corpus", "Clinical Trials must use its dedicated Botulinum toxin corpus.");
const moduleResults = modules.map((moduleId) => buildModuleIntelligence(
  moduleId,
  "Botulinum toxin",
  moduleId === "clinical_trials" ? clinicalTrialsCorpus.findings : corpus.findings,
  "2026-08-15T16:00:00.000Z"
));
for (const result of moduleResults) {
  const moduleId = result.moduleId;
  assert(result.sections.length === 4 && result.evidence.length > 0, `${moduleId} must generate contextual Botulinum toxin intelligence.`);
}
assert(new Set(moduleResults.map((result) => result.evidence.map((item) => item.findingId).join("|"))).size === modules.length, "Each Botulinum toxin module must use a distinct contextual evidence set.");
const clinicalTrials = moduleResults.find((result) => result.moduleId === "clinical_trials");
assert(clinicalTrials?.dataQuality.corpusFindingCount === clinicalTrialsCorpus.findings.length, "Clinical Trials generation must analyze the dedicated corpus.");
assert(clinicalTrials.evidence.some((item) => item.evidenceClass === "clinical_study"), "Clinical Trials evidence must include directly classified study records.");
const patient = buildPatientIntelligence("Botulinum toxin", corpus.findings, "2026-08-11T16:00:00.000Z");
assert(patient.therapeuticArea === "Botulinum toxin" && patient.dataQuality.corpusFindingCount === corpus.findings.length && patient.dataQuality.patientVoiceFindingCount > 0, "Patient Intelligence must run against patient voice in the Botulinum toxin corpus.");

const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608110001_register_botulinum_toxin.sql"), "utf8");
assert(migration.includes("'Botulinum toxin'") && migration.includes("user_therapeutic_access"), "Staging migration must register and assign Botulinum toxin access.");

console.log(JSON.stringify({
  therapeuticArea: coverage.therapeuticArea,
  corpusFindings: corpus.findings.length,
  themes: intelligence.themeSummary.map((theme) => theme.themeId),
  modules,
  patientVoiceFindings: patient.dataQuality.patientVoiceFindingCount,
  knowledgeGraph: true,
  executiveBrief: true,
  longitudinalTracking: true,
}, null, 2));
