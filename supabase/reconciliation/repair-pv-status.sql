-- Run within a single transaction. This step is separate from access management.
set local lock_timeout = '5s';
set local statement_timeout = '2min';

do $$
declare
  current_check text;
  expected_prefix constant text := 'CHECK ((status = ANY (ARRAY[';
  four_statuses constant text := '''queued''::text, ''delivered''::text, ''acknowledged''::text, ''failed''::text';
  five_statuses constant text := '''queued''::text, ''provider_accepted''::text, ''delivered''::text, ''acknowledged''::text, ''failed''::text';
  six_statuses constant text := '''queued''::text, ''provider_accepted''::text, ''manual_sent''::text, ''delivered''::text, ''acknowledged''::text, ''failed''::text';
begin
  lock table public.pv_transfers in access exclusive mode;
  select pg_get_constraintdef(oid) into current_check
  from pg_constraint
  where conrelid = 'public.pv_transfers'::regclass and conname = 'pv_transfers_status_check'
    and contype = 'c' and convalidated;

  if current_check = expected_prefix || six_statuses || '])))' then
    return;
  end if;

  if current_check is null or current_check not in (
    expected_prefix || four_statuses || '])))',
    expected_prefix || five_statuses || '])))'
  ) then
    raise exception 'Unexpected PV transfer status constraint: %', current_check;
  end if;

  alter table public.pv_transfers
    drop constraint pv_transfers_status_check,
    add constraint pv_transfers_status_check check
      (status in ('queued', 'provider_accepted', 'manual_sent', 'delivered', 'acknowledged', 'failed'));
end;
$$;
