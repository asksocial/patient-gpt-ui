create table if not exists public.pv_review_lists (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  therapeutic_area text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','exported','archived')),
  assigned_to text,
  shared_emails text[] not null default '{}',
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pv_review_list_items (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  list_id uuid not null references public.pv_review_lists(id) on delete cascade,
  record_id uuid not null references public.pv_records(id) on delete restrict,
  note text,
  added_by text not null,
  added_at timestamptz not null default now(),
  unique (list_id, record_id)
);

create index if not exists pv_review_lists_scope_idx
  on public.pv_review_lists (principal_id, therapeutic_area, updated_at desc);

create index if not exists pv_review_list_items_list_idx
  on public.pv_review_list_items (list_id, added_at);

alter table public.pv_review_lists enable row level security;
alter table public.pv_review_list_items enable row level security;

comment on table public.pv_review_lists is
  'Tenant- and therapeutic-area-scoped aggregate lists of potential PV mentions selected for coordinated human review.';

comment on table public.pv_review_list_items is
  'References immutable PV records without copying or altering original evidence.';
