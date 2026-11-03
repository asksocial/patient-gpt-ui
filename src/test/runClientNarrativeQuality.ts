import assert from "node:assert/strict";
import { buildQuestionEvidence, questionEvidenceAnswer } from "../answering/search/buildQuestionEvidence";
import { buildCorpusBurdenAnswer, buildCorpusCharts } from "../answering/personas/buildCorpusCharts";
import { CLIENT_NARRATIVE_INSTRUCTIONS } from "../answering/narrative/clientNarrative";
import { executiveNarrative } from "../answering/narrative/intelligenceNarratives";
import type { CanonicalFinding } from "../answering/models/finding";
import { preserveRawMetadata } from "../ingestion/metadata";
import { getPromptDefinition } from "../lib/ai-gateway/registries";
import { buildSourceGroundedSearchAnswer } from "../lib/answers/composeHybridAnswer";
import { buildModuleIntelligence, MODULE_INTELLIGENCE_PROFILES, type GeneratableModuleId } from "../lib/module-intelligence/buildModuleIntelligence";
import { moduleExecutiveSummary } from "../lib/module-intelligence/summaryCopy";
import { buildPatientIntelligence } from "../lib/patient-intelligence/buildPatientIntelligence";

function finding(id: string, text: string): CanonicalFinding {
  return {
    findingId: id, therapeuticArea: "GLP-1", findingType: "other", canonicalClaim: text, summary: text,
    countries: ["Japan"], platforms: ["Reddit"], personas: ["patient"], symptoms: ["fatigue"], treatments: ["Wegovy"],
    lifecycleStages: [], intentLabels: [], normalizedLabels: [], confidence: .9, relevanceScore: .9, evidenceStrength: .9, semanticFingerprint: id,
    rawMetadata: preserveRawMetadata({ Country: "Japan", Title: "Wegovy discussion", "Opening Text": text, "Source Type": "forum", Language: "English", URL: `https://example.test/${id}` }, { adapter: "meltwater", sourceProvider: "fixture" }),
    evidence: [{ sourceId: id, sourceType: "live", excerpt: text, url: `https://example.test/${id}` }],
  };
}

function assertNarrative(text: string) {
  assert.ok(text.split(/(?<=[.!?])\s+/).length >= 3, text);
  assert.match(text, /further|additional|research|review/i);
  assert.doesNotMatch(text, /The matching material|Matching source markets|evaluated eligible findings|Patient Intelligence analyzed|For What are/i);
  assert.doesNotMatch(text, /proven|clinically verified|causes patients to|patients should take/i);
}

// Topic and question wording change; the client-facing construct stays consistent.
for (const [question, text] of [
  ["What are GLP-1 cost concerns in Japan?", "I take Wegovy and my insurance coverage changed. I cannot afford the price."],
  ["What are GLP-1 side effects?", "I take Wegovy and I have nausea and fatigue after my injection."],
  ["What do people say about GLP-1 maintenance?", "I take Wegovy for weight maintenance and I am still taking my weekly treatment."],
  ["What GLP-1 education questions are being discussed?", "I take Wegovy and I have questions and confusion about the information."],
  ["What GLP-1 policy discussions are present?", "Wegovy regulatory approval and policy are discussed."],
  ["What GLP-1 dosing questions are discussed?", "I take Wegovy and I have questions about dose adjustment and weekly injections."],
]) {
  const evidence = buildQuestionEvidence(question, [finding("topic", text)], ["GLP-1", "Wegovy"])!;
  assert.ok(evidence.topics.some(topic => topic.count > 0), question);
  assertNarrative(questionEvidenceAnswer(evidence));
}

const context = "I am a patient taking Wegovy. I am worried about side effects, treatment cost and insurance coverage. I need support and plain-language information about recovery and expectations. Scientific evidence and clinical study efficacy leave unanswered questions. I enrolled in a clinical trial after screening and eligibility review. The research team arranged a site visit and protocol follow-up. Public trust, reputation, media coverage, misinformation, advocacy and education matter to our community. Competitor products, alternative brands, market share, launch, pricing, switching and demand are discussed.";
const records = [finding("experience", context), finding("advocacy", "Wegovy patient organizations and caregivers want education, policy reform and patient advocacy community support.")];
for (const moduleId of Object.keys(MODULE_INTELLIGENCE_PROFILES) as GeneratableModuleId[]) {
  const result = buildModuleIntelligence(moduleId, "GLP-1", records, undefined, { relevancePolicy: "prequalified" });
  assert.ok(result.sections.some(section => section.findingCount > 0), moduleId);
  assertNarrative(result.executiveSummary);
  // Saved reports use their existing evidence for the updated presentation.
  assert.equal(moduleExecutiveSummary("Old mechanical summary", result), result.executiveSummary);
  const empty = buildModuleIntelligence(moduleId, "GLP-1", []);
  assert.match(empty.executiveSummary, /does not yet provide enough evidence/);
  assert.doesNotMatch(empty.executiveSummary, /highlight /);
}
const patient = buildPatientIntelligence("GLP-1", records);
assertNarrative(patient.executiveSummary);
assert.equal(moduleExecutiveSummary("Old patient summary", patient), patient.executiveSummary);

const fallback = buildSourceGroundedSearchAnswer({ question: "How do people describe treatment?", therapeuticArea: "GLP-1", curatedThemes: [], liveThemes: [{ name: "Treatment questions", description: "Questions about treatment" }], matches: [] });
assertNarrative(fallback.directAnswer);
assertNarrative(buildCorpusBurdenAnswer(buildCorpusCharts(records.map(record => ({ symptoms: record.symptoms }))).burdens));

const executive = executiveNarrative({ therapeuticArea: "GLP-1", topThemes: [{ label: "Treatment questions", eligiblePercent: 20 }], dataQuality: { temporalCoveragePercent: 50 } });
assertNarrative(executive);
assert.match(executive, /Incomplete date coverage/);
assert.match(executiveNarrative({ therapeuticArea: "GLP-1", topThemes: [], dataQuality: { temporalCoveragePercent: 100 } }), /does not yet provide enough evidence/);

for (const promptId of ["compose_hybrid_answer", "agent_workflow_execution"]) {
  const prompt = getPromptDefinition(promptId)!;
  assert.ok(prompt.instructions.includes(CLIENT_NARRATIVE_INSTRUCTIONS), promptId);
  assert.match(prompt.instructions, /Preserve citations, exact source quotations/);
}
console.log("PASS client narrative structure across question types, all six modules, patient and executive summaries, saved reports, fallbacks and AI instructions");
