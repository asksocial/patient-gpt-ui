-- Gate 1B. Builder-only storage. No provider connection or retrieval binding.
begin;

create schema corpus_builder;
revoke all on schema corpus_builder from public, anon, authenticated, authenticator, service_role;

create table corpus_builder.corpora (
  workspace_id uuid not null references public.intelligence_workspaces(id),
  id uuid not null default gen_random_uuid(),
  corpus_key text not null check (length(btrim(corpus_key)) between 1 and 120),
  name text not null check (length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, id),
  unique (workspace_id, corpus_key)
);

create table corpus_builder.protocols (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  corpus_id uuid not null,
  revision integer not null check (revision > 0),
  subject text not null check (length(btrim(subject)) between 1 and 300),
  window_start timestamptz not null,
  window_end timestamptz not null check (window_end > window_start and isfinite(window_end)),
  platform text not null check (platform ~ '^[a-z0-9_]{1,32}$'),
  source_policy_ref text not null check (length(btrim(source_policy_ref)) between 1 and 200),
  retention_policy_ref text not null check (length(btrim(retention_policy_ref)) between 1 and 200),
  retain_days integer not null check (retain_days between 1 and 3650),
  sampling_policy jsonb not null check (jsonb_typeof(sampling_policy) = 'object' and octet_length(sampling_policy::text) <= 12000),
  budget_cents bigint not null check (budget_cents between 1 and 100000000),
  attempt_limit_cents bigint not null check (attempt_limit_cents between 1 and budget_cents),
  created_at timestamptz not null default clock_timestamp(),
  check (isfinite(window_start)),
  primary key (workspace_id, id),
  unique (workspace_id, corpus_id, revision),
  foreign key (workspace_id, corpus_id) references corpus_builder.corpora(workspace_id, id)
);

create table corpus_builder.queries (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  protocol_id uuid not null,
  query_key text not null check (length(btrim(query_key)) between 1 and 120),
  expression text not null check (length(btrim(expression)) between 1 and 4000),
  primary key (workspace_id, id),
  unique (workspace_id, protocol_id, id),
  unique (workspace_id, protocol_id, query_key),
  foreign key (workspace_id, protocol_id) references corpus_builder.protocols(workspace_id, id)
);

create table corpus_builder.jobs (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  protocol_id uuid not null,
  query_id uuid not null,
  slice_start timestamptz not null,
  slice_end timestamptz not null check (slice_end > slice_start),
  status text not null default 'queued' check (status in ('queued','running','failed','succeeded','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, id),
  unique (workspace_id, id, query_id),
  unique (workspace_id, query_id, slice_start, slice_end),
  foreign key (workspace_id, protocol_id, query_id) references corpus_builder.queries(workspace_id, protocol_id, id)
);

create table corpus_builder.attempts (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  job_id uuid not null,
  query_id uuid not null,
  request_key text not null check (length(btrim(request_key)) between 1 and 120),
  dataset_key text not null check (length(btrim(dataset_key)) between 1 and 160),
  expected_rows integer not null check (expected_rows between 0 and 1000000),
  next_offset integer not null default 0 check (next_offset between 0 and expected_rows),
  reserved_cents bigint not null check (reserved_cents > 0),
  actual_cents bigint check (actual_cents between 0 and reserved_cents),
  status text not null default 'running' check (status in ('running','failed','succeeded','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  check ((status = 'running') = (actual_cents is null and finished_at is null)),
  primary key (workspace_id, id),
  unique (workspace_id, job_id, request_key),
  unique (workspace_id, id, query_id),
  foreign key (workspace_id, job_id, query_id) references corpus_builder.jobs(workspace_id, id, query_id)
);
create unique index corpus_builder_one_active_attempt
  on corpus_builder.attempts (workspace_id, job_id) where status = 'running';

create table corpus_builder.usage_ledger (
  workspace_id uuid not null,
  attempt_id uuid not null,
  event_type text not null check (event_type in ('reserve','settle')),
  cents bigint not null check (cents >= 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, attempt_id, event_type),
  foreign key (workspace_id, attempt_id) references corpus_builder.attempts(workspace_id, id)
);

create table corpus_builder.pages (
  workspace_id uuid not null,
  attempt_id uuid not null,
  page_offset integer not null check (page_offset >= 0),
  row_count integer not null check (row_count between 1 and 100),
  payload_digest bytea not null,
  received_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, attempt_id, page_offset),
  foreign key (workspace_id, attempt_id) references corpus_builder.attempts(workspace_id, id)
);

create table corpus_builder.social_records (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  platform text not null,
  identity_digest bytea not null,
  native_post_id text check (length(native_post_id) between 1 and 200),
  withdrawn_at timestamptz,
  check ((native_post_id is null) = (withdrawn_at is not null)),
  primary key (workspace_id, id),
  unique (workspace_id, identity_digest)
);

create table corpus_builder.source_revisions (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  record_id uuid not null,
  content_digest bytea not null,
  primary key (workspace_id, id),
  unique (workspace_id, record_id, id),
  unique (workspace_id, record_id, content_digest),
  foreign key (workspace_id, record_id) references corpus_builder.social_records(workspace_id, id)
);

-- Text and source URLs are segregated so withdrawal can erase them.
create table corpus_builder.source_content (
  workspace_id uuid not null,
  revision_id uuid not null,
  content text not null check (length(btrim(content)) between 1 and 16000),
  expires_at timestamptz not null,
  primary key (workspace_id, revision_id),
  foreign key (workspace_id, revision_id) references corpus_builder.source_revisions(workspace_id, id)
);

create table corpus_builder.observations (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  attempt_id uuid not null,
  query_id uuid not null,
  page_offset integer not null,
  row_ordinal integer not null check (row_ordinal > 0),
  record_id uuid not null,
  revision_id uuid not null,
  published_at timestamptz,
  collected_at timestamptz not null,
  engagement bigint check (engagement >= 0),
  missing_fields text[] not null check (missing_fields <@ array['published_at','source_url','author','engagement']),
  primary key (workspace_id, id),
  unique (workspace_id, id, query_id),
  unique (workspace_id, record_id, revision_id, id),
  unique (workspace_id, attempt_id, page_offset, row_ordinal),
  foreign key (workspace_id, record_id, revision_id) references corpus_builder.source_revisions(workspace_id, record_id, id),
  foreign key (workspace_id, attempt_id, query_id) references corpus_builder.attempts(workspace_id, id, query_id),
  foreign key (workspace_id, attempt_id, page_offset) references corpus_builder.pages(workspace_id, attempt_id, page_offset)
);
create index corpus_builder_observation_source on corpus_builder.observations(workspace_id, record_id);

create table corpus_builder.observation_details (
  workspace_id uuid not null,
  observation_id uuid not null,
  source_url text check (source_url ~ '^https?://' and length(source_url) <= 2000),
  author_key text check (author_key ~ '^[a-f0-9]{64}$'),
  primary key (workspace_id, observation_id),
  foreign key (workspace_id, observation_id) references corpus_builder.observations(workspace_id, id)
);

create table corpus_builder.query_matches (
  workspace_id uuid not null,
  observation_id uuid not null,
  query_id uuid not null,
  match_kind text not null check (match_kind in ('returned','confirmed')),
  primary key (workspace_id, observation_id, query_id),
  foreign key (workspace_id, observation_id, query_id) references corpus_builder.observations(workspace_id, id, query_id)
);

create table corpus_builder.frames (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  protocol_id uuid not null,
  input_digest bytea not null,
  record_count integer not null check (record_count > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, id),
  unique (workspace_id, protocol_id, input_digest),
  foreign key (workspace_id, protocol_id) references corpus_builder.protocols(workspace_id, id)
);
create table corpus_builder.frame_entries (
  workspace_id uuid not null,
  frame_id uuid not null,
  record_id uuid not null,
  revision_id uuid not null,
  observation_id uuid not null,
  primary key (workspace_id, frame_id, record_id),
  unique (workspace_id, frame_id, record_id, revision_id),
  foreign key (workspace_id, frame_id) references corpus_builder.frames(workspace_id, id),
  foreign key (workspace_id, record_id, revision_id, observation_id)
    references corpus_builder.observations(workspace_id, record_id, revision_id, id)
);
create index corpus_builder_frame_source on corpus_builder.frame_entries(workspace_id, record_id);

create table corpus_builder.versions (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  frame_id uuid not null,
  manifest_digest bytea not null,
  method_version text not null check (length(btrim(method_version)) between 1 and 120),
  seed text not null check (length(btrim(seed)) between 1 and 120),
  record_count integer not null check (record_count > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, id),
  unique (workspace_id, frame_id, id),
  unique (workspace_id, frame_id, manifest_digest),
  foreign key (workspace_id, frame_id) references corpus_builder.frames(workspace_id, id)
);
create table corpus_builder.memberships (
  workspace_id uuid not null,
  frame_id uuid not null,
  version_id uuid not null,
  record_id uuid not null,
  revision_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  primary key (workspace_id, version_id, ordinal),
  unique (workspace_id, version_id, record_id),
  foreign key (workspace_id, frame_id, version_id) references corpus_builder.versions(workspace_id, frame_id, id),
  foreign key (workspace_id, frame_id, record_id, revision_id) references corpus_builder.frame_entries(workspace_id, frame_id, record_id, revision_id)
);
create table corpus_builder.version_invalidations (
  workspace_id uuid not null,
  version_id uuid not null,
  record_id uuid not null,
  reason text not null check (reason in ('withdrawn','expired')),
  invalidated_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, version_id, record_id),
  foreign key (workspace_id, version_id) references corpus_builder.versions(workspace_id, id),
  foreign key (workspace_id, record_id) references corpus_builder.social_records(workspace_id, id)
);

-- Governance storage only. Gate 1B has no publication or client-read RPC.
create table corpus_builder.assessment_runs (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  version_id uuid not null,
  method_version text not null,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  recommendation text check (recommendation in ('APPROVE','EXPAND','REVIEW')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, id),
  unique (workspace_id, version_id, id),
  foreign key (workspace_id, version_id) references corpus_builder.versions(workspace_id, id)
);
create table corpus_builder.review_labels (
  workspace_id uuid not null,
  version_id uuid not null,
  assessment_id uuid not null,
  record_id uuid not null,
  reviewer_id text not null,
  label text not null check (label in ('relevant','irrelevant','uncertain')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, assessment_id, record_id, reviewer_id),
  foreign key (workspace_id, version_id, assessment_id) references corpus_builder.assessment_runs(workspace_id, version_id, id),
  foreign key (workspace_id, version_id, record_id) references corpus_builder.memberships(workspace_id, version_id, record_id)
);
create table corpus_builder.approval_events (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  version_id uuid not null,
  assessment_id uuid not null,
  actor_id text not null,
  decision text not null check (decision in ('submitted','approved','rejected','withdrawn')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, id),
  unique (workspace_id, version_id, id, decision),
  foreign key (workspace_id, version_id, assessment_id) references corpus_builder.assessment_runs(workspace_id, version_id, id)
);
create table corpus_builder.publications (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  version_id uuid not null,
  approval_id uuid not null,
  approval_decision text not null default 'approved' check (approval_decision = 'approved'),
  published_at timestamptz not null,
  withdrawn_at timestamptz check (withdrawn_at >= published_at),
  primary key (workspace_id, id),
  foreign key (workspace_id, version_id, approval_id, approval_decision)
    references corpus_builder.approval_events(workspace_id, version_id, id, decision)
);

create table corpus_builder.audit_events (
  workspace_id uuid not null references public.intelligence_workspaces(id),
  sequence bigint not null check (sequence > 0),
  actor_id text not null,
  action text not null,
  resource_id uuid not null,
  recorded_at timestamptz not null,
  previous_digest bytea,
  event_digest bytea not null,
  primary key (workspace_id, sequence)
);

create function corpus_builder.guard(p_principal text, p_workspace uuid, p_actor text, p_write boolean)
returns void language plpgsql set search_path = '' as $$
declare
  creator text;
  member_role text;
begin
  -- Serialize mutations in one workspace, including reservations, page commits,
  -- and withdrawal versus frame/version creation. Distinct workspaces can run.
  if p_write then
    perform pg_advisory_xact_lock(hashtextextended(p_workspace::text, 202611180003));
  end if;
  perform 1 from public.user_provisioning
    where clerk_user_id = p_actor and state = 'active' and account_role = 'platform_admin' for share;
  if not found then raise insufficient_privilege using message = 'Active platform administrator required'; end if;
  select w.created_by into creator from public.intelligence_workspaces w
    where w.id = p_workspace and w.principal_id = p_principal and w.archived_at is null for share;
  if not found then raise insufficient_privilege using message = 'Workspace access denied'; end if;
  select m.role into member_role from public.intelligence_workspace_members m
    where m.workspace_id = p_workspace and m.principal_id = p_principal and m.user_id = p_actor for share;
  if member_role is null and creator = p_actor then member_role := 'owner'; end if;
  if member_role is null or (p_write and member_role not in ('owner','editor')) then
    raise insufficient_privilege using message = 'Workspace access denied';
  end if;
end $$;

create function corpus_builder.audit(p_workspace uuid, p_actor text, p_action text, p_resource uuid)
returns void language plpgsql set search_path = '' as $$
declare
  seq bigint;
  prev bytea;
  stamp timestamptz := clock_timestamp();
begin
  select sequence, event_digest into seq, prev from corpus_builder.audit_events
    where workspace_id = p_workspace order by sequence desc limit 1;
  seq := coalesce(seq, 0) + 1;
  insert into corpus_builder.audit_events values (
    p_workspace, seq, p_actor, p_action, p_resource, stamp, prev,
    sha256(convert_to(jsonb_build_array(p_workspace, seq, p_actor, p_action,
      p_resource, extract(epoch from stamp), encode(prev, 'hex'))::text, 'UTF8'))
  );
end $$;

create function corpus_builder.immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Frozen Corpus Builder metadata cannot be changed';
end $$;

create function public.corpus_builder_configure(
  p_principal text, p_workspace uuid, p_actor text, p_config jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  corpus uuid;
  protocol uuid;
  next_revision integer;
begin
  perform corpus_builder.guard(p_principal, p_workspace, p_actor, true);
  if jsonb_typeof(p_config->'queries') is distinct from 'array'
    or jsonb_array_length(p_config->'queries') not between 1 and 50 then
    raise invalid_parameter_value using message = 'One to fifty acquisition queries required';
  end if;
  insert into corpus_builder.corpora(workspace_id, corpus_key, name)
    values (p_workspace, p_config->>'corpus_key', p_config->>'name')
    on conflict (workspace_id, corpus_key) do nothing;
  select id into strict corpus from corpus_builder.corpora
    where workspace_id = p_workspace and corpus_key = p_config->>'corpus_key';
  select coalesce(max(revision),0)+1 into next_revision from corpus_builder.protocols
    where workspace_id = p_workspace and corpus_id = corpus;
  insert into corpus_builder.protocols(workspace_id, corpus_id, revision, subject, window_start, window_end,
    platform, source_policy_ref, retention_policy_ref, retain_days, sampling_policy, budget_cents, attempt_limit_cents)
    values (p_workspace, corpus, next_revision, p_config->>'subject',
      (p_config->>'window_start')::timestamptz, (p_config->>'window_end')::timestamptz, p_config->>'platform',
      p_config->>'source_policy_ref', p_config->>'retention_policy_ref', (p_config->>'retain_days')::integer,
      p_config->'sampling_policy', (p_config->>'budget_cents')::bigint, (p_config->>'attempt_limit_cents')::bigint)
    returning id into protocol;
  insert into corpus_builder.queries(workspace_id, protocol_id, query_key, expression)
    select p_workspace, protocol, item->>'key', item->>'expression'
    from jsonb_array_elements(p_config->'queries') item;
  perform corpus_builder.audit(p_workspace, p_actor, 'protocol.created', protocol);
  return protocol;
end $$;

create function public.corpus_builder_status(p_principal text, p_workspace uuid, p_actor text, p_protocol uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform corpus_builder.guard(p_principal, p_workspace, p_actor, false);
  select jsonb_build_object('protocol_id',id,'corpus_id',corpus_id,'revision',revision,'budget_cents',budget_cents,
    'queries',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'key',q.query_key) order by q.query_key),'[]')
      from corpus_builder.queries q where q.workspace_id=p_workspace and q.protocol_id=p_protocol))
    into result from corpus_builder.protocols where workspace_id=p_workspace and id=p_protocol;
  if not found then raise insufficient_privilege using message = 'Protocol unavailable'; end if;
  return result;
end $$;

create function public.corpus_builder_queue(p_principal text, p_workspace uuid, p_actor text,
  p_query uuid, p_start timestamptz, p_end timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  protocol corpus_builder.protocols;
  job uuid;
begin
  perform corpus_builder.guard(p_principal, p_workspace, p_actor, true);
  select p.* into protocol from corpus_builder.queries q join corpus_builder.protocols p
    on (p.workspace_id,p.id)=(q.workspace_id,q.protocol_id)
    where q.workspace_id=p_workspace and q.id=p_query;
  if not found then raise insufficient_privilege using message = 'Query unavailable'; end if;
  if p_start is null or p_end is null or p_end <= p_start
    or p_start < protocol.window_start or p_end > protocol.window_end then
    raise invalid_parameter_value using message = 'Slice must fit the protocol window';
  end if;
  insert into corpus_builder.jobs(workspace_id, protocol_id, query_id, slice_start, slice_end)
    values (p_workspace, protocol.id, p_query, p_start, p_end)
    on conflict (workspace_id, query_id, slice_start, slice_end) do nothing returning id into job;
  if job is not null then
    perform corpus_builder.audit(p_workspace, p_actor, 'job.queued', job);
  else
    select id into strict job from corpus_builder.jobs
      where workspace_id=p_workspace and query_id=p_query and slice_start=p_start and slice_end=p_end;
  end if;
  return job;
end $$;

create function public.corpus_builder_reserve(p_principal text, p_workspace uuid, p_actor text,
  p_job uuid, p_key text, p_dataset text, p_expected_rows integer, p_cents bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  job corpus_builder.jobs;
  attempt corpus_builder.attempts;
  protocol corpus_builder.protocols;
  used bigint;
begin
  perform corpus_builder.guard(p_principal, p_workspace, p_actor, true);
  select * into job from corpus_builder.jobs where workspace_id=p_workspace and id=p_job;
  if not found then raise insufficient_privilege using message = 'Job unavailable'; end if;
  select * into attempt from corpus_builder.attempts
    where workspace_id=p_workspace and job_id=p_job and request_key=p_key;
  if found then
    if (attempt.dataset_key,attempt.expected_rows,attempt.reserved_cents)
      is distinct from (p_dataset,p_expected_rows,p_cents) then
      raise invalid_parameter_value using message = 'Reservation key conflicts with recorded inputs';
    end if;
    return attempt.id;
  end if;
  if job.status not in ('queued','failed') then raise exception 'Job cannot start an attempt'; end if;
  select * into strict protocol from corpus_builder.protocols
    where workspace_id=p_workspace and id=job.protocol_id;
  select coalesce(sum(coalesce(a.actual_cents,a.reserved_cents)),0) into used
    from corpus_builder.attempts a join corpus_builder.jobs j
      on (j.workspace_id,j.id)=(a.workspace_id,a.job_id)
    where j.workspace_id=p_workspace and j.protocol_id=protocol.id;
  if p_cents is null or p_cents < 1 or p_cents > protocol.attempt_limit_cents
    or p_cents > protocol.budget_cents-used then
    raise invalid_parameter_value using message = 'Protocol or attempt budget exhausted';
  end if;
  insert into corpus_builder.attempts(workspace_id,job_id,query_id,request_key,dataset_key,expected_rows,reserved_cents)
    values (p_workspace,p_job,job.query_id,p_key,p_dataset,p_expected_rows,p_cents) returning * into attempt;
  insert into corpus_builder.usage_ledger(workspace_id,attempt_id,event_type,cents)
    values (p_workspace,attempt.id,'reserve',p_cents);
  update corpus_builder.jobs set status='running' where workspace_id=p_workspace and id=p_job;
  perform corpus_builder.audit(p_workspace,p_actor,'attempt.reserved',attempt.id);
  return attempt.id;
end $$;

create function public.corpus_builder_page(p_principal text, p_workspace uuid, p_actor text,
  p_attempt uuid, p_offset integer, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  attempt corpus_builder.attempts;
  size integer;
  digest bytea;
  saved_digest bytea;
  item record;
  job corpus_builder.jobs;
  protocol corpus_builder.protocols;
  source corpus_builder.social_records;
  revision uuid;
  observation uuid;
  identity bytea;
  content_hash bytea;
  published timestamptz;
  collected timestamptz;
  missing text[];
begin
  perform corpus_builder.guard(p_principal, p_workspace, p_actor, true);
  select * into attempt from corpus_builder.attempts where workspace_id=p_workspace and id=p_attempt;
  if not found then raise insufficient_privilege using message = 'Attempt unavailable'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or octet_length(p_rows::text) > 1000000 then
    raise invalid_parameter_value using message = 'Bounded dataset page required';
  end if;
  size := jsonb_array_length(p_rows);
  if size not between 1 and 100 then raise invalid_parameter_value using message = 'Invalid page size'; end if;
  digest := sha256(convert_to(p_rows::text,'UTF8'));
  select payload_digest into saved_digest from corpus_builder.pages
    where workspace_id=p_workspace and attempt_id=p_attempt and page_offset=p_offset;
  if found then
    if digest is distinct from saved_digest then
      raise invalid_parameter_value using message = 'Page replay conflicts with recorded payload';
    end if;
    return attempt.next_offset;
  end if;
  if attempt.status <> 'running' or p_offset is distinct from attempt.next_offset
    or size > attempt.expected_rows-attempt.next_offset then
    raise invalid_parameter_value using message = 'Attempt or page checkpoint does not accept this page';
  end if;
  select * into strict job from corpus_builder.jobs where workspace_id=p_workspace and id=attempt.job_id;
  select * into strict protocol from corpus_builder.protocols where workspace_id=p_workspace and id=job.protocol_id;
  insert into corpus_builder.pages(workspace_id,attempt_id,page_offset,row_count,payload_digest)
    values (p_workspace,p_attempt,p_offset,size,digest);
  for item in select value as row, ordinality::integer as ordinal
    from jsonb_array_elements(p_rows) with ordinality
  loop
    if jsonb_typeof(item.row) <> 'object'
      or length(btrim(item.row->>'post_id')) is null
      or length(btrim(item.row->>'post_id')) not between 1 and 200
      or jsonb_typeof(item.row->'content') is distinct from 'string' then
      raise invalid_parameter_value using message = 'Native post identity and content required';
    end if;
    published := (item.row->>'published_at')::timestamptz;
    collected := (item.row->>'collected_at')::timestamptz;
    if collected is null or not isfinite(collected) or collected > clock_timestamp()
      or (published is not null and (published < job.slice_start or published >= job.slice_end or published > collected)) then
      raise invalid_parameter_value using message = 'Invalid collection or publication time';
    end if;
    if collected + make_interval(days => protocol.retain_days) <= clock_timestamp() then
      raise invalid_parameter_value using message = 'Source retention window expired';
    end if;
    identity := sha256(convert_to(jsonb_build_array(protocol.platform,btrim(item.row->>'post_id'))::text,'UTF8'));
    insert into corpus_builder.social_records(workspace_id,platform,identity_digest,native_post_id)
      values (p_workspace,protocol.platform,identity,btrim(item.row->>'post_id'))
      on conflict (workspace_id,identity_digest) do nothing;
    select * into strict source from corpus_builder.social_records where workspace_id=p_workspace and identity_digest=identity;
    if source.withdrawn_at is not null then
      raise invalid_parameter_value using message = 'Source record has been withdrawn';
    end if;
    content_hash := sha256(convert_to(item.row->>'content','UTF8'));
    insert into corpus_builder.source_revisions(workspace_id,record_id,content_digest)
      values (p_workspace,source.id,content_hash)
      on conflict (workspace_id,record_id,content_digest) do nothing returning id into revision;
    if revision is not null then
      insert into corpus_builder.source_content values
        (p_workspace,revision,item.row->>'content',collected + make_interval(days => protocol.retain_days));
    else
      select id into strict revision from corpus_builder.source_revisions
        where workspace_id=p_workspace and record_id=source.id and content_digest=content_hash;
      -- Reobservation never lengthens retention, and a stricter protocol can shorten it.
      update corpus_builder.source_content
        set expires_at=least(expires_at,collected + make_interval(days => protocol.retain_days))
        where workspace_id=p_workspace and revision_id=revision and expires_at > clock_timestamp();
      if not found then raise invalid_parameter_value using message = 'Source revision is no longer retainable'; end if;
    end if;
    missing := array_remove(array[
      case when published is null then 'published_at' end,
      case when item.row->>'source_url' is null then 'source_url' end,
      case when item.row->>'author_key' is null then 'author' end,
      case when item.row->>'engagement' is null then 'engagement' end],null);
    insert into corpus_builder.observations(workspace_id,attempt_id,query_id,page_offset,row_ordinal,
      record_id,revision_id,published_at,collected_at,engagement,missing_fields)
      values (p_workspace,p_attempt,attempt.query_id,p_offset,item.ordinal,source.id,revision,
        published,collected,(item.row->>'engagement')::bigint,missing) returning id into observation;
    insert into corpus_builder.observation_details values
      (p_workspace,observation,item.row->>'source_url',item.row->>'author_key');
    insert into corpus_builder.query_matches values
      (p_workspace,observation,attempt.query_id,coalesce(item.row->>'match_kind','returned'));
  end loop;
  update corpus_builder.attempts set next_offset=p_offset+size where workspace_id=p_workspace and id=p_attempt;
  perform corpus_builder.audit(p_workspace,p_actor,'page.committed',p_attempt);
  return p_offset+size;
end $$;

create function public.corpus_builder_finish(p_principal text, p_workspace uuid, p_actor text,
  p_attempt uuid, p_status text, p_actual bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempt corpus_builder.attempts;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select * into attempt from corpus_builder.attempts where workspace_id=p_workspace and id=p_attempt;
  if not found then raise insufficient_privilege using message = 'Attempt unavailable'; end if;
  if attempt.status <> 'running' then
    if (attempt.status,attempt.actual_cents) is distinct from (p_status,p_actual) then
      raise invalid_parameter_value using message = 'Settlement conflicts with recorded result';
    end if;
    return;
  end if;
  if p_status is null or p_status not in ('succeeded','failed','cancelled')
    or p_actual is null or p_actual not between 0 and attempt.reserved_cents
    or (p_status='succeeded' and attempt.next_offset<>attempt.expected_rows) then
    raise invalid_parameter_value using message = 'Invalid or incomplete settlement';
  end if;
  update corpus_builder.attempts set status=p_status,actual_cents=p_actual,finished_at=clock_timestamp()
    where workspace_id=p_workspace and id=p_attempt;
  insert into corpus_builder.usage_ledger(workspace_id,attempt_id,event_type,cents)
    values (p_workspace,p_attempt,'settle',p_actual);
  update corpus_builder.jobs set status=p_status where workspace_id=p_workspace and id=attempt.job_id;
  perform corpus_builder.audit(p_workspace,p_actor,'attempt.'||p_status,p_attempt);
end $$;

create function public.corpus_builder_job_status(p_principal text,p_workspace uuid,p_actor text,p_job uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,false);
  select jsonb_build_object('id',j.id,'status',j.status,
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,
      'next_offset',a.next_offset,'expected_rows',a.expected_rows,'reserved_cents',a.reserved_cents,
      'actual_cents',a.actual_cents) order by a.created_at,a.id)
      from (select * from corpus_builder.attempts
        where workspace_id=p_workspace and job_id=p_job order by created_at desc,id desc limit 50) a),'[]'))
    into result from corpus_builder.jobs j where j.workspace_id=p_workspace and j.id=p_job;
  if not found then raise insufficient_privilege using message = 'Job unavailable'; end if;
  return result;
end $$;

create function public.corpus_builder_freeze_frame(p_principal text,p_workspace uuid,p_actor text,p_protocol uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  entries jsonb;
  digest bytea;
  frame uuid;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  perform 1 from corpus_builder.protocols where workspace_id=p_workspace and id=p_protocol;
  if not found then raise insufficient_privilege using message = 'Protocol unavailable'; end if;
  select jsonb_agg(jsonb_build_object('record_id',s.record_id,'revision_id',s.revision_id,
      'observation_id',s.observation_id,'identity',encode(s.identity_digest,'hex'),
      'revision',encode(s.content_digest,'hex'),'observation',encode(s.observation_digest,'hex'))
      order by s.identity_digest) into entries
    from (
      select distinct on (o.record_id) o.record_id,o.revision_id,o.id as observation_id,
        r.identity_digest,v.content_digest,
        sha256(convert_to(jsonb_build_array(extract(epoch from o.published_at),extract(epoch from o.collected_at),
          o.engagement,o.missing_fields,d.author_key,d.source_url,m.match_kind)::text,'UTF8')) as observation_digest
      from corpus_builder.observations o
      join corpus_builder.attempts a on (a.workspace_id,a.id)=(o.workspace_id,o.attempt_id)
      join corpus_builder.jobs j on (j.workspace_id,j.id)=(a.workspace_id,a.job_id)
      join corpus_builder.social_records r on (r.workspace_id,r.id)=(o.workspace_id,o.record_id)
      join corpus_builder.source_revisions v on (v.workspace_id,v.id)=(o.workspace_id,o.revision_id)
      join corpus_builder.source_content c on (c.workspace_id,c.revision_id)=(o.workspace_id,o.revision_id)
      join corpus_builder.observation_details d on (d.workspace_id,d.observation_id)=(o.workspace_id,o.id)
      join corpus_builder.query_matches m on (m.workspace_id,m.observation_id,m.query_id)=(o.workspace_id,o.id,o.query_id)
      where o.workspace_id=p_workspace and j.protocol_id=p_protocol and a.status='succeeded'
        and r.withdrawn_at is null and c.expires_at>clock_timestamp()
      order by o.record_id,o.collected_at desc,(m.match_kind='confirmed') desc,v.content_digest,observation_digest,o.id
      limit 10001
    ) s;
  if entries is null or jsonb_array_length(entries)>10000 then
    raise invalid_parameter_value using message = 'Frame requires between one and ten thousand eligible records';
  end if;
  select sha256(convert_to(jsonb_agg(jsonb_build_array(x->'identity',x->'revision',x->'observation') order by n)::text,'UTF8'))
    into digest from jsonb_array_elements(entries) with ordinality as e(x,n);
  insert into corpus_builder.frames(workspace_id,protocol_id,input_digest,record_count)
    values (p_workspace,p_protocol,digest,jsonb_array_length(entries))
    on conflict (workspace_id,protocol_id,input_digest) do nothing returning id into frame;
  if frame is null then
    select id into strict frame from corpus_builder.frames
      where workspace_id=p_workspace and protocol_id=p_protocol and input_digest=digest;
    return frame;
  end if;
  insert into corpus_builder.frame_entries(workspace_id,frame_id,record_id,revision_id,observation_id)
    select p_workspace,frame,e.record_id,e.revision_id,e.observation_id
    from jsonb_to_recordset(entries) as e(record_id uuid,revision_id uuid,observation_id uuid);
  perform corpus_builder.audit(p_workspace,p_actor,'frame.frozen',frame);
  return frame;
end $$;

create function corpus_builder.frame_available(p_workspace uuid,p_frame uuid)
returns boolean language sql volatile set search_path = '' as $$
  select not exists (
    select 1 from corpus_builder.frame_entries e
    left join corpus_builder.source_content c on (c.workspace_id,c.revision_id)=(e.workspace_id,e.revision_id)
    where e.workspace_id=p_workspace and e.frame_id=p_frame
      and (c.revision_id is null or c.expires_at<=clock_timestamp())
  )
$$;

create function public.corpus_builder_freeze_version(p_principal text,p_workspace uuid,p_actor text,
  p_frame uuid,p_method text,p_seed text,p_records uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  frame corpus_builder.frames;
  version_id uuid;
  digest bytea;
  identities jsonb;
  member_count integer;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select * into frame from corpus_builder.frames where workspace_id=p_workspace and id=p_frame;
  if not found then raise insufficient_privilege using message = 'Frame unavailable'; end if;
  if not corpus_builder.frame_available(p_workspace,p_frame) then
    raise invalid_parameter_value using message = 'Frame contains withdrawn or expired evidence';
  end if;
  if p_records is null or cardinality(p_records) not between 1 and frame.record_count
    or array_ndims(p_records)<>1 then
    raise invalid_parameter_value using message = 'Invalid membership selection';
  end if;
  select count(distinct e.record_id),jsonb_agg(encode(s.identity_digest,'hex') order by n) into member_count,identities
    from unnest(p_records) with ordinality m(id,n)
    join corpus_builder.frame_entries e on e.workspace_id=p_workspace and e.frame_id=p_frame and e.record_id=m.id
    join corpus_builder.social_records s on (s.workspace_id,s.id)=(e.workspace_id,e.record_id);
  if member_count<>cardinality(p_records) then
    raise invalid_parameter_value using message = 'Membership requires distinct records from this frame';
  end if;
  digest := sha256(convert_to(jsonb_build_array(encode(frame.input_digest,'hex'),p_method,p_seed,identities)::text,'UTF8'));
  insert into corpus_builder.versions(workspace_id,frame_id,manifest_digest,method_version,seed,record_count)
    values (p_workspace,p_frame,digest,p_method,p_seed,member_count)
    on conflict (workspace_id,frame_id,manifest_digest) do nothing returning id into version_id;
  if version_id is null then
    select id into strict version_id from corpus_builder.versions
      where workspace_id=p_workspace and frame_id=p_frame and manifest_digest=digest;
    return version_id;
  end if;
  insert into corpus_builder.memberships(workspace_id,frame_id,version_id,record_id,revision_id,ordinal)
    select p_workspace,p_frame,version_id,e.record_id,e.revision_id,n
      from unnest(p_records) with ordinality m(id,n)
      join corpus_builder.frame_entries e on e.workspace_id=p_workspace and e.frame_id=p_frame and e.record_id=m.id;
  perform corpus_builder.audit(p_workspace,p_actor,'version.frozen',version_id);
  return version_id;
end $$;

create function public.corpus_builder_frame_manifest(p_principal text,p_workspace uuid,p_actor text,p_frame uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,false);
  select jsonb_build_object('frame_id',f.id,'digest',encode(f.input_digest,'hex'),'record_count',f.record_count,
    'available',corpus_builder.frame_available(p_workspace,p_frame),
    'record_ids',(select jsonb_agg(e.record_id order by s.identity_digest)
       from corpus_builder.frame_entries e join corpus_builder.social_records s
         on (s.workspace_id,s.id)=(e.workspace_id,e.record_id)
       where e.workspace_id=p_workspace and e.frame_id=p_frame))
    into result from corpus_builder.frames f where f.workspace_id=p_workspace and f.id=p_frame;
  if not found then raise insufficient_privilege using message = 'Frame unavailable'; end if;
  return result;
end $$;

create function public.corpus_builder_version_status(p_principal text,p_workspace uuid,p_actor text,p_version uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,false);
  select jsonb_build_object('id',v.id,'digest',encode(v.manifest_digest,'hex'),'record_count',v.record_count,
    'valid',corpus_builder.frame_available(p_workspace,v.frame_id) and not exists (
      select 1 from corpus_builder.version_invalidations i where i.workspace_id=p_workspace and i.version_id=v.id))
    into result from corpus_builder.versions v where v.workspace_id=p_workspace and v.id=p_version;
  if not found then raise insufficient_privilege using message = 'Version unavailable'; end if;
  return result;
end $$;

create function public.corpus_builder_withdraw(p_principal text,p_workspace uuid,p_actor text,p_record uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  source corpus_builder.social_records;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select * into source from corpus_builder.social_records where workspace_id=p_workspace and id=p_record;
  if not found then raise insufficient_privilege using message = 'Source unavailable'; end if;
  if p_reason is null or p_reason not in ('withdrawn','expired') then
    raise invalid_parameter_value using message = 'Invalid withdrawal reason';
  end if;
  if source.withdrawn_at is not null then return; end if;
  if p_reason='expired' and not exists (
    select 1 from corpus_builder.source_revisions v join corpus_builder.source_content c
      on (c.workspace_id,c.revision_id)=(v.workspace_id,v.id)
      where v.workspace_id=p_workspace and v.record_id=p_record and c.expires_at<=clock_timestamp()) then
    raise invalid_parameter_value using message = 'Source retention window has not expired';
  end if;
  update corpus_builder.social_records set native_post_id=null,withdrawn_at=clock_timestamp()
    where workspace_id=p_workspace and id=p_record;
  delete from corpus_builder.source_content c using corpus_builder.source_revisions v
    where (c.workspace_id,c.revision_id)=(v.workspace_id,v.id) and v.workspace_id=p_workspace and v.record_id=p_record;
  delete from corpus_builder.observation_details d using corpus_builder.observations o
    where (d.workspace_id,d.observation_id)=(o.workspace_id,o.id) and o.workspace_id=p_workspace and o.record_id=p_record;
  insert into corpus_builder.version_invalidations(workspace_id,version_id,record_id,reason)
    select p_workspace,v.id,p_record,p_reason from corpus_builder.versions v join corpus_builder.frame_entries e
      on (e.workspace_id,e.frame_id)=(v.workspace_id,v.frame_id)
    where v.workspace_id=p_workspace and e.record_id=p_record;
  perform corpus_builder.audit(p_workspace,p_actor,'source.'||p_reason,p_record);
end $$;

create function public.corpus_builder_source_lookup(p_principal text,p_workspace uuid,p_actor text,
  p_platform text,p_post_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,false);
  if p_platform is null or p_platform !~ '^[a-z0-9_]{1,32}$'
    or p_post_id is null or length(btrim(p_post_id)) not between 1 and 200 then
    raise invalid_parameter_value using message = 'Native platform and post identity required';
  end if;
  select jsonb_build_object('id',r.id,'withdrawn',r.withdrawn_at is not null) into result
    from corpus_builder.social_records r where r.workspace_id=p_workspace
      and r.identity_digest=sha256(convert_to(jsonb_build_array(p_platform,btrim(p_post_id))::text,'UTF8'));
  return result;
end $$;

-- Ordinary API roles and the RLS-bypassing service role cannot use private
-- tables directly. Revoke explicit defaults as well as PUBLIC rights.
revoke all on all tables in schema corpus_builder from public,anon,authenticated,authenticator,service_role;
revoke all on all functions in schema corpus_builder from public,anon,authenticated,authenticator,service_role;

do $$
declare
  t text;
  fn regprocedure;
begin
  for t in select tablename from pg_tables where schemaname='corpus_builder' loop
    execute format('alter table corpus_builder.%I enable row level security',t);
  end loop;
  foreach t in array array['corpora','protocols','queries','usage_ledger','pages','source_revisions',
    'observations','query_matches','frames','frame_entries','versions','memberships','version_invalidations',
    'approval_events','audit_events']
  loop
    execute format('create trigger corpus_builder_frozen before update or delete on corpus_builder.%I
      for each row execute function corpus_builder.immutable()',t);
    execute format('create trigger corpus_builder_no_truncate before truncate on corpus_builder.%I
      for each statement execute function corpus_builder.immutable()',t);
  end loop;
  foreach fn in array array[
    'public.corpus_builder_configure(text,uuid,text,jsonb)',
    'public.corpus_builder_status(text,uuid,text,uuid)',
    'public.corpus_builder_queue(text,uuid,text,uuid,timestamptz,timestamptz)',
    'public.corpus_builder_reserve(text,uuid,text,uuid,text,text,integer,bigint)',
    'public.corpus_builder_page(text,uuid,text,uuid,integer,jsonb)',
    'public.corpus_builder_finish(text,uuid,text,uuid,text,bigint)',
    'public.corpus_builder_job_status(text,uuid,text,uuid)',
    'public.corpus_builder_freeze_frame(text,uuid,text,uuid)',
    'public.corpus_builder_freeze_version(text,uuid,text,uuid,text,text,uuid[])',
    'public.corpus_builder_frame_manifest(text,uuid,text,uuid)',
    'public.corpus_builder_version_status(text,uuid,text,uuid)',
    'public.corpus_builder_withdraw(text,uuid,text,uuid,text)',
    'public.corpus_builder_source_lookup(text,uuid,text,text,text)'
  ]::regprocedure[]
  loop
    execute format('revoke all on function %s from public,anon,authenticated,authenticator,service_role',fn);
    execute format('grant execute on function %s to service_role',fn);
  end loop;
end $$;

commit;
