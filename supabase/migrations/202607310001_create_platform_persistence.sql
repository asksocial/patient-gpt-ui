create extension if not exists pgcrypto;

create table if not exists public.intelligence_workspaces (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  principal_type text not null check (principal_type in ('organization', 'user')),
  name text not null,
  description text,
  therapeutic_area text,
  module_ids text[] not null default '{}',
  settings jsonb not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_work_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.intelligence_workspaces(id) on delete cascade,
  principal_id text not null,
  kind text not null check (
    kind in ('answer', 'report', 'snapshot', 'patient_intelligence', 'monitor_result', 'export')
  ),
  title text not null,
  therapeutic_area text,
  module_id text,
  status text not null default 'draft' check (
    status in ('draft', 'ready', 'approved', 'archived')
  ),
  payload jsonb not null,
  provenance jsonb not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_knowledge_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.intelligence_workspaces(id) on delete cascade,
  principal_id text not null,
  entity_key text not null,
  entity_type text not null,
  name text not null,
  aliases text[] not null default '{}',
  attributes jsonb not null default '{}',
  confidence numeric(5, 4) not null default 0 check (confidence >= 0 and confidence <= 1),
  provenance jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, entity_key)
);

create table if not exists public.intelligence_knowledge_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.intelligence_workspaces(id) on delete cascade,
  principal_id text not null,
  relationship_key text not null,
  relationship_type text not null,
  from_entity_id uuid not null references public.intelligence_knowledge_entities(id) on delete cascade,
  to_entity_id uuid not null references public.intelligence_knowledge_entities(id) on delete cascade,
  attributes jsonb not null default '{}',
  confidence numeric(5, 4) not null default 0 check (confidence >= 0 and confidence <= 1),
  provenance jsonb not null default '[]',
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, relationship_key)
);

create table if not exists public.intelligence_audit_events (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  workspace_id uuid references public.intelligence_workspaces(id) on delete set null,
  actor_id text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text not null check (outcome in ('allowed', 'denied', 'completed', 'failed')),
  metadata jsonb not null default '{}',
  previous_hash text not null,
  event_hash text not null unique,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_workspaces_principal_idx
  on public.intelligence_workspaces (principal_id, updated_at desc);
create index if not exists intelligence_work_products_workspace_idx
  on public.intelligence_work_products (workspace_id, created_at desc);
create index if not exists intelligence_work_products_principal_kind_idx
  on public.intelligence_work_products (principal_id, kind, created_at desc);
create index if not exists intelligence_entities_workspace_type_idx
  on public.intelligence_knowledge_entities (workspace_id, entity_type, name);
create index if not exists intelligence_relationships_workspace_type_idx
  on public.intelligence_knowledge_relationships (workspace_id, relationship_type, observed_at desc);
create index if not exists intelligence_audit_principal_idx
  on public.intelligence_audit_events (principal_id, occurred_at desc);

alter table public.intelligence_workspaces enable row level security;
alter table public.intelligence_work_products enable row level security;
alter table public.intelligence_knowledge_entities enable row level security;
alter table public.intelligence_knowledge_relationships enable row level security;
alter table public.intelligence_audit_events enable row level security;

alter table if exists public.chat_sessions
  add column if not exists workspace_id uuid references public.intelligence_workspaces(id) on delete set null;

comment on table public.intelligence_workspaces is
  'Tenant-scoped AskSocial workspaces. Access is mediated by authenticated server routes with explicit principal filtering.';
comment on table public.intelligence_work_products is
  'Persistent evidence-backed answers, reports, snapshots, and application outputs.';
comment on table public.intelligence_audit_events is
  'Append-only hash-chained audit events for governed platform activity.';
