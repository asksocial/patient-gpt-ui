create table if not exists public.saved_intelligence_searches (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  owner_id text not null,
  workspace_id uuid references public.intelligence_workspaces(id) on delete cascade,
  name text not null,
  query text not null,
  filters jsonb not null default '{}',
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_intelligence_prompts (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  owner_id text not null,
  workspace_id uuid references public.intelligence_workspaces(id) on delete cascade,
  name text not null,
  prompt text not null,
  description text,
  module_id text,
  tags text[] not null default '{}',
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_searches_principal_idx
  on public.saved_intelligence_searches (principal_id, updated_at desc);
create index if not exists saved_prompts_principal_idx
  on public.saved_intelligence_prompts (principal_id, updated_at desc);

alter table public.saved_intelligence_searches enable row level security;
alter table public.saved_intelligence_prompts enable row level security;

comment on table public.saved_intelligence_searches is
  'Saved tenant-scoped cross-workspace intelligence searches.';
comment on table public.saved_intelligence_prompts is
  'Reusable user-owned or organization-shared AskSocial prompt templates.';
