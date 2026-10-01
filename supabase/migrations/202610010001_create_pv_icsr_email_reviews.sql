-- Additive intake/email layer. No changes to PV detection, regulatory clocks, or transfers.
create table public.pv_icsr_cases (
  record_id uuid primary key references public.pv_records(id) on delete restrict,
  principal_id text not null,
  revision integer not null check (revision > 0),
  snapshot jsonb not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);
create index pv_icsr_cases_principal_idx on public.pv_icsr_cases(principal_id, updated_at desc);
create table public.pv_icsr_case_revisions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.pv_records(id) on delete restrict,
  principal_id text not null,
  revision integer not null,
  action text not null,
  snapshot jsonb not null,
  changes jsonb not null,
  reviewer_id text not null,
  reviewed_at timestamptz not null default now(),
  unique(record_id, revision)
);
create index pv_icsr_revisions_principal_idx on public.pv_icsr_case_revisions(principal_id, record_id, revision desc);
alter table public.pv_icsr_cases enable row level security;
alter table public.pv_icsr_case_revisions enable row level security;
-- Existing PV uses server service-role access plus explicit principal predicates. No public policies.
revoke all on public.pv_icsr_cases, public.pv_icsr_case_revisions from anon, authenticated;
grant select, insert, update on public.pv_icsr_cases to service_role;
grant select, insert on public.pv_icsr_case_revisions to service_role;
create function public.pv_icsr_prevent_revision_change() returns trigger language plpgsql as $$
begin raise exception 'ICSR revisions are append-only'; end;
$$;
create trigger pv_icsr_revision_immutable before update or delete on public.pv_icsr_case_revisions
for each row execute function public.pv_icsr_prevent_revision_change();

-- Transactional compare-and-swap: reviewer changes, status, and revision ledger commit together.
create function public.save_pv_icsr_revision(
  p_record_id uuid, p_principal_id text, p_actor_id text, p_expected_revision integer,
  p_action text, p_snapshot jsonb, p_changes jsonb
) returns integer language plpgsql security definer set search_path = public as $$
declare v_revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_record_id::text, 0));
  if not exists(select 1 from public.pv_records where id = p_record_id and principal_id = p_principal_id) then
    raise exception 'PV record not found';
  end if;
  select revision into v_revision from public.pv_icsr_cases where record_id = p_record_id and principal_id = p_principal_id;
  v_revision := coalesce(v_revision, 0);
  if v_revision <> p_expected_revision then raise exception 'ICSR revision conflict'; end if;
  if p_snapshot->>'revision' <> (v_revision + 1)::text or p_snapshot->'caseData'->>'id' <> p_record_id::text then
    raise exception 'Invalid ICSR snapshot';
  end if;
  if v_revision > 0 and p_snapshot->'originalExtraction' is distinct from
    (select snapshot->'originalExtraction' from public.pv_icsr_cases where record_id = p_record_id) then
    raise exception 'Original extraction is immutable';
  end if;
  insert into public.pv_icsr_cases(record_id, principal_id, revision, snapshot, updated_by)
  values(p_record_id, p_principal_id, v_revision + 1, p_snapshot, p_actor_id)
  on conflict(record_id) do update set revision = excluded.revision, snapshot = excluded.snapshot,
    updated_by = excluded.updated_by, updated_at = now();
  insert into public.pv_icsr_case_revisions(record_id, principal_id, revision, action, snapshot, changes, reviewer_id)
  values(p_record_id, p_principal_id, v_revision + 1, p_action, p_snapshot, p_changes, p_actor_id);
  return v_revision + 1;
end;
$$;
revoke all on function public.save_pv_icsr_revision(uuid,text,text,integer,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_pv_icsr_revision(uuid,text,text,integer,text,jsonb,jsonb) to service_role;
comment on table public.pv_icsr_case_revisions is 'Immutable original extraction and human-reviewed revisions, actor, timestamp, changed paths, and email edits. No regulatory submission or transmission.';
