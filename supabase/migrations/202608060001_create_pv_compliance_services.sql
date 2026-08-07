create extension if not exists pgcrypto;

create table if not exists public.pv_detection_libraries (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  name text not null,
  sponsor_name text,
  product_id text,
  market text,
  language text not null default 'en',
  detection_threshold numeric(5,2) not null default 55 check (detection_threshold between 1 and 100),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','active','retired')),
  approved_by text,
  approved_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pv_detection_concepts (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.pv_detection_libraries(id) on delete cascade,
  principal_id text not null,
  category text not null check (category in ('product','adverse_experience','severity','treatment_change','lack_of_efficacy','medication_error','overdose','pregnancy','misuse_abuse','product_quality')),
  canonical_term text not null,
  terms text[] not null,
  exclusions text[] not null default '{}',
  product_id text,
  language text not null default 'en',
  market text,
  weight numeric(5,2) not null default 50 check (weight between 0 and 100),
  active_from timestamptz,
  active_until timestamptz,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pv_sources (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  name text not null,
  source_type text not null,
  source_url text not null,
  ownership_classification text not null check (ownership_classification in ('controlled','owned','discovered')),
  sponsor_name text,
  business_owner text,
  products text[] not null default '{}',
  markets text[] not null default '{}',
  languages text[] not null default '{en}',
  cadence_minutes integer not null check (cadence_minutes > 0),
  effective_at timestamptz not null,
  end_at timestamptz,
  active boolean not null default true,
  approved_by text,
  approved_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (principal_id, source_url)
);

create table if not exists public.pv_screening_runs (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  source_id uuid not null references public.pv_sources(id) on delete restrict,
  status text not null check (status in ('running','completed','failed')),
  screened_from timestamptz not null,
  screened_until timestamptz not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  items_screened integer not null default 0 check (items_screened >= 0),
  potential_records integer not null default 0 check (potential_records >= 0),
  nil_return boolean not null default false,
  query_snapshot jsonb not null default '{}',
  error text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pv_sla_policies (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  name text not null,
  review_minutes integer not null check (review_minutes > 0),
  transfer_minutes integer not null check (transfer_minutes > 0),
  acknowledgment_minutes integer not null check (acknowledgment_minutes > 0),
  clock_start text not null default 'posted_at' check (clock_start in ('posted_at','ingested_at','identified_at')),
  timezone text not null default 'UTC',
  active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pv_records (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  external_id text not null,
  source_id uuid references public.pv_sources(id) on delete restrict,
  screening_run_id uuid references public.pv_screening_runs(id) on delete set null,
  library_id uuid references public.pv_detection_libraries(id) on delete restrict,
  sla_policy_id uuid references public.pv_sla_policies(id) on delete restrict,
  status text not null default 'new' check (status in ('new','in_review','not_relevant','ready_for_transfer','transferred','acknowledged','reconciled')),
  priority text not null default 'standard' check (priority in ('standard','high','critical')),
  product_name text,
  potential_event text,
  source_type text not null,
  source_url text not null,
  author_identifier text,
  original_verbatim text not null,
  original_language text not null default 'en',
  translated_text text,
  parent_context text,
  thread_context jsonb not null default '[]',
  immutable_capture_url text,
  evidence_hash text not null,
  posted_at timestamptz not null,
  ingested_at timestamptz not null,
  identified_at timestamptz not null,
  assigned_reviewer_id text,
  detection_score numeric(5,2) not null check (detection_score between 0 and 100),
  product_confidence numeric(5,2) not null check (product_confidence between 0 and 100),
  health_experience_confidence numeric(5,2) not null check (health_experience_confidence between 0 and 100),
  context_confidence numeric(5,2) not null check (context_confidence between 0 and 100),
  matched_concepts jsonb not null default '[]',
  proposed_classifications text[] not null default '{}',
  classifier_version text not null,
  library_version integer not null,
  detection_rationale jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (principal_id, external_id)
);

create table if not exists public.pv_reviews (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  record_id uuid not null references public.pv_records(id) on delete restrict,
  reviewer_id text not null,
  product_mention text not null check (product_mention in ('yes','no','unclear')),
  health_experience text not null check (health_experience in ('yes','no','unclear')),
  classifications text[] not null default '{}',
  rationale text not null,
  decision text not null check (decision in ('escalate','close_not_relevant')),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pv_transfers (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  record_id uuid not null references public.pv_records(id) on delete restrict,
  destination text not null,
  transfer_method text not null check (transfer_method in ('secure_api','sftp','secure_email','manual_export')),
  package_version integer not null default 1,
  payload jsonb not null,
  payload_hash text not null,
  status text not null default 'queued' check (status in ('queued','delivered','acknowledged','failed')),
  transferred_by text not null,
  transferred_at timestamptz,
  acknowledgment_reference text,
  acknowledged_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pv_audit_events (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  actor_id text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text not null check (outcome in ('allowed','denied','completed','failed')),
  metadata jsonb not null default '{}',
  previous_hash text not null,
  event_hash text not null unique,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pv_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null check (status in ('draft','exceptions','reconciled','approved')),
  record_count integer not null default 0,
  transfer_count integer not null default 0,
  acknowledgment_count integer not null default 0,
  issue_count integer not null default 0,
  critical_count integer not null default 0,
  report_payload jsonb not null default '{}',
  prepared_by text not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.pv_reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  reconciliation_run_id uuid not null references public.pv_reconciliation_runs(id) on delete cascade,
  issue_type text not null check (issue_type in ('reviewed_not_transferred','transferred_not_acknowledged','duplicate_transfer','missing_screening_run','missing_nil_return','open_record','timestamp_discrepancy')),
  record_id uuid references public.pv_records(id) on delete restrict,
  source_id uuid references public.pv_sources(id) on delete restrict,
  severity text not null check (severity in ('warning','critical')),
  detail text not null,
  status text not null default 'open' check (status in ('open','explained','resolved')),
  resolution text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pv_records_queue_idx on public.pv_records (principal_id, status, identified_at);
create index if not exists pv_records_clock_idx on public.pv_records (principal_id, posted_at, status);
create index if not exists pv_screening_due_idx on public.pv_sources (principal_id, active, cadence_minutes, updated_at);
create index if not exists pv_reviews_record_idx on public.pv_reviews (record_id, reviewed_at desc);
create unique index if not exists pv_active_transfer_record_idx on public.pv_transfers (record_id) where status in ('queued','delivered','acknowledged');
create index if not exists pv_transfers_status_idx on public.pv_transfers (principal_id, status, created_at);
create index if not exists pv_audit_chain_idx on public.pv_audit_events (principal_id, occurred_at desc);
create index if not exists pv_reconciliation_period_idx on public.pv_reconciliation_runs (principal_id, period_end desc);

alter table public.pv_detection_libraries enable row level security;
alter table public.pv_detection_concepts enable row level security;
alter table public.pv_sources enable row level security;
alter table public.pv_screening_runs enable row level security;
alter table public.pv_sla_policies enable row level security;
alter table public.pv_records enable row level security;
alter table public.pv_reviews enable row level security;
alter table public.pv_transfers enable row level security;
alter table public.pv_audit_events enable row level security;
alter table public.pv_reconciliation_runs enable row level security;
alter table public.pv_reconciliation_issues enable row level security;

comment on table public.pv_records is 'Tenant-scoped potential PV records. Original evidence fields are preserved and must never be overwritten after creation.';
comment on table public.pv_audit_events is 'Append-only hash-chained PV provenance ledger for detection, review, transfer, acknowledgment, and reconciliation.';
comment on table public.pv_transfers is 'Versioned sponsor handoff packages with delivery and acknowledgment status.';
