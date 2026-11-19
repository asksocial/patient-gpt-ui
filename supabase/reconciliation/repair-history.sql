-- Run within a single transaction after reviewing the historical baseline and applying the schema repair.
-- Resolve schema_migrations with search_path = pg_catalog, supabase_migrations, pg_temp.
-- A hosted rehearsal may instead select a temporary ledger explicitly.
set local lock_timeout = '5s';
set local statement_timeout = '2min';

do $$
declare
  ledger_schema text;
  observed text[];
  observed_versions text[];
  baseline constant text[] := array[
    '20260823232148:remote_schema',
    '202610010001:create_pv_icsr_email_reviews',
    '202610170001:odcs_service_controls',
    '202610190001:pv_reportability_identification',
    '202610200002:structured_review_email_queue',
    '202610290001:pv_legacy_audit_compatibility',
    '202611020001:incomplete_pv_screening',
    '202611020002:pv_review_audit_revision',
    '202611120001:monitoring_scope'
  ];
  repaired constant text[] := array[
    '202607160001:create_application_foundation',
    '202607170001:create_theme_knowledge_store',
    '202607310001:create_platform_persistence',
    '202607310002:create_saved_intelligence_library',
    '202607310003:create_continuous_intelligence',
    '202608060001:create_pv_compliance_services',
    '202608080001:create_workspace_management',
    '202608080002:expand_pv_adverse_event_ontology',
    '202608100001:create_pv_csv_imports',
    '202608110001:register_botulinum_toxin',
    '202608110002:scope_pv_corpora',
    '202608110003:create_pv_review_lists',
    '202608230001:start_day_zero_at_reportability_review',
    '202608230002:add_pv_review_start',
    '202608230003:generalize_pv_reporter_enrichment',
    '202609110001:add_pv_health_experience_reclassification',
    '202609150001:add_versioned_e2b_alignment',
    '202610200001:register_glp_1'
  ];
  expected text[];
begin
  select n.nspname into ledger_schema
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.oid = to_regclass('schema_migrations') and c.relkind = 'r'
    and (n.nspname = 'supabase_migrations' or n.oid = pg_my_temp_schema());
  if ledger_schema is null then
    raise exception 'Select the Supabase migration ledger or the session-local rehearsal ledger explicitly.';
  end if;

  -- Serialize with other history writers for the duration of this transaction.
  lock table schema_migrations in share row exclusive mode;
  -- Supabase can store null historical display names. Compare the recorded
  -- baseline by version and independently verify the snapshot name and size.
  select array_agg(version order by version), array_agg(version || ':' || coalesce(name,'') order by version)
    into observed_versions, observed from schema_migrations;

  if not exists (
    select 1 from schema_migrations where version = '20260823232148' and name = 'remote_schema'
      and cardinality(statements) = 426
  ) then
    raise exception 'Expected remote_schema snapshot is absent or differs.';
  end if;

  select array_agg(version order by version) into expected
    from (select split_part(entry, ':', 1) as version from unnest(baseline || repaired) as entries(entry)) as versions;
  if observed_versions = expected then
    if not (observed @> repaired) then
      raise exception 'Historical repair entries exist under unexpected names.';
    end if;
  elsif observed_versions is distinct from (
    select array_agg(split_part(entry, ':', 1) order by entry) from unnest(baseline) as entries(entry)
  ) then
    raise exception 'Migration history differs from the reviewed baseline. Observed versions: %', observed_versions;
  end if;

  if 10 <> (
    select count(*) from (values
      ('therapeutic_areas_active_sort_idx', 'therapeutic_areas', 'is_active, sort_order, name'),
      ('user_therapeutic_access_user_idx', 'user_therapeutic_access', 'clerk_user_id, therapeutic_area'),
      ('chat_sessions_user_updated_idx', 'chat_sessions', 'user_id, updated_at DESC'),
      ('chat_messages_session_created_idx', 'chat_messages', 'session_id, created_at'),
      ('curated_insights_area_idx', 'curated_insights', 'therapeutic_area, created_at DESC'),
      ('curated_themes_area_idx', 'curated_themes', 'therapeutic_area, created_at DESC'),
      ('live_themes_area_idx', 'live_themes', 'therapeutic_area, created_at DESC'),
      ('theme_matches_area_idx', 'theme_matches', 'therapeutic_area, created_at DESC'),
      ('knowledge_snapshots_scope_created_idx', 'knowledge_snapshots', 'principal_id, therapeutic_area, created_at DESC'),
      ('theme_knowledge_records_theme_history_idx', 'theme_knowledge_records', 'principal_id, therapeutic_area, theme_id, created_at DESC')
    ) as expected_index(index_name, table_name, columns)
    join pg_index i on i.indexrelid = to_regclass('public.' || index_name)
    where i.indisvalid and i.indisready and pg_get_indexdef(i.indexrelid) =
      format('CREATE INDEX %I ON public.%I USING btree (%s)', index_name, table_name, columns)
  ) then
    raise exception 'One or more reconciled index definitions are missing or differ.';
  end if;

  if 2 <> (
    select count(*) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
      and c.relname in ('knowledge_snapshots', 'theme_knowledge_records')
  ) or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename in ('knowledge_snapshots', 'theme_knowledge_records')
  ) then
    raise exception 'Knowledge store tables or their expected RLS configuration differ.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'intelligence_knowledge_relationships'
      and column_name = 'provenance' and udt_name = 'jsonb'
      and is_nullable = 'NO' and column_default = '''[]''::jsonb'
  ) then
    raise exception 'Relationship provenance is missing or differs.';
  end if;

  if 2 <> (
    select count(*) from public.therapeutic_areas
    where is_active and (
      (name = 'Botulinum toxin' and slug = 'botulinum-toxin' and sort_order = 6) or
      (name = 'GLP-1' and slug = 'glp-1' and sort_order = 7)
    )
  ) then
    raise exception 'Historical topic registry entries differ. Preserve current grants and review the registry.';
  end if;

  if observed_versions = expected then
    return;
  end if;

  -- These versions are baselined from observed effects. Leave statements null
  -- to avoid recording historical grant/backfill SQL as if this run executed it.
  insert into schema_migrations (version, name)
  select split_part(entry, ':', 1), split_part(entry, ':', 2) from unnest(repaired) as entries(entry);
end;
$$;
