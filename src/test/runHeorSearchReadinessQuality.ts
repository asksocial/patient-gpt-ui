import assert from "node:assert/strict";
import fs from "node:fs";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import { selectSearchCorpusForQuestion } from "../lib/answers/loadSearchCorpusIntelligence";
import { refreshSearchCorpusIntelligence } from "../lib/answers/refreshSearchCorpusIntelligence";
import { buildSourceIntelligence } from "../lib/answers/buildSourceIntelligence";
import { searchRecordText } from "../answering/search/searchSubjects";
import { buildQuestionEvidence } from "../answering/search/buildQuestionEvidence";
import { buildFocusedSearchAnswer } from "../answering/personas/buildCorpusCharts";
import { buildSourceGroundedSearchAnswer } from "../lib/answers/composeHybridAnswer";
import { askSocial } from "../app/api/ask";
import type { CanonicalFinding } from "../answering/models/finding";

const corpus = loadCanonicalFindingsForAsk("GLP-1").findings;
const prompts: Array<[string, RegExp]> = [
  ["What are the cost and insurance concerns?", /insurance and coverage/],
  ["What are patients saying about cost and insurance?", /prices and affordability/],
  ["What are the safety and side effect concerns?", /digestive symptoms/],
  ["What are patients saying about side effects?", /side.effect|digestive/],
  ["What are people saying about appetite and eating?", /appetite|eating/],
  ["What are patients saying about food noise?", /food noise/],
  ["What are patients saying about maintenance?", /maintenance/],
  ["What are patients saying about weight regain?", /weight regain/],
  ["What are patients saying about PCOS?", /PCOS/],
  ["What are people saying about microdosing?", /microdosing/],
  ["What are the cost concerns in Asian markets?", /prices and affordability/],
];
const results: unknown[] = [];
for (const [question, expected] of prompts) {
  const selection = selectSearchCorpusForQuestion("GLP-1", corpus, question);
  const summary = selection.summary;
  const evidence = summary.questionEvidence!;
  assert.ok(selection.findings.length > 0, question);
  assert.ok(evidence?.examples.length > 0, `${question}: source excerpts must accompany the summary`);
  const answer = askSocial(question, corpus).answer;
  assert.match(answer.directAnswer, expected, question);
  assert.ok(!/\d|%/.test(answer.directAnswer), "Analytical narrative stays qualitative");
  assert.ok(!/most frequently identified burden themes/.test(answer.directAnswer), "Focused answers cannot default to symptom synthesis");
  assert.ok(!/personal treatment experience and shared/.test(answer.directAnswer), "Audience role is not a topical answer");
  assert.equal(summary.corpusCharts!.burdens.denominator, selection.findings.length);
  assert.equal(summary.corpusCharts!.burdens.segments.reduce((n, s) => n + s.count, 0), selection.findings.length);
  assert.equal(summary.clientGroups.reduce((n, g) => n + g.count, 0), summary.denominator);
  const byId = new Map(selection.findings.map(f => [f.findingId || (f as any).id, f]));
  for (const example of evidence.examples) {
    const record = byId.get(example.id)!;
    assert.ok(record, "Every example belongs to the matching retained corpus");
    const snippet = example.excerpt.replace(/^…|…$/g, "");
    const fields = record.rawMetadata?.fields || {};
    const candidates = [fields.Title, fields["Opening Text"], fields["Hit Sentence"], ...(record.evidence || []).map(e => e.excerpt), record.summary].filter(Boolean).map(value => String(value).replace(/\s+/g, " ").trim());
    assert.ok(candidates.some(text => text.includes(snippet)), "Quotes preserve original wording; no generated or translated evidence");
  }
  if (/cost/.test(question)) {
    assert.ok(summary.corpusCharts!.burdens.segments.some(s => /prices|coverage|access|affordability/.test(s.label)));
    assert.ok(!summary.corpusCharts!.burdens.segments.some(s => /weight and metabolic/.test(s.label)));
  }
  const stored = { analyticalAnswer: { directAnswer: "Old weight-loss answer", sections: [{ key: "persona_intelligence", personaIntelligence: { ...summary, questionEvidence: undefined } }] }, answer: { directAnswer: "Old", liveData: { themes: [{name: "Unrelated outcome", description: "Old"}], emergingNarratives: ["Old"] }, curatedIntelligence: { themes: [] }, recommendedActions: [], whatThisMeans: "Old" } };
  const refreshed = refreshSearchCorpusIntelligence(stored, "GLP-1", question) as any;
  assert.equal(refreshed.analyticalAnswer.directAnswer, answer.directAnswer);
  assert.ok(!refreshed.answer.liveData.themes.some((t: any) => t.name === "Unrelated outcome"));
  assert.equal(stored.analyticalAnswer.directAnswer, "Old weight-loss answer", "Saved database content remains unchanged");
  const sources = buildSourceIntelligence(selection.findings, evidence);
  const hybrid = buildSourceGroundedSearchAnswer({ questionEvidence: evidence, question, therapeuticArea: "GLP-1", curatedThemes: sources.curatedThemes, liveThemes: sources.socialThemes, matches: [] });
  assert.equal(hybrid.directAnswer, answer.directAnswer);
  assert.equal(hybrid.liveData.emergingNarratives.length, 0);
  assert.ok(hybrid.recommendedActions.every(action => !/promot|market campaign|increase prescribing/i.test(action)));
  assert.ok([...sources.socialThemes, ...sources.curatedThemes].every(theme => evidence.topics.some(t => t.label === theme.name)));
  results.push({question, sourcePosts: summary.denominator, retained: selection.findings.length, excerpts: evidence.examples.length});
}
const patientCost = selectSearchCorpusForQuestion("GLP-1", corpus, prompts[1][0]);
assert.ok(patientCost.summary.denominator > 4, "Native-language access terms recover previously missed patient-related content");
const regain = selectSearchCorpusForQuestion("GLP-1", corpus, prompts[7][0]);
assert.match(buildFocusedSearchAnswer(regain.summary), /limited.*illustrative/);
const rate = selectSearchCorpusForQuestion("GLP-1", corpus, "What percentage of patients stop because of cost?");
assert.ok(rate.findings.length > 0);
assert.match(buildFocusedSearchAnswer(rate.summary), /do not supply a representative patient denominator/);
const household = selectSearchCorpusForQuestion("GLP-1", corpus, "What are the household productivity costs?");
assert.match(buildFocusedSearchAnswer(household.summary), /structured resource.use|No retained/);
const empty = selectSearchCorpusForQuestion("GLP-1", corpus, "What are cost concerns about xylophonebarnacle?");
assert.equal(empty.findings.length, 0);
assert.match(buildFocusedSearchAnswer(empty.summary), /No retained/);
assert.equal(empty.summary.questionEvidence!.examples.length, 0);
const emerging = selectSearchCorpusForQuestion("GLP-1", corpus, "What safety themes are emerging in Asian markets?");
assert.match(buildFocusedSearchAnswer(emerging.summary), /comparable time baseline/);
const hypothetical = [
  { id: "new-cost", findingId: "new-cost", therapeuticArea: "New Demo Topic", summary: "My insurance denied coverage and I cannot afford the treatment price.", country: "Canada", sourceType: "live", persona: "patient", symptoms: ["fatigue"] },
  { id: "new-other", findingId: "new-other", therapeuticArea: "New Demo Topic", summary: "My fatigue improved with treatment.", country: "Canada", sourceType: "live", persona: "patient", symptoms: ["fatigue"] },
] as unknown as CanonicalFinding[];
const custom = selectSearchCorpusForQuestion("New Demo Topic", hypothetical, "What are the cost and insurance concerns?");
assert.equal(custom.findings.length, 1);
assert.match(buildFocusedSearchAnswer(custom.summary), /insurance and coverage/);
assert.ok(searchRecordText(custom.findings[0]).includes("insurance"));
const shell = fs.readFileSync("src/components/WorkspaceShell.jsx", "utf8");
assert.ok(shell.includes('title="Evidence Supporting This Answer"'));
assert.ok(shell.includes('focusedSummary ? "Supporting Conversation Evidence"'));
assert.ok(fs.readFileSync("src/components/CorpusDonutCards.jsx", "utf8").includes('"Topics in This Question"'));
console.log(JSON.stringify({passed: true, demoPrompts: results, guards: ["qualitative question-specific summaries", "source-exact evidence", "matching topic charts", "saved answer upgrade", "thin cohorts", "unsupported rates", "unmatched concepts", "temporal limits", "future corpora"]}, null, 2));

const mixedPost = { ...hypothetical[0], findingId: "mixed", summary: "Generated GLP-1 insurance summary", rawMetadata: { fields: { Title: "Unrelated discussion", "Opening Text": "Insurance companies are investing in AI.", "Hit Sentence": "GLP-1 is mentioned in a separate link.", Language: "English" } } } as unknown as CanonicalFinding;
const mixedEvidence = buildQuestionEvidence("What are the insurance concerns?", [mixedPost], ["GLP-1"]);
assert.equal(mixedEvidence!.examples.length, 0, "An unrelated clause or generated canonical summary cannot become quoted source evidence");
