alter table public.pv_detection_libraries
  add column if not exists therapeutic_area text;

alter table public.pv_import_batches
  add column if not exists corpus_id text,
  add column if not exists therapeutic_area text;

alter table public.pv_records
  add column if not exists therapeutic_area text;

create index if not exists pv_import_batches_therapeutic_area_idx
  on public.pv_import_batches (principal_id, therapeutic_area, available_at desc);

create index if not exists pv_records_therapeutic_area_queue_idx
  on public.pv_records (principal_id, therapeutic_area, status, identified_at desc);

create unique index if not exists pv_import_batches_principal_corpus_idx
  on public.pv_import_batches (principal_id, corpus_id)
  where corpus_id is not null;

comment on column public.pv_import_batches.corpus_id is
  'Stable identifier for an AskSocial-governed bundled corpus; prevents the same corpus from being activated twice for a tenant.';

comment on column public.pv_records.therapeutic_area is
  'Therapeutic-area scope used to keep PV review queues aligned with the user-selected corpus.';
