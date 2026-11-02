import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
const files=['202608060001_create_pv_compliance_services.sql','202608080002_expand_pv_adverse_event_ontology.sql','202608100001_create_pv_csv_imports.sql','202608110002_scope_pv_corpora.sql','202608230001_start_day_zero_at_reportability_review.sql','202608230002_add_pv_review_start.sql','202609110001_add_pv_health_experience_reclassification.sql','202609150001_add_versioned_e2b_alignment.sql','202610010001_create_pv_icsr_email_reviews.sql','202610170001_odcs_service_controls.sql','202610190001_pv_reportability_identification.sql','202610200002_structured_review_email_queue.sql','202611020001_incomplete_pv_screening.sql'];
for(const file of files)await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;',''));
const id='a23d8974-4fa5-4115-891b-f26abf054eae',tenant='qa-only',actor='qa-reviewer',at='2026-11-02T10:00:00Z';
await db.query("insert into pv_records(id,principal_id,external_id,source_type,source_url,original_verbatim,evidence_hash,posted_at,ingested_at,identified_at,detection_score,product_confidence,health_experience_confidence,context_confidence,classifier_version,library_version,updated_at,status) values($1,$2,'QA-ONLY','Synthetic','https://example.invalid','SYNTHETIC ONLY','qa',$3,$3,$3,0,0,0,0,'qa',1,$3,'in_review')",[id,tenant,at]);
const snapshot={revision:1,originalExtraction:{synthetic:true},caseData:{id,approval:null,status:'requires_review'},email:null,screeningDraft:{recordUpdatedAt:at,rationale:'QA incomplete'}};
const draft='select save_pv_screening_draft($1,$2,$3,$4,$5,$6,$7)';
await db.query(draft,[id,tenant,actor,0,snapshot,[],at]);
assert.equal((await db.query('select count(*)::int n from pv_audit_events')).rows[0].n,1);
assert.equal((await db.query('select reportability_identified_at from pv_records where id=$1',[id])).rows[0].reportability_identified_at,null);
await assert.rejects(db.query(draft,[id,tenant,actor,0,snapshot,[],at]),/conflict/);
await assert.rejects(db.query(draft,[id,'other',actor,1,{...snapshot,revision:2},[],at]),/not found/);
await assert.rejects(db.query(draft,[id,tenant,actor,1,{...snapshot,revision:2,caseData:{...snapshot.caseData,approval:{reviewer:actor}}},[],at]),/cannot change/);
// Failure of the activity audit rolls back the draft revision too.
await db.exec("create function qa_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'QA audit failure'; end $$;create trigger qa_fail_audit before insert on pv_audit_events for each row execute function qa_fail_audit();");
await assert.rejects(db.query(draft,[id,tenant,actor,1,{...snapshot,revision:2},[],at]),/QA audit failure/);
assert.equal((await db.query('select revision from pv_icsr_cases where record_id=$1',[id])).rows[0].revision,1);
await db.exec('drop trigger qa_fail_audit on pv_audit_events');
const review={product_mention:'yes',health_experience:'yes',classifications:['adverse_event'],rationale:'Synthetic incomplete observation',decision:'forward_observation',reviewed_at:at,validated_ae_ontology:{},e2b_mapping_version:'qa'};
const updates={status:'ready_for_transfer',updated_at:'2026-11-02T10:01:00Z',follow_up_owner:actor,follow_up_due_at:'2099-11-03T10:00:00Z'};
const complete='select complete_pv_structured_review($1,$2,$3,$4,$5,$6,$7,$8) result';
await assert.rejects(db.query(complete,[id,tenant,actor,at,review,{...updates,follow_up_owner:''},1,null]),/requires/);
const saved=(await db.query(complete,[id,tenant,actor,at,review,updates,1,null])).rows[0].result;
assert.equal(saved.record.reportability_identified_at,null);assert.equal(saved.record.follow_up_owner,actor);
const head=(await db.query('select snapshot from pv_icsr_cases where record_id=$1',[id])).rows[0].snapshot;assert.equal(head.caseData.approval,null);assert.equal(head.email,null);
await assert.rejects(db.query(draft,[id,tenant,actor,2,{...head,revision:3},[],at]),/conflict/);
await assert.rejects(db.query('select prepare_pv_icsr_email($1,$2,$3)',[tenant,actor,{caseIds:[id],cases:[{recordId:id,revision:2}]}]),/review changed/);
await db.exec('set role authenticated');
await assert.rejects(db.query(draft,[id,tenant,actor,2,{...head,revision:3},[],at]),/permission denied/);
console.log('PASS: real PostgreSQL draft/revision/audit atomicity, rollback, tenant and stale-edit guards, incomplete disposition and follow-up retention, no approval/email/Day Zero, complete-email rejection, direct-user RPC denial.');
} catch(e){console.error(e.message,e.where||'');process.exitCode=1;} finally {await db.close();}
