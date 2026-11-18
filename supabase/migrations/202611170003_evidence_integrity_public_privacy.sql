begin;
-- Exact percentages from successive public snapshots permit differencing even
-- when both complementary cells exceed ten. Internal metrics remain intact.
-- All client assessment/suspected/insufficient rates are withheld until an
-- independently accepted longitudinal disclosure mechanism is available.
create or replace function public.evidence_public_rate(p_n integer,p_d integer)
returns numeric language sql immutable set search_path=public,pg_temp as $$ select null::numeric $$;
revoke all on function public.evidence_public_rate(integer,integer) from public,anon,authenticated,service_role;
commit;
