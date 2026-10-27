import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CanonicalFinding } from "../answering/models/finding";
import { GLP1_AUDIENCE_VERSION } from "../ingestion/glp1Audience";
import { getCanonicalCorpusRevision, loadCanonicalFindingsForAsk, loadCanonicalFindingsForModule } from "../lib/answers/loadCanonicalFindingsForAsk";
import { loadGlp1PersonaIntelligence } from "../lib/answers/loadGlp1PersonaIntelligence";
import { loadCurrentGlp1ExecutiveIntelligence } from "../lib/answers/loadCurrentGlp1ExecutiveIntelligence";
import { loadSearchCorpusIntelligence } from "../lib/answers/loadSearchCorpusIntelligence";
import { buildModuleIntelligence, buildModuleEvidenceCatalog, MODULE_INTELLIGENCE_PROFILES, type GeneratableModuleId } from "../lib/module-intelligence/buildModuleIntelligence";
import { buildPatientIntelligence, buildPatientEvidenceCatalog } from "../lib/patient-intelligence/buildPatientIntelligence";

function sourceId(finding: CanonicalFinding) {
  return String(finding.findingId || (finding as CanonicalFinding & { id?: string }).id).replace(/^"+|"+$/g, "");
}

const corpus = loadCanonicalFindingsForAsk("GLP-1");
assert.equal(corpus.status, "available");
assert.equal(corpus.findings.length, 4737, "Modules must receive the expanded analytical corpus.");
assert(corpus.findings.every(finding => finding.audienceClassification?.version === GLP1_AUDIENCE_VERSION));
const ids = new Set(corpus.findings.map(sourceId));
const moduleIds = Object.keys(MODULE_INTELLIGENCE_PROFILES) as GeneratableModuleId[];
const report = [];
for (const moduleId of moduleIds) {
  const moduleCorpus = loadCanonicalFindingsForModule("glp1", moduleId);
  assert.equal(moduleCorpus.status, "available");
  assert.equal(moduleCorpus.findings.length, corpus.findings.length);
  assert.deepEqual(moduleCorpus.findings.map(sourceId), corpus.findings.map(sourceId), `${moduleId} must use the same current source records as Search.`);
  const result = buildModuleIntelligence(moduleId, "GLP-1", moduleCorpus.findings);
  assert.equal(result.dataQuality.corpusFindingCount, 4737);
  assert(result.evidence.length > 0 && result.evidence.every(item => ids.has(item.findingId)));
  const catalog = buildModuleEvidenceCatalog(moduleId, "GLP-1", moduleCorpus.findings);
  assert(catalog.total > 0 && catalog.items.every(item => ids.has(item.findingId)), `${moduleId} evidence browsing must use the same updated corpus.`);
  report.push({ module: result.moduleLabel, corpusFindings: result.dataQuality.corpusFindingCount, selectedFindings: result.dataQuality.selectedFindingCount, browsableEvidence: catalog.total });
}
const patient = buildPatientIntelligence("GLP-1", corpus.findings);
assert.equal(patient.dataQuality.corpusFindingCount, 4737);
assert.equal(patient.dataQuality.patientVoiceFindingCount, 277);
for (const dimension of patient.evidenceDimensions) {
  const catalog = buildPatientEvidenceCatalog("GLP-1", corpus.findings, dimension.id);
  assert(catalog.items.every(item => ids.has(item.findingId)));
}
const composition = loadGlp1PersonaIntelligence();
assert.equal(composition.denominator, 5000);
assert.equal(composition.analyticalCount, 4737);
assert.equal(loadCurrentGlp1ExecutiveIntelligence("GLP-1")!.executiveIntelligence.dataQuality.datasetFindingCount, 4737);

// Replace an isolated export within the same process to reproduce warm-server
// staleness. The real source CSV and historical reports are never modified.
const originalCwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "glp1-module-corpus-"));
try {
  fs.mkdirSync(path.join(fixture, "data"));
  process.chdir(fixture);
  const file = path.join(fixture, "data/glp-1.csv");
  function writeRows(rowIds: string[]) {
    const lines = ["Document ID\tTitle\tURL\tSource Type\tLanguage\tDate\tCountry", ...rowIds.map(id => `${id}\tI started Wegovy and my appetite improved after my weekly injection\thttps://example.com/${id}\tsocial network\tEnglish\t2026-10-20\tUnited States`)];
    fs.writeFileSync(file, Buffer.from("\uFEFF" + lines.join("\n"), "utf16le"));
    fs.utimesSync(file, 1700000000, 1700000000);
  }
  writeRows(["row1"]);
  const before = getCanonicalCorpusRevision("GLP-1");
  assert.equal(loadCanonicalFindingsForAsk("GLP-1").findings.length, 1);
  assert.equal(loadGlp1PersonaIntelligence().denominator, 1);
  assert.equal(loadCurrentGlp1ExecutiveIntelligence("GLP-1")!.executiveIntelligence.dataQuality.datasetFindingCount, 1);
  writeRows(["row2"]);
  assert.notEqual(getCanonicalCorpusRevision("GLP-1"), before, "Replacing a same-size export with the same mtime must invalidate warm caches.");
  assert.equal(sourceId(loadCanonicalFindingsForAsk("GLP-1").findings[0]), "row2");
  writeRows(["row2", "row3"]);
  for (const moduleId of moduleIds) assert.equal(loadCanonicalFindingsForModule("GLP-1", moduleId).findings.length, 2);
  const updated = loadCanonicalFindingsForAsk("GLP-1").findings;
  assert.equal(loadGlp1PersonaIntelligence().denominator, 2);
  assert.equal(loadSearchCorpusIntelligence("GLP-1", updated).denominator, 2);
  assert.equal(loadCurrentGlp1ExecutiveIntelligence("GLP-1")!.executiveIntelligence.dataQuality.datasetFindingCount, 2);

  const moduleFile = path.join(fixture, "data/glp-1-clinical-trials.csv");
  fs.copyFileSync(file, moduleFile);
  assert.equal(loadCanonicalFindingsForModule("GLP-1", "clinical_trials").findings.length, 2);
  writeRows(["row4"]); fs.copyFileSync(file, moduleFile);
  assert.equal(loadCanonicalFindingsForModule("GLP-1", "clinical_trials").findings.length, 1, "Module-specific exports must also invalidate their own cache.");
} finally {
  process.chdir(originalCwd);
  fs.rmSync(fixture, { recursive: true, force: true });
}
assert.equal(loadCanonicalFindingsForAsk("GLP-1").findings.length, 4737);
assert.equal(loadGlp1PersonaIntelligence().denominator, 5000);
console.log(JSON.stringify({ sourceRows: 5000, analyticalFindings: 4737, modules: report, patientVoiceFindings: 277, warmCacheRefresh: "passed" }, null, 2));
