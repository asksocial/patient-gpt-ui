import assert from "node:assert/strict";
import { resolveQuestionGeography, sourceCountryLabel } from "../answering/search/geography";
import { buildSearchQuestionFocus } from "../answering/search/questionFocus";
import { buildQuestionEvidence, questionEvidenceAnswer } from "../answering/search/buildQuestionEvidence";
import { buildCorpusCharts } from "../answering/personas/buildCorpusCharts";
import { getDiseaseProfile } from "../ingestion/profiles";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import { selectSearchCorpusForQuestion } from "../lib/answers/loadSearchCorpusIntelligence";
import { refreshSearchCorpusIntelligence } from "../lib/answers/refreshSearchCorpusIntelligence";
import type { CanonicalFinding } from "../answering/models/finding";

const question = "What are people saying about cost and insurance in Asian markets?";
// Independent enumeration spans East, Southeast, South, Central and West Asia.
const countries = "Afghanistan|Armenia|Azerbaijan|Bahrain|Bangladesh|Bhutan|Brunei|Cambodia|China|Cyprus|Georgia|Hong Kong|India|Indonesia|Iran|Iraq|Israel|Japan|Jordan|Kazakhstan|Kuwait|Kyrgyzstan|Laos|Lebanon|Macao|Malaysia|Maldives|Mongolia|Myanmar|Nepal|North Korea|Oman|Pakistan|Palestine|Philippines|Qatar|Saudi Arabia|Singapore|South Korea|Sri Lanka|Syria|Taiwan|Tajikistan|Thailand|Timor-Leste|Turkey|Turkmenistan|United Arab Emirates|Uzbekistan|Vietnam|Yemen".split("|");
const geo = resolveQuestionGeography(question);
for (const country of countries) assert.ok(geo.matchesCountry(country), `Missing Asian market: ${country}`);
for (const country of ["Australia", "New Zealand", "United States", "Brazil", "France", "Unknown"]) assert.equal(geo.matchesCountry(country), false, country);
assert.ok(resolveQuestionGeography("APAC costs").matchesCountry("Australia"));
assert.equal(resolveQuestionGeography("East Asian costs").matchesCountry("India"), false);
const focus = buildSearchQuestionFocus(question, getDiseaseProfile("glp_1", "GLP-1"));
const record = (country: string, text: string, index = country): CanonicalFinding => ({ findingId: index, therapeuticArea: "GLP-1", countries: [country], summary: text, rawMetadata: { fields: { Country: country, Title: "Wegovy treatment", "Opening Text": text, URL: `https://example.test/${index}` } } } as unknown as CanonicalFinding);
for (const [country, text] of [
  ["Japan", "ウゴービは保険が適用されず自費の値段が高い"],
  ["South Korea", "위고비 비급여 약값과 보험 적용이 궁금해요"],
  ["China", "司美格鲁肽价格昂贵，医保能报销吗"],
  ["Taiwan", "司美格魯肽價格與醫療保險"],
  ["Thailand", "Wegovy ราคาและประกัน"],
  ["Vietnam", "Wegovy chi phí và bảo hiểm"],
  ["Indonesia", "Wegovy harga dan asuransi"],
  ["Malaysia", "Wegovy harga dan insurans"],
  ["India", "Wegovy कीमत और बीमा"],
  ["Philippines", "Wegovy presyo at seguro"],
]) assert.ok(focus.matches(record(country, text)), `${country}: ${text}`);
const fixtures = countries.map(country => record(country, `Wegovy prices and health insurance coverage in ${country}`));
const evidence = buildQuestionEvidence(question, fixtures)!;
assert.equal(evidence.marketCoverage?.length, countries.length);
assert.equal(evidence.marketCoverage?.reduce((sum, market) => sum + market.count, 0), fixtures.length);
for (const country of countries) assert.ok(questionEvidenceAnswer(evidence).includes(sourceCountryLabel(country)), country);
assert.ok(new Set(evidence.examples.map(example => example.country)).size > 1, "Representative quotes must not all favor one market");
const chart = buildCorpusCharts(fixtures.map(f => ({ country: f.countries![0] })), { showAllMarkets: true });
assert.equal(chart.markets.segments.filter(segment => segment.count).length, countries.length);

const corpus = loadCanonicalFindingsForAsk("GLP-1");
assert.equal(corpus.status, "available");
const selected = selectSearchCorpusForQuestion("GLP-1", corpus.findings, question);
const markets = selected.summary.questionEvidence!.marketCoverage!;
for (const country of ["Japan", "South Korea"]) {
  const actual = selected.findings.filter(f => sourceCountryLabel(f.rawMetadata?.fields?.Country || f.countries?.[0]) === country).length;
  assert.ok(actual > 0);
  assert.equal(markets.find(m => m.country === country)?.count, actual);
}
for (const market of markets) assert.equal(selected.summary.corpusCharts!.markets.segments.find(s => s.label === market.country)?.count, market.count);
assert.equal(markets.reduce((sum, market) => sum + market.count, 0), selected.findings.length);
const saved = { answer: { directAnswer: "Old answer" }, analyticalAnswer: { directAnswer: "Old answer", sections: [{ personaIntelligence: { questionEvidence: { version: 4 }, queryContext: { question } } }] } };
const refreshed = refreshSearchCorpusIntelligence(saved, "GLP-1", question) as any;
assert.match(refreshed.answer.directAnswer, /Japan/);
assert.match(refreshed.answer.directAnswer, /South Korea/);
assert.equal(saved.answer.directAnswer, "Old answer", "Stored historical answer remains intact");
console.log(JSON.stringify({ count: selected.findings.length, markets, exampleMarkets: selected.summary.questionEvidence!.examples.map(e => e.country) }, null, 2));
console.log("PASS Asian market coverage, native-language retrieval, complete market chart, representative sources and saved Search refresh");
