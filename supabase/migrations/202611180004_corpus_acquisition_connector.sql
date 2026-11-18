-- Gate 2A. Provider orchestration only. Existing Builder RPCs own ingestion and spend.
begin;

create table corpus_builder.acquisition_plans (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  protocol_id uuid not null,
  request_key text not null check (request_key ~ '^[a-zA-Z0-9_-]{1,120}$'),
  request_digest bytea not null,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  mapping_ref text not null check (mapping_ref ~ '^[a-zA-Z0-9_.:-]{1,120}$'),
  mapping_digest text not null check (mapping_digest ~ '^[a-f0-9]{64}$'),
  normalization_version text not null check (normalization_version ~ '^[a-zA-Z0-9_.:-]{1,120}$'),
  concurrency_limit integer not null check (concurrency_limit between 1 and 8),
  approved_by text not null,
  approved_at timestamptz not null default clock_timestamp(),
  deadline timestamptz not null,
  primary key (workspace_id,id),
  unique (workspace_id,request_key),
  foreign key (workspace_id,protocol_id) references corpus_builder.protocols(workspace_id,id)
);

create table corpus_builder.acquisition_work (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  plan_id uuid not null,
  job_id uuid not null,
  attempt_id uuid not null,
  max_rows integer not null check (max_rows between 1 and 10000),
  phase text not null default 'ready' check (phase in ('ready','submitting','running','paging','done','review')),
  run_id text check (run_id ~ '^[a-zA-Z0-9_-]{1,160}$'),
  submitted_at timestamptz,
  dataset_id text check (dataset_id ~ '^[a-zA-Z0-9_-]{1,160}$'),
  collected_at timestamptz,
  verified_cost bigint check (verified_cost >= 0),
  lease_token uuid,
  lease_until timestamptz,
  next_at timestamptz not null default clock_timestamp(),
  failures integer not null default 0 check (failures between 0 and 6),
  cancel_requested boolean not null default false,
  abort_sent boolean not null default false,
  review_code text check (review_code in ('ambiguous','schema','partial','usage','limit','retries','deadline','withdrawn','provider')),
  check ((lease_token is null)=(lease_until is null)),
  primary key (workspace_id,id),
  unique (workspace_id,job_id),
  unique (workspace_id,attempt_id),
  unique (workspace_id,plan_id,id),
  unique (workspace_id,run_id),
  foreign key (workspace_id,plan_id) references corpus_builder.acquisition_plans(workspace_id,id),
  foreign key (workspace_id,job_id) references corpus_builder.jobs(workspace_id,id),
  foreign key (workspace_id,attempt_id) references corpus_builder.attempts(workspace_id,id)
);
create index corpus_builder_acquisition_due on corpus_builder.acquisition_work(workspace_id,plan_id,next_at)
  where phase not in ('done','review');

create table corpus_builder.acquisition_callbacks (
  workspace_id uuid not null,
  plan_id uuid not null,
  work_id uuid not null,
  event_id text not null check (event_id ~ '^[a-zA-Z0-9_-]{1,160}$'),
  received_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id,plan_id,event_id),
  foreign key (workspace_id,plan_id,work_id) references corpus_builder.acquisition_work(workspace_id,plan_id,id)
);

create function public.corpus_acquisition_approve(p_principal text,p_workspace uuid,p_actor text,p_plan jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  plan corpus_builder.acquisition_plans;
  v_protocol uuid := (p_plan->>'protocol_id')::uuid;
  v_job uuid;
  v_attempt uuid;
  item jsonb;
  v_query uuid;
  digest bytea;
  hours integer := (p_plan->>'hours')::integer;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  if jsonb_typeof(p_plan->'jobs') is distinct from 'array' or hours is null or hours not between 1 and 72
    or octet_length(p_plan::text)>50000 then
    raise invalid_parameter_value using message='Invalid acquisition plan';
  end if;
  if jsonb_array_length(p_plan->'jobs') not between 1 and 50 then
    raise invalid_parameter_value using message='Plan must explicitly list one to fifty jobs';
  end if;
  perform 1 from corpus_builder.protocols p where p.workspace_id=p_workspace and p.id=v_protocol
    and p.platform=p_plan->>'platform' and p.source_policy_ref=p_plan->>'source_policy_ref'
    and p.retention_policy_ref=p_plan->>'retention_policy_ref';
  if not found then raise insufficient_privilege using message='Approved source and retention policy required'; end if;
  digest := sha256(convert_to(p_plan::text,'UTF8'));
  select * into plan from corpus_builder.acquisition_plans a
    where a.workspace_id=p_workspace and a.request_key=p_plan->>'request_key';
  if found then
    if plan.request_digest<>digest then raise invalid_parameter_value using message='Plan replay differs'; end if;
    return plan.id;
  end if;
  insert into corpus_builder.acquisition_plans(workspace_id,protocol_id,request_key,request_digest,provider,
    mapping_ref,mapping_digest,normalization_version,concurrency_limit,approved_by,deadline)
    values(p_workspace,v_protocol,p_plan->>'request_key',digest,p_plan->>'provider',p_plan->>'mapping_ref',
      p_plan->>'mapping_digest',p_plan->>'normalization_version',(p_plan->>'concurrency')::integer,
      p_actor,clock_timestamp()+make_interval(hours=>hours))
    returning * into plan;
  for item in select value from jsonb_array_elements(p_plan->'jobs') loop
    v_query := (item->>'query_id')::uuid;
    perform 1 from corpus_builder.queries q where q.workspace_id=p_workspace
      and q.protocol_id=plan.protocol_id and q.id=v_query
      and length(q.expression)<=1024 and q.expression !~ '[[:cntrl:]]';
    if not found then raise invalid_parameter_value using message='Query unavailable or invalid'; end if;
    v_job := public.corpus_builder_queue(p_principal,p_workspace,p_actor,v_query,
      (item->>'start')::timestamptz,(item->>'end')::timestamptz);
    perform 1 from corpus_builder.attempts a where a.workspace_id=p_workspace and a.job_id=v_job;
    if found then raise invalid_parameter_value using message='Plan job already has an attempt'; end if;
    v_attempt := public.corpus_builder_reserve(p_principal,p_workspace,p_actor,v_job,
      plan.id::text,plan.id::text,(item->>'max_rows')::integer,(item->>'cents')::bigint);
    insert into corpus_builder.acquisition_work(workspace_id,plan_id,job_id,attempt_id,max_rows)
      values(p_workspace,plan.id,v_job,v_attempt,(item->>'max_rows')::integer);
  end loop;
  perform corpus_builder.audit(p_workspace,p_actor,'acquisition.approved',plan.id);
  return plan.id;
end $$;

create function public.corpus_acquisition_claim(p_principal text,p_workspace uuid,p_actor text,p_plan uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  plan corpus_builder.acquisition_plans;
  work corpus_builder.acquisition_work;
  concurrent integer;
  workspace_concurrent integer;
  result jsonb;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select * into plan from corpus_builder.acquisition_plans where workspace_id=p_workspace and id=p_plan;
  if not found then raise insufficient_privilege using message='Plan unavailable'; end if;
  -- Count uncertain or quarantined runs as active until a known settlement.
  select count(*) filter (where w.plan_id=p_plan),count(*) into concurrent,workspace_concurrent
    from corpus_builder.acquisition_work w where w.workspace_id=p_workspace
    and (w.phase in ('submitting','running','paging')
      or w.phase='review' and w.submitted_at is not null
      or w.phase='ready' and w.lease_until>clock_timestamp());
  select w.* into work from corpus_builder.acquisition_work w where w.workspace_id=p_workspace and w.plan_id=p_plan
    and w.phase not in ('done','review') and w.next_at<=clock_timestamp()
    and (w.lease_until is null or w.lease_until<=clock_timestamp())
    and (w.phase<>'ready' or w.cancel_requested or (concurrent<plan.concurrency_limit and workspace_concurrent<8))
    order by w.cancel_requested desc,w.next_at,w.id limit 1;
  if not found then return null; end if;
  update corpus_builder.acquisition_work set lease_token=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '90 seconds' where workspace_id=p_workspace and id=work.id
    returning * into work;
  select to_jsonb(work) - 'workspace_id' || jsonb_build_object('provider',plan.provider,'mapping_ref',plan.mapping_ref,
      'mapping_digest',plan.mapping_digest,'normalization_version',plan.normalization_version,
      'deadline',plan.deadline,'platform',p.platform,
      'query',q.expression,'start',j.slice_start,'end',j.slice_end,
      'offset',a.next_offset,'rows',a.expected_rows,'cents',a.reserved_cents)
    into result from corpus_builder.jobs j
    join corpus_builder.queries q on (q.workspace_id,q.id)=(j.workspace_id,j.query_id)
    join corpus_builder.protocols p on (p.workspace_id,p.id)=(j.workspace_id,j.protocol_id)
    join corpus_builder.attempts a on a.workspace_id=j.workspace_id and a.id=work.attempt_id
    where j.workspace_id=p_workspace and j.id=work.job_id;
  return result;
end $$;

create function public.corpus_acquisition_advance(p_principal text,p_workspace uuid,p_actor text,p_work uuid,
  p_lease uuid,p_step text,p_data jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
  work corpus_builder.acquisition_work;
  attempt corpus_builder.attempts;
  total integer;
  cents bigint;
  outcome text;
  delay integer;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select * into work from corpus_builder.acquisition_work where workspace_id=p_workspace and id=p_work;
  if not found or p_lease is null or work.lease_token is distinct from p_lease or work.lease_until<=clock_timestamp() then
    raise insufficient_privilege using message='Worker lease unavailable';
  end if;
  select * into strict attempt from corpus_builder.attempts where workspace_id=p_workspace and id=work.attempt_id;
  if attempt.status <> 'running' then raise exception 'Acquisition attempt is not open'; end if;

  case p_step
    when 'submit' then
      if work.phase<>'ready' or work.cancel_requested or exists (
        select 1 from corpus_builder.acquisition_plans where workspace_id=p_workspace and id=work.plan_id
          and deadline<=clock_timestamp()) then raise exception 'Submission not allowed'; end if;
      update corpus_builder.acquisition_work set phase='submitting',submitted_at=clock_timestamp()
        where workspace_id=p_workspace and id=p_work;
      return; -- Keep the lease for the single submission call.
    when 'run' then
      if work.phase<>'submitting' or p_data->>'run_id' is null then raise exception 'Run reconciliation not allowed'; end if;
      work.run_id := p_data->>'run_id';
      work.phase := 'running';
    when 'bind' then
      total := (p_data->>'total')::integer;
      cents := (p_data->>'cents')::bigint;
      if work.phase<>'running' or work.run_id is distinct from p_data->>'run_id'
        or total is null or total not between 0 and work.max_rows or cents is null
        or cents not between 0 and attempt.reserved_cents or attempt.next_offset<>0
        or p_data->>'dataset_id' is null or p_data->>'collected_at' is null then
        raise exception 'Dataset binding not allowed';
      end if;
      work.dataset_id := p_data->>'dataset_id';
      work.collected_at := (p_data->>'collected_at')::timestamptz;
      if not isfinite(work.collected_at) or work.collected_at>clock_timestamp() then
        raise invalid_parameter_value using message='Invalid dataset collection time';
      end if;
      work.verified_cost := cents;
      update corpus_builder.attempts set dataset_key=work.dataset_id,expected_rows=total
        where workspace_id=p_workspace and id=work.attempt_id;
      work.phase := 'paging';
    when 'page' then
      if work.phase<>'paging' or work.cancel_requested or work.dataset_id is distinct from p_data->>'dataset_id'
        or attempt.expected_rows is distinct from (p_data->>'total')::integer then raise exception 'Page checkpoint conflict'; end if;
      perform public.corpus_builder_page(p_principal,p_workspace,p_actor,work.attempt_id,
        (p_data->>'offset')::integer,p_data->'rows');
    when 'finish' then
      outcome := p_data->>'outcome';
      cents := (p_data->>'cents')::bigint;
      if not coalesce((
        work.phase='ready' and outcome='cancelled' and cents=0 and work.cancel_requested
        or work.phase='running' and outcome in ('failed','cancelled') and work.run_id=p_data->>'run_id'
        or work.phase='paging' and cents=work.verified_cost and (
          outcome='failed' or outcome='cancelled' and work.cancel_requested
          or outcome='succeeded' and not work.cancel_requested)
      ),false) then raise exception 'Settlement not allowed'; end if;
      perform public.corpus_builder_finish(p_principal,p_workspace,p_actor,work.attempt_id,outcome,cents);
      work.phase := 'done';
    when 'abort_sent' then
      if work.phase<>'running' or not work.cancel_requested then raise exception 'Cancellation not requested'; end if;
      work.abort_sent := true;
    when 'wait' then
      if work.phase not in ('submitting','running') then raise exception 'Wait not allowed'; end if;
    when 'retry' then
      work.failures := work.failures+1;
      if work.failures>=6 then
        work.phase := 'review';
        work.review_code := 'retries';
      end if;
    when 'review' then
      work.phase := 'review';
      work.review_code := p_data->>'code';
      if work.review_code is null then raise invalid_parameter_value using message='Review code required'; end if;
    else raise invalid_parameter_value using message='Unknown worker transition';
  end case;
  delay := coalesce((p_data->>'delay')::integer,0);
  if delay not between 0 and 3600 or (p_step in ('wait','retry','abort_sent') and delay<5) then
    raise invalid_parameter_value using message='Invalid worker delay';
  end if;
  if p_step<>'retry' then work.failures := 0; end if;
  update corpus_builder.acquisition_work set phase=work.phase,run_id=work.run_id,dataset_id=work.dataset_id,
    collected_at=work.collected_at,verified_cost=work.verified_cost,failures=work.failures,
    abort_sent=work.abort_sent,review_code=work.review_code,next_at=clock_timestamp()+make_interval(secs=>delay),
    lease_token=null,lease_until=null where workspace_id=p_workspace and id=p_work;
  perform corpus_builder.audit(p_workspace,p_actor,'acquisition.'||p_step,p_work);
end $$;

create function public.corpus_acquisition_cancel(p_principal text,p_workspace uuid,p_actor text,p_work uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  update corpus_builder.acquisition_work set cancel_requested=true,next_at=clock_timestamp()
    where workspace_id=p_workspace and id=p_work and phase<>'done' and not cancel_requested;
  if found then
    perform corpus_builder.audit(p_workspace,p_actor,'acquisition.cancel_requested',p_work);
  elsif not exists(select 1 from corpus_builder.acquisition_work where workspace_id=p_workspace and id=p_work
    and (cancel_requested or phase='done')) then
    raise insufficient_privilege using message='Acquisition work unavailable';
  end if;
end $$;

-- Explicit administrator recovery never creates a new attempt or clears a
-- submission intent. Known work resumes from the persisted upstream state.
create function public.corpus_acquisition_resume(p_principal text,p_workspace uuid,p_actor text,p_work uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  update corpus_builder.acquisition_work set phase=case
    when dataset_id is not null then 'paging' when run_id is not null then 'running'
    when submitted_at is not null then 'submitting' else 'ready' end,
    failures=0,review_code=null,next_at=clock_timestamp()
    where workspace_id=p_workspace and id=p_work and phase='review';
  if not found then raise insufficient_privilege using message='Acquisition review unavailable'; end if;
  perform corpus_builder.audit(p_workspace,p_actor,'acquisition.resumed',p_work);
end $$;

create function public.corpus_acquisition_callback(p_principal text,p_workspace uuid,p_actor text,p_plan uuid,
  p_run text,p_event text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  work uuid;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select id into work from corpus_builder.acquisition_work where workspace_id=p_workspace and plan_id=p_plan and run_id=p_run;
  if not found then raise insufficient_privilege using message='Run unavailable'; end if;
  insert into corpus_builder.acquisition_callbacks(workspace_id,plan_id,work_id,event_id)
    values(p_workspace,p_plan,work,p_event) on conflict do nothing;
  if not found then return false; end if;
  update corpus_builder.acquisition_work set next_at=least(next_at,clock_timestamp())
    where workspace_id=p_workspace and id=work and phase='running' and failures=0;
  perform corpus_builder.audit(p_workspace,p_actor,'acquisition.callback',work);
  return true;
end $$;

-- Plan/job projections omit credentials, Actor inputs and source content.
create function public.corpus_acquisition_status(p_principal text,p_workspace uuid,p_actor text,p_plan uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  result jsonb;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,false);
  select jsonb_build_object('id',p.id,'deadline',p.deadline,'jobs',coalesce((
    select jsonb_agg(jsonb_build_object('id',w.id,'phase',w.phase,'cancel_requested',w.cancel_requested,
      'review_code',w.review_code,'offset',a.next_offset,'rows',a.expected_rows,
      'attempt_status',a.status,'reserved_cents',a.reserved_cents,'actual_cents',a.actual_cents) order by w.id)
    from corpus_builder.acquisition_work w join corpus_builder.attempts a
      on (a.workspace_id,a.id)=(w.workspace_id,w.attempt_id)
    where w.workspace_id=p_workspace and w.plan_id=p_plan),'[]'))
    into result from corpus_builder.acquisition_plans p where p.workspace_id=p_workspace and p.id=p_plan;
  if not found then raise insufficient_privilege using message='Plan unavailable'; end if;
  return result;
end $$;

alter table corpus_builder.acquisition_plans enable row level security;
alter table corpus_builder.acquisition_work enable row level security;
alter table corpus_builder.acquisition_callbacks enable row level security;
revoke all on corpus_builder.acquisition_plans,corpus_builder.acquisition_work,corpus_builder.acquisition_callbacks
  from public,anon,authenticated,authenticator,service_role;
create trigger corpus_acquisition_plan_frozen before update or delete on corpus_builder.acquisition_plans
  for each row execute function corpus_builder.immutable();
create trigger corpus_acquisition_callback_frozen before update or delete on corpus_builder.acquisition_callbacks
  for each row execute function corpus_builder.immutable();
do $$
declare fn regprocedure;
begin
  foreach fn in array array[
    'public.corpus_acquisition_approve(text,uuid,text,jsonb)',
    'public.corpus_acquisition_claim(text,uuid,text,uuid)',
    'public.corpus_acquisition_advance(text,uuid,text,uuid,uuid,text,jsonb)',
    'public.corpus_acquisition_cancel(text,uuid,text,uuid)',
    'public.corpus_acquisition_resume(text,uuid,text,uuid)',
    'public.corpus_acquisition_callback(text,uuid,text,uuid,text,text)',
    'public.corpus_acquisition_status(text,uuid,text,uuid)'
  ]::regprocedure[] loop
    execute format('revoke all on function %s from public,anon,authenticated,authenticator,service_role',fn);
    execute format('grant execute on function %s to service_role',fn);
  end loop;
end $$;
commit;
