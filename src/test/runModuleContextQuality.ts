import assert from 'node:assert/strict';
import { sourceContext, matchesContextSignal } from '../lib/intelligence/sourceContext';
import { buildModuleIntelligence, buildModuleEvidenceCatalog, MODULE_INTELLIGENCE_PROFILES, type GeneratableModuleId } from '../lib/module-intelligence/buildModuleIntelligence';
import { buildPatientIntelligence } from '../lib/patient-intelligence/buildPatientIntelligence';
import { classifyGlp1Audience } from '../ingestion/glp1Audience';
import { preserveRawMetadata } from '../ingestion/metadata';
import type { CanonicalFinding } from '../answering/models/finding';

function finding(id: string, text: string): CanonicalFinding {
  const fields = { Title: 'Mounjaro discussion', 'Opening Text': text, 'Hit Sentence': text, 'Document ID': id, URL: `https://www.reddit.com/r/Mounjaro/comments/${id}`, 'Source Type': 'forum', Language: 'Korean' };
  return { findingId: id, therapeuticArea: 'GLP-1', findingType: 'other', summary: 'Generated: clinical research cost patient outcomes safety', canonicalClaim: 'Generated: clinical research cost patient outcomes safety', normalizedLabels: ['research','cost','safety','effective'], symptoms: ['pain'], audienceClassification: classifyGlp1Audience(fields), rawMetadata: preserveRawMetadata(fields, { adapter: "meltwater", sourceProvider: "fixture" }), evidence: [{ sourceType: 'live',sourceId: id,excerpt: text,url: fields.URL }] } as CanonicalFinding;
}
assert.equal(sourceContext(finding('clean','Garden flowers grow in spring.')).includes('Generated'), false);
for (const [id, pattern, text] of [
  ['protocol',/site/,'The website is unavailable.'],
  ['cost_access',/cost/,'I wore a costume.'],
  ['expectations',/work/,'An online network and workload.'],
] as const) assert.equal(matchesContextSignal(id,pattern,text),false,text);
const fixtures: Record<GeneratableModuleId,string> = {
  medical_affairs: '마운자로 맞고 구토와 변비 부작용이 생겼어요. 어떻게 해야 되나요?',
  clinical_trials: '마운자로 임상시험 참여자를 모집 중이며 참여 자격과 제외 기준을 확인합니다.',
  corporate_affairs: '환자 단체가 정부 정책을 비판하고 신뢰 문제를 제기했습니다.',
  commercial: '위고비 가격이 비싸고 보험 처방 비용이 부담입니다.',
  competitive: '위고비와 마운자로를 비교하고 약을 바꾸는 차이를 알고 싶어요.',
  advocacy: '환자 단체가 보험 비용과 접근성 문제를 설명하고 지원이 필요하다고 합니다.',
};
for (const [moduleId,text] of Object.entries(fixtures)) {
  const records=[finding(`${moduleId}-positive`,text),finding('irrelevant','Garden flowers grow in spring.')];
  const result=buildModuleIntelligence(moduleId as GeneratableModuleId,'GLP-1',records);
  assert.ok(result.evidence.some(e=>e.findingId===`${moduleId}-positive`),`${moduleId} must retain native-language context even when quality is low.`);
  assert.equal(result.evidence.some(e=>e.findingId==='irrelevant'),false,'Derived labels must not create module relevance.');
  const catalog=buildModuleEvidenceCatalog(moduleId as GeneratableModuleId,'GLP-1',records,{contextualOnly:true});
  assert.equal(catalog.total,result.dataQuality.contextualEvidenceFindingCount,'Report and scoped evidence table must use the same policy.');
  assert.equal(buildModuleEvidenceCatalog(moduleId as GeneratableModuleId,'GLP-1',records).total,records.length,'The full retained corpus remains reviewable.');
}
const preferred = Array.from({length:8},(_,i)=>finding(`preferred-${i}`, 'I am taking Mounjaro and have a question about clinical research and side effects.'));
const additional = finding('additional-relevant','마운자로 구토 부작용 질문이 있어요.');
assert.ok(buildModuleIntelligence('medical_affairs','GLP-1',[...preferred, additional]).evidence.some(e=>e.findingId==='additional-relevant'),'Eight preferred findings must not suppress another relevant source.');
const empty=buildPatientIntelligence('GLP-1',[]);
assert.match(empty.headline,/No supported/);
assert.equal(empty.recommendations.length,0);
assert.equal(buildModuleIntelligence('commercial','GLP-1',[]).recommendations.length,0);
const routine=buildModuleIntelligence('clinical_trials','GLP-1',[finding('routine','I take a weekly injection and visit my doctor. Insurance access is difficult.')]);
for(const id of ['recruitment','site_experience','eligibility','retention','awareness_trust']) assert.equal(routine.sections.find(s=>s.id===id)?.findingCount,0,`${id} needs actual research context.`);
const patient=buildPatientIntelligence('GLP-1',[
  finding('patient','I am taking Mounjaro. 부작용이 무섭고 가격이 비싸요. 정체기 질문이 있어요. 어떻게 해야 하나요?'),
]);
assert.ok(patient.journeyStages.some(s=>s.id==='maintenance'));
assert.ok(patient.treatmentBarriers.some(s=>s.id==='cost_access'));
assert.ok(patient.emotionalBurden.some(s=>s.id==='fear'));
const noNeed=buildPatientIntelligence('GLP-1',[finding('no-need','I take Mounjaro. I experienced nausea last week.')]);
assert.equal(noNeed.unmetNeeds.length,0,'A symptom statement is not automatically an unmet information need.');
// Distinct Korean verbatims must not collapse into the same ASCII-only key.
const native=buildModuleIntelligence('commercial','GLP-1',[
  finding('k1','가격이 너무 비싸서 보험이 필요해요 - dc App'),
  finding('k2','비용이 내려가면 좋겠고 약국 처방이 궁금해요 - dc App'),
]);
assert.equal(native.evidence.length,2);
// All nonempty sections must have a representative before extra slots are filled.
const sections=MODULE_INTELLIGENCE_PROFILES.clinical_trials.sections;
const examples=['clinical trial awareness and trust','clinical trial enrollment and recruitment','clinical trial eligibility inclusion criteria','clinical trial protocol randomization placebo','clinical trial retention follow-up completion','clinical trial site investigator coordinator','clinical trial participant experience and burden','clinical trial outcomes endpoints efficacy','clinical trial adverse events safety'];
const diverse=buildModuleIntelligence('clinical_trials','GLP-1',examples.flatMap((text,i)=>Array.from({length:4},(_,j)=>finding(`s${i}-${j}`,`${text}. Original account ${i} ${j}.`))));
for(const section of sections) if(diverse.sections.find(s=>s.id===section.id)!.findingCount) assert.ok(diverse.evidence.some(e=>e.matchedSectionIds.includes(section.id)),`Representative examples must cover ${section.id}.`);
const weak=buildModuleIntelligence('medical_affairs','GLP-1',[finding('weak','마운자로 부작용 질문이 있어요.')]);
if(weak.dataQuality.lowQualityFindingCount===weak.dataQuality.selectedFindingCount) assert.ok(weak.sections.every(s=>s.confidence!=='high'),'Low-quality context alone must not establish high confidence.');
console.log('PASS all seven modules: source-only matching, multilingual positives, substring negatives, trial-context gates, complete catalogs, Patient needs, Unicode deduplication and balanced representatives.');
