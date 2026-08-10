create table if not exists public.pv_import_batches (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  library_id uuid not null references public.pv_detection_libraries(id) on delete restrict,
  source_id uuid references public.pv_sources(id) on delete set null,
  file_name text not null,
  file_hash text not null,
  data_origin text not null check (data_origin in ('live','curated')),
  date_column text not null,
  content_columns text[] not null default '{}',
  source_url_column text,
  external_id_column text,
  uploaded_by text not null,
  uploaded_at timestamptz not null,
  available_at timestamptz not null,
  day_zero_basis text not null default 'identified_at' check (day_zero_basis = 'identified_at'),
  row_count integer not null default 0 check (row_count >= 0),
  screened_count integer not null default 0 check (screened_count >= 0),
  routed_count integer not null default 0 check (routed_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null default 'processing' check (status in ('processing','completed','completed_with_errors','failed')),
  error_summary jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (principal_id, file_hash)
);

alter table public.pv_records
  add column if not exists import_batch_id uuid references public.pv_import_batches(id) on delete restrict,
  add column if not exists source_row_number integer,
  add column if not exists posted_at_source_column text,
  add column if not exists posted_at_raw_value text,
  add column if not exists day_zero_basis text not null default 'posted_at',
  add column if not exists day_zero_reason text;

alter table public.pv_records
  drop constraint if exists pv_records_day_zero_basis_check;

alter table public.pv_records
  add constraint pv_records_day_zero_basis_check
  check (day_zero_basis in ('posted_at','identified_at'));

create index if not exists pv_import_batches_availability_idx
  on public.pv_import_batches (principal_id, available_at desc);

create index if not exists pv_records_import_batch_idx
  on public.pv_records (import_batch_id, source_row_number);

alter table public.pv_import_batches enable row level security;

comment on column public.pv_import_batches.available_at is
  'Server timestamp when the uploaded CSV became available to the AskSocial tenant; this is the reviewer-identification timestamp and day zero for CSV-imported ODCS content.';

comment on column public.pv_records.posted_at is
  'Original social-post timestamp parsed from the configured CSV date column.';

comment on column public.pv_records.day_zero_basis is
  'Explicit governing clock. CSV imports use identified_at; other governed sources may use posted_at according to the applicable policy.';
