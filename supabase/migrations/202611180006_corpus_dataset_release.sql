begin;

-- Existing plans can finish recovery. New work requires independently verified evidence.
alter table corpus_builder.acquisition_work add column exclusive_dataset_required boolean not null default false;
alter table corpus_builder.acquisition_work alter column exclusive_dataset_required set default true;

-- Enrollment is a governance decision. No API role can enroll an account.
create table corpus_builder.exclusive_provider_accounts (
  provider text not null,
  account_id text not null check (account_id ~ '^[a-zA-Z0-9_-]{1,160}$'),
  approval_ref text not null check (approval_ref ~ '^[a-zA-Z0-9_.:-]{1,120}$'),
  release_enabled boolean not null default false,
  execution_mode text not null default 'disabled' check (execution_mode in ('disabled','fixture')),
  primary key (provider,account_id)
);

create table corpus_builder.exclusive_datasets (
  workspace_id uuid not null,
  work_id uuid not null,
  attempt_id uuid not null,
  provider text not null,
  dataset_id text not null check (dataset_id ~ '^[a-zA-Z0-9_-]{1,160}$'),
  run_id text not null,
  owner_account_id text,
  ownership_method text check (ownership_method='apify.dataset-owner-v1'),
  verified_at timestamptz,
  ownership_approval_ref text,
  release_after timestamptz not null,
  primary key (workspace_id,work_id),
  unique (provider,dataset_id),
  unique (workspace_id,attempt_id),
  foreign key (workspace_id,work_id) references corpus_builder.acquisition_work(workspace_id,id),
  foreign key (workspace_id,attempt_id) references corpus_builder.attempts(workspace_id,id),
  foreign key (provider,owner_account_id) references corpus_builder.exclusive_provider_accounts(provider,account_id),
  check (num_nonnulls(owner_account_id,ownership_method,verified_at,ownership_approval_ref) in (0,4))
);
create index corpus_release_legacy_dataset on corpus_builder.acquisition_work(dataset_id) where dataset_id is not null;

-- A reader has to durably close its claim. Unknown reader outcomes block deletion.
create table corpus_builder.dataset_reads (
  workspace_id uuid not null,
  work_id uuid not null,
  reader_token uuid not null,
  opened_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id,work_id,reader_token),
  foreign key (workspace_id,work_id) references corpus_builder.exclusive_datasets(workspace_id,work_id)
);

-- A single hold per reason is enough for the exclusive model.
create table corpus_builder.dataset_holds (
  workspace_id uuid not null,
  work_id uuid not null,
  kind text not null check (kind in ('legal','internal')),
  primary key (workspace_id,work_id,kind),
  foreign key (workspace_id,work_id) references corpus_builder.exclusive_datasets(workspace_id,work_id)
);

create table corpus_builder.dataset_releases (
  workspace_id uuid not null,
  work_id uuid not null,
  id uuid not null default gen_random_uuid(),
  approved_by text not null,
  approved_at timestamptz not null default clock_timestamp(),
  discard_incomplete boolean not null,
  state text not null default 'approved' check (state in ('approved','executing','retry','review','completed')),
  next_at timestamptz not null default clock_timestamp(),
  executor text,
  lease_token uuid,
  lease_until timestamptz,
  executions integer not null default 0 check (executions between 0 and 6),
  completed_by text,
  completion_token uuid,
  outcome text check (outcome in ('deleted','verified_absent','temporary','uncertain','denied')),
  primary key (workspace_id,work_id),
  unique (workspace_id,id),
  foreign key (workspace_id,work_id) references corpus_builder.exclusive_datasets(workspace_id,work_id),
  check ((state='completed') = (completed_by is not null and completion_token is not null)),
  check (case when state='executing' then num_nonnulls(executor,lease_token,lease_until)=3
    else num_nonnulls(executor,lease_token,lease_until)=0 end)
);

create function corpus_builder.bind_exclusive_dataset(p_workspace uuid,p_work uuid,p_data jsonb)
returns void language plpgsql set search_path='' as $$
declare
  work corpus_builder.acquisition_work;
  provider_name text;
  duration integer;
  owner_id text;
  approval text;
  provider_dataset text := p_data->>'dataset_id';
begin
  select * into strict work from corpus_builder.acquisition_work where workspace_id=p_workspace and id=p_work;
  select p.provider,t.retain_days into strict provider_name,duration from corpus_builder.acquisition_plans p
    join corpus_builder.protocols t on (t.workspace_id,t.id)=(p.workspace_id,p.protocol_id)
    where p.workspace_id=p_workspace and p.id=work.plan_id;

  -- Serialize duplicate binds across workspaces, including against historical claims.
  perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(provider_name,provider_dataset)::text,202611180006));
  if exists (
    select 1 from corpus_builder.acquisition_work w join corpus_builder.acquisition_plans p
      on (p.workspace_id,p.id)=(w.workspace_id,w.plan_id)
    where w.dataset_id=provider_dataset and p.provider=provider_name
      and (w.workspace_id,w.id)<>(p_workspace,p_work)
  ) then raise invalid_parameter_value using message='Dataset cannot be assigned'; end if;

  -- This assertion comes from the trusted server adapter, after a provider metadata check.
  -- Enrollment is independent of credentials or any workspace administrator request.
  if provider_name='apify' and p_data->'ownership'->>'method'='apify.dataset-owner-v1'
    and p_data->'ownership'->>'dataset_id'=provider_dataset
    and p_data->'ownership'->>'run_id'=work.run_id then
    select account_id,approval_ref into owner_id,approval from corpus_builder.exclusive_provider_accounts
      where provider=provider_name and account_id=p_data->'ownership'->>'account_id';
  end if;
  if owner_id is null and (work.exclusive_dataset_required or p_data->'ownership' is not null) then
    raise invalid_parameter_value using message='Dataset ownership assertion unavailable';
  end if;
  insert into corpus_builder.exclusive_datasets(workspace_id,work_id,attempt_id,provider,dataset_id,run_id,
    owner_account_id,ownership_method,verified_at,ownership_approval_ref,release_after)
  values(p_workspace,p_work,work.attempt_id,provider_name,provider_dataset,work.run_id,owner_id,
    case when owner_id is not null then 'apify.dataset-owner-v1' end,
    case when owner_id is not null then clock_timestamp() end,approval,
    (p_data->>'collected_at')::timestamptz+make_interval(days=>duration));
end $$;

-- A reader opens before any dataset item IO and closes after the bounded request.
-- NULL means a historical binding; it is permanently outside the release workflow.
create function public.corpus_acquisition_dataset_read_begin(p_principal text,p_workspace uuid,p_actor text,
  p_work uuid,p_lease uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  if not exists (select 1 from corpus_builder.acquisition_work
    where workspace_id=p_workspace and id=p_work and lease_token=p_lease
      and lease_until>clock_timestamp() and phase='paging' and not cancel_requested) then
    raise insufficient_privilege using message='Dataset read lease unavailable';
  end if;
  if not exists (select 1 from corpus_builder.exclusive_datasets where workspace_id=p_workspace and work_id=p_work) then
    return null;
  end if;
  if exists (select 1 from corpus_builder.dataset_releases where workspace_id=p_workspace and work_id=p_work) then
    raise insufficient_privilege using message='Dataset unavailable';
  end if;
  insert into corpus_builder.dataset_reads(workspace_id,work_id,reader_token)
    values(p_workspace,p_work,p_lease);
  return p_lease;
end $$;

create function public.corpus_acquisition_dataset_read_end(p_principal text,p_workspace uuid,p_actor text,
  p_work uuid,p_reader uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  delete from corpus_builder.dataset_reads
    where workspace_id=p_workspace and work_id=p_work and reader_token=p_reader;
end $$;

create function public.corpus_acquisition_dataset_hold(p_principal text,p_workspace uuid,p_actor text,
  p_work uuid,p_kind text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  if p_kind is null or p_kind not in ('legal','internal') or p_active is null then
    raise invalid_parameter_value using message='Invalid dataset hold';
  end if;
  if not exists (select 1 from corpus_builder.exclusive_datasets where workspace_id=p_workspace and work_id=p_work) then
    raise insufficient_privilege using message='Dataset unavailable';
  end if;
  if p_active then
    insert into corpus_builder.dataset_holds values(p_workspace,p_work,p_kind) on conflict do nothing;
  else
    delete from corpus_builder.dataset_holds where workspace_id=p_workspace and work_id=p_work and kind=p_kind;
  end if;
  if found then
    perform corpus_builder.audit(p_workspace,p_actor,
      'dataset.'||p_kind||case when p_active then '.held' else '.cleared' end,p_work);
  end if;
end $$;

-- Called under the workspace lock. Immutable global binding eliminates shared consumers.
create function corpus_builder.dataset_release_ready(p_workspace uuid,p_work uuid,p_discard boolean)
returns boolean language sql volatile set search_path='' as $$
  select exists (
    select 1 from corpus_builder.exclusive_datasets d
    join corpus_builder.acquisition_work w on (w.workspace_id,w.id)=(d.workspace_id,d.work_id)
    join corpus_builder.attempts a on (a.workspace_id,a.id)=(d.workspace_id,d.attempt_id)
    join corpus_builder.exclusive_provider_accounts e on (e.provider,e.account_id)=(d.provider,d.owner_account_id)
    where d.workspace_id=p_workspace and d.work_id=p_work and d.verified_at is not null
      and e.release_enabled and e.approval_ref=d.ownership_approval_ref
      and d.release_after<=clock_timestamp() and w.phase='done' and w.lease_token is null
      and a.actual_cents is not null and w.run_id=d.run_id and w.dataset_id=d.dataset_id
      and a.dataset_key=d.dataset_id
      and (a.status='succeeded' and a.next_offset=a.expected_rows
        or a.status in ('failed','cancelled') and p_discard)
      and not exists (select 1 from corpus_builder.dataset_reads r
        where r.workspace_id=d.workspace_id and r.work_id=d.work_id)
      and not exists (select 1 from corpus_builder.dataset_holds h
        where h.workspace_id=d.workspace_id and h.work_id=d.work_id)
      and exists (select 1 from corpus_builder.usage_ledger l where l.workspace_id=a.workspace_id
        and l.attempt_id=a.id and l.event_type='settle' and l.cents=a.actual_cents)
  )
$$;

create function public.corpus_acquisition_release_approve(p_principal text,p_workspace uuid,p_actor text,
  p_work uuid,p_discard_incomplete boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare release corpus_builder.dataset_releases;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select * into release from corpus_builder.dataset_releases where workspace_id=p_workspace and work_id=p_work;
  if found then
    if release.discard_incomplete is distinct from p_discard_incomplete then
      raise invalid_parameter_value using message='Dataset release approval replay differs';
    end if;
    return release.id;
  end if;
  if p_discard_incomplete is null
    or not corpus_builder.dataset_release_ready(p_workspace,p_work,p_discard_incomplete) then
    raise invalid_parameter_value using message='Dataset release prerequisites unavailable';
  end if;
  insert into corpus_builder.dataset_releases(workspace_id,work_id,approved_by,discard_incomplete)
    values(p_workspace,p_work,p_actor,p_discard_incomplete) returning * into release;
  perform corpus_builder.audit(p_workspace,p_actor,'dataset.release_approved',release.id);
  return release.id;
end $$;

-- Execution and acknowledgment are fixture-only. Production deletion has no callable transport.
create function public.corpus_acquisition_release_claim_fixture(p_principal text,p_workspace uuid,p_actor text,
  p_work uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare release corpus_builder.dataset_releases;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select r.* into release from corpus_builder.dataset_releases r
    join corpus_builder.exclusive_datasets d on (d.workspace_id,d.work_id)=(r.workspace_id,r.work_id)
    join corpus_builder.exclusive_provider_accounts a on (a.provider,a.account_id)=(d.provider,d.owner_account_id)
    where r.workspace_id=p_workspace and r.work_id=p_work and a.execution_mode='fixture';
  if not found or release.approved_by=p_actor then
    raise insufficient_privilege using message='Independent fixture executor required';
  end if;
  if release.state in ('completed','review') or release.next_at>clock_timestamp()
    or release.state='executing' and release.lease_until>clock_timestamp()
    or not corpus_builder.dataset_release_ready(p_workspace,p_work,release.discard_incomplete) then
    return null;
  end if;
  if release.executions>=6 then
    update corpus_builder.dataset_releases set state='review',outcome='uncertain',executor=null,lease_token=null,lease_until=null
      where workspace_id=p_workspace and work_id=p_work;
    perform corpus_builder.audit(p_workspace,p_actor,'dataset.fixture_review',release.id);
    return null;
  end if;
  update corpus_builder.dataset_releases set state='executing',executor=p_actor,lease_token=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '90 seconds',executions=executions+1
    where workspace_id=p_workspace and work_id=p_work returning * into release;
  perform corpus_builder.audit(p_workspace,p_actor,'dataset.fixture_claimed',release.id);
  return jsonb_build_object('release_id',release.id,'lease_token',release.lease_token);
end $$;

create function public.corpus_acquisition_release_finish_fixture(p_principal text,p_workspace uuid,p_actor text,
  p_work uuid,p_token uuid,p_outcome text)
returns void language plpgsql security definer set search_path='' as $$
declare
  release corpus_builder.dataset_releases;
  status text;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select r.* into release from corpus_builder.dataset_releases r
    join corpus_builder.exclusive_datasets d on (d.workspace_id,d.work_id)=(r.workspace_id,r.work_id)
    join corpus_builder.exclusive_provider_accounts a on (a.provider,a.account_id)=(d.provider,d.owner_account_id)
    where r.workspace_id=p_workspace and r.work_id=p_work and a.execution_mode='fixture';
  if found and release.state='completed' and release.completed_by=p_actor
    and release.completion_token=p_token and release.outcome=p_outcome then return; end if;
  if not found or release.state<>'executing' or release.executor<>p_actor or p_token is null
    or release.lease_token<>p_token or release.lease_until<=clock_timestamp() then
    raise insufficient_privilege using message='Fixture release lease unavailable';
  end if;
  if p_outcome is null or p_outcome not in ('deleted','verified_absent','temporary','uncertain','denied') then
    raise invalid_parameter_value using message='Invalid fixture release outcome';
  end if;
  if p_outcome in ('deleted','verified_absent') then
    if not corpus_builder.dataset_release_ready(p_workspace,p_work,release.discard_incomplete) then
      raise invalid_parameter_value using message='Dataset release prerequisites changed';
    end if;
    status := 'completed';
  elsif p_outcome in ('temporary','uncertain') and release.executions<6 then
    status := 'retry';
  else
    status := 'review';
  end if;
  update corpus_builder.dataset_releases set state=status,outcome=p_outcome,executor=null,lease_token=null,
    completed_by=case when status='completed' then p_actor end,
    completion_token=case when status='completed' then p_token end,
    lease_until=null,next_at=clock_timestamp()+interval '5 seconds'
    where workspace_id=p_workspace and work_id=p_work;
  perform corpus_builder.audit(p_workspace,p_actor,'dataset.fixture_'||p_outcome,release.id);
end $$;

do $$
declare
  t text;
  fn regprocedure;
begin
  foreach t in array array['exclusive_provider_accounts','exclusive_datasets','dataset_reads','dataset_holds','dataset_releases'] loop
    execute format('alter table corpus_builder.%I enable row level security',t);
    execute format('revoke all on corpus_builder.%I from public,anon,authenticated,authenticator,service_role',t);
  end loop;
  foreach fn in array array[
    'corpus_builder.bind_exclusive_dataset(uuid,uuid,jsonb)',
    'corpus_builder.dataset_release_ready(uuid,uuid,boolean)',
    'public.corpus_acquisition_dataset_read_begin(text,uuid,text,uuid,uuid)',
    'public.corpus_acquisition_dataset_read_end(text,uuid,text,uuid,uuid)',
    'public.corpus_acquisition_dataset_hold(text,uuid,text,uuid,text,boolean)',
    'public.corpus_acquisition_release_approve(text,uuid,text,uuid,boolean)',
    'public.corpus_acquisition_release_claim_fixture(text,uuid,text,uuid)',
    'public.corpus_acquisition_release_finish_fixture(text,uuid,text,uuid,uuid,text)'
  ]::regprocedure[] loop
    execute format('revoke all on function %s from public,anon,authenticated,authenticator,service_role',fn);
    if fn::text like 'corpus_acquisition_%' or fn::text like 'public.corpus_acquisition_%' then
      execute format('grant execute on function %s to service_role',fn);
    end if;
  end loop;
end $$;
create trigger corpus_dataset_binding_immutable before update or delete on corpus_builder.exclusive_datasets
  for each row execute function corpus_builder.immutable();
create trigger corpus_dataset_binding_no_truncate before truncate on corpus_builder.exclusive_datasets
  for each statement execute function corpus_builder.immutable();

create or replace function public.corpus_acquisition_advance(p_principal text,p_workspace uuid,p_actor text,p_work uuid,
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
      perform corpus_builder.bind_exclusive_dataset(p_workspace,p_work,p_data);
      if p_data->'ownership' is not null then
        perform corpus_builder.audit(p_workspace,p_actor,'dataset.ownership_verified',p_work);
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
commit;
