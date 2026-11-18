-- Observation-only Stage 2. No changes to foundation sources, membership or PV.
begin;
create table public.evidence_assessment_policies (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null references public.intelligence_workspaces(id),
 version text not null check(length(version) between 1 and 100), config jsonb not null, policy_hash text not null,
 rationale text not null check(length(rationale)>=50), validation_status text not null default 'unvalidated' check(validation_status='unvalidated'),
 created_by text not null, created_at timestamptz not null default now(),
 unique(principal_id,workspace_id,version), unique(principal_id,workspace_id,id)
);
create table public.evidence_assessment_runs (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, corpus_id uuid not null,
 corpus_version_id uuid not null, policy_id uuid not null, methodology_version text not null check(length(methodology_version) between 1 and 100),
 input_version text not null default 'retained-context-1' check(input_version='retained-context-1'),
 source_cutoff bigint not null, context_hash text not null, observation_only boolean not null default true check(observation_only),
 created_by text not null, created_at timestamptz not null default now(),
 foreign key(principal_id,workspace_id,corpus_id,corpus_version_id) references public.evidence_corpus_versions(principal_id,workspace_id,corpus_id,id),
 foreign key(principal_id,workspace_id,policy_id) references public.evidence_assessment_policies(principal_id,workspace_id,id),
 unique(principal_id,workspace_id,context_hash), unique(principal_id,workspace_id,id)
);
create table public.evidence_assessment_inputs (
 principal_id text not null, workspace_id uuid not null, run_id uuid not null, source_revision_id uuid not null,
 ordinal integer not null, source_record_id uuid not null, source_key text not null, content_hash text not null, template_key text not null,
 token_keys text[] not null, account_id uuid, published_at timestamptz, thread_id text, reply_to text, provenance jsonb not null,
 primary key(run_id,source_revision_id), unique(run_id,source_record_id), unique(run_id,ordinal),
 foreign key(principal_id,workspace_id,run_id) references public.evidence_assessment_runs(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,source_revision_id) references public.evidence_source_revisions(principal_id,workspace_id,id)
);
create index evidence_assessment_exact on public.evidence_assessment_inputs(run_id,content_hash,source_key);
create index evidence_assessment_template on public.evidence_assessment_inputs(run_id,template_key,source_key);
create index evidence_assessment_account on public.evidence_assessment_inputs(run_id,account_id,published_at);
create index evidence_assessment_thread on public.evidence_assessment_inputs(run_id,thread_id);
create index evidence_assessment_tokens on public.evidence_assessment_inputs using gin(token_keys);
create table public.evidence_assessment_jobs (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, run_id uuid not null,
 source_revision_id uuid not null, status text not null default 'queued' check(status in ('queued','running','retry','succeeded','failed')),
 attempts integer not null default 0, max_attempts integer not null check(max_attempts between 1 and 5),
 claim_token uuid, lease_until timestamptz, next_attempt_at timestamptz not null default now(),
 last_error_code text, total_processing_ms integer not null default 0 check(total_processing_ms>=0),
 created_by text not null, created_at timestamptz not null default now(), completed_at timestamptz,
 foreign key(principal_id,workspace_id,run_id) references public.evidence_assessment_runs(principal_id,workspace_id,id),
 foreign key(run_id,source_revision_id) references public.evidence_assessment_inputs(run_id,source_revision_id),
 unique(run_id,source_revision_id), unique(principal_id,workspace_id,id)
);
create index evidence_assessment_job_claim on public.evidence_assessment_jobs(principal_id,workspace_id,run_id,status,next_attempt_at,lease_until);
create table public.evidence_assessment_job_events (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, job_id uuid not null,
 event text not null check(event in ('enqueued','claimed','lease_expired','retry','failed','succeeded')),
 attempt integer not null, actor_id text not null, claim_token uuid, error_code text, processing_ms integer not null default 0,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,job_id) references public.evidence_assessment_jobs(principal_id,workspace_id,id)
);
create index evidence_assessment_job_event_history on public.evidence_assessment_job_events(job_id,recorded_at,id);
create table public.evidence_assessments (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, job_id uuid not null,
 run_id uuid not null, source_revision_id uuid not null, methodology_version text not null, policy_id uuid not null,
 context_hash text not null, assessed_at timestamptz not null default clock_timestamp(), processing_ms integer not null,
 classification text not null check(classification in ('high_confidence','uncertain','likely_inauthentic','insufficient_evidence')),
 observation_only boolean not null default true check(observation_only), result jsonb not null,
 foreign key(principal_id,workspace_id,job_id) references public.evidence_assessment_jobs(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,run_id) references public.evidence_assessment_runs(principal_id,workspace_id,id),
 foreign key(run_id,source_revision_id) references public.evidence_assessment_inputs(run_id,source_revision_id),
 foreign key(principal_id,workspace_id,policy_id) references public.evidence_assessment_policies(principal_id,workspace_id,id),
 unique(job_id), unique(run_id,source_revision_id), unique(principal_id,workspace_id,id)
);
create index evidence_assessments_revision_history on public.evidence_assessments(principal_id,workspace_id,source_revision_id,assessed_at);
create table public.evidence_assessment_relationships (
 principal_id text not null, workspace_id uuid not null, assessment_id uuid not null, run_id uuid not null,
 related_revision_id uuid not null, kind text not null check(kind in ('exact_duplicate','near_duplicate','ordinary_repost','shared_template','reply_context')),
 similarity numeric check(similarity between 0 and 1), primary key(assessment_id,related_revision_id,kind),
 foreign key(principal_id,workspace_id,assessment_id) references public.evidence_assessments(principal_id,workspace_id,id),
 foreign key(run_id,related_revision_id) references public.evidence_assessment_inputs(run_id,source_revision_id)
);

create function public.evidence_assessment_policy_valid(p_config jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare k text; limits jsonb; n numeric;
begin
 if jsonb_typeof(p_config) is distinct from 'object' or p_config-array['maxCandidates','nearDuplicateJaccard','minNearDuplicateTokens','maxTokens','templateMinimumPosts','burstMinimumPosts','burstWindowSeconds','minimumObservedDimensions','minimumComparableTokens','maxAttempts','retryDelaySeconds']<>'{}'::jsonb then return false; end if;
 for k,limits in select key,value from jsonb_each('{"maxCandidates":[8,100],"nearDuplicateJaccard":[0.5,0.99],"minNearDuplicateTokens":[5,100],"maxTokens":[64,512],"templateMinimumPosts":[3,20],"burstMinimumPosts":[3,50],"burstWindowSeconds":[10,3600],"minimumObservedDimensions":[2,5],"minimumComparableTokens":[5,100],"maxAttempts":[1,5],"retryDelaySeconds":[1,300]}'::jsonb) loop
  if jsonb_typeof(p_config->k) is distinct from 'number' then return false; end if;
  n:=(p_config->>k)::numeric;
  if n<(limits->>0)::numeric or n>(limits->>1)::numeric or (k<>'nearDuplicateJaccard' and n<>trunc(n)) then return false; end if;
 end loop;
 return (p_config->>'maxTokens')::integer>=greatest((p_config->>'minNearDuplicateTokens')::integer,(p_config->>'minimumComparableTokens')::integer);
end $$;

-- Fixed-budget signatures. Inverted candidate lookup, not all-pairs comparison.
create function public.evidence_assessment_token_keys(p_text text) returns text[]
language sql immutable set search_path=public,pg_temp as $$
 select coalesce(array_agg(key order by key),'{}') from (
  select distinct encode(sha256(convert_to(token,'UTF8')),'hex') as key
  from regexp_split_to_table(lower(left(p_text,20000)),'[^[:alnum:]]+') as token
  where length(token)>=3 and token not in ('the','and','that','this','with','have','for','was','are','you','not','but','from','they','just','has','had','been','will','can')
  order by key limit 12
 ) x
$$;
create function public.evidence_assessment_template_key(p_text text) returns text
language sql immutable set search_path=public,pg_temp as $$
 select encode(sha256(convert_to(regexp_replace(regexp_replace(lower(left(p_text,20000)),'https?://[^[:space:]]+','<url>','g'),'[0-9]+([.,][0-9]+)?','<n>','g'),'UTF8')),'hex')
$$;

create function public.register_evidence_assessment_policy(p_principal text,p_workspace uuid,p_actor text,p_version text,p_config jsonb,p_rationale text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_assessment_policies; h text;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 if not public.evidence_assessment_policy_valid(p_config) then raise exception 'Invalid assessment policy'; end if;
 h:=encode(sha256(convert_to(p_config::text,'UTF8')),'hex');
 select * into v from public.evidence_assessment_policies where principal_id=p_principal and workspace_id=p_workspace and version=p_version;
 if found then
  if v.policy_hash<>h or v.rationale<>p_rationale then raise exception 'Policy versions are immutable'; end if;
  return to_jsonb(v);
 end if;
 insert into public.evidence_assessment_policies(principal_id,workspace_id,version,config,policy_hash,rationale,created_by) values(p_principal,p_workspace,p_version,p_config,h,p_rationale,p_actor) returning * into v;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'assessment.policy.create',v.id,jsonb_build_object('policyHash',h,'observationOnly',true));
 return to_jsonb(v);
end $$;

create function public.create_evidence_assessment_run(p_principal text,p_workspace uuid,p_actor text,p_corpus uuid,p_version uuid,p_policy uuid,p_methodology text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_assessment_runs; version_row public.evidence_corpus_versions; policy_row public.evidence_assessment_policies; cutoff bigint; h text;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 select * into version_row from public.evidence_corpus_versions where principal_id=p_principal and workspace_id=p_workspace and corpus_id=p_corpus and id=p_version;
 if not found then raise exception 'Assessment corpus version unavailable'; end if;
 select * into policy_row from public.evidence_assessment_policies where principal_id=p_principal and workspace_id=p_workspace and id=p_policy;
 if not found then raise exception 'Assessment policy unavailable'; end if;
 if version_row.record_count>250000 then raise exception 'Snapshot exceeds Stage 2 input limit'; end if;
 select coalesce(max(import_sequence),0) into cutoff from public.evidence_ingestion_batches where corpus_id=p_corpus;
 h:=encode(sha256(convert_to(jsonb_build_array(p_corpus,p_version,version_row.manifest_hash,cutoff,policy_row.version,policy_row.policy_hash,p_methodology,'retained-context-1')::text,'UTF8')),'hex');
 select * into v from public.evidence_assessment_runs where principal_id=p_principal and workspace_id=p_workspace and context_hash=h;
 if found then return to_jsonb(v); end if;
 insert into public.evidence_assessment_runs(principal_id,workspace_id,corpus_id,corpus_version_id,policy_id,methodology_version,source_cutoff,context_hash,created_by)
 values(p_principal,p_workspace,p_corpus,p_version,p_policy,p_methodology,cutoff,h,p_actor) returning * into v;
 insert into public.evidence_assessment_inputs(principal_id,workspace_id,run_id,source_revision_id,ordinal,source_record_id,source_key,content_hash,template_key,token_keys,account_id,published_at,thread_id,reply_to,provenance)
 select p_principal,p_workspace,v.id,r.id,e.ordinal,r.source_record_id,s.record_key,r.content_hash,
 public.evidence_assessment_template_key(r.normalized_content),public.evidence_assessment_token_keys(r.normalized_content),r.account_id,
 latest.published_at,coalesce(r.original_fields->>'threadId',r.original_fields->>'Thread ID'),coalesce(r.original_fields->>'replyToSourceIdentifier',r.original_fields->>'In Reply To'),
 jsonb_build_object('sourceUrl',latest.source_url,'publishedAt',latest.published_at,'collectedAt',latest.collected_at,'provider',latest.provider,'providerJobId',latest.provider_job_id,'observationCount',coalesce(latest.observation_count,0))
 from public.evidence_manifest_entries e join public.evidence_source_revisions r on r.id=e.source_revision_id join public.evidence_source_records s on s.id=r.source_record_id
 left join lateral (
  select o.source_url,o.published_at,o.collected_at,b.provider,b.provider_job_id,count(*) over()::integer as observation_count
  from public.evidence_source_observations o join public.evidence_ingestion_batches b on b.id=o.batch_id
  where o.source_revision_id=r.id and b.corpus_id=p_corpus and b.import_sequence<=cutoff
  order by b.import_sequence desc,o.ordinal desc limit 1
 ) latest on true
 where e.corpus_version_id=p_version and e.principal_id=p_principal and e.workspace_id=p_workspace;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'assessment.context.freeze',v.id,jsonb_build_object('contextHash',h,'sourceCount',version_row.record_count,'observationOnly',true));
 return to_jsonb(v);
end $$;

-- Bounded enqueue: p_revision for one record; otherwise cursor through a run.
create function public.enqueue_evidence_assessments(p_principal text,p_workspace uuid,p_actor text,p_run uuid,p_revision uuid default null,p_after integer default -1,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_assessment_runs; item record; job public.evidence_assessment_jobs; ids uuid[]:='{}'; last_ordinal integer:=p_after; n integer:=0; attempts integer;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 if p_limit not between 1 and 500 or p_after < -1 then raise exception 'Invalid enqueue bounds'; end if;
 select * into v from public.evidence_assessment_runs where id=p_run and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Assessment run unavailable'; end if;
 if p_revision is not null and not exists(select 1 from public.evidence_assessment_inputs where run_id=p_run and source_revision_id=p_revision) then raise exception 'Source revision outside assessment context'; end if;
 select (config->>'maxAttempts')::integer into attempts from public.evidence_assessment_policies where id=v.policy_id;
 for item in select * from public.evidence_assessment_inputs where run_id=p_run and (p_revision is not null and source_revision_id=p_revision or p_revision is null and ordinal>p_after) order by ordinal limit p_limit loop
  insert into public.evidence_assessment_jobs(principal_id,workspace_id,run_id,source_revision_id,max_attempts,created_by)
  values(p_principal,p_workspace,p_run,item.source_revision_id,attempts,p_actor) on conflict(run_id,source_revision_id) do nothing returning * into job;
  if found then
   insert into public.evidence_assessment_job_events(principal_id,workspace_id,job_id,event,attempt,actor_id) values(p_principal,p_workspace,job.id,'enqueued',0,p_actor);
   n:=n+1;
  else select * into job from public.evidence_assessment_jobs where run_id=p_run and source_revision_id=item.source_revision_id;
  end if;
  ids:=array_append(ids,job.id); last_ordinal:=item.ordinal;
 end loop;
 if n>0 then perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'assessment.jobs.enqueue',p_run,jsonb_build_object('created',n,'observationOnly',true)); end if;
 return jsonb_build_object('jobIds',ids,'created',n,'afterOrdinal',last_ordinal);
end $$;

create function public.claim_evidence_assessments(p_principal text,p_workspace uuid,p_actor text,p_run uuid,p_limit integer default 10,p_lease_seconds integer default 120)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.evidence_assessment_jobs; results jsonb:='[]'; token uuid; stamp timestamptz:=clock_timestamp();
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 stamp:=clock_timestamp();
 if p_limit not between 1 and 25 or p_lease_seconds not between 30 and 300 then raise exception 'Invalid worker bounds'; end if;
 if not exists(select 1 from public.evidence_assessment_runs where id=p_run and principal_id=p_principal and workspace_id=p_workspace) then raise exception 'Assessment run unavailable'; end if;
 for j in select * from public.evidence_assessment_jobs where run_id=p_run and principal_id=p_principal and workspace_id=p_workspace
  and (status in ('queued','retry') and next_attempt_at<=stamp or status='running' and lease_until<=stamp)
  order by next_attempt_at,created_at,id for update skip locked limit p_limit loop
  if j.status='running' then
   insert into public.evidence_assessment_job_events(principal_id,workspace_id,job_id,event,attempt,actor_id,claim_token,error_code) values(p_principal,p_workspace,j.id,'lease_expired',j.attempts,p_actor,j.claim_token,'worker_interrupted');
  end if;
  if j.attempts>=j.max_attempts then
   update public.evidence_assessment_jobs set status='failed',lease_until=null,last_error_code='retry_exhausted',completed_at=stamp where id=j.id;
   insert into public.evidence_assessment_job_events(principal_id,workspace_id,job_id,event,attempt,actor_id,error_code) values(p_principal,p_workspace,j.id,'failed',j.attempts,p_actor,'retry_exhausted');
   continue;
  end if;
  token:=gen_random_uuid();
  update public.evidence_assessment_jobs set status='running',attempts=attempts+1,claim_token=token,lease_until=stamp+make_interval(secs=>p_lease_seconds) where id=j.id returning * into j;
  insert into public.evidence_assessment_job_events(principal_id,workspace_id,job_id,event,attempt,actor_id,claim_token) values(p_principal,p_workspace,j.id,'claimed',j.attempts,p_actor,token);
  results:=results||jsonb_build_array(to_jsonb(j));
 end loop;
 return results;
end $$;

-- Internal reader: only lease-owning scoped worker RPC can return source input.
create function public.evidence_assessment_input_json(p_run uuid,p_revision uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revisionId',r.id,'sourceRecordId',s.id,'sourceKey',s.record_key,'platform',s.platform,'sourceNamespace',s.source_namespace,'sourceIdentifier',s.source_identifier,'identityBasis',s.identity_basis,'originalContent',r.original_content,'originalFields',r.original_fields,'contentHash',r.content_hash,'templateKey',i.template_key,'accountId',r.account_id)||i.provenance
 from public.evidence_assessment_inputs i join public.evidence_source_revisions r on r.id=i.source_revision_id join public.evidence_source_records s on s.id=r.source_record_id
 where i.run_id=p_run and i.source_revision_id=p_revision
$$;

create function public.load_evidence_assessment_job(p_principal text,p_workspace uuid,p_actor text,p_job uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.evidence_assessment_jobs; run_row public.evidence_assessment_runs; policy_row public.evidence_assessment_policies; target public.evidence_assessment_inputs; candidate_ids uuid[]; cap integer; truncated boolean; candidates jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 select * into j from public.evidence_assessment_jobs where id=p_job and principal_id=p_principal and workspace_id=p_workspace and status='running' and claim_token=p_token and lease_until>clock_timestamp();
 if not found then raise exception 'Assessment lease unavailable'; end if;
 select * into run_row from public.evidence_assessment_runs where id=j.run_id;
 select * into policy_row from public.evidence_assessment_policies where id=run_row.policy_id;
 select * into target from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id=j.source_revision_id;
 cap:=(policy_row.config->>'maxCandidates')::integer;
 -- Every channel is bounded independently; exact/template/account/thread keys
 -- and GIN token overlap avoid unrestricted pairwise comparisons.
 with raw as (
  (select source_revision_id as id,0 as priority,source_key from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id<>j.source_revision_id and content_hash=target.content_hash order by source_key limit cap+1)
  union all (select source_revision_id,1,source_key from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id<>j.source_revision_id and account_id=target.account_id order by abs(extract(epoch from(published_at-target.published_at))) nulls last,source_key limit cap+1)
  union all (select source_revision_id,2,source_key from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id<>j.source_revision_id and template_key=target.template_key order by source_key limit cap+1)
  union all (select i.source_revision_id,3,i.source_key from public.evidence_assessment_inputs i join public.evidence_source_records s on s.id=i.source_record_id where i.run_id=j.run_id and i.source_revision_id<>j.source_revision_id and s.source_identifier=target.reply_to order by i.source_key limit cap+1)
  union all (select source_revision_id,3,source_key from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id<>j.source_revision_id and thread_id=target.thread_id order by source_key limit cap+1)
  union all (select source_revision_id,4,source_key from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id<>j.source_revision_id and token_keys && target.token_keys order by source_key limit cap+1)
 ), unique_candidates as (select id,min(priority) as priority,min(source_key) as sort_key from raw group by id order by min(priority),min(source_key) limit cap+1)
 select coalesce(array_agg(id order by priority,sort_key),'{}') into candidate_ids from unique_candidates;
 truncated:=cardinality(candidate_ids)>cap;
 candidate_ids:=candidate_ids[1:cap];
 select coalesce(jsonb_agg(public.evidence_assessment_input_json(j.run_id,c.id) order by c.position),'[]') into candidates from unnest(candidate_ids) with ordinality as c(id,position);
 return jsonb_build_object('contextHash',run_row.context_hash,'policyHash',policy_row.policy_hash,'methodologyVersion',run_row.methodology_version,'inputVersion',run_row.input_version,'policy',policy_row.config,
 'target',public.evidence_assessment_input_json(j.run_id,j.source_revision_id),'candidates',candidates,'candidateTruncated',truncated,
 'exactOtherSourceCount',(select count(*) from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id<>j.source_revision_id and content_hash=target.content_hash),
 'templateOtherSourceCount',(select count(*) from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id<>j.source_revision_id and template_key=target.template_key),
 'accountOtherSourceCount',(select count(*) from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id<>j.source_revision_id and account_id=target.account_id));
end $$;

create function public.finish_evidence_assessment(p_principal text,p_workspace uuid,p_actor text,p_job uuid,p_token uuid,p_result jsonb,p_processing_ms integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.evidence_assessment_jobs; r public.evidence_assessment_runs; p public.evidence_assessment_policies; a public.evidence_assessments; link jsonb; d jsonb; indicator jsonb; related jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 select * into j from public.evidence_assessment_jobs where id=p_job and principal_id=p_principal and workspace_id=p_workspace for update;
 if not found or j.claim_token is distinct from p_token then raise exception 'Assessment claim unavailable'; end if;
 if j.status='succeeded' then return (select to_jsonb(x) from public.evidence_assessments x where job_id=j.id); end if;
 if j.status<>'running' or j.lease_until<=clock_timestamp() then raise exception 'Assessment lease expired'; end if;
 select * into r from public.evidence_assessment_runs where id=j.run_id;
 select * into p from public.evidence_assessment_policies where id=r.policy_id;
 if p_processing_ms not between 0 and 600000 or octet_length(p_result::text)>1048576 then raise exception 'Invalid assessment bounds'; end if;
 if p_result->>'sourceRevisionId' is distinct from j.source_revision_id::text or p_result->>'contextHash' is distinct from r.context_hash or p_result->>'policyHash' is distinct from p.policy_hash or p_result->>'methodologyVersion' is distinct from r.methodology_version or p_result->>'inputVersion' is distinct from r.input_version or p_result->>'observationOnly' is distinct from 'true' then raise exception 'Assessment provenance mismatch'; end if;
 if p_result->>'classification' not in ('uncertain','insufficient_evidence') or p_result->>'classification' is null or p_result->'overallScore' is distinct from 'null'::jsonb then raise exception 'Strong classification or overall score requires a future validated methodology'; end if;
 if jsonb_typeof(p_result->'dimensions') is distinct from 'object' or jsonb_typeof(p_result->'relationships') is distinct from 'array' or length(coalesce(p_result->>'explanation',''))<20 then raise exception 'Assessment explanation required'; end if;
 foreach d in array array[p_result->'dimensions'->'provenance',p_result->'dimensions'->'originality',p_result->'dimensions'->'accountBehavior',p_result->'dimensions'->'conversationalContext',p_result->'dimensions'->'syntheticIndicators'] loop
  if jsonb_typeof(d) is distinct from 'object' or d->>'status' is null or d->>'status' not in ('observed','unknown','indicator') or not d ? 'score' or jsonb_typeof(d->'indicators') is distinct from 'array' or jsonb_typeof(d->'missingEvidence') is distinct from 'array' then raise exception 'Invalid assessment dimension'; end if;
  for indicator in select value from jsonb_array_elements(d->'indicators') loop
   if jsonb_typeof(indicator->'relatedRevisionIds') is distinct from 'array' then raise exception 'Indicator references required'; end if;
   for related in select value from jsonb_array_elements(indicator->'relatedRevisionIds') loop
    if not exists(select 1 from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id=(related#>>'{}')::uuid) then raise exception 'Indicator outside frozen context'; end if;
   end loop;
  end loop;
  if d->'score'<>'null'::jsonb and (jsonb_typeof(d->'score')<>'number' or (d->>'score')::numeric not between 0 and 1) then raise exception 'Invalid dimension score'; end if;
 end loop;
 for link in select value from jsonb_array_elements(p_result->'relationships') loop
  if link->>'relatedRevisionId'=j.source_revision_id::text or not exists(select 1 from public.evidence_assessment_inputs where run_id=j.run_id and source_revision_id=(link->>'relatedRevisionId')::uuid) then raise exception 'Relationship outside frozen context'; end if;
 end loop;
 insert into public.evidence_assessments(principal_id,workspace_id,job_id,run_id,source_revision_id,methodology_version,policy_id,context_hash,processing_ms,classification,result)
 values(p_principal,p_workspace,j.id,j.run_id,j.source_revision_id,r.methodology_version,r.policy_id,r.context_hash,p_processing_ms,p_result->>'classification',p_result) returning * into a;
 for link in select value from jsonb_array_elements(p_result->'relationships') loop
  insert into public.evidence_assessment_relationships values(p_principal,p_workspace,a.id,j.run_id,(link->>'relatedRevisionId')::uuid,link->>'kind',(link->>'similarity')::numeric) on conflict do nothing;
 end loop;
 update public.evidence_assessment_jobs set status='succeeded',lease_until=null,completed_at=clock_timestamp(),last_error_code=null,total_processing_ms=total_processing_ms+p_processing_ms where id=j.id;
 insert into public.evidence_assessment_job_events(principal_id,workspace_id,job_id,event,attempt,actor_id,claim_token,processing_ms) values(p_principal,p_workspace,j.id,'succeeded',j.attempts,p_actor,p_token,p_processing_ms);
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'assessment.complete',a.id,jsonb_build_object('runId',j.run_id,'sourceRevisionId',j.source_revision_id,'observationOnly',true));
 return to_jsonb(a);
end $$;

create function public.fail_evidence_assessment(p_principal text,p_workspace uuid,p_actor text,p_job uuid,p_token uuid,p_code text,p_processing_ms integer,p_retry boolean default true)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.evidence_assessment_jobs; delay integer; next_status text;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 select * into j from public.evidence_assessment_jobs where id=p_job and principal_id=p_principal and workspace_id=p_workspace for update;
 if not found or j.status<>'running' or j.claim_token is distinct from p_token or j.lease_until<=clock_timestamp() then raise exception 'Assessment lease unavailable'; end if;
 if p_code not in ('assessment_failed','method_unsupported','deadline','storage_failure','worker_interrupted') or p_processing_ms not between 0 and 600000 or p_retry is null then raise exception 'Invalid failure event'; end if;
 select least(300,(p.config->>'retryDelaySeconds')::integer*power(2,j.attempts-1)::integer) into delay from public.evidence_assessment_runs r join public.evidence_assessment_policies p on p.id=r.policy_id where r.id=j.run_id;
 next_status:=case when p_retry and j.attempts<j.max_attempts then 'retry' else 'failed' end;
 update public.evidence_assessment_jobs set status=next_status,lease_until=null,last_error_code=p_code,total_processing_ms=total_processing_ms+p_processing_ms,next_attempt_at=clock_timestamp()+make_interval(secs=>delay),completed_at=case when next_status='failed' then clock_timestamp() else null end where id=j.id returning * into j;
 insert into public.evidence_assessment_job_events(principal_id,workspace_id,job_id,event,attempt,actor_id,claim_token,error_code,processing_ms) values(p_principal,p_workspace,j.id,next_status,j.attempts,p_actor,p_token,p_code,p_processing_ms);
 return to_jsonb(j);
end $$;

-- Bounded inspection of internal jobs/results and durable metrics. No client report.
create function public.read_evidence_assessments(p_principal text,p_workspace uuid,p_actor text,p_run uuid,p_after integer default -1,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare output jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 if p_limit not between 1 and 200 or p_after < -1 then raise exception 'Invalid read bounds'; end if;
 if not exists(select 1 from public.evidence_assessment_runs where id=p_run and principal_id=p_principal and workspace_id=p_workspace) then raise exception 'Assessment run unavailable'; end if;
 select coalesce(jsonb_agg(row_data order by ordinal),'[]') into output from (
  select i.ordinal,jsonb_build_object('ordinal',i.ordinal,'job',to_jsonb(j),'assessment',to_jsonb(a),'history',coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at,e.id) from public.evidence_assessment_job_events e where e.job_id=j.id),'[]')) as row_data
  from public.evidence_assessment_inputs i left join public.evidence_assessment_jobs j on j.run_id=i.run_id and j.source_revision_id=i.source_revision_id
  left join public.evidence_assessments a on a.job_id=j.id where i.run_id=p_run and i.ordinal>p_after order by i.ordinal limit p_limit
 ) page;
 return jsonb_build_object('items',output,'metrics',(select jsonb_build_object('jobs',count(*),'succeeded',count(*) filter(where status='succeeded'),'failed',count(*) filter(where status='failed'),'pending',count(*) filter(where status in ('queued','retry','running')),'attempts',coalesce(sum(attempts),0),'retries',coalesce(sum(greatest(attempts-1,0)),0),'processingMs',coalesce(sum(total_processing_ms),0),'failureRate',count(*) filter(where status='failed')::numeric/nullif(count(*) filter(where status in ('succeeded','failed')),0),'completedPerProcessingSecond',count(*) filter(where status='succeeded')*1000.0/nullif(sum(total_processing_ms),0)) from public.evidence_assessment_jobs where run_id=p_run));
end $$;

do $$ declare t text; begin
 foreach t in array array['evidence_assessment_policies','evidence_assessment_runs','evidence_assessment_inputs','evidence_assessment_jobs','evidence_assessment_job_events','evidence_assessments','evidence_assessment_relationships'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  if t<>'evidence_assessment_jobs' then
   execute format('create trigger evidence_assessment_append_only before update or delete on public.%I for each row execute function public.evidence_foundation_immutable()',t);
  end if;
  execute format('create trigger evidence_assessment_no_truncate before truncate on public.%I execute function public.evidence_foundation_immutable()',t);
 end loop;
end $$;
revoke all on function public.evidence_assessment_policy_valid(jsonb),public.evidence_assessment_token_keys(text),public.evidence_assessment_template_key(text),public.evidence_assessment_input_json(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.register_evidence_assessment_policy(text,uuid,text,text,jsonb,text),public.create_evidence_assessment_run(text,uuid,text,uuid,uuid,uuid,text),public.enqueue_evidence_assessments(text,uuid,text,uuid,uuid,integer,integer),public.claim_evidence_assessments(text,uuid,text,uuid,integer,integer),public.load_evidence_assessment_job(text,uuid,text,uuid,uuid),public.finish_evidence_assessment(text,uuid,text,uuid,uuid,jsonb,integer),public.fail_evidence_assessment(text,uuid,text,uuid,uuid,text,integer,boolean),public.read_evidence_assessments(text,uuid,text,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.register_evidence_assessment_policy(text,uuid,text,text,jsonb,text),public.create_evidence_assessment_run(text,uuid,text,uuid,uuid,uuid,text),public.enqueue_evidence_assessments(text,uuid,text,uuid,uuid,integer,integer),public.claim_evidence_assessments(text,uuid,text,uuid,integer,integer),public.load_evidence_assessment_job(text,uuid,text,uuid,uuid),public.finish_evidence_assessment(text,uuid,text,uuid,uuid,jsonb,integer),public.fail_evidence_assessment(text,uuid,text,uuid,uuid,text,integer,boolean),public.read_evidence_assessments(text,uuid,text,uuid,integer,integer) to service_role;
commit;
