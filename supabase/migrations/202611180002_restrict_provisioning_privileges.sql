-- Keep provisioning writes inside the existing audited SECURITY DEFINER RPC.
begin;

revoke all privileges on table public.user_provisioning
  from public, anon, authenticated, service_role, authenticator;
grant select on table public.user_provisioning to service_role;

revoke all privileges on table public.user_therapeutic_access
  from public, anon, authenticated, authenticator;

-- Table-level revocation does not remove grants made on individual columns.
do $$
declare
  provisioning_columns text;
  topic_columns text;
begin
  select string_agg(format('%I', attname), ', ' order by attnum) into provisioning_columns
  from pg_attribute where attrelid = 'public.user_provisioning'::regclass
    and attnum > 0 and not attisdropped;
  select string_agg(format('%I', attname), ', ' order by attnum) into topic_columns
  from pg_attribute where attrelid = 'public.user_therapeutic_access'::regclass
    and attnum > 0 and not attisdropped;

  execute format('revoke all privileges (%s) on table public.user_provisioning
    from public, anon, authenticated, service_role, authenticator', provisioning_columns);
  execute format('revoke all privileges (%s) on table public.user_therapeutic_access
    from public, anon, authenticated, authenticator', topic_columns);
end $$;

grant select (clerk_user_id, organization_id, therapeutic_area)
  on table public.user_therapeutic_access to authenticated;

revoke all on function public.change_user_provisioning(text,text,uuid,integer,text,text,text,text[],text,text)
  from public, anon, authenticated, service_role, authenticator;
grant execute on function public.change_user_provisioning(text,text,uuid,integer,text,text,text,text[],text,text)
  to service_role;

-- Check effective grants and roles reachable through SET ROLE or ADMIN OPTION.
-- The connection role may switch to the expected API roles.
do $$
declare
  provisioning oid := 'public.user_provisioning'::regclass;
  topics oid := 'public.user_therapeutic_access'::regclass;
  transition oid := 'public.change_user_provisioning(text,text,uuid,integer,text,text,text,text[],text,text)'::regprocedure;
  predicate oid := 'public.has_active_managed_topic_scope(text,text)'::regprocedure;
  required_columns text[] := array['clerk_user_id', 'organization_id', 'therapeutic_area'];
  actor record;
begin
  if exists (
    select 1 from pg_proc where oid in (transition, predicate)
      and (not prosecdef or not coalesce(proconfig @> array['search_path=""'], false))
  ) then
    raise exception 'Provisioning RPC security definition differs from the reviewed baseline';
  end if;

  for actor in
    with recursive reachable (root, role_id) as (
      select rolname, oid from pg_roles
      where rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
      union
      select reachable.root, membership.roleid
      from reachable join pg_auth_members membership on membership.member = reachable.role_id
      where membership.set_option or membership.admin_option
    )
    select distinct root, role_id, rolname, rolsuper, rolcreaterole from reachable
    join pg_roles on oid = role_id
  loop
    if actor.root <> 'authenticator' and actor.root <> actor.rolname
      and actor.rolname in ('authenticated', 'service_role') then
      raise exception 'Unexpected API role switch from % to %', actor.root, actor.rolname;
    end if;

    if actor.rolsuper or actor.rolcreaterole or exists (
      select 1 from pg_class where oid in (provisioning, topics)
        and pg_has_role(actor.role_id, relowner, 'USAGE')
      union all
      select 1 from pg_proc where oid in (transition, predicate)
        and pg_has_role(actor.role_id, proowner, 'USAGE')
    ) then
      raise exception 'Provisioning owner or privileged role is reachable through %', actor.rolname;
    end if;

    if has_table_privilege(actor.role_id, provisioning, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
      or has_any_column_privilege(actor.role_id, provisioning, 'INSERT, UPDATE, REFERENCES')
      or has_table_privilege(actor.role_id, provisioning, 'SELECT WITH GRANT OPTION')
      or has_any_column_privilege(actor.role_id, provisioning, 'SELECT WITH GRANT OPTION')
      or has_any_column_privilege(actor.role_id, provisioning, 'SELECT') is distinct from (actor.rolname = 'service_role')
      or has_function_privilege(actor.role_id, transition, 'EXECUTE WITH GRANT OPTION')
      or has_function_privilege(actor.role_id, transition, 'EXECUTE') is distinct from (actor.rolname = 'service_role') then
      raise exception 'Unexpected effective provisioning privileges for %', actor.rolname;
    end if;

    -- Server-side topic administration already uses service_role.
    if actor.rolname <> 'service_role' and (
      has_table_privilege(actor.role_id, topics, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
      or has_any_column_privilege(actor.role_id, topics, 'INSERT, UPDATE, REFERENCES, SELECT WITH GRANT OPTION')
      or exists (
        select 1 from pg_attribute
        where attrelid = topics and attnum > 0 and not attisdropped
          and has_column_privilege(actor.role_id, topics, attnum, 'SELECT')
            is distinct from (actor.rolname = 'authenticated' and attname = any(required_columns))
      )
    ) then
      raise exception 'Unexpected effective therapeutic-access privileges for %', actor.rolname;
    end if;
  end loop;

  if not has_table_privilege('service_role', provisioning, 'SELECT')
    or not has_function_privilege('authenticated', predicate, 'EXECUTE')
    or not exists (select 1 from pg_class where oid = topics and relrowsecurity)
    or not exists (select 1 from pg_class where oid = provisioning and relrowsecurity) then
    raise exception 'Required provisioning read or row-security contract is absent';
  end if;
end $$;

commit;
