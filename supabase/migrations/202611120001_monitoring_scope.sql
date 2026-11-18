alter table public.intelligence_monitoring_profiles
  add column if not exists criteria jsonb not null default '{}'::jsonb;

alter table public.intelligence_monitoring_profiles
  add constraint intelligence_monitoring_profiles_criteria_object
  check (jsonb_typeof(criteria) = 'object');

comment on column public.intelligence_monitoring_profiles.criteria is
  'Explicit keyword matching and source-country/region scope applied before every monitor analysis. Empty object preserves legacy profiles.';
