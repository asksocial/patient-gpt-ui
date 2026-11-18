begin;

alter table corpus_builder.source_content add column retention_policy_ref text;
create index corpus_retention_expiry on corpus_builder.source_content(workspace_id,expires_at,revision_id);
create index corpus_retention_observations on corpus_builder.observations(workspace_id,revision_id);
create index corpus_retention_frames on corpus_builder.frame_entries(workspace_id,revision_id);

create table corpus_builder.revision_expirations (
  workspace_id uuid not null,
  revision_id uuid not null,
  expires_at timestamptz not null,
  retention_policy_ref text,
  purged_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id,revision_id),
  foreign key (workspace_id,revision_id) references corpus_builder.source_revisions(workspace_id,id)
);

-- Dedicated storage and read gate for future corpus derivatives. No link to existing retrieval indexes.
create table corpus_builder.revision_artifacts (
  workspace_id uuid not null,
  revision_id uuid not null,
  artifact_key uuid not null,
  kind text not null check (kind in ('extract','embedding')),
  payload jsonb not null check (octet_length(payload::text)<=1000000),
  primary key (workspace_id,revision_id,artifact_key),
  foreign key (workspace_id,revision_id) references corpus_builder.source_revisions(workspace_id,id)
);

create function corpus_builder.revision_available(p_workspace uuid,p_revision uuid)
returns boolean language sql volatile set search_path='' as $$
  select exists (
    select 1 from corpus_builder.source_content c
    join corpus_builder.source_revisions v on (v.workspace_id,v.id)=(c.workspace_id,c.revision_id)
    join corpus_builder.social_records r on (r.workspace_id,r.id)=(v.workspace_id,v.record_id)
    where c.workspace_id=p_workspace and c.revision_id=p_revision
      and c.expires_at>clock_timestamp() and r.withdrawn_at is null
  )
$$;

create function public.corpus_builder_revision_artifact_put(p_principal text,p_workspace uuid,p_actor text,
  p_revision uuid,p_key uuid,p_kind text,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  if not corpus_builder.revision_available(p_workspace,p_revision) then
    raise insufficient_privilege using message='Revision unavailable';
  end if;
  insert into corpus_builder.revision_artifacts(workspace_id,revision_id,artifact_key,kind,payload)
    values(p_workspace,p_revision,p_key,p_kind,p_payload)
    on conflict (workspace_id,revision_id,artifact_key) do nothing;
  if not found and not exists (
    select 1 from corpus_builder.revision_artifacts a where a.workspace_id=p_workspace
      and a.revision_id=p_revision and a.artifact_key=p_key and a.kind=p_kind and a.payload=p_payload
  ) then raise invalid_parameter_value using message='Artifact replay differs'; end if;
end $$;

create function public.corpus_builder_revision_artifact_get(p_principal text,p_workspace uuid,p_actor text,
  p_revision uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,false);
  select a.payload into result from corpus_builder.revision_artifacts a
    where a.workspace_id=p_workspace and a.revision_id=p_revision and a.artifact_key=p_key
      and corpus_builder.revision_available(p_workspace,p_revision);
  return result;
end $$;

create function public.corpus_builder_expire_revisions(p_principal text,p_workspace uuid,p_actor text,
  p_cutoff timestamptz,p_limit integer)
returns integer language plpgsql security definer set search_path='' as $$
declare
  item record;
  purged integer := 0;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  if p_limit is null or p_limit not between 1 and 500 or p_cutoff is null
    or not isfinite(p_cutoff) or p_cutoff>clock_timestamp() then
    raise invalid_parameter_value using message='Invalid revision cleanup bounds';
  end if;
  for item in select c.revision_id,c.expires_at,c.retention_policy_ref
    from corpus_builder.source_content c
    where c.workspace_id=p_workspace and c.expires_at<=p_cutoff
    order by c.expires_at,c.revision_id limit p_limit
  loop
    insert into corpus_builder.revision_expirations(workspace_id,revision_id,expires_at,retention_policy_ref)
      values(p_workspace,item.revision_id,item.expires_at,item.retention_policy_ref);
    delete from corpus_builder.observation_details d using corpus_builder.observations o
      where (d.workspace_id,d.observation_id)=(o.workspace_id,o.id)
        and o.workspace_id=p_workspace and o.revision_id=item.revision_id;
    delete from corpus_builder.revision_artifacts where workspace_id=p_workspace and revision_id=item.revision_id;
    delete from corpus_builder.source_content where workspace_id=p_workspace and revision_id=item.revision_id;
    -- The frozen frame dependency plus the revision tombstone records invalidation.
    -- Version status already evaluates missing/expired content without changing manifests.
    perform corpus_builder.audit(p_workspace,p_actor,'revision.expired',item.revision_id);
    purged := purged+1;
  end loop;
  return purged;
end $$;

create table corpus_builder.retention_operations (
  workspace_id uuid not null references public.intelligence_workspaces(id),
  id uuid not null default gen_random_uuid(),
  work_id uuid not null,
  phase text not null check (phase in ('ready','submitting','running','paging','review','done')),
  failure_count integer not null check (failure_count between 0 and 6),
  recorded_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (workspace_id,id),
  foreign key (workspace_id,work_id) references corpus_builder.acquisition_work(workspace_id,id)
);
create index corpus_retention_operations_expiry on corpus_builder.retention_operations(workspace_id,expires_at,id);

create function corpus_builder.log_work_operation()
returns trigger language plpgsql set search_path='' as $$
declare stamp timestamptz := clock_timestamp();
begin
  if (new.phase,new.failures) is distinct from (old.phase,old.failures) then
    insert into corpus_builder.retention_operations(workspace_id,work_id,phase,failure_count,recorded_at,expires_at)
      values(new.workspace_id,new.id,new.phase,new.failures,stamp,stamp+interval '2160 hours');
  end if;
  return new;
end $$;
create trigger corpus_retention_work_operation after update on corpus_builder.acquisition_work
  for each row execute function corpus_builder.log_work_operation();

create function public.corpus_builder_purge_operations(p_principal text,p_workspace uuid,p_actor text,p_limit integer)
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  if p_limit is null or p_limit not between 1 and 500 then
    raise invalid_parameter_value using message='Invalid operational cleanup limit';
  end if;
  delete from corpus_builder.retention_operations where workspace_id=p_workspace and id in (
    select id from corpus_builder.retention_operations where workspace_id=p_workspace and expires_at<=clock_timestamp()
      order by expires_at,id limit p_limit
  );
  get diagnostics removed=row_count;
  if removed>0 then perform corpus_builder.audit(p_workspace,p_actor,'operations.purged',p_workspace); end if;
  return removed;
end $$;

alter table corpus_builder.revision_expirations enable row level security;
alter table corpus_builder.revision_artifacts enable row level security;
alter table corpus_builder.retention_operations enable row level security;
revoke all on corpus_builder.revision_expirations,corpus_builder.revision_artifacts,corpus_builder.retention_operations
  from public,anon,authenticated,authenticator,service_role;
revoke all on function corpus_builder.revision_available(uuid,uuid),corpus_builder.log_work_operation()
  from public,anon,authenticated,authenticator,service_role;
create trigger corpus_retention_expiration_immutable before update or delete on corpus_builder.revision_expirations
  for each row execute function corpus_builder.immutable();
create trigger corpus_retention_expiration_no_truncate before truncate on corpus_builder.revision_expirations
  for each statement execute function corpus_builder.immutable();

do $$
declare fn regprocedure;
begin
  foreach fn in array array[
    'public.corpus_builder_expire_revisions(text,uuid,text,timestamptz,integer)',
    'public.corpus_builder_revision_artifact_put(text,uuid,text,uuid,uuid,text,jsonb)',
    'public.corpus_builder_revision_artifact_get(text,uuid,text,uuid,uuid)',
    'public.corpus_builder_purge_operations(text,uuid,text,integer)'
  ]::regprocedure[] loop
    execute format('revoke all on function %s from public,anon,authenticated,authenticator,service_role',fn);
    execute format('grant execute on function %s to service_role',fn);
  end loop;
end $$;

create or replace function public.corpus_builder_page(p_principal text, p_workspace uuid, p_actor text,
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
  -- Existing checkpoints use their original digest even if their historic shape differs.
  if exists (
    select 1 from jsonb_array_elements(p_rows) as row(value)
    where jsonb_typeof(value) is distinct from 'object'
       or case when jsonb_typeof(value)='object' then
          value - array['post_id','content','collected_at','published_at','source_url','author_key','engagement','match_kind'] <> '{}'::jsonb
          else false end
  ) then raise invalid_parameter_value using message='Unexpected normalized source field'; end if;
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
      insert into corpus_builder.source_content(workspace_id,revision_id,content,expires_at,retention_policy_ref)
        values(p_workspace,revision,item.row->>'content',collected + make_interval(days => protocol.retain_days),
          protocol.retention_policy_ref);
    else
      select id into strict revision from corpus_builder.source_revisions
        where workspace_id=p_workspace and record_id=source.id and content_digest=content_hash;
      -- Reobservation never lengthens retention, and a stricter protocol can shorten it.
      update corpus_builder.source_content
        set retention_policy_ref=case
              when collected + make_interval(days => protocol.retain_days)<expires_at
                then protocol.retention_policy_ref else retention_policy_ref end,
            expires_at=least(expires_at,collected + make_interval(days => protocol.retain_days))
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

create or replace function public.corpus_builder_withdraw(p_principal text,p_workspace uuid,p_actor text,p_record uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  source corpus_builder.social_records;
begin
  perform corpus_builder.guard(p_principal,p_workspace,p_actor,true);
  select * into source from corpus_builder.social_records where workspace_id=p_workspace and id=p_record;
  if not found then raise insufficient_privilege using message = 'Source unavailable'; end if;
  if p_reason is distinct from 'withdrawn' then
    raise invalid_parameter_value using message = 'Invalid withdrawal reason';
  end if;
  if source.withdrawn_at is not null then return; end if;
  update corpus_builder.social_records set native_post_id=null,withdrawn_at=clock_timestamp()
    where workspace_id=p_workspace and id=p_record;
  delete from corpus_builder.source_content c using corpus_builder.source_revisions v
    where (c.workspace_id,c.revision_id)=(v.workspace_id,v.id) and v.workspace_id=p_workspace and v.record_id=p_record;
  delete from corpus_builder.observation_details d using corpus_builder.observations o
    where (d.workspace_id,d.observation_id)=(o.workspace_id,o.id) and o.workspace_id=p_workspace and o.record_id=p_record;
  delete from corpus_builder.revision_artifacts a using corpus_builder.source_revisions v
    where (a.workspace_id,a.revision_id)=(v.workspace_id,v.id) and v.workspace_id=p_workspace and v.record_id=p_record;
  insert into corpus_builder.version_invalidations(workspace_id,version_id,record_id,reason)
    select p_workspace,v.id,p_record,p_reason from corpus_builder.versions v join corpus_builder.frame_entries e
      on (e.workspace_id,e.frame_id)=(v.workspace_id,v.frame_id)
    where v.workspace_id=p_workspace and e.record_id=p_record;
  perform corpus_builder.audit(p_workspace,p_actor,'source.'||p_reason,p_record);
end $$;
commit;
