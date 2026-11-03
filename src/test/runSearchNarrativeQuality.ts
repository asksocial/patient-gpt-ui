import assert from "node:assert/strict";
import { questionEvidenceAnswer } from "../answering/search/buildQuestionEvidence";
import { buildFocusedSearchAnswer } from "../answering/personas/buildCorpusCharts";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import { selectSearchCorpusForQuestion } from "../lib/answers/loadSearchCorpusIntelligence";
import { refreshSearchCorpusIntelligence } from "../lib/answers/refreshSearchCorpusIntelligence";

const question = "What are the GLP-1 cost and insurance concerns in Japan?";
const corpus = loadCanonicalFindingsForAsk("GLP-1");
assert.equal(corpus.status, "available");
const { summary } = selectSearchCorpusForQuestion("GLP-1", corpus.findings, question);
const evidence = summary.questionEvidence!;
const answer = buildFocusedSearchAnswer(summary);
assert.equal(answer, questionEvidenceAnswer(evidence));
assert.match(answer, /^Conversations originating in Japan offer insight/);
assert.match(answer, /affordability and accessibility of GLP-1 treatments/);
assert.match(answer, /medication costs and affordability/);
assert.match(answer, /insurance coverage/);
assert.match(answer, /access through pharmacies and telehealth services/);
assert.match(answer, /Further research is needed/);
assert.match(answer, /individual posts may discuss other countries/);
assert.doesNotMatch(answer, /The matching material|Matching source markets/);

// A same-version saved response must refresh both displayed answer fields.
const saved = {
  answer: { directAnswer: "Old mechanical answer" },
  analyticalAnswer: { directAnswer: "Old mechanical answer", sections: [
    { key: "persona_intelligence", personaIntelligence: { ...summary, questionEvidence: { ...evidence, narrativeVersion: undefined } } },
  ] },
};
const refreshed = refreshSearchCorpusIntelligence(saved, "GLP-1", question);
assert.equal(refreshed.analyticalAnswer.directAnswer, answer);
assert.equal(refreshed.answer.directAnswer, answer);
assert.equal(saved.analyticalAnswer.directAnswer, "Old mechanical answer");
assert.match(questionEvidenceAnswer({ ...evidence, topics: [] }), /do not yet provide enough evidence to answer this question/);
const narrow = questionEvidenceAnswer({ ...evidence, topics: evidence.topics.filter(topic => topic.id === "access:coverage") });
assert.doesNotMatch(narrow, /Discussions touch on[^.]*pharmac|Discussions touch on[^.]*medication costs/);
console.log(answer);
console.log("PASS narrative answers, supporting topic scope, evidence limits, and saved Search refresh");
