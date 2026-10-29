import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyGlp1PvContent} from '../lib/pv/glp1/detection';
import {buildR3AlignedCase} from '../lib/pv/icsr/case';
const original=JSON.parse(fs.readFileSync('src/test/fixtures/pv/glp1-negated-outcomes.json','utf8')).verbatim;
function detect(verbatim:string){return classifyGlp1PvContent({externalId:'synthetic-context-regression',sourceType:'SYNTHETIC QA',sourceUrl:'https://example.invalid/qa',verbatim,postedAt:'2026-10-29T10:00:00Z',language:'en'});}
function intake(verbatim:string){const result=detect(verbatim);return {result,c:buildR3AlignedCase({id:'synthetic-context-regression',source_type:'SYNTHETIC QA',source_url:'https://example.invalid/qa',original_verbatim:verbatim,identified_at:'2026-10-29T10:00:00Z',ae_ontology:result.ontologyExtraction})};}
const checks:Array<{name:string;run:()=>void}>=[];
function test(name:string,run:()=>void){checks.push({name,run});}
test('Locked QA fixture: no serious-outcome inversion or class duplicate',()=>{
 const {result,c}=intake(original);assert(result.shouldCreateRecord);assert.equal(result.contextConfidence,0);
 assert.deepEqual(result.ontologyExtraction.seriousness.criteria,[]);
 assert.deepEqual(result.ontologyExtraction.outcomes.map(x=>x.category),['recovered']);
 assert.equal(c.suspectProducts.length,1);assert.equal(c.events[0].outcome.value,'recovered');
 assert(Object.values(c.events[0].seriousness).every(x=>x.value==='evidence_absent_from_source'));
});
for(const term of ['hospitalized','hospitalised','death','life-threatening condition','disability','congenital anomaly','other medically important outcome'])test(`Long negated list: ${term}`,()=>{
 const {result,c}=intake(`I took Wegovy and developed nausea. There was no persistent vomiting, severe abdominal pain, dehydration, other unexpected change in my condition, or ${term}.`);
 assert.notEqual(result.ontologyExtraction.seriousness.value,'serious');assert(!result.ontologyExtraction.outcomes.some(x=>['fatal','hospitalization','permanent_injury'].includes(x.category)));
 assert(!Object.values(c.events[0].seriousness).some(x=>x.value==='evidence_present'));
});
test('Later positive occurrence survives earlier denial',()=>{const {result,c}=intake('I took Wegovy and had nausea. I was not hospitalized initially, but later I was hospitalized.');assert(result.ontologyExtraction.seriousness.criteria.includes('hospitalization'));assert.equal(c.events[0].seriousness.hospitalization.value,'evidence_present');});
test('Later synonym survives earlier denial',()=>{const r=detect('I took Wegovy and had nausea. I was not hospitalised on Monday. On Tuesday I was hospitalized.');assert(r.ontologyExtraction.outcomes.some(x=>x.category==='hospitalization'));});
test('Contrast ends negative scope',()=>{const r=detect('I took Wegovy and had nausea. No disability, but I was hospitalized.');assert(r.ontologyExtraction.seriousness.criteria.includes('hospitalization'));assert(!r.ontologyExtraction.seriousness.criteria.includes('disability_or_permanent_injury'));});
test('New coordinated positive clause ends negative scope',()=>{const r=detect('I took Wegovy and had nausea. I had no disability and I was hospitalized.');assert(r.ontologyExtraction.seriousness.criteria.includes('hospitalization'));});
test('Positive seriousness remains available for review',()=>{const {result,c}=intake('I took Wegovy and developed nausea. I was hospitalized for a life-threatening condition.');assert.equal(result.contextConfidence,100);assert.equal(c.events[0].seriousness.hospitalization.value,'evidence_present');assert.equal(c.events[0].seriousness.lifeThreatening.value,'evidence_present');assert.equal(c.approval,null);});
test('Hypothetical serious outcomes are not reported outcomes',()=>{const {result,c}=intake('I took Wegovy and had nausea. My doctor discussed the risk of hospitalization, disability, congenital anomaly, or life-threatening illness.');assert.notEqual(result.ontologyExtraction.seriousness.value,'serious');assert(!result.ontologyExtraction.outcomes.some(x=>['fatal','hospitalization','permanent_injury'].includes(x.category)));assert(!Object.values(c.events[0].seriousness).some(x=>x.value==='evidence_present'));assert.equal(c.events[0].seriousness.hospitalization.value,'requires_pv_review');});
test('Non-serious source wording is preserved',()=>{assert.equal(detect('I took Wegovy and had mild nausea. I was not hospitalized and it was not serious.').ontologyExtraction.seriousness.value,'non_serious');});
test('Not only / not to mention are not denials',()=>{assert(detect('I took Wegovy and had nausea. Not only was I hospitalized, I had permanent damage.').ontologyExtraction.seriousness.criteria.includes('hospitalization'));assert(detect('I took Wegovy. Not to mention the nausea.').shouldCreateRecord);});
test('Negated recovery does not become recovered',()=>{const o=detect('I took Wegovy and had nausea. It has not resolved.').ontologyExtraction.outcomes;assert(!o.some(x=>x.category==='recovered'));assert(o.some(x=>x.category==='ongoing'));});
test('Later recovery is retained',()=>{assert(detect('I took Wegovy and had nausea. It had not resolved initially, but it resolved the following morning.').ontologyExtraction.outcomes.some(x=>x.category==='recovered'));});
test('Negated severity does not override positive moderate severity',()=>{assert.equal(detect('I took Wegovy and had nausea. It was not severe, just moderate.').ontologyExtraction.severity.value,'moderate');});
test('Nearly died is not a fatal outcome',()=>{const r=detect('I took Wegovy and had nausea. I nearly died.');assert(!r.ontologyExtraction.outcomes.some(x=>x.category==='fatal'));assert(r.ontologyExtraction.seriousness.criteria.includes('life_threatening'));});
test('Class-only exposure is retained',()=>{assert.equal(intake('I started a GLP-1 and developed nausea.').c.suspectProducts.length,1);});
test('Class and brand/generic descriptions of one exposure do not add a second drug',()=>{assert.equal(intake('I started Wegovy (semaglutide), a GLP-1 medication, and developed nausea.').c.suspectProducts.length,1);});
test('Two named products remain separate',()=>{assert.equal(intake('I took Wegovy and Mounjaro, both GLP-1 medications, and developed nausea.').c.suspectProducts.length,2);});
test('A separate unspecified exposure remains separate',()=>{assert.equal(intake('I stopped Wegovy and switched to another GLP-1. I developed nausea.').c.suspectProducts.length,2);});
test('Different-patient class reference is not collapsed',()=>{assert.equal(intake('I took Wegovy and had nausea. My sister took a GLP-1 and had constipation.').c.suspectProducts.length,2);});
test('A fixture ID is not a drug exposure',()=>{assert(!detect('Fixture QA-GLP1-20261029-01. I received a dose and developed nausea.').shouldCreateRecord);});
test('Context sources do not inherit an unfinished denial',()=>{const base={externalId:'qa-context',sourceType:'SYNTHETIC QA',sourceUrl:'https://example.invalid/qa',verbatim:'I took Wegovy and had nausea but no disability',parentContext:'I was hospitalized.',postedAt:'2026-10-29T10:00:00Z',language:'en'};assert(classifyGlp1PvContent(base).ontologyExtraction.seriousness.criteria.includes('hospitalization'));});
test('Postposed denial and unresolved possibility remain distinct',()=>{const denied=intake('I took Wegovy and had nausea. Hospitalization was not required.');assert.equal(denied.c.events[0].seriousness.hospitalization.value,'evidence_absent_from_source');const possible=intake('I took Wegovy and had nausea. Hospitalization was not ruled out.');assert.equal(possible.c.events[0].seriousness.hospitalization.value,'requires_pv_review');assert.notEqual(possible.result.ontologyExtraction.seriousness.value,'serious');});
test('Contractions deny events',()=>{assert(!detect("I took Wegovy. I don't have nausea.").shouldCreateRecord);});
test('Permanent treatment wording is not permanent injury',()=>{assert(!detect('I took Wegovy and had nausea. I permanently stopped treatment.').ontologyExtraction.outcomes.some(x=>x.category==='permanent_injury'));});
let failed=0;for(const check of checks){try{check.run();console.log(`PASS ${check.name}`);}catch(e){failed++;console.error(`FAIL ${check.name}: ${(e as Error).message}`);}}
if(failed)process.exitCode=1;console.log(`${checks.length-failed}/${checks.length} extraction context checks passed.`);
