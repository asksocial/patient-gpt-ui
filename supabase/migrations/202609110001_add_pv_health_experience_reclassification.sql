alter table public.pv_records
  add column if not exists reviewer_detection_segment text,
  add column if not exists reviewer_health_experience_tags text[],
  add column if not exists segment_reclassified_at timestamptz,
  add column if not exists segment_reclassified_by text;

alter table public.pv_records
  drop constraint if exists pv_records_reviewer_detection_segment_check;

alter table public.pv_records
  add constraint pv_records_reviewer_detection_segment_check
  check (reviewer_detection_segment is null or reviewer_detection_segment in ('ae_adr', 'health_experience'));

alter table public.pv_records
  drop constraint if exists pv_records_status_check;

alter table public.pv_records
  add constraint pv_records_status_check
  check (status in ('new', 'in_review', 'health_experience', 'not_relevant', 'ready_for_transfer', 'transferred', 'acknowledged', 'reconciled'));

alter table public.pv_reviews
  drop constraint if exists pv_reviews_decision_check;

alter table public.pv_reviews
  add constraint pv_reviews_decision_check
  check (decision in ('escalate', 'close_not_relevant', 'reclassify_health_experience'));

comment on column public.pv_records.reviewer_detection_segment is
  'Governed human-review override of the immutable automated detection pathway. Null preserves the automated segment.';
comment on column public.pv_records.reviewer_health_experience_tags is
  'Reviewer-confirmed Health Experience categories retained separately from machine-proposed classifications.';
comment on column public.pv_records.segment_reclassified_at is
  'Timestamp of the latest governed reviewer segment reclassification.';
comment on column public.pv_records.segment_reclassified_by is
  'Authorized reviewer who made the latest governed segment reclassification.';
