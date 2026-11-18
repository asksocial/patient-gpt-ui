begin;
create table public.evidence_screening_policies (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null references public.intelligence_workspaces(id),
 version text not null, config jsonb not null, policy_hash text not null, rationale text not null check(length(rationale)>=50),
 created_by text not null, created_at timestamptz not null default clock_timestamp(),
 unique(principal_id,workspace_id,version), unique(principal_id,workspace_id,id)
);
create table public.evidence_integrity_monitors (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, corpus_id uuid not null,
 revision integer not null default 1, assessment_policy_id uuid not null, screening_policy_id uuid not null, enabled boolean not null,
 file_area text, file_module text, file_fingerprint text, retention_basis text, retention_policy_reference text,
 interval_seconds integer not null default 60 check(interval_seconds between 30 and 86400),
 next_run_at timestamptz not null default clock_timestamp(), claim_token uuid, lease_until timestamptz,
 last_success_at timestamptz, last_error_code text, created_by text not null,
 foreign key(principal_id,workspace_id,corpus_id) references public.evidence_corpora(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,assessment_policy_id) references public.evidence_assessment_policies(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,screening_policy_id) references public.evidence_screening_policies(principal_id,workspace_id,id),
 unique(principal_id,workspace_id,corpus_id), unique(principal_id,workspace_id,id)
);
create table public.evidence_integrity_monitor_events (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, monitor_id uuid not null,
 revision integer not null, configuration jsonb not null, actor_id text not null, reason text not null, recorded_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,monitor_id) references public.evidence_integrity_monitors(principal_id,workspace_id,id), unique(monitor_id,revision)
);
create table public.evidence_integrity_cycles (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, monitor_id uuid not null,
 monitor_revision integer not null, source_sequence bigint not null, assessment_run_id uuid not null, screening_policy_id uuid not null,
 enqueue_cursor integer not null default -1, status text not null default 'processing' check(status in ('processing','completed','dead_letter')),
 created_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
 foreign key(principal_id,workspace_id,monitor_id) references public.evidence_integrity_monitors(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,assessment_run_id) references public.evidence_assessment_runs(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,screening_policy_id) references public.evidence_screening_policies(principal_id,workspace_id,id),
 unique(monitor_id,monitor_revision,source_sequence), unique(principal_id,workspace_id,id)
);
create table public.evidence_screenings (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, cycle_id uuid not null,
 assessment_id uuid not null, screening_policy_id uuid not null, methodology_version text not null check(methodology_version='screening-3.0.0'),
 flags text[] not null, result jsonb not null, assessed_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,cycle_id) references public.evidence_integrity_cycles(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,assessment_id) references public.evidence_assessments(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,screening_policy_id) references public.evidence_screening_policies(principal_id,workspace_id,id),
 unique(assessment_id,screening_policy_id), unique(principal_id,workspace_id,id)
);
create index evidence_screenings_flags on public.evidence_screenings using gin(flags);
create table public.evidence_screening_errors (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, cycle_id uuid not null,
 assessment_id uuid not null, code text not null check(code in ('screening_failed','storage_failed')),
 attempt integer not null check(attempt between 1 and 3), recorded_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,cycle_id) references public.evidence_integrity_cycles(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,assessment_id) references public.evidence_assessments(principal_id,workspace_id,id), unique(cycle_id,assessment_id,attempt)
);
create index evidence_screening_error_lookup on public.evidence_screening_errors(cycle_id,assessment_id,recorded_at);

create function public.register_evidence_screening_policy(p_principal text,p_workspace uuid,p_actor text,p_version text,p_config jsonb,p_rationale text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_screening_policies; h text; f text;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 if nullif(btrim(p_version),'') is null or length(p_version)>100 or jsonb_typeof(p_config->'flags') is distinct from 'object' or p_config-array['flags','minimumAccounts','minimumTemplatePosts','synchronizationSeconds']<>'{}' then raise exception 'Invalid screening policy'; end if;
 foreach f in array array['suspected_automation','suspected_coordination','repetitive_template','potential_synthetic_content','provenance_incomplete','exact_duplicate','near_duplicate','repost','insufficient_evidence'] loop
  if jsonb_typeof(p_config->'flags'->f) is distinct from 'boolean' then raise exception 'Explicit flag settings required'; end if;
 end loop;
 if (p_config->'flags')-array['suspected_automation','suspected_coordination','repetitive_template','potential_synthetic_content','provenance_incomplete','exact_duplicate','near_duplicate','repost','insufficient_evidence']<>'{}' then raise exception 'Unsupported flag'; end if;
 if p_config->>'minimumAccounts' is null or p_config->>'minimumTemplatePosts' is null or p_config->>'synchronizationSeconds' is null or (p_config->>'minimumAccounts')::integer not between 3 and 20 or (p_config->>'minimumTemplatePosts')::integer not between 3 and 50 or (p_config->>'synchronizationSeconds')::integer not between 10 and 3600 then raise exception 'Invalid screening bounds'; end if;
 h:=encode(sha256(convert_to(p_config::text,'UTF8')),'hex');
 select * into v from public.evidence_screening_policies where principal_id=p_principal and workspace_id=p_workspace and version=p_version;
 if found then
  if v.policy_hash<>h or v.rationale<>p_rationale then raise exception 'Screening policy version is immutable'; end if;
  return to_jsonb(v);
 end if;
 insert into public.evidence_screening_policies(principal_id,workspace_id,version,config,policy_hash,rationale,created_by) values(p_principal,p_workspace,p_version,p_config,h,p_rationale,p_actor) returning * into v;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'screening.policy.create',v.id,jsonb_build_object('policyHash',h)); return to_jsonb(v);
end $$;

create function public.configure_evidence_monitor(p_principal text,p_workspace uuid,p_actor text,p_corpus uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 if jsonb_typeof(p_input->'enabled') is distinct from 'boolean' or length(coalesce(p_input->>'reason',''))<10 then raise exception 'Explicit configuration and reason required'; end if;
 select * into m from public.evidence_integrity_monitors where principal_id=p_principal and workspace_id=p_workspace and corpus_id=p_corpus for update;
 if found then
  if (p_input->>'expectedRevision')::integer is distinct from m.revision then raise exception 'Monitor revision conflict'; end if;
  update public.evidence_integrity_monitors set revision=revision+1,assessment_policy_id=(p_input->>'assessmentPolicyId')::uuid,screening_policy_id=(p_input->>'screeningPolicyId')::uuid,enabled=(p_input->>'enabled')::boolean,file_area=p_input->>'fileArea',file_module=p_input->>'fileModule',file_fingerprint=p_input->>'fileFingerprint',retention_basis=p_input->>'retentionBasis',retention_policy_reference=p_input->>'retentionPolicyReference',interval_seconds=coalesce((p_input->>'intervalSeconds')::integer,60),next_run_at=clock_timestamp(),claim_token=null,lease_until=null,created_by=p_actor where id=m.id returning * into m;
 else
  if coalesce((p_input->>'expectedRevision')::integer,0)<>0 then raise exception 'Monitor does not exist'; end if;
  insert into public.evidence_integrity_monitors(principal_id,workspace_id,corpus_id,assessment_policy_id,screening_policy_id,enabled,file_area,file_module,file_fingerprint,retention_basis,retention_policy_reference,interval_seconds,created_by)
  values(p_principal,p_workspace,p_corpus,(p_input->>'assessmentPolicyId')::uuid,(p_input->>'screeningPolicyId')::uuid,(p_input->>'enabled')::boolean,p_input->>'fileArea',p_input->>'fileModule',p_input->>'fileFingerprint',p_input->>'retentionBasis',p_input->>'retentionPolicyReference',coalesce((p_input->>'intervalSeconds')::integer,60),p_actor) returning * into m;
 end if;
 if m.file_area is not null and (length(coalesce(m.retention_basis,''))<10 or nullif(btrim(m.retention_policy_reference),'') is null) then raise exception 'File retention permission and policy required'; end if;
 insert into public.evidence_integrity_monitor_events(principal_id,workspace_id,monitor_id,revision,configuration,actor_id,reason) values(p_principal,p_workspace,m.id,m.revision,to_jsonb(m)-array['claim_token','lease_until'],p_actor,p_input->>'reason');
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'screening.monitor.configure',m.id,jsonb_build_object('revision',m.revision,'enabled',m.enabled)); return to_jsonb(m);
end $$;

-- Global trusted scheduler boundary, never granted to browser roles. Scope and
-- governing actor come from approved durable configuration, not request input.
create function public.claim_evidence_monitors(p_limit integer default 3) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors; items jsonb:='[]';
begin
 if p_limit not between 1 and 5 then raise exception 'Invalid monitor claim limit'; end if;
 for m in select * from public.evidence_integrity_monitors where enabled and next_run_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp()) order by next_run_at,id for update skip locked limit p_limit loop
  update public.evidence_integrity_monitors set claim_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes' where id=m.id returning * into m;
  items:=items||jsonb_build_array(to_jsonb(m));
 end loop;
 return items;
end $$;
create function public.evidence_monitor_access(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid)
returns public.evidence_integrity_monitors language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 select * into m from public.evidence_integrity_monitors where id=p_monitor and principal_id=p_principal and workspace_id=p_workspace and enabled and claim_token=p_token and lease_until>clock_timestamp();
 if not found then raise exception 'Monitor lease unavailable'; end if; return m;
end $$;
-- Recheck the current configured lease inside every source-import transaction.
-- Row locking prevents a concurrent policy revocation from racing a chunk.
create function public.import_evidence_monitored_batch(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors;
begin
 select * into m from public.evidence_integrity_monitors where id=p_monitor for update;
 m:=public.evidence_monitor_access(p_principal,p_workspace,p_actor,p_monitor,p_token);
 if m.created_by is distinct from p_actor or m.file_area is null or m.retention_basis is distinct from p_input->>'retentionBasis' or m.retention_policy_reference is distinct from p_input->>'retentionPolicyReference' then raise exception 'Approved file retention scope required'; end if;
 return public.import_evidence_batch(p_principal,p_workspace,p_actor,m.corpus_id,p_input);
end $$;
revoke all on function public.import_evidence_monitored_batch(text,uuid,text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.import_evidence_monitored_batch(text,uuid,text,uuid,uuid,jsonb) to service_role;

create function public.prepare_evidence_cycle(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors; b public.evidence_ingestion_batches; c public.evidence_integrity_cycles; r jsonb;
begin
 m:=public.evidence_monitor_access(p_principal,p_workspace,p_actor,p_monitor,p_token);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 select * into b from public.evidence_ingestion_batches where corpus_id=m.corpus_id order by import_sequence desc limit 1;
 if not found then return null; end if;
 select * into c from public.evidence_integrity_cycles where monitor_id=m.id and monitor_revision=m.revision and source_sequence=b.import_sequence;
 if not found then
  r:=public.create_evidence_assessment_run(p_principal,p_workspace,p_actor,m.corpus_id,b.corpus_version_id,m.assessment_policy_id,'deterministic-1.0.0');
  insert into public.evidence_integrity_cycles(principal_id,workspace_id,monitor_id,monitor_revision,source_sequence,assessment_run_id,screening_policy_id)
  values(p_principal,p_workspace,m.id,m.revision,b.import_sequence,(r->>'id')::uuid,m.screening_policy_id) returning * into c;
  perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'screening.cycle.create',c.id,jsonb_build_object('runId',c.assessment_run_id,'sourceSequence',c.source_sequence));
 end if;
 -- Finish an older captured context rather than silently abandoning its jobs.
 select * into c from public.evidence_integrity_cycles where monitor_id=m.id and status='processing' order by created_at,id limit 1;
 if not found then select * into c from public.evidence_integrity_cycles where monitor_id=m.id order by created_at desc,id desc limit 1; end if;
 return to_jsonb(c);
end $$;

create function public.pending_evidence_screenings(p_principal text,p_workspace uuid,p_actor text,p_cycle uuid,p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.evidence_integrity_cycles; items jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 if p_limit not between 1 and 25 then raise exception 'Invalid screening batch limit'; end if;
 select * into c from public.evidence_integrity_cycles where id=p_cycle and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Cycle unavailable'; end if;
 select coalesce(jsonb_agg(id),'[]') into items from (
  select a.id from public.evidence_assessments a where a.run_id=c.assessment_run_id
  and not exists(select 1 from public.evidence_screenings s where s.assessment_id=a.id and s.screening_policy_id=c.screening_policy_id)
  and (select count(*) from public.evidence_screening_errors e where e.cycle_id=c.id and e.assessment_id=a.id)<3
  and coalesce((select max(e.recorded_at)+interval '2 seconds' from public.evidence_screening_errors e where e.cycle_id=c.id and e.assessment_id=a.id),'-infinity')<=clock_timestamp()
  order by a.source_revision_id limit p_limit
 ) page; return items;
end $$;

-- A bounded completed-assessment context; Stage 2 source inputs and method remain
-- immutable. Extra template/time candidates support cross-account screening.
create function public.load_evidence_screening(p_principal text,p_workspace uuid,p_actor text,p_cycle uuid,p_assessment uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.evidence_integrity_cycles; a public.evidence_assessments; r public.evidence_assessment_runs; t public.evidence_assessment_inputs; p public.evidence_assessment_policies; sp public.evidence_screening_policies; ids uuid[]; cap integer; candidates jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 select * into c from public.evidence_integrity_cycles where id=p_cycle and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Cycle unavailable'; end if;
 select * into a from public.evidence_assessments where id=p_assessment and run_id=c.assessment_run_id;
 if not found then raise exception 'Assessment outside cycle'; end if;
 select * into r from public.evidence_assessment_runs where id=a.run_id;
 select * into t from public.evidence_assessment_inputs where run_id=r.id and source_revision_id=a.source_revision_id;
 select * into p from public.evidence_assessment_policies where id=r.policy_id;
 select * into sp from public.evidence_screening_policies where id=c.screening_policy_id; cap:=(p.config->>'maxCandidates')::integer;
 with raw as (
  (select source_revision_id as id,source_key,0 as priority from public.evidence_assessment_inputs where run_id=r.id and source_revision_id<>a.source_revision_id and template_key=t.template_key order by source_key limit cap+1)
  union all (select source_revision_id,source_key,1 from public.evidence_assessment_inputs where run_id=r.id and source_revision_id<>a.source_revision_id and account_id=t.account_id order by abs(extract(epoch from(published_at-t.published_at))) nulls last,source_key limit cap+1)
  union all (select source_revision_id,source_key,2 from public.evidence_assessment_inputs where run_id=r.id and source_revision_id<>a.source_revision_id and token_keys && t.token_keys order by source_key limit cap+1)
 ), chosen as (select id,min(source_key) as source_key,min(priority) as priority from raw group by id order by min(priority),min(source_key) limit cap+1)
 select coalesce(array_agg(id order by priority,source_key),'{}') into ids from chosen;
 select coalesce(jsonb_agg(public.evidence_assessment_input_json(r.id,u.id) order by u.n),'[]') into candidates from unnest(ids[1:cap]) with ordinality as u(id,n);
 return jsonb_build_object('assessment',to_jsonb(a),'screeningPolicy',to_jsonb(sp),'context',jsonb_build_object('contextHash',r.context_hash,'policyHash',p.policy_hash,'methodologyVersion',r.methodology_version,'inputVersion',r.input_version,'policy',p.config,'target',public.evidence_assessment_input_json(r.id,a.source_revision_id),'candidates',candidates,'candidateTruncated',cardinality(ids)>cap,'exactOtherSourceCount',(select count(*) from public.evidence_assessment_inputs where run_id=r.id and source_revision_id<>a.source_revision_id and content_hash=t.content_hash),'templateOtherSourceCount',(select count(*) from public.evidence_assessment_inputs where run_id=r.id and source_revision_id<>a.source_revision_id and template_key=t.template_key),'accountOtherSourceCount',(select count(*) from public.evidence_assessment_inputs where run_id=r.id and source_revision_id<>a.source_revision_id and account_id=t.account_id)));
end $$;

create function public.save_evidence_screening(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid,p_cycle uuid,p_assessment uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors; c public.evidence_integrity_cycles; a public.evidence_assessments; s public.evidence_screenings; f jsonb; ref jsonb; codes text[]:='{}'; config jsonb;
begin
 m:=public.evidence_monitor_access(p_principal,p_workspace,p_actor,p_monitor,p_token);
 select * into c from public.evidence_integrity_cycles where id=p_cycle and monitor_id=m.id;
 select * into a from public.evidence_assessments where id=p_assessment and run_id=c.assessment_run_id;
 if not found then raise exception 'Assessment outside cycle'; end if;
 select * into s from public.evidence_screenings where assessment_id=a.id and screening_policy_id=c.screening_policy_id;
 if found then return to_jsonb(s); end if;
 select p.config into config from public.evidence_screening_policies p where id=c.screening_policy_id;
 if p_result->>'methodologyVersion' is distinct from 'screening-3.0.0' or p_result->>'sourceRevisionId' is distinct from a.source_revision_id::text or p_result->>'humanAuthorshipVerified' is distinct from 'false' or jsonb_typeof(p_result->'flags') is distinct from 'array' or octet_length(p_result::text)>1048576 then raise exception 'Invalid screening result'; end if;
 for f in select value from jsonb_array_elements(p_result->'flags') loop
  if config->'flags'->>(f->>'code') is distinct from 'true' or f->>'methodologyVersion' is distinct from 'screening-3.0.0' or jsonb_typeof(f->'evidenceRevisionIds') is distinct from 'array' then raise exception 'Disabled or invalid flag'; end if;
  for ref in select value from jsonb_array_elements(f->'evidenceRevisionIds') loop
   if not exists(select 1 from public.evidence_assessment_inputs where run_id=a.run_id and source_revision_id=(ref#>>'{}')::uuid) then raise exception 'Flag reference outside context'; end if;
  end loop;
  codes:=array_append(codes,f->>'code');
 end loop;
 insert into public.evidence_screenings(principal_id,workspace_id,cycle_id,assessment_id,screening_policy_id,methodology_version,flags,result) values(p_principal,p_workspace,c.id,a.id,c.screening_policy_id,'screening-3.0.0',codes,p_result) returning * into s;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'screening.complete',s.id,jsonb_build_object('assessmentId',a.id,'policyId',c.screening_policy_id,'flags',codes)); return to_jsonb(s);
end $$;
create function public.fail_evidence_screening(p_principal text,p_workspace uuid,p_actor text,p_cycle uuid,p_assessment uuid,p_code text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 if not exists(select 1 from public.evidence_integrity_cycles c join public.evidence_assessments a on a.run_id=c.assessment_run_id where c.id=p_cycle and c.principal_id=p_principal and c.workspace_id=p_workspace and a.id=p_assessment) then raise exception 'Assessment outside cycle'; end if;
 select count(*)+1 into n from public.evidence_screening_errors where cycle_id=p_cycle and assessment_id=p_assessment;
 if n>3 then return; end if;
 insert into public.evidence_screening_errors(principal_id,workspace_id,cycle_id,assessment_id,code,attempt) values(p_principal,p_workspace,p_cycle,p_assessment,p_code,n);
end $$;
create function public.checkpoint_evidence_cycle(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid,p_cycle uuid,p_cursor integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors; c public.evidence_integrity_cycles; pending integer; failed integer; missing integer; terminal integer; source_count integer;
begin
 m:=public.evidence_monitor_access(p_principal,p_workspace,p_actor,p_monitor,p_token);
 select * into c from public.evidence_integrity_cycles where id=p_cycle and monitor_id=m.id for update;
 if not found then raise exception 'Cycle unavailable'; end if;
 select count(*) into source_count from public.evidence_assessment_inputs where run_id=c.assessment_run_id;
 if p_cursor < c.enqueue_cursor or p_cursor>=source_count and source_count>0 then raise exception 'Invalid enqueue cursor'; end if;
 select count(*) filter(where status in ('queued','retry','running')),count(*) filter(where status='failed') into pending,failed from public.evidence_assessment_jobs where run_id=c.assessment_run_id;
 select count(*) into missing from public.evidence_assessments a where run_id=c.assessment_run_id and not exists(select 1 from public.evidence_screenings s where s.assessment_id=a.id and s.screening_policy_id=c.screening_policy_id);
 select count(*) into terminal from public.evidence_assessments a where run_id=c.assessment_run_id and not exists(select 1 from public.evidence_screenings s where s.assessment_id=a.id and s.screening_policy_id=c.screening_policy_id) and (select count(*) from public.evidence_screening_errors e where e.cycle_id=c.id and e.assessment_id=a.id)>=3;
 update public.evidence_integrity_cycles set enqueue_cursor=p_cursor,status=case when p_cursor>=source_count-1 and pending=0 and missing=terminal then case when failed>0 or terminal>0 then 'dead_letter' else 'completed' end else 'processing' end,completed_at=case when p_cursor>=source_count-1 and pending=0 and missing=terminal then clock_timestamp() else null end where id=c.id returning * into c;
 return to_jsonb(c);
end $$;
create function public.release_evidence_monitor(p_monitor uuid,p_token uuid,p_error text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_error is not null and p_error not in ('authorization_unavailable','processing_failed','source_import_failed') then raise exception 'Invalid monitor error'; end if;
 update public.evidence_integrity_monitors set lease_until=null,claim_token=null,next_run_at=clock_timestamp()+make_interval(secs=>interval_seconds),last_error_code=p_error,last_success_at=case when p_error is null then clock_timestamp() else last_success_at end where id=p_monitor and claim_token=p_token and lease_until>clock_timestamp();
end $$;

do $$ declare t text; begin
 foreach t in array array['evidence_screening_policies','evidence_integrity_monitors','evidence_integrity_monitor_events','evidence_integrity_cycles','evidence_screenings','evidence_screening_errors'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  if t not in ('evidence_integrity_monitors','evidence_integrity_cycles') then execute format('create trigger evidence_screening_immutable before update or delete on public.%I for each row execute function public.evidence_foundation_immutable()',t); end if;
  execute format('create trigger evidence_screening_no_truncate before truncate on public.%I execute function public.evidence_foundation_immutable()',t);
 end loop;
end $$;
revoke all on function public.evidence_monitor_access(text,uuid,text,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.register_evidence_screening_policy(text,uuid,text,text,jsonb,text),public.configure_evidence_monitor(text,uuid,text,uuid,jsonb),public.claim_evidence_monitors(integer),public.prepare_evidence_cycle(text,uuid,text,uuid,uuid),public.pending_evidence_screenings(text,uuid,text,uuid,integer),public.load_evidence_screening(text,uuid,text,uuid,uuid),public.save_evidence_screening(text,uuid,text,uuid,uuid,uuid,uuid,jsonb),public.fail_evidence_screening(text,uuid,text,uuid,uuid,text),public.checkpoint_evidence_cycle(text,uuid,text,uuid,uuid,uuid,integer),public.release_evidence_monitor(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.register_evidence_screening_policy(text,uuid,text,text,jsonb,text),public.configure_evidence_monitor(text,uuid,text,uuid,jsonb),public.claim_evidence_monitors(integer),public.prepare_evidence_cycle(text,uuid,text,uuid,uuid),public.pending_evidence_screenings(text,uuid,text,uuid,integer),public.load_evidence_screening(text,uuid,text,uuid,uuid),public.save_evidence_screening(text,uuid,text,uuid,uuid,uuid,uuid,jsonb),public.fail_evidence_screening(text,uuid,text,uuid,uuid,text),public.checkpoint_evidence_cycle(text,uuid,text,uuid,uuid,uuid,integer),public.release_evidence_monitor(uuid,uuid,text) to service_role;
commit;
