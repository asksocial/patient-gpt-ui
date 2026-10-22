import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { askSocial } from "../app/api/ask";
import { adaptMeltwaterRows, parseMeltwaterCsv } from "../ingestion/adapters/meltwaterAdapter";
import { glp1Profile } from "../ingestion/profiles/glp1Profile";
import { getRankingProfile } from "../answering/ranking/getRankingProfile";
import { getThemeTaxonomy } from "../answering/themes/taxonomies";
import { normalizeTherapeuticAreaId } from "../lib/analytics/coverage";
import { loadCanonicalFindingsForAsk, loadCanonicalFindingsForModule } from "../lib/answers/loadCanonicalFindingsForAsk";
import { getTherapeuticAreaCapabilityContract } from "../lib/therapeuticAreaCapabilities";
import { buildModuleIntelligence, MODULE_INTELLIGENCE_PROFILES, type GeneratableModuleId } from "../lib/module-intelligence/buildModuleIntelligence";
import { buildPatientIntelligence } from "../lib/patient-intelligence/buildPatientIntelligence";
import { MODE_ANALYSIS_PROFILES, runModeTherapeuticAreaEvaluation } from "../lib/intelligence-platform";
import { enrichFindingsWithEvidenceIntelligence } from "../answering/evidence";

const bytes = fs.readFileSync("data/glp-1.csv");
assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), "937c80bf2ade6d10cde9cc412f60a61f493f811efd0e45adee32cd2799cd17bb", "The source export must remain byte-for-byte intact.");
const rows = parseMeltwaterCsv("data/glp-1.csv");
assert.equal(rows.length, 5000);
assert(rows.every((row) => Object.keys(row).length === 49 && row["Document ID"]));
assert.equal(rows.filter((row) => !row.URL).length, 3, "Preserve the three source rows without URLs without inventing citations.");
for (const alias of ["GLP-1", "glp1", "glp_1", "GLP 1"]) {
  assert.equal(normalizeTherapeuticAreaId(alias), "glp_1");
  assert.equal(getRankingProfile(alias).profileId, "glp_1");
}
const context = { sourceType: "meltwater" as const, therapeuticArea: "GLP-1", profile: glp1Profile };
const adapted = adaptMeltwaterRows([
  { "Document ID": "shot", Title: "I started my weekly Wegovy shot and my appetite has changed.", URL: "https://example.com/shot" },
  { "Document ID": "jab", Title: "My Ozempic jab has reduced food noise and cravings.", URL: "https://example.com/jab" },
  { "Document ID": "unrelated", Title: "I lost my appetite and my weight changed without medication.", URL: "https://example.com/unrelated" },
  { "Document ID": "spam", Title: "Buy now GLP-1 semaglutide promo code for a limited offer.", URL: "https://example.com/spam" },
], context);
assert.deepEqual(adapted.map((finding) => finding.id), ["shot", "jab"], "Retain injection experiences and exclude unrelated or promotional rows.");

const corpus = loadCanonicalFindingsForAsk("GLP-1");
assert.equal(corpus.status, "available");
assert(corpus.findings.length > 2000);
assert(corpus.findings.every((finding) => finding.therapeuticArea === "GLP-1"));
assert.equal(getThemeTaxonomy("GLP-1")?.themes.length, 8);
const contract = getTherapeuticAreaCapabilityContract("GLP-1");
assert.equal(contract.dataReadiness.analyticalCoverage, "validated");
assert(Object.values(contract.precision).every((value) => value === "custom"));
const enriched = enrichFindingsWithEvidenceIntelligence(corpus.findings);
const modeResults = [];
for (const profile of MODE_ANALYSIS_PROFILES) {
  const result = askSocial("What are the main GLP-1 treatment experiences, access barriers, outcomes, and treatment choices?", corpus.findings, { modeId: profile.modeId });
  assert(result.themeSummary.length > 0);
  assert.equal(result.knowledgeSnapshot?.therapeuticArea, "glp_1");
  assert(result.executiveIntelligence);
  assert(result.themeLongitudinalTracking.datedFindingCount > 0);
  assert.equal(result.modeAnalysis?.modeId, profile.modeId);
  assert.equal(result.modeAnalysis.sections.length, profile.outputContract.requiredSections.length);
  assert(result.modeAnalysis.evidenceSelection.selectedFindingCount > 0);
  const evaluation = runModeTherapeuticAreaEvaluation({ profile, therapeuticArea: "GLP-1", findings: enriched, themeSummary: result.themeSummary });
  assert(evaluation.passed, evaluation.failures.join(", "));
  modeResults.push(profile.modeId);
}
const moduleResults = [];
for (const moduleId of Object.keys(MODULE_INTELLIGENCE_PROFILES) as GeneratableModuleId[]) {
  const moduleCorpus = loadCanonicalFindingsForModule("GLP-1", moduleId);
  assert.equal(moduleCorpus.status, "available");
  assert.equal(moduleCorpus.sourceLabel, corpus.status === "available" ? corpus.sourceLabel : "");
  const result = buildModuleIntelligence(moduleId, "GLP-1", moduleCorpus.findings);
  assert.equal(result.sections.length, MODULE_INTELLIGENCE_PROFILES[moduleId].sections.length);
  assert(result.evidence.length > 0, `${moduleId} must return evidence.`);
  moduleResults.push({ moduleId, evidence: result.evidence.length });
}
const patient = buildPatientIntelligence("GLP-1", corpus.findings);
assert(patient.dataQuality.patientVoiceFindingCount > 0);
assert.equal(patient.dataQuality.corpusFindingCount, corpus.findings.length);
assert.equal(Object.values(patient.dataQuality.resolvedAudienceCounts).reduce((sum, count) => sum + count, 0), corpus.findings.length);
// Cached callers must not be able to mutate another workflow's corpus.
corpus.findings[0].therapeuticArea = "changed";
assert.equal(loadCanonicalFindingsForAsk("glp1").findings[0].therapeuticArea, "GLP-1");
console.log(JSON.stringify({ sourceRows: rows.length, analyticalFindings: corpus.findings.length, modes: modeResults, modules: moduleResults, patientVoiceFindings: patient.dataQuality.patientVoiceFindingCount, executiveBrief: true, knowledgeGraph: true, longitudinalTracking: true }, null, 2));
