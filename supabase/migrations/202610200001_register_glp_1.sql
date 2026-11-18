-- Register the social intelligence corpus. FAERS/PV configuration is separate.
insert into public.therapeutic_areas (name, slug, is_active, sort_order)
values ('GLP-1', 'glp-1', true, 7)
on conflict (name) do update
set slug = excluded.slug,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

-- Follow the existing corpus rollout policy for users with assigned topics.
insert into public.user_therapeutic_access (clerk_user_id, therapeutic_area)
select distinct clerk_user_id, 'GLP-1'
from public.user_therapeutic_access
where nullif(trim(clerk_user_id), '') is not null
on conflict (clerk_user_id, therapeutic_area) do nothing;
