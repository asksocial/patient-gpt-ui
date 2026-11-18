-- Stage 4 verified write/privacy gaps; previous stage migrations remain immutable.
begin;
create or replace function public.evidence_foundation_access(p_principal text,p_workspace uuid,p_actor text,p_write boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.intelligence_workspaces; member_role text;
begin
 if nullif(btrim(p_principal),'') is null or nullif(btrim(p_actor),'') is null then raise exception 'Identity required'; end if;
 select * into w from public.intelligence_workspaces where id=p_workspace and principal_id=p_principal and archived_at is null for share;
 if not found then raise exception 'Evidence workspace unavailable'; end if;
 select role into member_role from public.intelligence_workspace_members where workspace_id=p_workspace and principal_id=p_principal and user_id=p_actor for share;
 if member_role is null and w.created_by=p_actor then member_role:='owner'; end if;
 if member_role is null or (p_write and member_role not in ('owner','editor')) then raise exception 'Evidence workspace access denied'; end if;
end $$;
-- Serialize lease validation with claim replacement/configuration through commit.
create or replace function public.evidence_monitor_access(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid)
returns public.evidence_integrity_monitors language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 select * into m from public.evidence_integrity_monitors where id=p_monitor and principal_id=p_principal and workspace_id=p_workspace and enabled and claim_token=p_token and lease_until>clock_timestamp() for update;
 if not found then raise exception 'Monitor lease unavailable'; end if; return m;
end $$;
-- Consistent order for all monitor writes: membership, workspace advisory lock, monitor row.
create or replace function public.import_evidence_monitored_batch(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors;
begin
 m:=public.evidence_monitor_access(p_principal,p_workspace,p_actor,p_monitor,p_token);
 if m.created_by is distinct from p_actor or m.file_area is null or m.retention_basis is distinct from p_input->>'retentionBasis' or m.retention_policy_reference is distinct from p_input->>'retentionPolicyReference' then raise exception 'Approved file retention scope required'; end if;
 return public.import_evidence_batch(p_principal,p_workspace,p_actor,m.corpus_id,p_input);
end $$;
-- Failure evidence is a write and must be bound to the same live monitor lease.
create function public.fail_evidence_screening(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid,p_cycle uuid,p_assessment uuid,p_code text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors;
begin
 m:=public.evidence_monitor_access(p_principal,p_workspace,p_actor,p_monitor,p_token);
 if not exists(select 1 from public.evidence_integrity_cycles where id=p_cycle and monitor_id=m.id) then raise exception 'Cycle outside monitor'; end if;
 perform public.fail_evidence_screening(p_principal,p_workspace,p_actor,p_cycle,p_assessment,p_code);
end $$;
revoke all on function public.fail_evidence_screening(text,uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.fail_evidence_screening(text,uuid,text,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.fail_evidence_screening(text,uuid,text,uuid,uuid,uuid,uuid,text) to service_role;
-- Suppress small cells and their complements, without changing any denominator.
create function public.evidence_public_rate(p_n integer,p_d integer) returns numeric
language sql immutable set search_path=public,pg_temp as $$
 select case when p_d>=20 and p_n>=10 and p_d-p_n>=10 then round(p_n*100.0/p_d,2) else null end
$$;
revoke all on function public.evidence_public_rate(integer,integer) from public,anon,authenticated,service_role;
create or replace function public.create_evidence_analysis_receipt(p_principal text,p_workspace uuid,p_actor text,p_snapshot uuid,p_sources uuid[],p_scope_hash text,p_expected_count integer,p_deployment_scope text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.evidence_qualification_snapshots; b public.evidence_analytical_bindings; c public.evidence_integrity_cycles; m public.evidence_integrity_monitors; proof public.evidence_integrity_release_checks; receipt public.evidence_analysis_receipts; mode text; n integer; distinct_units integer; v_summary jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 select * into s from public.evidence_qualification_snapshots where id=p_snapshot and principal_id=p_principal and workspace_id=p_workspace and status='sealed';
 if not found then raise exception 'Sealed analytical snapshot required'; end if;
 select * into b from public.evidence_analytical_bindings where id=s.binding_id;
 select * into c from public.evidence_integrity_cycles where id=s.cycle_id;
 select * into m from public.evidence_integrity_monitors where id=b.monitor_id;
 if b.active_snapshot_id is distinct from s.id or b.revision<>s.binding_revision or c.monitor_revision<>m.revision or c.source_sequence<>(select max(import_sequence) from public.evidence_ingestion_batches where corpus_id=m.corpus_id) then raise exception 'Analytical snapshot is stale'; end if;
 select * into proof from public.evidence_integrity_release_checks where principal_id=p_principal and workspace_id=p_workspace and binding_id=b.id and corpus_id=m.corpus_id and qualification_policy_id=b.qualification_policy_id and screening_policy_id=c.screening_policy_id and deployment_scope=p_deployment_scope order by recorded_at desc limit 1;
 if not found then raise exception 'Client reporting awaits scoped reconciliation/security validation'; end if;
 if p_expected_count<10 or (s.metrics->>'uniqueSourceRecords')::integer<10 then raise exception 'Public summary withheld: minimum cohort size is 10'; end if;
 if cardinality(p_sources)>10000 or p_expected_count<0 or p_scope_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid analytical receipt bounds'; end if;
 select count(distinct source_record_id),count(distinct e.count_unit_id) into n,distinct_units from public.evidence_qualification_entries e join public.evidence_source_revisions r on r.id=e.source_revision_id where snapshot_id=s.id and r.source_record_id=any(p_sources);
 mode:=s.metrics->>'countingMode';
 if n<>cardinality(p_sources) or n<>p_expected_count or (mode<>'all_eligible_posts' and distinct_units<>n) then raise exception 'Analytical input counts do not reconcile'; end if;
 if (s.metrics->>'collectedRecords')::integer<>(s.metrics->>'uniqueSourceRecords')::integer+(s.metrics->>'technicalRepeatOccurrences')::integer or (s.metrics->>'analyticallyCountedRecords')::integer>(s.metrics->>'uniqueSourceRecords')::integer then raise exception 'Corpus metrics do not reconcile'; end if;
 select * into receipt from public.evidence_analysis_receipts where principal_id=p_principal and workspace_id=p_workspace and snapshot_id=s.id and scope_hash=p_scope_hash;
 if found then if receipt.source_ids is distinct from p_sources then raise exception 'Analysis scope hash reused'; end if; return receipt.summary; end if;
 insert into public.evidence_analysis_receipts(principal_id,workspace_id,snapshot_id,release_check_id,scope_hash,source_ids,analytical_input_count,summary,created_by) values(p_principal,p_workspace,s.id,proof.id,p_scope_hash,p_sources,n,'{}',p_actor) returning * into receipt;
 v_summary:=jsonb_build_object('schemaVersion','evidence-integrity-summary-1','receiptId',receipt.id,'workspaceId',p_workspace,'snapshotId',s.id,'methodologyVersion','screening-3.0.0 / qualification-3.0.0','sourceRecordsCollected',(s.metrics->>'collectedRecords')::integer,'uniqueAnalyticalCorpusRecords',(s.metrics->>'analyticallyCountedRecords')::integer,'analyticalInputRecords',n,'duplicateImportOccurrences',(s.metrics->>'technicalRepeatOccurrences')::integer,'repostAmplificationRecords',(s.metrics->>'amplificationRecords')::integer,'assessmentCoveragePercent',case when (s.metrics->>'uniqueSourceRecords')::integer>0 then public.evidence_public_rate((s.metrics->>'assessedRecords')::integer,(s.metrics->>'uniqueSourceRecords')::integer) else null end,'suspectedActivityPercent',case when (s.metrics->>'assessedRecords')::integer>0 then public.evidence_public_rate((s.metrics->>'suspectedActivityRecords')::integer,(s.metrics->>'assessedRecords')::integer) else null end,'insufficientEvidencePercent',case when (s.metrics->>'assessedRecords')::integer>0 then public.evidence_public_rate((s.metrics->>'insufficientEvidenceRecords')::integer,(s.metrics->>'assessedRecords')::integer) else null end,'countingMode',mode,'scopeTherapeuticArea',b.area_key,'scopeModule',b.module_key,'scopeNote','Corpus metrics describe the retained version. Analytical input records describe this request after topic, query and audience filters. Individual themes may have narrower eligibility denominators. Public summaries require at least 10 input and corpus records; percentages are suppressed when either complementary cell has fewer than 10 records.','narrative','AskSocial evaluated available source evidence for duplication, potential automation, coordinated activity and provenance completeness. Repeated imports were normalized for counting. Uncertain and flagged records were retained; near duplicates did not establish source equivalence. These assessments do not independently verify human authorship.','limitations',jsonb_build_array('Absence of flags does not establish authenticity.','Suspected activity percentages use assessed records; incomplete coverage remains explicit.','Reposts are grouped only where source metadata establishes an original relationship.','Qualification never suppresses or changes pharmacovigilance cases.'));
 -- Initial receipt construction is confined to this transaction. It becomes
 -- immutable on commit; subsequent changes are prevented by the trigger below.
 update public.evidence_analysis_receipts set summary=v_summary where id=receipt.id;
 return v_summary;
end $$;
create or replace function public.read_evidence_client_summary(p_principal text,p_workspace uuid,p_actor text,p_receipt uuid,p_deployment_scope text)
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
 if r.analytical_input_count<10 or (s.metrics->>'uniqueSourceRecords')::integer<10 then raise exception 'Public summary withheld: minimum cohort size is 10'; end if;
 return r.summary || jsonb_build_object(
  'assessmentCoveragePercent',public.evidence_public_rate((s.metrics->>'assessedRecords')::integer,(s.metrics->>'uniqueSourceRecords')::integer),
  'suspectedActivityPercent',public.evidence_public_rate((s.metrics->>'suspectedActivityRecords')::integer,(s.metrics->>'assessedRecords')::integer),
  'insufficientEvidencePercent',public.evidence_public_rate((s.metrics->>'insufficientEvidenceRecords')::integer,(s.metrics->>'assessedRecords')::integer),
  'scopeNote','Corpus metrics describe the retained version. Analytical input records describe this request after topic, query and audience filters. Individual themes may have narrower eligibility denominators. Public summaries require at least 10 input and corpus records; percentages are suppressed when either complementary cell has fewer than 10 records.');
end $$;
commit;
