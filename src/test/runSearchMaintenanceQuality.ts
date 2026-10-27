import assert from 'node:assert/strict';
import { buildSearchQuestionFocus } from '../answering/search/questionFocus';
import { buildQuestionEvidence } from '../answering/search/buildQuestionEvidence';
import { searchRecordText } from '../answering/search/searchSubjects';
import { getDiseaseProfile } from '../ingestion/profiles';
import { loadCanonicalFindingsForAsk } from '../lib/answers/loadCanonicalFindingsForAsk';
import { selectSearchCorpusForQuestion } from '../lib/answers/loadSearchCorpusIntelligence';
import { refreshSearchCorpusIntelligence } from '../lib/answers/refreshSearchCorpusIntelligence';

const question = 'What are patients saying about maintenance?';
const focus = buildSearchQuestionFocus(question, getDiseaseProfile('glp_1', 'GLP-1'));
const record = (text: string) => ({ rawMetadata: { fields: { Title: 'Mounjaro treatment discussion', 'Opening Text': text } }, audienceClassification: { patientContent: true } } as any);
for (const text of [
  'I am maintaining my weight on Wegovy.',
  'My Mounjaro dose is being tapered off.',
  'How long should a plateau last? I am on 15mg of Zepbound.',
  '마운자로 5mg 3달차 정체기 왔어.',
  '마운자로 용량 2주째 그대로입니다',
  '마운자로 4개월해서 8키로뺐는데 끊자마자 바로 다시 찌네',
  '7.5mg에서 2.5mg까지 내렸고 한달에 한번씩 맞아요.',
  '6개월 52 정도유지 하고 있어요.',
  '유지 용량으로 넘어가기 전입니다.',
  'マンジャロもやめる。吐き気がひどい。',
  'マンジャロ5mg 今停滞期入ってる気がする',
  '마운자로 중단했다가 다시 시작합니다.',
]) assert.ok(focus.matches(record(text)), `Missing relevant maintenance wording: ${text}`);
for (const text of [
  'I stopped taking zinc because of its copper interaction.',
  '음료수3병 못끊는게 뇌에서 에너지먹으라고 계속 쪼아대서',
  '러닝은 심혈관 심폐지구력 등 유지와 건강인듯',
  '生活習慣をきちんと維持していたら',
  '새로운 용량으로 다시 시작해보려고 해! 2.5mg에서 5mg으로 증량',
  '💙 제목에 위고비/마운자로 + 효과/부작용/정체기 등 키워드를 넣어주세요! ex) 마운자로 첫날 부작용으로 트림이 너무 심해요 --- 감기약 먹어도 되나요?',
]) assert.equal(focus.matches(record(text)), false, `Unrelated wording or posting instructions matched: ${text}`);
assert.match(searchRecordText(record('💙 제목에 정체기 등 키워드를 넣어주세요! --- 마운자로 정체기 꿀팁 있나요?')), /정체기 꿀팁/);
const evidence = buildQuestionEvidence(question, [record('I reached a weight plateau on Mounjaro.')]);
assert.ok(evidence?.topics.some(t => t.id === 'maintenance:plateau'));
assert.equal(evidence?.version, 5);

const corpus = loadCanonicalFindingsForAsk('GLP-1');
assert.equal(corpus.status, 'available');
if (corpus.status !== 'available') throw Error('GLP-1 corpus unavailable');
const all = selectSearchCorpusForQuestion('GLP-1', corpus.findings, 'What are patients saying?');
const matched = selectSearchCorpusForQuestion('GLP-1', corpus.findings, question);
assert.ok(matched.findings.length < all.findings.length);
const urls = new Set(matched.findings.map(f => String(f.rawMetadata?.fields?.URL)));
for (const url of [
  'https://www.instiz.net/name/67539634?page=1&category=52',
  'https://www.instiz.net/name/67567899?page=1&category=225#com398519636',
  'http://www.facebook.com/1667441942052025',
  'https://x.com/ui_seikeiaka/status/2094905910586138875',
  'https://cafe.naver.com/wematalktalk/15033',
]) assert.ok(urls.has(url), `Previously missed source: ${url}`);
for (const url of [
  'https://www.youtube.com/watch?v=DJAto2TI-PU',
  'https://gall.dcinside.com/mgallery/board/view/?id=mounjaro&no=170041#833206',
  'https://cafe.naver.com/wematalktalk/13610',
  'https://cafe.naver.com/wematalktalk/14900',
  'https://gall.dcinside.com/mgallery/board/view/?id=mounjaro&no=180146&t=cv&page=1#894051',
]) assert.equal(urls.has(url), false, `Unrelated source or template example: ${url}`);
const saved = { analyticalAnswer: { directAnswer: 'Old answer', sections: [{ key: 'persona_intelligence', personaIntelligence: { questionEvidence: { version: 3 }, denominator: 36, analyticalCount: 36, queryContext: { question } } }] } };
const refreshed = refreshSearchCorpusIntelligence(saved, 'GLP-1', question) as any;
const summary = refreshed.analyticalAnswer.sections.find((s: any) => s.personaIntelligence)?.personaIntelligence;
assert.equal(summary.analyticalCount, matched.findings.length);
assert.equal(summary.questionEvidence.version, 5);
assert.equal(saved.analyticalAnswer.sections[0].personaIntelligence.denominator, 36);
console.log(`PASS maintenance retrieval: ${matched.findings.length}/${all.findings.length} patient-related analytical mentions; native-language misses, false positives, posting templates, and saved Search refresh checked.`);
