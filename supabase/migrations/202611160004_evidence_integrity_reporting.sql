begin;
create table public.evidence_integrity_release_checks (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, binding_id uuid not null, corpus_id uuid not null,
 qualification_policy_id uuid not null, screening_policy_id uuid not null, deployment_scope text not null check(deployment_scope in ('local','staging','production')),
 artifact_hash text not null check(artifact_hash ~ '^[a-f0-9]{64}$'), evidence_reference text not null check(length(evidence_reference)>=10), checks jsonb not null,
 recorded_by text not null, recorded_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,binding_id) references public.evidence_analytical_bindings(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,corpus_id) references public.evidence_corpora(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,qualification_policy_id) references public.evidence_qualification_policies(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,screening_policy_id) references public.evidence_screening_policies(principal_id,workspace_id,id)
);
create table public.evidence_analysis_receipts (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, snapshot_id uuid not null,
 release_check_id uuid not null references public.evidence_integrity_release_checks(id), scope_hash text not null,
 source_ids uuid[] not null, analytical_input_count integer not null, summary jsonb not null,
 created_by text not null, created_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,snapshot_id) references public.evidence_qualification_snapshots(principal_id,workspace_id,id),
 unique(principal_id,workspace_id,snapshot_id,scope_hash)
);

-- This trusted service-only recorder is intentionally not a dashboard/HTTP action.
-- It records QA evidence, not a proof that a browser test happened. An operator
-- supplies an actual test artifact/reference after reconciliation/security checks.
create function public.record_evidence_release_checks(p_principal text,p_workspace uuid,p_actor text,p_binding uuid,p_scope text,p_artifact text,p_reference text,p_checks jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.evidence_analytical_bindings; m public.evidence_integrity_monitors; v public.evidence_integrity_release_checks; k text;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 select * into b from public.evidence_analytical_bindings where id=p_binding and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Binding unavailable'; end if;
 select * into m from public.evidence_integrity_monitors where id=b.monitor_id;
 foreach k in array array['countReconciliation','tenantIsolation','clientProjection','actorAuthorization'] loop
  if p_checks->>k is distinct from 'true' then raise exception 'Completed reconciliation/security evidence required'; end if;
 end loop;
 if has_table_privilege('service_role','public.evidence_screenings','SELECT') or has_table_privilege('authenticated','public.evidence_analysis_receipts','SELECT') or has_function_privilege('authenticated','public.read_evidence_monitoring(text,uuid,text,uuid,jsonb,integer,integer)','EXECUTE') then raise exception 'Unsafe direct database privileges'; end if;
 insert into public.evidence_integrity_release_checks(principal_id,workspace_id,binding_id,corpus_id,qualification_policy_id,screening_policy_id,deployment_scope,artifact_hash,evidence_reference,checks,recorded_by)
 values(p_principal,p_workspace,b.id,m.corpus_id,b.qualification_policy_id,m.screening_policy_id,p_scope,p_artifact,p_reference,p_checks,p_actor) returning * into v;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'reporting.validation.record',v.id,jsonb_build_object('deploymentScope',p_scope,'artifactHash',p_artifact)); return to_jsonb(v);
end $$;

create function public.create_evidence_analysis_receipt(p_principal text,p_workspace uuid,p_actor text,p_snapshot uuid,p_sources uuid[],p_scope_hash text,p_expected_count integer,p_deployment_scope text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.evidence_qualification_snapshots; b public.evidence_analytical_bindings; c public.evidence_integrity_cycles; m public.evidence_integrity_monitors; proof public.evidence_integrity_release_checks; receipt public.evidence_analysis_receipts; mode text; n integer; distinct_units integer; v_summary jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 select * into s from public.evidence_qualification_snapshots where id=p_snapshot and principal_id=p_principal and workspace_id=p_workspace and status='sealed';
 if not found then raise exception 'Sealed analytical snapshot required'; end if;
 select * into b from public.evidence_analytical_bindings where id=s.binding_id;
 select * into c from public.evidence_integrity_cycles where id=s.cycle_id;
 select * into m from public.evidence_integrity_monitors where id=b.monitor_id;
 if b.active_snapshot_id is distinct from s.id or b.revision<>s.binding_revision or c.monitor_revision<>m.revision or c.source_sequence<>(select max(import_sequence) from public.evidence_ingestion_batches where corpus_id=m.corpus_id) then raise exception 'Analytical snapshot is stale'; end if;
 select * into proof from public.evidence_integrity_release_checks where principal_id=p_principal and workspace_id=p_workspace and binding_id=b.id and corpus_id=m.corpus_id and qualification_policy_id=b.qualification_policy_id and screening_policy_id=c.screening_policy_id and deployment_scope=p_deployment_scope order by recorded_at desc limit 1;
 if not found then raise exception 'Client reporting awaits scoped reconciliation/security validation'; end if;
 if cardinality(p_sources)>10000 or p_expected_count<0 or p_scope_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid analytical receipt bounds'; end if;
 select count(distinct source_record_id),count(distinct e.count_unit_id) into n,distinct_units from public.evidence_qualification_entries e join public.evidence_source_revisions r on r.id=e.source_revision_id where snapshot_id=s.id and r.source_record_id=any(p_sources);
 mode:=s.metrics->>'countingMode';
 if n<>cardinality(p_sources) or n<>p_expected_count or (mode<>'all_eligible_posts' and distinct_units<>n) then raise exception 'Analytical input counts do not reconcile'; end if;
 if (s.metrics->>'collectedRecords')::integer<>(s.metrics->>'uniqueSourceRecords')::integer+(s.metrics->>'technicalRepeatOccurrences')::integer or (s.metrics->>'analyticallyCountedRecords')::integer>(s.metrics->>'uniqueSourceRecords')::integer then raise exception 'Corpus metrics do not reconcile'; end if;
 select * into receipt from public.evidence_analysis_receipts where principal_id=p_principal and workspace_id=p_workspace and snapshot_id=s.id and scope_hash=p_scope_hash;
 if found then if receipt.source_ids is distinct from p_sources then raise exception 'Analysis scope hash reused'; end if; return receipt.summary; end if;
 insert into public.evidence_analysis_receipts(principal_id,workspace_id,snapshot_id,release_check_id,scope_hash,source_ids,analytical_input_count,summary,created_by) values(p_principal,p_workspace,s.id,proof.id,p_scope_hash,p_sources,n,'{}',p_actor) returning * into receipt;
 v_summary:=jsonb_build_object('schemaVersion','evidence-integrity-summary-1','receiptId',receipt.id,'workspaceId',p_workspace,'snapshotId',s.id,'methodologyVersion','screening-3.0.0 / qualification-3.0.0','sourceRecordsCollected',(s.metrics->>'collectedRecords')::integer,'uniqueAnalyticalCorpusRecords',(s.metrics->>'analyticallyCountedRecords')::integer,'analyticalInputRecords',n,'duplicateImportOccurrences',(s.metrics->>'technicalRepeatOccurrences')::integer,'repostAmplificationRecords',(s.metrics->>'amplificationRecords')::integer,'assessmentCoveragePercent',case when (s.metrics->>'uniqueSourceRecords')::integer>0 then round((s.metrics->>'assessedRecords')::numeric*100/(s.metrics->>'uniqueSourceRecords')::numeric,2) else null end,'suspectedActivityPercent',case when (s.metrics->>'assessedRecords')::integer>0 then round((s.metrics->>'suspectedActivityRecords')::numeric*100/(s.metrics->>'assessedRecords')::numeric,2) else null end,'insufficientEvidencePercent',case when (s.metrics->>'assessedRecords')::integer>0 then round((s.metrics->>'insufficientEvidenceRecords')::numeric*100/(s.metrics->>'assessedRecords')::numeric,2) else null end,'countingMode',mode,'scopeTherapeuticArea',b.area_key,'scopeModule',b.module_key,'scopeNote','Corpus metrics describe the retained version. Analytical input records describe this request after topic, query and audience filters. Individual themes may have narrower eligibility denominators.','narrative','AskSocial evaluated available source evidence for duplication, potential automation, coordinated activity and provenance completeness. Repeated imports were normalized for counting. Uncertain and flagged records were retained; near duplicates did not establish source equivalence. These assessments do not independently verify human authorship.','limitations',jsonb_build_array('Absence of flags does not establish authenticity.','Suspected activity percentages use assessed records; incomplete coverage remains explicit.','Reposts are grouped only where source metadata establishes an original relationship.','Qualification never suppresses or changes pharmacovigilance cases.'));
 -- Initial receipt construction is confined to this transaction. It becomes
 -- immutable on commit; subsequent changes are prevented by the trigger below.
 update public.evidence_analysis_receipts set summary=v_summary where id=receipt.id;
 return v_summary;
end $$;
create function public.guard_evidence_receipt() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' and old.summary='{}'::jsonb and old.created_at>=transaction_timestamp() then return new; end if;
 raise exception 'Evidence analysis receipts are immutable';
end $$;
create trigger evidence_receipt_guard before update or delete on public.evidence_analysis_receipts for each row execute function public.guard_evidence_receipt();
create function public.read_evidence_client_summary(p_principal text,p_workspace uuid,p_actor text,p_receipt uuid,p_deployment_scope text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.evidence_analysis_receipts; s public.evidence_qualification_snapshots; b public.evidence_analytical_bindings; c public.evidence_integrity_cycles; m public.evidence_integrity_monitors;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 select * into r from public.evidence_analysis_receipts where id=p_receipt and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Summary unavailable'; end if;
 select * into s from public.evidence_qualification_snapshots where id=r.snapshot_id;
 select * into b from public.evidence_analytical_bindings where id=s.binding_id;
 select * into c from public.evidence_integrity_cycles where id=s.cycle_id;
 select * into m from public.evidence_integrity_monitors where id=b.monitor_id;
 if b.active_snapshot_id is distinct from s.id or b.revision<>s.binding_revision or m.revision<>c.monitor_revision or c.source_sequence<>(select max(import_sequence) from public.evidence_ingestion_batches where corpus_id=m.corpus_id) or not exists(select 1 from public.evidence_integrity_release_checks where id=r.release_check_id and deployment_scope=p_deployment_scope) then raise exception 'Summary is stale or not released for this environment'; end if;
 return r.summary;
end $$;
do $$ declare t text; begin
 foreach t in array array['evidence_integrity_release_checks','evidence_analysis_receipts'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  if t='evidence_integrity_release_checks' then execute format('create trigger evidence_release_immutable before update or delete on public.%I for each row execute function public.evidence_foundation_immutable()',t); end if;
  execute format('create trigger evidence_report_no_truncate before truncate on public.%I execute function public.evidence_foundation_immutable()',t);
 end loop;
end $$;
revoke all on function public.guard_evidence_receipt() from public,anon,authenticated,service_role;
revoke all on function public.record_evidence_release_checks(text,uuid,text,uuid,text,text,text,jsonb),public.create_evidence_analysis_receipt(text,uuid,text,uuid,uuid[],text,integer,text),public.read_evidence_client_summary(text,uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.record_evidence_release_checks(text,uuid,text,uuid,text,text,text,jsonb),public.create_evidence_analysis_receipt(text,uuid,text,uuid,uuid[],text,integer,text),public.read_evidence_client_summary(text,uuid,text,uuid,text) to service_role;
commit;
