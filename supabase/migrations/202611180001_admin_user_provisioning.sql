-- Clerk remains the identity and organization provider. This table tracks the
-- application-side provisioning lifecycle and the managed account's access.
create table public.user_provisioning (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  clerk_user_id text unique,
  recipient_clerk_user_id text,
  organization_id text,
  account_role text not null check (account_role in ('platform_admin', 'client_admin', 'client_analyst', 'viewer')),
  state text not null default 'pending' check (state in ('pending', 'active', 'suspended')),
  topics text[] not null default '{}',
  invitation_id text,
  delivery_state text not null default 'unsent' check (delivery_state in ('unsent', 'sending', 'sent', 'failed')),
  delivery_started_at timestamptz,
  revision integer not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  check ((account_role = 'platform_admin') = (organization_id is null)),
  check (account_role <> 'platform_admin' or cardinality(topics) = 0),
  check (state = 'pending' or clerk_user_id is not null)
);

alter table public.user_provisioning enable row level security;
revoke all on public.user_provisioning from public, anon, authenticated;
grant select on public.user_provisioning to service_role;

alter table public.chat_sessions add column organization_id text;
create index chat_sessions_user_org_idx on public.chat_sessions (user_id, organization_id, updated_at desc);

alter table public.user_therapeutic_access
  add column organization_id text not null default '';
alter table public.user_therapeutic_access
  drop constraint if exists user_therapeutic_access_clerk_user_id_therapeutic_area_key,
  drop constraint if exists user_therapeutic_access_unique;
-- The hosted preview uses this name for the legacy unique index.
drop index if exists public.user_therapeutic_access_unique;
alter table public.user_therapeutic_access
  add unique (clerk_user_id, organization_id, therapeutic_area);

-- This predicate exposes only a boolean for the caller's authenticated identity.
create function public.has_active_managed_topic_scope(target_org text, target_topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_provisioning p
    where p.clerk_user_id = (select auth.jwt()->>'sub')
      and p.organization_id = target_org and p.state = 'active'
      and target_org = (select auth.jwt() #>> '{o,id}')
  ) and exists (
    select 1 from public.therapeutic_areas a
    join public.user_therapeutic_access g on g.therapeutic_area = a.name
    where a.name = target_topic and a.is_active and g.organization_id = target_org
      and g.clerk_user_id = (select auth.jwt()->>'sub')
  );
$$;
revoke all on function public.has_active_managed_topic_scope(text,text) from public, anon;
grant execute on function public.has_active_managed_topic_scope(text,text) to authenticated;
grant select (clerk_user_id, organization_id, therapeutic_area) on public.user_therapeutic_access to authenticated;

create policy managed_users_read_own_active_topic_grants
  on public.user_therapeutic_access for select to authenticated
  using (
    organization_id <> ''
    and clerk_user_id = (select auth.jwt()->>'sub')
    and public.has_active_managed_topic_scope(organization_id, therapeutic_area)
  );

-- All platform audit callers share this per-principal lock and tail ordering.
create function public.append_intelligence_audit_event(
  p_principal text, p_actor text, p_action text, p_resource_type text,
  p_outcome text, p_resource_id text default null, p_workspace uuid default null,
  p_metadata jsonb default '{}', p_occurred_at timestamptz default null
) returns public.intelligence_audit_events
language plpgsql security invoker set search_path = ''
as $$
declare
  prior_hash text;
  prior_time timestamptz;
  event_time timestamptz;
  event_row public.intelligence_audit_events;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_principal, 191));
  select a.event_hash, a.occurred_at into prior_hash, prior_time
    from public.intelligence_audit_events a where a.principal_id = p_principal
    order by a.occurred_at desc, a.id desc limit 1;
  prior_hash := coalesce(prior_hash, 'GENESIS');
  event_time := greatest(coalesce(p_occurred_at, clock_timestamp()), prior_time + interval '1 microsecond');
  insert into public.intelligence_audit_events (
    principal_id, workspace_id, actor_id, action, resource_type, resource_id,
    outcome, metadata, previous_hash, event_hash, occurred_at
  ) values (
    p_principal, p_workspace, p_actor, p_action, p_resource_type, p_resource_id,
    p_outcome, p_metadata, prior_hash,
    encode(sha256(convert_to(jsonb_build_array(p_principal, p_actor, p_action,
      p_resource_type, p_outcome, p_resource_id, p_workspace, p_metadata,
      extract(epoch from event_time), prior_hash)::text, 'UTF8')), 'hex'),
    event_time
  ) returning * into event_row;
  return event_row;
end;
$$;
revoke all on function public.append_intelligence_audit_event(text,text,text,text,text,text,uuid,jsonb,timestamptz) from public, anon, authenticated;
grant select, insert on public.intelligence_audit_events to service_role;
grant execute on function public.append_intelligence_audit_event(text,text,text,text,text,text,uuid,jsonb,timestamptz) to service_role;

-- The trusted application verifies the Clerk admin or invitation proof before
-- calling this RPC. The DB owns revision checks, state transitions, grants,
-- and the audit event for each committed transition.
create function public.change_user_provisioning(
  p_action text, p_actor text, p_id uuid default null, p_revision integer default null,
  p_email text default null, p_org text default null, p_role text default null,
  p_topics text[] default null, p_user text default null, p_invitation text default null
) returns public.user_provisioning
language plpgsql security definer set search_path = ''
as $$
declare
  account public.user_provisioning;
  before_account public.user_provisioning;
  result text := 'completed';
  managed_actor public.user_provisioning;
begin
  if p_actor is null or p_actor = '' then raise exception 'Actor required'; end if;
  if p_action <> 'activate' or p_actor is distinct from p_user then
    select * into managed_actor from public.user_provisioning where clerk_user_id = p_actor for share;
    if found and (managed_actor.account_role <> 'platform_admin' or managed_actor.state <> 'active') then
      raise exception using errcode = '42501', message = 'Active Platform Admin access is required';
    end if;
  end if;
  if p_action = 'reserve' then
    insert into public.user_provisioning (email, organization_id, account_role, topics, recipient_clerk_user_id)
      values (p_email, p_org, p_role, coalesce(p_topics, '{}'), p_user)
      returning * into account;
  else
    select * into account from public.user_provisioning where id = p_id for update;
    if not found or account.revision is distinct from p_revision then
      raise exception using errcode = '40001', message = 'Account changed. Reload and retry.';
    end if;
    before_account := account;
    case p_action
      when 'send' then
        if account.state <> 'pending' or (account.delivery_state = 'sending'
          and account.delivery_started_at > clock_timestamp() - interval '5 minutes') then
          raise exception using errcode = '40001', message = 'Invitation unavailable or already sending.';
        end if;
        account.delivery_state := 'sending';
        account.delivery_started_at := clock_timestamp();
      when 'sent', 'delivery_failed' then
        if account.delivery_state <> 'sending' then raise exception 'No delivery in progress'; end if;
        account.delivery_state := case when p_action = 'sent' then 'sent' else 'failed' end;
        account.invitation_id := coalesce(p_invitation, account.invitation_id);
        if p_action = 'delivery_failed' then result := 'failed'; end if;
      when 'activate' then
        if account.state <> 'pending' or p_user is null or p_user = ''
          or (account.recipient_clerk_user_id is not null and account.recipient_clerk_user_id <> p_user) then
          raise exception 'Account cannot be activated';
        end if;
        account.clerk_user_id := p_user;
        account.state := 'active';
      when 'update_access' then
        if p_role is null or (p_role = 'platform_admin') <> (account.organization_id is null) then
          raise exception 'Cannot move an account between platform and client roles';
        end if;
        account.account_role := p_role;
        account.topics := coalesce(p_topics, '{}');
      when 'suspend', 'restore' then
        if account.clerk_user_id = p_actor then raise exception 'Cannot change your own account status'; end if;
        if (p_action = 'suspend' and account.state <> 'active') or (p_action = 'restore' and account.state <> 'suspended') then
          raise exception 'Invalid account status transition';
        end if;
        account.state := case when p_action = 'suspend' then 'suspended' else 'active' end;
      else raise exception 'Unknown provisioning action';
    end case;

    update public.user_provisioning set clerk_user_id = account.clerk_user_id,
      account_role = account.account_role, state = account.state, topics = account.topics,
      invitation_id = account.invitation_id, delivery_state = account.delivery_state,
      delivery_started_at = account.delivery_started_at, revision = account.revision + 1,
      updated_at = clock_timestamp()
      where id = p_id returning * into account;
  end if;

  if (select count(*) from public.therapeutic_areas a
    where a.is_active and a.name = any(account.topics)) <> cardinality(account.topics)
    and p_action in ('reserve', 'update_access', 'activate') then
    raise exception 'Topics must be unique and active';
  end if;

  if account.clerk_user_id is not null and account.organization_id is not null
    and p_action in ('activate', 'update_access') then
    delete from public.user_therapeutic_access
      where clerk_user_id = account.clerk_user_id and organization_id = account.organization_id
        and not (therapeutic_area = any(account.topics));
    insert into public.user_therapeutic_access (clerk_user_id, organization_id, therapeutic_area)
      select account.clerk_user_id, account.organization_id, topic from unnest(account.topics) topic
      on conflict (clerk_user_id, organization_id, therapeutic_area) do nothing;
  end if;

  perform public.append_intelligence_audit_event(
    coalesce(account.organization_id, 'asksocial:platform'), p_actor,
    'user_provisioning.' || p_action, 'user_provisioning', result, account.id::text,
    p_metadata => jsonb_build_object('userId', account.clerk_user_id,
      'role', account.account_role, 'previousRole', before_account.account_role,
      'state', account.state, 'previousState', before_account.state,
      'topics', account.topics, 'previousTopics', before_account.topics,
      'deliveryState', account.delivery_state, 'previousDeliveryState', before_account.delivery_state)
  );
  return account;
end;
$$;
revoke all on function public.change_user_provisioning(text,text,uuid,integer,text,text,text,text[],text,text)
  from public, anon, authenticated;
grant execute on function public.change_user_provisioning(text,text,uuid,integer,text,text,text,text[],text,text)
  to service_role;
