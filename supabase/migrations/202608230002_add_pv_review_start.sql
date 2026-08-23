alter table public.pv_records
  add column if not exists review_started_at timestamptz,
  add column if not exists review_started_by text;

create index if not exists pv_records_review_started_idx
  on public.pv_records (principal_id, review_started_at desc)
  where review_started_at is not null;

comment on column public.pv_records.review_started_at is
  'Immutable timestamp recorded when an authorized reviewer first continues from the full mention into structured review. It documents review initiation and does not itself start Day Zero.';

comment on column public.pv_records.review_started_by is
  'Actor who first continued the record into structured review.';
