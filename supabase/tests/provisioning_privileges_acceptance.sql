-- Run as the migration owner on a disposable Supabase-profile database.
begin;

do $$
declare
  transition regprocedure := 'public.change_user_provisioning(text,text,uuid,integer,text,text,text,text[],text,text)'::regprocedure;
  actual_columns text[];
begin
  if not exists (select 1 from pg_proc where oid = transition and prosecdef
    and proconfig @> array['search_path=""'])
    or not has_function_privilege('service_role', transition, 'EXECUTE')
    or has_function_privilege('anon', transition, 'EXECUTE')
    or has_function_privilege('authenticated', transition, 'EXECUTE')
    or has_function_privilege('authenticator', transition, 'EXECUTE') then
    raise exception 'Unexpected transition execution contract';
  end if;

  if not has_table_privilege('service_role', 'public.user_provisioning', 'SELECT')
    or has_table_privilege('service_role', 'public.user_provisioning', 'INSERT, UPDATE, DELETE, TRUNCATE')
    or has_any_column_privilege('service_role', 'public.user_provisioning', 'INSERT, UPDATE') then
    raise exception 'Unexpected effective provisioning rights';
  end if;

  select array_agg(attname::text order by attname) into actual_columns
  from pg_attribute where attrelid = 'public.user_therapeutic_access'::regclass
    and attnum > 0 and not attisdropped
    and has_column_privilege('authenticated', attrelid, attnum, 'SELECT');
  if actual_columns is distinct from array['clerk_user_id', 'organization_id', 'therapeutic_area']
    or has_table_privilege('authenticated', 'public.user_therapeutic_access', 'SELECT') then
    raise exception 'Unexpected therapeutic access projection';
  end if;
end $$;

insert into public.therapeutic_areas (name, is_active)
values ('Gate 1A synthetic topic', true);

set local role service_role;
do $$
declare
  account public.user_provisioning;
  operation text;
begin
  account := public.change_user_provisioning('reserve', 'gate1a_admin',
    p_email => 'gate1a@example.invalid', p_org => 'org_gate1a_acceptance',
    p_role => 'viewer', p_topics => array['Gate 1A synthetic topic']);

  foreach operation in array array[
    $sql$INSERT INTO public.user_provisioning (email, account_role) VALUES ('denied@example.invalid', 'platform_admin')$sql$,
    format('UPDATE public.user_provisioning SET revision = 99 WHERE id = %L', account.id),
    format('DELETE FROM public.user_provisioning WHERE id = %L', account.id)
  ] loop
    begin
      execute operation;
      raise exception 'Direct provisioning mutation unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
  end loop;

  account := public.change_user_provisioning('activate', 'gate1a_recipient',
    account.id, account.revision, p_user => 'gate1a_recipient');
  if account.state is distinct from 'active' or account.revision is distinct from 1
    or (select count(*) from public.intelligence_audit_events
        where principal_id = 'org_gate1a_acceptance' and resource_id = account.id::text
          and action in ('user_provisioning.reserve', 'user_provisioning.activate')) <> 2 then
    raise exception 'Expected an active account with exactly two audited transitions';
  end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"gate1a_recipient","o":{"id":"org_gate1a_acceptance"}}', true);
do $$
begin
  if (select array_agg(therapeutic_area) from public.user_therapeutic_access
      where clerk_user_id = 'gate1a_recipient' and organization_id = 'org_gate1a_acceptance')
    is distinct from array['Gate 1A synthetic topic'] then
    raise exception 'Expected one topic for the active account';
  end if;

  perform set_config('request.jwt.claims', '{"sub":"gate1a_recipient","o":{"id":"org_gate1a_other"}}', true);
  if exists (select therapeutic_area from public.user_therapeutic_access) then
    raise exception 'Topic grants crossed organization boundaries';
  end if;
end $$;

rollback;
