create extension if not exists pgcrypto;

create table if not exists public.knowledge_snapshots (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  principal_type text not null check (
    principal_type in ('organization', 'user')
  ),
  therapeutic_area text not null,
  snapshot_key text not null,
  schema_version text not null,
  content_hash text not null,
  analysis_start date,
  analysis_end date,
  granularity text,
  dataset_finding_count integer not null default 0 check (
    dataset_finding_count >= 0
  ),
  dated_finding_count integer not null default 0 check (
    dated_finding_count >= 0
  ),
  temporal_coverage_percent numeric(7, 2) not null default 0 check (
    temporal_coverage_percent >= 0 and
    temporal_coverage_percent <= 100
  ),
  source_query text,
  created_by text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    principal_id,
    therapeutic_area,
    snapshot_key
  )
);

create table if not exists public.theme_knowledge_records (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.knowledge_snapshots(id) on delete cascade,
  principal_id text not null,
  therapeutic_area text not null,
  theme_id text not null,
  theme_label text not null,
  eligible_percent numeric(7, 2) not null default 0,
  evidence_weighted_percent numeric(7, 2) not null default 0,
  confidence text not null,
  triangulation text not null,
  trajectory text not null,
  percentage_point_change numeric(8, 2) not null default 0,
  persistence_percent numeric(7, 2) not null default 0,
  record_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (snapshot_id, theme_id)
);

create index if not exists knowledge_snapshots_scope_created_idx
  on public.knowledge_snapshots (
    principal_id,
    therapeutic_area,
    created_at desc
  );

create index if not exists theme_knowledge_records_theme_history_idx
  on public.theme_knowledge_records (
    principal_id,
    therapeutic_area,
    theme_id,
    created_at desc
  );

alter table public.knowledge_snapshots enable row level security;
alter table public.theme_knowledge_records enable row level security;

comment on table public.knowledge_snapshots is
  'Versioned AskSocial intelligence snapshots. Access is mediated by server routes using the service role and explicit principal scoping.';

comment on table public.theme_knowledge_records is
  'Queryable per-theme records derived from immutable knowledge snapshots.';
