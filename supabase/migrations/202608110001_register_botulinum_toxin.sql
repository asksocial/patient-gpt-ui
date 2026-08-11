insert into public.therapeutic_areas (name, slug, is_active, sort_order)
values ('Botulinum toxin', 'botulinum-toxin', true, 6)
on conflict (name) do update
set slug = excluded.slug,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

insert into public.user_therapeutic_access (clerk_user_id, therapeutic_area)
select distinct clerk_user_id, 'Botulinum toxin'
from public.user_therapeutic_access
where nullif(trim(clerk_user_id), '') is not null
on conflict (clerk_user_id, therapeutic_area) do nothing;
