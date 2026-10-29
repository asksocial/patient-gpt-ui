import assert from "node:assert/strict";
import { preserveRawMetadata } from "../ingestion/metadata";
import type { CanonicalFinding } from "../answering/models/finding";
import { sourcePassages } from "../answering/evidence/sourcePassages";
import { MODULE_INTELLIGENCE_PROFILES, buildModuleIntelligence, type GeneratableModuleId } from "../lib/module-intelligence/buildModuleIntelligence";
import { buildPatientIntelligence } from "../lib/patient-intelligence/buildPatientIntelligence";
import { loadCanonicalFindingsForModule } from "../lib/answers/loadCanonicalFindingsForAsk";

const text = `I am a patient taking Wegovy and considering my next treatment. I am worried about pain and side effects after my injection and I need support and more information. What should I expect? The scientific evidence and clinical study efficacy results are unclear and limited evidence leaves unanswered questions. I enrolled in a clinical trial after screening and eligibility criteria were reviewed. The research team and investigator arranged my site visit, protocol questionnaire and follow-up schedule. Travel and time commitment create a burden but I hope to continue through completion. The primary endpoint showed improvement in daily quality of life. My doctor discussed safety monitoring and adverse reactions. Public trust, reputation, media coverage and misinformation about the company matter to our advocacy community. The patient organization, caregivers and stakeholders want education and policy reform. High treatment cost, insurance coverage and access barriers made me compare competitor products and alternative brands. Market share, launch, pricing and switching influence adoption and demand. I want plain-language guidance on recovery, complications and realistic treatment expectations.`;
function finding(id: string, sourceText = text): CanonicalFinding {
  return { findingId: id, therapeuticArea: "GLP-1", findingType: "other", summary: text, canonicalClaim: text, countries: ["United States"], personas: ["patient"], platforms: ["Reddit"], symptoms: [], treatments: ["Wegovy"], lifecycleStages: [], intentLabels: [], normalizedLabels: [], confidence: .9, relevanceScore: .9, evidenceStrength: .9, semanticFingerprint: id, rawMetadata: preserveRawMetadata({ "Opening Text": sourceText, "Source Type": "forum", Language: "English", URL: `https://example.com/mentions/${id}` }, { adapter: "meltwater", sourceProvider: "fixture" }), evidence: [{ sourceId: id, sourceType: "live", excerpt: sourceText, url: `https://example.com/mentions/${id}`, platform: "Reddit" }] };
}
const first = finding("first", text + " This is my own first account.");
const second = finding("second", text.replaceAll(". ", ". In my separate treatment experience, ").replace("I am a patient", "My own experience as a patient") + " This is a separate second account.");
const generatedOnly = finding("generated-only", "My garden is growing and I planted flowers this morning.");
const duplicate = { ...first, findingId: "duplicate" };
const strip = (quote: string) => quote.replace(/^…|…$/g, "");
const ids = Object.keys(MODULE_INTELLIGENCE_PROFILES) as GeneratableModuleId[];
for (const moduleId of ids) {
  const result = buildModuleIntelligence(moduleId, "GLP-1", [first, duplicate, generatedOnly, second], undefined, { relevancePolicy: "prequalified" });
  assert.deepEqual(result.evidenceGroups.map(group => group.id), result.sections.map(section => section.id));
  for (const group of result.evidenceGroups) {
    assert.equal(group.items.length, 2, `${moduleId}/${group.label}: two distinct supporting mentions`);
    assert.equal(new Set(group.items.map(item => item.url)).size, 2);
    for (const item of group.items) {
      assert.notEqual(item.findingId, "generated-only");
      assert.deepEqual(item.matchedSectionIds, [group.id]);
      assert.ok(item.supportingPassages?.some(passage => passage.theme === group.label && passage.quote === item.quote));
      const record = [first, second, duplicate].find(finding => finding.findingId === item.findingId)!;
      assert.ok(sourcePassages(record).some(passage => passage.url === item.url && passage.text.includes(strip(item.quote))), "Quote and URL must belong to the same original source.");
    }
  }
  const scarce = buildModuleIntelligence(moduleId, "GLP-1", [first, duplicate, generatedOnly], undefined, { relevancePolicy: "prequalified" });
  assert.ok(scarce.evidenceGroups.every(group => group.items.length === 1), "Never duplicate a source to fill a pair.");
}
const patientSources = [finding("patient-first", "I am taking Wegovy and considering treatment. I am worried about side effects and cost. I need information and support. What should I expect during recovery? My doctor gave me an injection and I have pain."), finding("patient-second", "I started Wegovy last week and I am considering continuing treatment. I am scared about swelling and treatment costs. Can someone explain the risks? I need information and support from my doctor during follow-up.")];
const patient = buildPatientIntelligence("GLP-1", patientSources, undefined, { evidenceScope: "patient_related" });
assert.equal(patient.evidenceGroups.length, 5);
assert.ok(patient.evidenceGroups.every(group => group.items.length === 2));
for (const group of patient.evidenceGroups) for (const item of group.items) {
  assert.ok(item.supportingPassages?.some(passage => passage.quote === item.quote));
  const record = patientSources.find(finding => finding.findingId === item.findingId)!;
  assert.ok(record && sourcePassages(record).some(passage => passage.url === item.url && passage.text.includes(strip(item.quote))));
}
const misleading = buildModuleIntelligence("medical_affairs", "GLP-1", [
  finding("emotional-reaction", "Weight-loss drugs for children? When I first saw the research, my reaction as a parent was probably surprise."),
  finding("generic-advice", "Semaglutide. Ante cualquier duda, consultá a un médico."),
], undefined, { relevancePolicy: "prequalified" });
assert.equal(misleading.evidenceGroups.find(group => group.id === "safety_discussion")!.items.length, 0, "A parent's emotional reaction is not a safety reaction.");
assert.ok(!misleading.evidenceGroups.find(group => group.id === "medical_questions")!.items.some(item => item.findingId === "generic-advice"), "Generic doctor advice is not a medical question.");
const coverage = [];
for (const moduleId of ids) {
  const corpus = loadCanonicalFindingsForModule("GLP-1", moduleId);
  assert.equal(corpus.status, "available");
  if (corpus.status !== "available") continue;
  const result = buildModuleIntelligence(moduleId, "GLP-1", corpus.findings, undefined, { relevancePolicy: corpus.relevancePolicy });
  for (const group of result.evidenceGroups) {
    assert.ok(group.items.length <= 2);
    assert.equal(group.items.length, 2, `${moduleId}/${group.label}: production theme has a complete pair.`);
    for (const item of group.items) {
      const original = corpus.findings.find(record => String(record.findingId || (record as CanonicalFinding & { id?: string; sourceId?: string }).id || (record as CanonicalFinding & { sourceId?: string }).sourceId || record.semanticFingerprint).replace(/^"+|"+$/g, "") === item.findingId)!;
      assert.ok(original, `${moduleId}/${group.id}: source ${item.findingId} must exist`);
      assert.ok(sourcePassages(original).some(passage => passage.url === item.url && passage.text.includes(strip(item.quote))));
    }
  }
  coverage.push({ module: moduleId, themes: result.evidenceGroups.map(group => `${group.label}: ${group.items.length}`) });
}
console.log(JSON.stringify({ checked: "Two directly supporting samples per primary module theme, source provenance, duplicates, generated-only negatives, Patient dimensions and real GLP-1 corpora", coverage }, null, 2));
