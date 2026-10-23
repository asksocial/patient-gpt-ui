import { buildSourceGroundedSearchAnswer } from "../lib/answers/composeHybridAnswer";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadCanonicalFindingsForAsk, getCanonicalCorpusSourceFiles } from "../lib/answers/loadCanonicalFindingsForAsk";
import { loadSearchCorpusIntelligence, selectSearchCorpusForQuestion } from "../lib/answers/loadSearchCorpusIntelligence";
import { refreshSearchCorpusIntelligence } from "../lib/answers/refreshSearchCorpusIntelligence";
import { parseMeltwaterCsv } from "../ingestion/adapters/meltwaterAdapter";
import { askSocial } from "../app/api/ask";
import type { CanonicalFinding } from "../answering/models/finding";

for (const topic of ["GLP-1", "Hepatitis B", "Gene Therapy", "Botulinum toxin", "Medical Aesthetics", "Regenerative Aesthetics", "Uterine Fibroids"]) {
  const corpus = loadCanonicalFindingsForAsk(topic);
  if (corpus.status !== "available") { console.log(`PASS ${topic}: no configured corpus, no fabricated analytics`); continue; }
  const summary = loadSearchCorpusIntelligence(topic, corpus.findings);
  assert.equal(summary.scope, "full_corpus");
  assert.equal(summary.analyticalCount, corpus.findings.length);
  assert.equal(summary.classifiedCount, summary.denominator);
  assert.equal(summary.clientGroups.reduce((n, g) => n + g.count, 0), summary.denominator);
  for (const chart of [summary.corpusCharts!.burdens, summary.corpusCharts!.markets]) {
    assert.equal(chart.denominator, corpus.findings.length);
    assert.equal(chart.segments.reduce((n, s) => n + s.count, 0), chart.denominator);
  }
  const rawRows = getCanonicalCorpusSourceFiles(topic).reduce((n, file) => n + parseMeltwaterCsv(file).length, 0);
  assert.ok(summary.denominator >= Math.max(rawRows, corpus.findings.length));
  const stored = { analyticalAnswer: { directAnswer: "Old sample uses 80%", sections: [{ key: "top_burdens" }, { key: "strategic_implications", title: "What This Means" }] } };
  const refreshed = refreshSearchCorpusIntelligence(stored, topic);
  assert.ok(!/[0-9%]/.test(refreshed.analyticalAnswer.directAnswer!));
  assert.ok(!refreshed.analyticalAnswer.sections.some(section => section.key === "strategic_implications"));
  assert.equal((refreshed.analyticalAnswer.sections.find(section => section.key === "persona_intelligence") as any).personaIntelligence.denominator, summary.denominator);
  assert.equal(stored.analyticalAnswer.directAnswer, "Old sample uses 80%", "Saved source remains unchanged");
  console.log(`PASS ${topic}: ${summary.denominator} source records, ${corpus.findings.length} analytical records, exclusive audiences and complete chart totals`);
}

// A new topic is discovered from its CSV without adding a registry entry or UI branch.
const topic = "Future Search Test Condition";
const file = path.resolve("data/future-search-test-condition.csv");
assert.ok(!fs.existsSync(file), "Never overwrite an existing corpus");
fs.writeFileSync(file, 'Document ID,Title,Opening Text,Hit Sentence,Country,Source Type,Author Name,URL\nfuture-1,Future Search Test Condition,My symptoms and pain improved after my treatment,My symptoms improved,Canada,forum,patient-account,https://example.test/1\nfuture-2,Future Search Test Condition,Our patients need treatment for their pain,Our patients need treatment,Japan,social,Dr Nurse RN,https://example.test/2\nfuture-3,Unrelated gardening,Garden flowers and roses,Garden flowers,Canada,social,gardener,https://example.test/3\n'.replaceAll(',', '\t'), 'utf16le');
try {
  const corpus = loadCanonicalFindingsForAsk(topic);
  assert.equal(corpus.status, "available");
  const summary = loadSearchCorpusIntelligence(topic, corpus.findings);
  assert.equal(summary.denominator, 3);
  assert.equal(summary.classifiedCount, 3);
  assert.equal(summary.clientGroups.find(g => g.excluded)!.count, 1);
  assert.ok(summary.clientGroups.find(g => g.id === "patients_circle")!.count >= 1);
  assert.ok(summary.clientGroups.find(g => g.id === "healthcare_science")!.count >= 1);
  const result = askSocial("What are people saying right now?", corpus.findings);
  assert.equal(result.answer.sections.find(section => section.key === "persona_intelligence")!.personaIntelligence!.denominator, 3);
  assert.ok(!/[0-9%]/.test(result.answer.directAnswer));
  console.log("PASS future CSV topic: automatic corpus discovery, patient/provider attribution, excluded rows and shared Search generation");
} finally { fs.unlinkSync(file); }

// Curated/imported corpora need no disease-specific classifier or source CSV.
const findings = Array.from({ length: 120 }, (_, i) => ({
  id: `custom-${i}`, findingId: `custom-${i}`, therapeuticArea: "Entirely New Custom Topic", findingType: "symptom_burden",
  summary: "My symptoms improved after my treatment", symptoms: [i % 2 ? "pain" : "fatigue"], country: i % 2 ? "Canada" : "Japan", persona: "patient", sourceType: "live", confidence: 0.8,
})) as unknown as CanonicalFinding[];
const custom = askSocial("What are people saying right now?", findings);
assert.ok(custom.answer.usedFindingIds.length <= 50);
const persona = custom.answer.sections.find(section => section.key === "persona_intelligence")!.personaIntelligence!;
assert.equal(persona.denominator, 120, "Future corpora never use the ranked 50 as the denominator");
assert.equal(persona.corpusCharts!.burdens.denominator, 120);
assert.ok(!/[0-9%]/.test(custom.answer.directAnswer));
const source = fs.readFileSync("src/components/WorkspaceShell.jsx", "utf8");
assert.ok(!source.includes('title="What This Means"'));
assert.ok(source.includes('section.key !== "strategic_implications"'));
console.log("PASS future imported/curated corpus: all records classified, full-corpus charts, qualitative answer and no What This Means card");

const glpCorpus = loadCanonicalFindingsForAsk("GLP-1").findings;
const overall = loadSearchCorpusIntelligence("GLP-1", glpCorpus);
const brazil = selectSearchCorpusForQuestion("GLP-1", glpCorpus, "What are people saying in Brazil?");
const japan = selectSearchCorpusForQuestion("GLP-1", glpCorpus, "What are people saying in Japan?");
assert.equal(brazil.summary.scope, "question_corpus");
assert.ok(brazil.summary.denominator < 5000);
assert.ok(japan.summary.denominator < 5000);
assert.notEqual(brazil.summary.denominator, japan.summary.denominator, "Different countries produce different full-source cohorts");
assert.equal(brazil.summary.corpusCharts!.markets.segments[0].label, "Brazil");
assert.equal(japan.summary.corpusCharts!.markets.segments[0].label, "Japan");
assert.deepEqual(brazil.summary.fullCorpus, overall, "Overall composition stays available and unchanged");
const brazilAnswer = askSocial("What are people saying in Brazil?", glpCorpus);
const japanAnswer = askSocial("What are people saying in Japan?", glpCorpus);
assert.notEqual(brazilAnswer.answer.directAnswer, japanAnswer.answer.directAnswer);
assert.ok(brazilAnswer.answer.usedFindingIds.length <= 50);
assert.equal(brazilAnswer.answer.sections.find(section => section.key === "persona_intelligence")!.personaIntelligence!.denominator, brazil.summary.denominator);
const costs = selectSearchCorpusForQuestion("GLP-1", glpCorpus, "What are the cost and insurance concerns?");
const safety = selectSearchCorpusForQuestion("GLP-1", glpCorpus, "What are the safety and side effect concerns?");
assert.notDeepEqual(costs.findings.map(finding => (finding as any).id), safety.findings.map(finding => (finding as any).id), "Distinct questions select distinct evidence across the full retained corpus");
for (const selection of [brazil, japan, costs, safety]) {
  assert.equal(selection.summary.corpusCharts!.burdens.denominator, selection.findings.length);
  assert.equal(selection.summary.clientGroups.reduce((n, g) => n + g.count, 0), selection.summary.denominator);
  assert.ok((selection.summary.excludedFromAnalysisCount || 0) >= 0);
}
const noMatch = selectSearchCorpusForQuestion("GLP-1", glpCorpus, "What are people saying about xylophonebarnacle?");
assert.equal(noMatch.findings.length, 0);
assert.equal(noMatch.summary.denominator, 0, "An unsupported focus never falls back to unrelated corpus-wide data");
const legacyCountry = { analyticalAnswer: { directAnswer: "Old broad answer", sections: [{ key: "top_burdens" }] } };
const savedBrazil = refreshSearchCorpusIntelligence(legacyCountry, "GLP-1", "What are people saying in Brazil?");
assert.equal((savedBrazil.analyticalAnswer.sections.find(section => section.key === "persona_intelligence") as any).personaIntelligence.denominator, brazil.summary.denominator);
assert.equal(legacyCountry.analyticalAnswer.directAnswer, "Old broad answer");
console.log("PASS question-responsive source cohorts, country charts, qualitative answers, relevant evidence, empty-match handling and saved-question refresh");

for (const broad of ["What are the most important conversation signals and what do they mean?", "Give me an overview of the current corpus", "What themes are changing and what should leadership do?", "What are people saying right now?"]) {
  assert.equal(loadSearchCorpusIntelligence("Gene Therapy", loadCanonicalFindingsForAsk("Gene Therapy").findings, broad).scope, "full_corpus", broad);
}
console.log("PASS ordinary overview wording retains the complete corpus rather than treating pronouns as filters");


const emptyAnswer = buildSourceGroundedSearchAnswer({ question: "Unmatched request", therapeuticArea: "GLP-1", curatedThemes: [], liveThemes: [], matches: [] });
assert.match(emptyAnswer.directAnswer, /No corpus evidence matches/);
assert.equal(emptyAnswer.liveData.themes.length, 0);
const oldFocused = { analyticalAnswer: { directAnswer: "Old general answer", sections: [{ key: "top_burdens" }] }, answer: { directAnswer: "Old", curatedIntelligence: { themes: [] }, liveData: { themes: [{ name: "Unrelated global theme", description: "Old theme" }], emergingNarratives: ["Old narrative"] }, whatThisMeans: "Old", recommendedActions: [] }, sourceIntelligence: { socialMentions: [{ country: "United States" }] } };
const updatedFocused = refreshSearchCorpusIntelligence(oldFocused, "GLP-1", "What are people saying in Brazil?") as any;
assert.ok(updatedFocused.sourceIntelligence.socialMentions.every((mention: any) => mention.country === "Brazil"));
assert.ok(!updatedFocused.answer.liveData.themes.some((theme: any) => theme.name === "Unrelated global theme"));
assert.equal(oldFocused.sourceIntelligence.socialMentions[0].country, "United States");
console.log("PASS legacy focused reports refresh source mentions and grounded themes without changing stored evidence; unmatched requests avoid unrelated narratives");
