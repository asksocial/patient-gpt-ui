import assert from 'node:assert/strict';
import {readWorkspaceContext,retainWorkspaceContext,readRetainedAnalyses,retainAnalysis,restoreWorkspaceContext,analysisKey} from '../lib/client/workspaceRetention';
class Store {
 values=new Map<string,string>();
 getItem(key:string){return this.values.get(key)||null;}
 setItem(key:string,value:string){this.values.set(key,value);}
}
const db=new Store();
const context={therapeuticArea:'GLP-1',moduleId:'commercial',destination:'module_commercial',workspaceId:'qa-workspace',sessionId:'qa-session',savedProductId:'qa-product',question:'Cost and insurance'};
retainWorkspaceContext('org:actor',context,db);
retainAnalysis('org:actor',{moduleId:'commercial',therapeuticArea:'GLP-1',workspaceId:'qa-workspace',result:{headline:'Saved commercial analysis',generatedAt:'2026-11-02T16:00:00Z'}},db);
retainAnalysis('org:actor',{moduleId:'advocacy',therapeuticArea:'GLP-1',workspaceId:'qa-workspace',result:{headline:'Saved advocacy analysis'}},db);
assert.equal(readRetainedAnalyses('org:actor',db).length,2,'Switching modules must retain both generated results');
assert.deepEqual(readWorkspaceContext('org:actor',db),context,'Saving a result must preserve navigation context');
assert.equal(readRetainedAnalyses('org:other-actor',db).length,0,'An account/actor change cannot restore another user’s work');
assert.equal(readWorkspaceContext('different-org:actor',db),undefined,'Organization changes must isolate context');
retainAnalysis('org:actor',{moduleId:'commercial',therapeuticArea:'Botulinum toxin',workspaceId:'qa-workspace',result:{headline:'Different topic'}},db);
retainAnalysis('org:actor',{moduleId:'commercial',therapeuticArea:'GLP-1',workspaceId:'other-workspace',result:{headline:'Different workspace'}},db);
assert.equal(readRetainedAnalyses('org:actor',db).length,4,'Topic and workspace changes cannot overwrite another analysis');
retainAnalysis('org:actor',{moduleId:'commercial',therapeuticArea:'GLP-1',workspaceId:'qa-workspace',result:{headline:'Explicit regeneration'}},db);
assert.equal(readRetainedAnalyses('org:actor',db).length,4);
assert.equal(readRetainedAnalyses('org:actor',db).find(x=>analysisKey(x.moduleId,x.therapeuticArea,x.workspaceId)===analysisKey('commercial','GLP-1','qa-workspace'))?.result.headline,'Explicit regeneration');
assert.equal(retainAnalysis('org:actor',{moduleId:'pv_review',therapeuticArea:'GLP-1',workspaceId:'qa-workspace',result:{approval:true}},db),false,'PV approval state must not be cached as research output');
const allowed=restoreWorkspaceContext(context,['GLP-1'],['commercial'],['qa-workspace'],['qa-session'],['ask']);
assert.deepEqual(allowed,context,'Accessible explicit context should survive refresh');
const revoked=restoreWorkspaceContext(context,['GLP-1'],[],[],[],['ask']);
assert.equal(revoked?.destination,'ask');assert.equal(revoked?.workspaceId,'');assert.equal(revoked?.savedProductId,undefined);assert.equal(revoked?.sessionId,null);
assert.equal(restoreWorkspaceContext(context,['Other'],['commercial'],['qa-workspace'],['qa-session'],['ask']),null,'Unavailable topics must not be restored');
assert.equal(restoreWorkspaceContext({...context,destination:'pv_review'},['GLP-1'],['commercial'],['qa-workspace'],['qa-session'],['ask'])?.destination,'ask','In-flight PV review must not restore an editable approval form');
const reloadStore=new Store();
reloadStore.setItem('asksocial.research-session.v1:fresh-page',JSON.stringify({version:1,context,analyses:[{moduleId:'commercial',therapeuticArea:'GLP-1',workspaceId:'qa-workspace',result:{headline:'Persisted before reload'}}]}));
assert.equal(readRetainedAnalyses('fresh-page',reloadStore)[0].result.headline,'Persisted before reload','New page runtime reads serialized results');
const broken=new Store();broken.setItem('asksocial.research-session.v1:corrupt','{');assert.equal(readRetainedAnalyses('corrupt',broken).length,0);
const unavailable={getItem(){throw Error('Denied');},setItem(){throw Error('Quota exceeded');}};
assert.equal(retainAnalysis('quota',{moduleId:'patient',therapeuticArea:'GLP-1',workspaceId:'',result:{headline:'Retained in memory'}},unavailable),false);
assert.equal(readRetainedAnalyses('quota',unavailable)[0].result.headline,'Retained in memory','Storage failures must not destroy the current tab’s work');
for(let i=0;i<20;i++)retainAnalysis('bounded',{moduleId:'commercial',therapeuticArea:`topic-${i}`,workspaceId:'',result:{headline:'x'}},db);
assert.equal(readRetainedAnalyses('bounded',db).length,12,'Bound cache growth across repeated topics');
console.log('PASS retained module results; serialized reload; identity/topic/workspace isolation; explicit regeneration; current-access validation; PV exclusion; malformed/quota handling; bounded retention.');

// Exercise the actual persistence query through an isolated REST transport.
async function verifySavedItemAccess() {
 const {listIntelligenceWorkProducts}=await import('../lib/intelligence-platform/persistence');
 const realFetch=globalThis.fetch;
 const oldUrl=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL='https://saved-work-test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-only';
 let productReads=0;
 globalThis.fetch=async (input)=>{
  const url=new URL(String(input));assert.equal(url.hostname,'saved-work-test.supabase.co','Regression tests cannot contact a live database');
  assert.equal(url.searchParams.get('principal_id'),'eq.qa-principal');
  const table=url.pathname.split('/').pop();
  if(table==='intelligence_workspaces')return Response.json(url.searchParams.get('id')==='eq.allowed'?[{id:'allowed',principal_id:'qa-principal',created_by:'owner'}]:[]);
  if(table==='intelligence_workspace_members')return Response.json([{role:'viewer'}]);
  assert.equal(table,'intelligence_work_products');productReads++;
  assert.equal(url.searchParams.get('id'),'eq.older-saved-item','Exact saved item lookup must happen before the result limit');
  assert.equal(url.searchParams.get('workspace_id'),'in.(allowed)');
  return Response.json([{id:'older-saved-item',payload:{type:'workspace_session'}}]);
 };
 try {
  const principal={principalId:'qa-principal',principalType:'user' as const,actorId:'viewer'};
  const items=await listIntelligenceWorkProducts(principal,{workspaceId:'allowed',productId:'older-saved-item'});
  assert.equal(items[0].id,'older-saved-item');
  await assert.rejects(listIntelligenceWorkProducts(principal,{workspaceId:'inaccessible',productId:'older-saved-item'}),/Workspace not found/);
  assert.equal(productReads,1,'Inaccessible workspaces must fail before any saved-item read');
  console.log('PASS exact saved-item lookup retains tenant/workspace access checks and supports older snapshots.');
 } finally {globalThis.fetch=realFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
}
verifySavedItemAccess().catch(error=>{console.error(error);process.exitCode=1;});
