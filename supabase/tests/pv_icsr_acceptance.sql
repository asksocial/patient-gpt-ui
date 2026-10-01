-- Run only in the confirmed migrated STAGING project, as database administrator.
-- Uses synthetic data exclusively. A final ROLLBACK removes all fixture/revision writes.
-- Any failed assertion aborts the transaction. Run ROLLBACK if the SQL client stops early.
begin;
do $$
declare
  v_record uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_revision integer;
  v_function text := 'public.save_pv_icsr_revision(uuid,text,text,integer,text,jsonb,jsonb)';
begin
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='pv_icsr_cases' and c.relrowsecurity) or
     not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='pv_icsr_case_revisions' and c.relrowsecurity) then
    raise exception 'RLS is not enabled on both ICSR tables';
  end if;
  if has_table_privilege('anon','public.pv_icsr_cases','select') or has_table_privilege('authenticated','public.pv_icsr_cases','select') or
     has_table_privilege('anon','public.pv_icsr_case_revisions','select') or has_table_privilege('authenticated','public.pv_icsr_case_revisions','select') then
    raise exception 'Direct user table access must be denied';
  end if;
  if has_function_privilege('anon', v_function, 'execute') or has_function_privilege('authenticated', v_function, 'execute') or
     not has_function_privilege('service_role', v_function, 'execute') then
    raise exception 'RPC privilege boundary failed';
  end if;
  insert into public.pv_records(
    id,principal_id,external_id,source_type,source_url,original_verbatim,evidence_hash,
    posted_at,ingested_at,identified_at,detection_score,product_confidence,health_experience_confidence,
    context_confidence,classifier_version,library_version
  ) values (
    v_record,'icsr-qa-tenant-a',v_record::text,'QA synthetic','https://example.invalid/icsr-qa',
    'SYNTHETIC QA FIXTURE: not an actual patient or safety case.',v_record::text,
    now(),now(),now(),0,0,0,0,'icsr-qa',1
  );
  v_snapshot := jsonb_build_object('revision',1,'originalExtraction',jsonb_build_object('synthetic',true),
    'caseData',jsonb_build_object('id',v_record::text,'status','requires_review'),'email',null);
  select public.save_pv_icsr_revision(v_record,'icsr-qa-tenant-a','qa-reviewer',0,'qa_test',v_snapshot,'["caseData.status"]') into v_revision;
  if v_revision <> 1 or (select count(*) from public.pv_icsr_case_revisions where record_id=v_record) <> 1 then
    raise exception 'Initial snapshot and audit revision did not commit together';
  end if;
  begin
    perform public.save_pv_icsr_revision(v_record,'icsr-qa-tenant-b','qa-reviewer',1,'qa_test',v_snapshot,'[]');
    raise exception 'Foreign tenant write unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'PV record not found' then raise; end if;
  end;
  begin
    perform public.save_pv_icsr_revision(v_record,'icsr-qa-tenant-a','qa-reviewer',0,'qa_test',v_snapshot,'[]');
    raise exception 'Stale revision unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'ICSR revision conflict' then raise; end if;
  end;
  v_snapshot := jsonb_set(v_snapshot,'{revision}','2');
  select public.save_pv_icsr_revision(v_record,'icsr-qa-tenant-a','qa-reviewer-2',1,'qa_update',v_snapshot,'[]') into v_revision;
  if v_revision <> 2 then raise exception 'Second review revision failed'; end if;
  begin
    perform public.save_pv_icsr_revision(v_record,'icsr-qa-tenant-a','qa-reviewer',2,'qa_test',
      jsonb_set(jsonb_set(v_snapshot,'{revision}','3'),'{originalExtraction}','{"tampered":true}'),'[]');
    raise exception 'Original extraction change unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'Original extraction is immutable' then raise; end if;
  end;
  begin
    update public.pv_icsr_case_revisions set action='tampered' where record_id=v_record;
    raise exception 'Revision update unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'ICSR revisions are append-only' then raise; end if;
  end;
  begin
    delete from public.pv_icsr_case_revisions where record_id=v_record;
    raise exception 'Revision deletion unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'ICSR revisions are append-only' then raise; end if;
  end;
  if (select revision from public.pv_icsr_cases where record_id=v_record) <> 2 or
     (select count(*) from public.pv_icsr_case_revisions where record_id=v_record) <> 2 then
    raise exception 'Failed operations changed persisted state';
  end if;
  raise notice 'PASS: schema/RLS, permissions, tenant write denial, stale revisions, original extraction, append-only history, and atomic state/history. True simultaneous API writes remain a staging check.';
end;
$$;
rollback;
