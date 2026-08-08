alter table public.intelligence_workspaces
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by text;

create table if not exists public.intelligence_workspace_members (
  workspace_id uuid not null references public.intelligence_workspaces(id) on delete cascade,
  principal_id text not null,
  user_id text not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  added_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

insert into public.intelligence_workspace_members (
  workspace_id,
  principal_id,
  user_id,
  role,
  added_by
)
select
  workspace.id,
  workspace.principal_id,
  workspace.created_by,
  'owner',
  workspace.created_by
from public.intelligence_workspaces workspace
on conflict (workspace_id, user_id) do nothing;

create index if not exists intelligence_workspace_members_user_idx
  on public.intelligence_workspace_members (principal_id, user_id, updated_at desc);

create index if not exists intelligence_workspaces_active_idx
  on public.intelligence_workspaces (principal_id, archived_at, updated_at desc);

alter table public.intelligence_workspace_members enable row level security;

comment on table public.intelligence_workspace_members is
  'Explicit workspace membership and owner/editor/viewer access for AskSocial workspaces.';
