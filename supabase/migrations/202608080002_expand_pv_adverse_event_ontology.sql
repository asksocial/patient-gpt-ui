alter table public.pv_detection_libraries
  add column if not exists expected_event_terms text[] not null default '{}';

alter table public.pv_records
  add column if not exists data_origin text not null default 'unknown',
  add column if not exists ae_ontology jsonb not null default '{}',
  add column if not exists ontology_version text not null default 'pv-ae-ontology-1.0.0';

alter table public.pv_records
  drop constraint if exists pv_records_data_origin_check;

alter table public.pv_records
  add constraint pv_records_data_origin_check
  check (data_origin in ('live','curated','unknown'));

alter table public.pv_reviews
  add column if not exists validated_ae_ontology jsonb not null default '{}';

create index if not exists pv_records_ontology_queue_idx
  on public.pv_records (principal_id, data_origin, status, identified_at desc);

comment on column public.pv_records.ae_ontology is
  'Machine-proposed product/procedure, event, seriousness criteria, outcome, onset, severity, expectedness, and reporter causality language. Requires qualified human review.';

comment on column public.pv_reviews.validated_ae_ontology is
  'Reviewer-confirmed PV ontology retained separately from the immutable source evidence and machine proposal.';
