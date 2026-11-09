import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('public/academy/index.html','utf8');
const source=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const lessons=fs.readFileSync('public/academy/assurance-data.js','utf8');
function academy(core={},extra={},hash='') {
  const records=new Map([['pvAcademy.v1',JSON.stringify(core)],['askSocial.assurancePractice.v0.1',JSON.stringify(extra)]]);
  const context={window:{scrollTo(){}},localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)},location:{hash,pathname:'/academy/index.html',search:''},history:{replaceState(){}},DCLogic:class {props={};setState(p,done){this.state={...this.state,...p};done?.();}}};
  vm.createContext(context);vm.runInContext(lessons,context);vm.runInContext(source+'\nglobalThis.testAcademy={app:new Component(),mods:MODS,weeks:WEEKS,quiz:QUIZ,cases:CASES,clock:CLOCK,assurance:ASSURANCE,reload:()=>initialAcademyState(localStorage,"")};',context);
  return context.testAcademy;
}
const fresh=academy();
assert.equal(fresh.mods.length,19);assert.equal(fresh.weeks.length,8);assert.equal(fresh.quiz.length,22);
assert.equal(fresh.mods.reduce((n,m)=>n+m[1],0),50);
assert.equal(fresh.app.renderVals().progressLabel,'0 of 39 practice milestones');
fresh.app.state.mod=0;fresh.app.state.view='modules';fresh.app.renderVals().prevMod();assert.equal(fresh.app.state.mod,0);
fresh.app.state.mod=11;fresh.app.renderVals().nextMod();assert.equal(fresh.app.state.mod,12);
assert.equal(fresh.app.renderVals().mod.isOps,true);assert.equal(fresh.app.renderVals().opsTeaching.length,3);
fresh.app.state.mod=18;fresh.app.renderVals().nextMod();assert.equal(fresh.app.state.view,'quiz');

const base=academy();const coreAnswers=Object.fromEntries(base.quiz.slice(0,8).map((q,i)=>[i,q[3]]));
const oldCore=academy({done:{0:true,11:true},cases:{0:{d:0,u:false,checked:true}},qans:coreAnswers,qdone:true,week:4,view:'quiz'});
assert.equal(oldCore.app.state.done[0],true);assert.equal(oldCore.app.state.done[11],true);
assert.equal(oldCore.app.state.cases[0].checked,true);assert.equal(oldCore.app.state.week,6);
assert.equal(oldCore.app.state.qi,8);assert.equal(oldCore.app.state.qdone,false);
assert.equal(oldCore.app.state.qcompleted.core,true);assert.equal(oldCore.app.state.qcompleted.assurance,false);
assert.equal(oldCore.app.renderVals().sections[4].badge,'1/2');

const extra={reviewed:{},scenarios:{},answers:{},submitted:true};
for(const l of base.assurance){extra.reviewed[l.id]=true;extra.scenarios[l.id]={choice:l.answer,checked:true};}
for(const [i,q] of base.quiz.slice(8).entries())extra.answers[i]=q[3];
const core={done:Object.fromEntries(base.mods.slice(0,12).map((_,i)=>[i,true])),qans:coreAnswers,qdone:true,qa:false,clock:{0:base.clock[0][2],1:base.clock[1][2]},cases:Object.fromEntries(base.cases.map((c,i)=>[i,{d:c[2][0],u:c[3],checked:true}]))};
const migrated=academy(core,extra);
assert.equal(migrated.app.renderVals().progressLabel,'39 of 39 practice milestones');assert.equal(migrated.app.renderVals().progressPct,'100%');
assert.equal(migrated.app.state.qdone,true);assert.equal(migrated.app.renderVals().sections[1].badge,'19/19');
migrated.app.state.mod=12;migrated.app.renderVals().toggleDone();assert.equal(migrated.reload().done[12],false,'Migration must not resurrect a cleared practice flag');
const unsubmitted=academy(core,{...extra,submitted:false});assert.equal(unsubmitted.app.state.qcompleted.assurance,false);
const direct=academy({}, {}, '#module-19');assert.equal(direct.app.state.mod,18);assert.equal(direct.app.state.view,'modules');
const invalid=academy({week:999,mod:-1,qi:1000,view:'bad',done:null,cases:[],qans:null});assert.equal(invalid.app.state.week,0);assert.equal(invalid.app.state.mod,null);assert.equal(invalid.app.state.qi,0);assert.equal(invalid.app.state.view,'map');
// Each checkpoint must pass independently, even if the combined score is 90%.
const borderline=academy(core,extra);borderline.app.state.qans[0]=(base.quiz[0][3]+1)%3;
assert.equal(borderline.app.renderVals().sections[4].badge,'1/2');assert.match(borderline.app.renderVals().score.checkpoints,/Core screening: 7\/8 · Not passed/);
console.log('PASS: 19-module sequence, 39 milestone counts, eight-week plan, checkpoint boundaries, deep links and legacy/core/assurance progress migration.');
