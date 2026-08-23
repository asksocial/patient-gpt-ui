alter table public.pv_records
  add column if not exists reportability_identified_at timestamptz;

alter table public.pv_records
  drop constraint if exists pv_records_day_zero_basis_check;

alter table public.pv_records
  add constraint pv_records_day_zero_basis_check
  check (day_zero_basis in ('posted_at', 'identified_at', 'reportability_identified_at'));

alter table public.pv_sla_policies
  drop constraint if exists pv_sla_policies_clock_start_check;

alter table public.pv_sla_policies
  add constraint pv_sla_policies_clock_start_check
  check (clock_start in ('posted_at', 'ingested_at', 'identified_at', 'reportability_identified_at'));

alter table public.pv_import_batches
  drop constraint if exists pv_import_batches_day_zero_basis_check;

alter table public.pv_import_batches
  add constraint pv_import_batches_day_zero_basis_check
  check (day_zero_basis in ('identified_at', 'reportability_identified_at'));

update public.pv_records
set day_zero_basis = 'reportability_identified_at',
    day_zero_reason = 'Day Zero starts only when a qualified reviewer confirms the minimum ICSR criteria.'
where import_batch_id is not null
  and reportability_identified_at is null;

update public.pv_import_batches
set day_zero_basis = 'reportability_identified_at'
where day_zero_basis = 'identified_at';

with first_escalation as (
  select distinct on (record_id)
    record_id,
    reviewed_at
  from public.pv_reviews
  where decision = 'escalate'
  order by record_id, reviewed_at asc
)
update public.pv_records as record
set reportability_identified_at = first_escalation.reviewed_at,
    day_zero_basis = 'reportability_identified_at',
    day_zero_reason = 'Day Zero began when a qualified reviewer escalated the AE/ADR for sponsor handoff.'
from first_escalation
where record.id = first_escalation.record_id
  and record.reportability_identified_at is null;

create index if not exists pv_records_reportability_review_idx
  on public.pv_records (principal_id, reportability_identified_at desc)
  where reportability_identified_at is not null;

comment on column public.pv_records.identified_at is
  'Server timestamp when the content became available to AskSocial for review. This availability timestamp does not start Day Zero for imported external-platform social data.';

comment on column public.pv_records.reportability_identified_at is
  'First qualified-human-review timestamp at which the minimum ICSR criteria were confirmed. This is the Day Zero trigger for imported external-platform social data and is immutable once set.';

comment on column public.pv_records.day_zero_basis is
  'Explicit governing clock. Imported external-platform social data uses reportability_identified_at; controlled sources may use another governed basis under the applicable policy.';

comment on column public.pv_import_batches.available_at is
  'Server timestamp when the uploaded CSV became available to the AskSocial tenant. It preserves acquisition chronology but does not start Day Zero before qualified reportability review.';
