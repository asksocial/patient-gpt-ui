import assert from "node:assert/strict";
import { classifyGlp1ExperienceThemes, buildGlp1ExperienceCharts } from "../answering/personas/glp1ExperienceThemes";
import { buildCorpusCharts } from "../answering/personas/buildCorpusCharts";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import { selectSearchCorpusForQuestion } from "../lib/answers/loadSearchCorpusIntelligence";
import { refreshSearchCorpusIntelligence } from "../lib/answers/refreshSearchCorpusIntelligence";

const classify = (summary: string) => classifyGlp1ExperienceThemes({ summary });
for (const [text, expected] of [
  ["맞고 메스꺼움이 심하고 소화가 안 돼요", "digestive"],
  ["注射後に吐き気がする", "digestive"],
  ["No nausea, no constipation on Wegovy", "digestive"],
  ["마운자로 실비거부 약값 32만원", "access"],
  ["体重55.35kg 食事量が減った", "outcomes"],
  ["단약 2달찬데 7키러 복구됨", "maintenance"],
  ["5mg 증량 4일차", "dosing"],
  ["주사 맞고 식욕이 없어요", "appetite"],
  ["식단하고 운동 계속", "nutrition"],
  ["피임약 먹는중인데 마운자로 고민됨", "reproductive"],
  ["hair loss and fatigue", "safety"],
  ["I lost 50lbs since starting Zepbound", "outcomes"],
  ["Minha amiga foi aplicar Mounjaro", "dosing"],
] as const) assert.equal(classify(text).primary?.id, expected, text);

for (const text of ["마운자로 마이너 갤러리", "Ozempic", "추천검색", "비온다 힝", "정병들은 글삭제", "hello https://example.test/dose/weight/insurance", "My job is hard work"]) {
  assert.equal(classify(text).primary, undefined, "Do not invent an experience from brands, URLs or vague chatter: " + text);
}
assert.equal(classifyGlp1ExperienceThemes({ summary: "nausea", rawMetadata: { fields: { Title: "추천검색", "Hit Sentence": "hello" } } }).primary, undefined, "Source text takes precedence over derived summaries");
assert.ok(classify("No nausea, I lost weight, my dose is 5mg").matches.length >= 3, "Retain all supported labels for audit");
assert.equal(classifyGlp1ExperienceThemes({ rawMetadata: { fields: { Title: "My appetite has changed", "Hit Sentence": "I discussed pregnancy with my doctor" } } }).primary?.id, "appetite", "An incidental detail must not displace the explicit title topic");

const corpus = loadCanonicalFindingsForAsk("GLP-1");
assert.equal(corpus.status, "available");
const question = "What are patients and caregivers saying about their treatment experiences?";
const selection = selectSearchCorpusForQuestion("GLP-1", corpus.findings, question);
const chart = selection.summary.corpusCharts!.burdens;
assert.equal(chart.denominator, 634);
assert.equal(chart.segments.reduce((n, s) => n + s.count, 0), chart.denominator, "Count every post exactly once");
assert.ok(chart.segments.filter(s => s.id !== "remainder").length > 2, "Show every supported category, not just two");
const originalRemainder = selection.findings.filter(f => !f.symptoms.some(s => ["weight and metabolic outcomes", "appetite and eating"].includes(s)));
assert.equal(originalRemainder.length, 616, "Reproduce the screenshot's original residual");
const recovered = originalRemainder.filter(f => classifyGlp1ExperienceThemes(f).primary);
assert.ok(recovered.length >= 550, "Recover supported multilingual labels from the old residual");
assert.ok(chart.segments.find(s => s.id === "remainder")!.count > 0, "Keep genuinely unsupported content explicit");
assert.deepEqual(selection.summary.corpusCharts!.markets, buildCorpusCharts(selection.findings.map(f => ({ country: f.countries?.[0] || (f as any).country }))).markets, "Do not alter markets or source population");
assert.equal(selection.summary.denominator, 639, "Audience source denominator is preserved");
const before = JSON.stringify(selection.findings);
buildGlp1ExperienceCharts(selection.findings);
assert.equal(JSON.stringify(selection.findings), before, "Do not mutate canonical records or PV symptoms");
const safety = selectSearchCorpusForQuestion("GLP-1", corpus.findings, "What safety concerns are people discussing?");
assert.equal(safety.summary.corpusCharts!.burdens.title, undefined, "Explicit question-topic charts retain their scope");
const saved = { analyticalAnswer: { directAnswer: "Old answer", sections: [{ key: "top_burdens" }] } };
const refreshed = refreshSearchCorpusIntelligence(saved, "GLP-1", question);
const persona = refreshed.analyticalAnswer.sections.find((s: any) => s.key === "persona_intelligence") as any;
assert.deepEqual(persona.personaIntelligence.corpusCharts.burdens, chart, "Saved reports refresh to the new labels");
assert.equal(saved.analyticalAnswer.directAnswer, "Old answer");
assert.equal(buildGlp1ExperienceCharts([]).burdens.denominator, 0);
console.log(`PASS GLP-1 experience labels: ${chart.highlightCount}/${chart.denominator} labeled; ${recovered.length}/616 formerly residual posts recovered; source counts, query scope, saved refresh and exclusive chart totals preserved`);
