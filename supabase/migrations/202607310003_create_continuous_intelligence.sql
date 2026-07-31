create table if not exists public.intelligence_monitoring_profiles (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  owner_id text not null,
  workspace_id uuid not null references public.intelligence_workspaces(id) on delete cascade,
  name text not null,
  monitor_type text not null check (monitor_type in ('theme_shift', 'patient_signal', 'narrative', 'competitor')),
  therapeutic_area text not null,
  query text not null,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  threshold numeric(8, 2) not null default 5 check (threshold >= 0),
  delivery_channels text[] not null default '{in_app}',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  last_run_at timestamptz,
  next_run_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_monitor_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.intelligence_monitoring_profiles(id) on delete cascade,
  principal_id text not null,
  workspace_id uuid not null references public.intelligence_workspaces(id) on delete cascade,
  status text not null check (status in ('completed', 'failed')),
  summary text,
  signal_value numeric(10, 2),
  previous_signal_value numeric(10, 2),
  change_value numeric(10, 2),
  payload jsonb not null default '{}',
  error text,
  started_at timestamptz not null,
  completed_at timestamptz not null
);

create table if not exists public.intelligence_alerts (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  workspace_id uuid not null references public.intelligence_workspaces(id) on delete cascade,
  profile_id uuid not null references public.intelligence_monitoring_profiles(id) on delete cascade,
  run_id uuid not null references public.intelligence_monitor_runs(id) on delete cascade,
  severity text not null check (severity in ('info', 'watch', 'material')),
  title text not null,
  summary text not null,
  evidence jsonb not null default '[]',
  status text not null default 'unread' check (status in ('unread', 'read', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  workspace_id uuid not null references public.intelligence_workspaces(id) on delete cascade,
  profile_id uuid references public.intelligence_monitoring_profiles(id) on delete set null,
  run_id uuid references public.intelligence_monitor_runs(id) on delete set null,
  channel text not null check (channel in ('in_app', 'email', 'slack', 'teams')),
  recipient text,
  subject text not null,
  payload jsonb not null,
  status text not null check (status in ('delivered', 'queued', 'failed', 'suppressed')),
  status_detail text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists monitoring_profiles_due_idx
  on public.intelligence_monitoring_profiles (status, next_run_at);
create index if not exists monitor_runs_profile_idx
  on public.intelligence_monitor_runs (profile_id, completed_at desc);
create index if not exists alerts_principal_idx
  on public.intelligence_alerts (principal_id, status, created_at desc);
create index if not exists delivery_outbox_status_idx
  on public.intelligence_delivery_outbox (status, channel, created_at);

alter table public.intelligence_monitoring_profiles enable row level security;
alter table public.intelligence_monitor_runs enable row level security;
alter table public.intelligence_alerts enable row level security;
alter table public.intelligence_delivery_outbox enable row level security;

comment on table public.intelligence_delivery_outbox is
  'Governed report and alert delivery queue. External channels remain queued until a configured connector dispatches them.';
