import assert from "node:assert/strict";
import { paginateThemeMentions } from "../answering/search/themeMentionCatalog";
import { buildQuestionEvidence } from "../answering/search/buildQuestionEvidence";
import { sourcePassages, supportingPassage } from "../answering/evidence/sourcePassages";
import { selectRepresentativeEvidence } from "../answering/themes/selectRepresentativeEvidence";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import { selectSearchCorpusForQuestion } from "../lib/answers/loadSearchCorpusIntelligence";
import { refreshSearchCorpusIntelligence } from "../lib/answers/refreshSearchCorpusIntelligence";
import { buildModuleIntelligence, buildModuleEvidenceCatalog } from "../lib/module-intelligence/buildModuleIntelligence";
import { buildPatientEvidenceCatalog } from "../lib/patient-intelligence/buildPatientIntelligence";
import { preserveRawMetadata } from "../ingestion/metadata";
import type { CanonicalFinding } from "../answering/models/finding";

function finding(id: string, text: string, fields: Record<string, unknown> = {}): CanonicalFinding {
  const url = `https://www.reddit.com/r/GLP1/comments/${id}`;
  return {
    findingId: id, therapeuticArea: "GLP-1", findingType: "other",
    summary: text, canonicalClaim: text, countries: ["United States"], personas: ["patient"], platforms: ["Reddit"],
    symptoms: [], treatments: [], lifecycleStages: [], intentLabels: [], normalizedLabels: [],
    confidence: 0.9, relevanceScore: 0.9, evidenceStrength: 0.9, semanticFingerprint: id,
    rawMetadata: preserveRawMetadata({ Title: "GLP-1 treatment discussion", "Opening Text": text, URL: url, Language: "English", "Source Type": "forum", ...fields }, { adapter: "meltwater", sourceProvider: "fixture" }),
    evidence: [{ sourceId: id, sourceType: "live", excerpt: text, url, platform: "Reddit" }],
  };
}
const question = "What are the main GLP-1 treatment experiences, access barriers, and safety concerns?";
const negative = [
  finding("housing-access", "The state of the world, forests burning and access to housing almost impossible, Ozempic and everything being about selling a product rather than connection."),
  finding("protein-supply", "Tirzepatide and T3 optimize your metabolism and mitochondria, but they aren't clearing an endless spike protein supply."),
  finding("investor-prices", "$LLY returns are down. $NVO Wegovy shares are up. @Investseekers, look at the stock prices."),
  finding("wellness", "Perfect for women over 40 starting a GLP-1 journey, managing side effects, and building a realistic wellness routine without the overwhelm."),
  finding("forum-footer", "오늘은 운동을 했어요. 위고비/마운자로/삭센다 카페는 위고비 효과/삭센다 가격/후기/부작용/처방/삭센다/", { Language: "Korean" }),
  finding("food-supply", "Remove soybean oil from every product in food supply. GLP-1's are not the answer. Healthy food IS."),
  finding("satire", 'Next up, Jelly Roll, they should put a warning label on Ozempic, side effects can include increased risk of TDS.'),
  finding("snack", "Zepbound Snack Ideas should support protein, energy, and fullness — not trigger side effects. This guide shares smart snack options."),
];
const badEvidence = buildQuestionEvidence(question, negative, ["GLP-1", "Ozempic", "Zepbound"]);
assert.ok(!badEvidence?.examples.some(item => ["access:availability", "access:prices", "safety:general_safety"].includes(item.topicId)), "Screenshot false positives must not appear under availability or treatment tolerability.");
const correct = [
  finding("shortage", "I cannot fill my Wegovy prescription because the local pharmacy has a shortage. I have called three pharmacies for stock."),
  finding("symptoms", "I started Ozempic and have been experiencing nausea and constipation. Are these side effects something other patients discuss?"),
];
const goodEvidence = buildQuestionEvidence(question, correct, ["Ozempic", "Wegovy"]);
assert.ok(goodEvidence?.examples.some(item => item.topicId === "access:availability" && item.id === "shortage"));
assert.ok(goodEvidence?.examples.some(item => item.id === "symptoms" && item.topicId.startsWith("safety:")));
for (const item of goodEvidence?.examples || []) {
  assert.ok(item.matchedTerms.length && item.matchedTerms.every(term => item.excerpt.toLowerCase().includes(term.toLowerCase())));
  assert.ok(item.url?.endsWith(item.id), "The displayed quote and source URL retain the same provenance.");
}
const unrelated = finding("derived-only", "I like walking through the park and looking at flowers in the afternoon.");
unrelated.summary = unrelated.canonicalClaim = "Generated claim: GLP-1 shortages, availability, side effects, and clinical evidence.";
unrelated.normalizedLabels = ["shortage", "side effects"];
assert.equal(buildQuestionEvidence(question, [unrelated], ["GLP-1"])?.examples.length, 0, "Generated claims and labels cannot create supporting quotes.");
assert.equal(selectRepresentativeEvidence([unrelated], { themeId: "availability", label: "Availability", description: "Treatment availability", keywords: ["shortage"] }).evidence.length, 0, "Generated labels do not establish representative theme support elsewhere in AskSocial.");
const inherited = finding("comment", "I agree with this discussion about the weather today.", { Title: "GLP-1 shortages and side effects", "Content Type": "comment" });
assert.equal(buildQuestionEvidence(question, [inherited], ["GLP-1"])?.examples.length, 0, "A comment cannot inherit support from the parent title.");
const multi = { ...unrelated, rawMetadata: undefined, evidence: [
  { sourceType: "live" as const, sourceId: "a", excerpt: "I like walking through the park and looking at flowers in the afternoon.", url: "https://example.com/unrelated" },
  { sourceType: "live" as const, sourceId: "b", excerpt: "I cannot obtain my Wegovy prescription because local pharmacies report a shortage.", url: "https://example.com/shortage" },
] };
const linked = supportingPassage(sourcePassages(multi), /shortage/i);
assert.equal(linked?.url, "https://example.com/shortage", "A second excerpt must not borrow the first excerpt's URL.");
const late = finding("late", "I started Wegovy for treatment. " + "I am discussing my everyday routines here. ".repeat(18) + "My Wegovy prescription is unavailable because every local pharmacy has a shortage.");
const lateQuote = supportingPassage(sourcePassages(late), /shortage/i);
assert.ok(lateQuote?.excerpt.includes("shortage") && lateQuote.excerpt.length < 500, "Long source excerpts focus on the supporting passage rather than the opening text.");
const native = finding("native", "마운자로 맞고 구토와 변비 부작용이 생겼어요. 어떻게 해야 되나요?", { Language: "Korean" });
assert.ok(buildQuestionEvidence(question, [native], ["Mounjaro"])?.examples.some(item => /구토|변비|부작용/.test(item.excerpt)), "Original-language evidence remains eligible.");
const mismatched = finding("substring", "I wore a costume while discussing my daily life and GLP-1 treatment.");
assert.equal(selectRepresentativeEvidence([mismatched], { themeId: "cost", label: "Cost", description: "Treatment cost", keywords: ["cost"] }).evidence.length, 0, "Theme words must not match unrelated substrings.");
const multiPassage = finding("same-source-passages", "Clinical research discusses the mechanism and efficacy of Mounjaro treatment.", { "Hit Sentence": "Should I ask my doctor about Mounjaro side effects? I am worried about constipation." });
const overviewEvidence = buildModuleIntelligence("medical_affairs", "GLP-1", [multiPassage]).evidence[0];
assert.ok(overviewEvidence.supportingPassages?.some(passage => passage.theme === "Scientific perception"));
assert.ok(overviewEvidence.supportingPassages?.some(passage => passage.theme === "Medical questions"), "Different excerpts from the same linked source retain their separate theme support.");
const longQuestion = finding("question", "I started Wegovy. " + "I am describing my everyday routines here. ".repeat(16) + "What are the side effects of Wegovy and should I ask my doctor about constipation?");
const catalog = buildModuleEvidenceCatalog("medical_affairs", "GLP-1", [longQuestion], { analysisOnly: true, sectionId: "medical_questions" });
assert.equal(catalog.total, 1);
assert.ok(catalog.items[0].supportingPassages?.some(item => item.theme === "Medical questions" && /\?|question/i.test(item.quote)));
const patient = buildPatientEvidenceCatalog("GLP-1", [finding("fear", "I am taking Wegovy. I am scared and worried about its side effects and I do not know what to expect.")], "emotional_burden", { evidenceScope: "patient_related" });
assert.ok(patient.items.some(item => item.supportingPassages?.some(passage => /scared|worried|fear/i.test(passage.quote))));
const corpus = loadCanonicalFindingsForAsk("GLP-1");
assert.equal(corpus.status, "available");
if (corpus.status !== "available") throw new Error("GLP-1 corpus required");
const selected = selectSearchCorpusForQuestion("GLP-1", corpus.findings, question);
const evidence = selected.summary.questionEvidence;
assert.ok(evidence?.examples.length, "The screenshot question retains actual supporting examples.");
for (const example of evidence?.examples || []) {
  const record = selected.findings.find(item => (item.findingId || (item as CanonicalFinding & { id?: string }).id) === example.id)!;
  assert.ok(record && sourcePassages(record).some(passage => passage.url === example.url && passage.text.includes(example.excerpt.replace(/^…|…$/g, ""))), `${example.topic}: displayed passage and link belong to the original source.`);
  assert.ok(example.matchedTerms.every(term => example.excerpt.toLowerCase().includes(term.toLowerCase())));
}
// Every theme gets two samples when available; the catalog keeps all other matches.
const many = Array.from({ length: 31 }, (_, index) => finding(`sample-${index}`, `I am taking Wegovy and have nausea and constipation after my dose. My insurance coverage was denied and my pharmacy has a medication shortage. Account ${index}.`));
const samples = buildQuestionEvidence(question, many, ["Wegovy"])!;
const complete = buildQuestionEvidence(question, many, ["Wegovy"], { allExamples: true })!;
assert.ok(samples.examples.length > 6, "Samples are no longer constrained by a global six-mention cap.");
for (const topic of samples.topics) {
  const previews = samples.examples.filter(example => example.topicId === topic.id);
  assert.equal(previews.length, 2, topic.label);
  const catalog = paginateThemeMentions(complete, topic.id)!;
  assert.equal(catalog.totalMatched, topic.count);
  assert.equal(catalog.total, topic.count - 2);
  assert.equal(catalog.items.length, 12);
  assert.ok(catalog.items.every(item => !previews.some(sample => sample.id === item.id)));
  const allPages = Array.from({ length: catalog.pages }, (_, index) => paginateThemeMentions(complete, topic.id, "", index + 1)!.items).flat();
  assert.equal(new Set(allPages.map(item => item.id)).size, catalog.total, "Pagination exposes every remaining mention exactly once.");
  assert.equal(paginateThemeMentions(complete, topic.id, "not-a-source-word")!.total, 0);
  assert.equal(paginateThemeMentions(complete, topic.id, "", Infinity)!.page, 1);
  const apiCollection = buildQuestionEvidence(question, many, ["Wegovy"], { allExamples: true, topicId: topic.id })!;
  assert.deepEqual(apiCollection.examples.slice(0, 2), previews, "API and Search choose the same two samples.");
}
assert.equal(paginateThemeMentions(complete, "unknown"), undefined);
const duplicate = structuredClone(many[0]); duplicate.findingId = "duplicate-source";
const deduped = buildQuestionEvidence(question, [many[0], duplicate], ["Wegovy"], { allExamples: true })!;
assert.ok(deduped.topics.every(topic => topic.count === 1));
assert.ok(deduped.topics.every(topic => paginateThemeMentions(deduped, topic.id)!.total === 0));
for (const topic of evidence?.topics || []) assert.equal(evidence!.examples.filter(example => example.topicId === topic.id).length, Math.min(2, topic.count), topic.label);
const allReal = selectSearchCorpusForQuestion("GLP-1", corpus.findings, question, { allExamples: true }).summary.questionEvidence!;
for (const topic of evidence?.topics || []) {
  const page = paginateThemeMentions(allReal, topic.id)!;
  assert.equal(page.totalMatched, topic.count, `${topic.label}: count matches the linked collection.`);
  assert.deepEqual(allReal.examples.filter(example => example.topicId === topic.id).slice(0, 2), evidence!.examples.filter(example => example.topicId === topic.id));
}
const saved = { answer: { directAnswer: "Old answer", liveData: { themes: [] } }, analyticalAnswer: { directAnswer: "Old answer", sections: [{ key: "persona_intelligence", personaIntelligence: { questionEvidence: { version: 5 }, queryContext: { question } } }] } };
const refreshed = refreshSearchCorpusIntelligence(saved, "GLP-1", question);
const refreshedSummary = refreshed.analyticalAnswer.sections.find(section => section.key === "persona_intelligence")?.personaIntelligence;
assert.equal(refreshedSummary?.questionEvidence?.version, 7, "Existing saved conversations refresh their evidence association.");
console.log(JSON.stringify({ checked: "Source-aligned theme evidence, screenshot negatives, provenance, long excerpts, multilingual support, modules, Patient, and saved Search", realExamples: evidence?.examples.map(item => ({ topic: item.topic, excerpt: item.excerpt, url: item.url })) }, null, 2));
