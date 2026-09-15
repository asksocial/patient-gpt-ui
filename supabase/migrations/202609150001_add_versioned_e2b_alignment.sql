alter table public.pv_records
  add column if not exists algorithm_assessed_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists client_notified_at timestamptz;

comment on column public.pv_records.algorithm_assessed_at is 'AskSocial-only timestamp for classifier completion; distinct from collection/ingestion time.';
comment on column public.pv_records.escalated_at is 'AskSocial-only timestamp when a qualified reviewer escalated the record for sponsor handoff.';
comment on column public.pv_records.client_notified_at is 'AskSocial-only timestamp recorded only after successful governed client notification.';

update public.pv_records
set algorithm_assessed_at = created_at
where algorithm_assessed_at is null;

alter table public.pv_reviews
  add column if not exists e2b_mapping_version text;

alter table public.pv_transfers
  add column if not exists e2b_mapping_version text,
  add column if not exists email_mapping_version text,
  add column if not exists ich_package_version text,
  add column if not exists controlled_terminology_version text;

create table if not exists public.pv_case_relationships (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  source_record_id uuid not null references public.pv_records(id) on delete restrict,
  target_record_id uuid not null references public.pv_records(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('possible_duplicate_of','confirmed_duplicate_of','follow_up_to','repost_of','related_case')),
  status text not null default 'proposed' check (status in ('proposed','human_confirmed','rejected')),
  match_confidence numeric(6,5) check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  rationale jsonb not null default '[]',
  evidence_snapshot jsonb not null default '{}',
  proposed_by text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_record_id <> target_record_id),
  unique (principal_id, source_record_id, target_record_id, relationship_type)
);

create index if not exists pv_case_relationships_source_idx on public.pv_case_relationships (principal_id, source_record_id, status);
create index if not exists pv_case_relationships_target_idx on public.pv_case_relationships (principal_id, target_record_id, status);
alter table public.pv_case_relationships enable row level security;

comment on table public.pv_case_relationships is 'Non-destructive, tenant-scoped PV duplicate, repost, follow-up, and related-case links with rationale and confidence.';
comment on column public.pv_case_relationships.evidence_snapshot is 'Evidence supporting the relationship decision; original pv_records remain immutable.';
