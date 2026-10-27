import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {loadCanonicalFindingsForModule} from '../src/lib/answers/loadCanonicalFindingsForAsk';
import {buildModuleIntelligence,MODULE_INTELLIGENCE_PROFILES} from '../src/lib/module-intelligence/buildModuleIntelligence';
import {buildPatientIntelligence} from '../src/lib/patient-intelligence/buildPatientIntelligence';
const report:any[]=[];
for(const area of (process.env.AUDIT_AREAS?.split(',') || ['GLP-1','Medical Aesthetics','Botulinum toxin','Hepatitis B','Gene Therapy','Regenerative Aesthetics','Uterine Fibroids'])) {
 for(const moduleId of ['patient',...Object.keys(MODULE_INTELLIGENCE_PROFILES)]) {
  const corpus=loadCanonicalFindingsForModule(area,moduleId);if(corpus.status!=='available'){report.push({area,moduleId,status:corpus.status});continue;}
  const result=moduleId==='patient'?buildPatientIntelligence(area,corpus.findings):buildModuleIntelligence(moduleId as any,area,corpus.findings,undefined,{relevancePolicy:corpus.relevancePolicy});
  const r:any=result;
  if(moduleId!=='patient') {
    for(const section of r.sections.filter((s:any)=>s.findingCount>0)) assert.ok(r.evidence.some((e:any)=>e.matchedSectionIds.includes(section.id)), `${area}/${moduleId}: no representative for ${section.id}`);
    assert.equal(r.dataQuality.corpusFindingCount,corpus.findings.length);
  } else assert.equal(r.dataQuality.corpusFindingCount,corpus.findings.length);

  const item={area,moduleId,corpus:corpus.findings.length,selection:r.dataQuality,sections:r.sections||{journey:r.journeyStages,barriers:r.treatmentBarriers,emotion:r.emotionalBurden,needs:r.unmetNeeds},examples:r.evidence.map((e:any)=>({id:e.findingId||e.id,url:e.url,topics:e.matchedSectionIds||e.matchedSignalLabels}))};
  report.push(item);console.log(area,moduleId,JSON.stringify(r.dataQuality));
 }
}
writeFileSync(process.env.AUDIT_OUTPUT||'/private/tmp/module-context-latest.json',JSON.stringify(report,null,2));
