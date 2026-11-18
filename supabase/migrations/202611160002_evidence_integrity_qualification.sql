begin;
create table public.evidence_qualification_policies (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null references public.intelligence_workspaces(id),
 version text not null, config jsonb not null, policy_hash text not null, rationale text not null check(length(rationale)>=50),
 created_by text not null, created_at timestamptz not null default clock_timestamp(),
 unique(principal_id,workspace_id,version), unique(principal_id,workspace_id,id)
);
create table public.evidence_analytical_bindings (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, monitor_id uuid not null,
 area_key text not null, module_key text not null default '', revision integer not null default 1,
 qualification_policy_id uuid not null, dataset_fingerprint text not null, active_snapshot_id uuid, created_by text not null,
 foreign key(principal_id,workspace_id,monitor_id) references public.evidence_integrity_monitors(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,qualification_policy_id) references public.evidence_qualification_policies(principal_id,workspace_id,id),
 unique(principal_id,workspace_id,area_key,module_key), unique(principal_id,workspace_id,id)
);
create table public.evidence_analytical_binding_events (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, binding_id uuid not null,
 revision integer not null, configuration jsonb not null, actor_id text not null, reason text not null, recorded_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,binding_id) references public.evidence_analytical_bindings(principal_id,workspace_id,id), unique(binding_id,revision)
);
create table public.evidence_qualification_snapshots (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, binding_id uuid not null, binding_revision integer not null,
 cycle_id uuid not null, qualification_policy_id uuid not null, methodology_version text not null default 'qualification-3.0.0' check(methodology_version='qualification-3.0.0'),
 status text not null default 'building' check(status in ('building','sealed')), cursor integer not null default -1, snapshot_hash text, metrics jsonb,
 created_at timestamptz not null default clock_timestamp(), sealed_at timestamptz,
 foreign key(principal_id,workspace_id,binding_id) references public.evidence_analytical_bindings(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,cycle_id) references public.evidence_integrity_cycles(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,qualification_policy_id) references public.evidence_qualification_policies(principal_id,workspace_id,id),
 unique(binding_id,binding_revision,cycle_id), unique(principal_id,workspace_id,id)
);
alter table public.evidence_analytical_bindings add foreign key(principal_id,workspace_id,active_snapshot_id) references public.evidence_qualification_snapshots(principal_id,workspace_id,id);
create table public.evidence_qualification_entries (
 principal_id text not null, workspace_id uuid not null, snapshot_id uuid not null, source_revision_id uuid not null,
 ordinal integer not null, count_unit_id uuid not null, counted boolean not null, amplification boolean not null,
 category text not null check(category in ('eligible','flagged_retained','separately_analyzed')),
 flags text[] not null, assessed boolean not null, observations integer not null, technical_repeats integer not null check(technical_repeats>=0),
 established_repost boolean not null, root_limitation text,
 primary key(snapshot_id,source_revision_id), unique(snapshot_id,ordinal),
 foreign key(principal_id,workspace_id,snapshot_id) references public.evidence_qualification_snapshots(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,source_revision_id) references public.evidence_source_revisions(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,count_unit_id) references public.evidence_source_records(principal_id,workspace_id,id)
);
create function public.guard_evidence_snapshot() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' or old.status='sealed' then raise exception 'Sealed qualification snapshots are immutable'; end if; return new;
end $$;
create trigger evidence_snapshot_immutable before update or delete on public.evidence_qualification_snapshots for each row execute function public.guard_evidence_snapshot();

create function public.register_evidence_qualification_policy(p_principal text,p_workspace uuid,p_actor text,p_version text,p_config jsonb,p_rationale text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_qualification_policies; h text; f jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 if nullif(btrim(p_version),'') is null or length(p_version)>100 or p_config-array['countingMode','comparisonFlags']<>'{}' or p_config->>'countingMode' is null or p_config->>'countingMode' not in ('all_eligible_posts','unique_original_content','original_plus_amplification') or jsonb_typeof(p_config->'comparisonFlags') is distinct from 'array' then raise exception 'Only conservative counting policies are supported'; end if;
 for f in select value from jsonb_array_elements(p_config->'comparisonFlags') loop
  if f#>>'{}' not in ('suspected_automation','suspected_coordination','potential_synthetic_content') then raise exception 'Invalid comparison flag'; end if;
 end loop;
 h:=encode(sha256(convert_to(p_config::text,'UTF8')),'hex');
 select * into v from public.evidence_qualification_policies where principal_id=p_principal and workspace_id=p_workspace and version=p_version;
 if found then if v.policy_hash<>h or v.rationale<>p_rationale then raise exception 'Qualification policy version is immutable'; end if; return to_jsonb(v); end if;
 insert into public.evidence_qualification_policies(principal_id,workspace_id,version,config,policy_hash,rationale,created_by) values(p_principal,p_workspace,p_version,p_config,h,p_rationale,p_actor) returning * into v;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'qualification.policy.create',v.id,jsonb_build_object('policyHash',h)); return to_jsonb(v);
end $$;
create function public.bind_evidence_analytics(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.evidence_analytical_bindings; m public.evidence_integrity_monitors;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 select * into m from public.evidence_integrity_monitors where id=p_monitor and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Monitor outside binding scope'; end if;
 if m.file_area is not null and (m.file_area is distinct from p_input->>'areaKey' or coalesce(m.file_module,'') is distinct from coalesce(p_input->>'moduleKey','')) then raise exception 'Binding must match monitored file topic and module'; end if;
 if length(coalesce(p_input->>'reason',''))<10 or nullif(p_input->>'areaKey','') is null or coalesce(p_input->>'datasetFingerprint','') !~ '^[a-f0-9]{64}$' then raise exception 'Approved source binding required'; end if;
 select * into b from public.evidence_analytical_bindings where principal_id=p_principal and workspace_id=p_workspace and area_key=p_input->>'areaKey' and module_key=coalesce(p_input->>'moduleKey','') for update;
 if found then
  if b.revision is distinct from (p_input->>'expectedRevision')::integer then raise exception 'Binding revision conflict'; end if;
  update public.evidence_analytical_bindings set monitor_id=p_monitor,qualification_policy_id=(p_input->>'qualificationPolicyId')::uuid,dataset_fingerprint=p_input->>'datasetFingerprint',revision=revision+1,active_snapshot_id=null,created_by=p_actor where id=b.id returning * into b;
 else
  if coalesce((p_input->>'expectedRevision')::integer,0)<>0 then raise exception 'Binding revision conflict'; end if;
  insert into public.evidence_analytical_bindings(principal_id,workspace_id,monitor_id,area_key,module_key,qualification_policy_id,dataset_fingerprint,created_by) values(p_principal,p_workspace,p_monitor,p_input->>'areaKey',coalesce(p_input->>'moduleKey',''),(p_input->>'qualificationPolicyId')::uuid,p_input->>'datasetFingerprint',p_actor) returning * into b;
 end if;
 insert into public.evidence_analytical_binding_events(principal_id,workspace_id,binding_id,revision,configuration,actor_id,reason) values(p_principal,p_workspace,b.id,b.revision,to_jsonb(b),p_actor,p_input->>'reason');
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'qualification.binding.configure',b.id,jsonb_build_object('revision',b.revision,'policyId',b.qualification_policy_id)); return to_jsonb(b);
end $$;

-- Only explicit native IDs/URLs resolve repost equivalence. Similar wording and
-- shared patient experiences never establish a common analytical count unit.
create function public.resolve_evidence_original(p_run uuid,p_revision uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare initial_source uuid; current_revision uuid:=p_revision; current_source uuid; f jsonb; platform_name text; namespace_name text; parent_id text; parent_url text; next_revision uuid; matches integer; visited uuid[]:='{}'; depth integer;
begin
 select r.source_record_id into initial_source from public.evidence_source_revisions r where id=p_revision;
 for depth in 1..16 loop
  select r.source_record_id,r.original_fields,s.platform,s.source_namespace into current_source,f,platform_name,namespace_name from public.evidence_source_revisions r join public.evidence_source_records s on s.id=r.source_record_id where r.id=current_revision;
  if current_source=any(visited) then return jsonb_build_object('root',initial_source,'established',false,'limitation','cyclic_repost_metadata'); end if;
  visited:=array_append(visited,current_source);
  parent_id:=nullif(coalesce(f->>'repostOfSourceIdentifier',f->>'Original Post ID'),''); parent_url:=nullif(coalesce(f->>'repostOfUrl',f->>'Original Post URL'),'');
  if parent_id is null and parent_url is null then return jsonb_build_object('root',current_source,'established',current_source<>initial_source,'limitation',null); end if;
  select count(*),(array_agg(i.source_revision_id order by i.source_key))[1] into matches,next_revision from public.evidence_assessment_inputs i join public.evidence_source_records s on s.id=i.source_record_id where i.run_id=p_run and ((parent_id is not null and s.source_identifier=parent_id and s.platform=platform_name and s.source_namespace=namespace_name) or (parent_url is not null and i.provenance->>'sourceUrl'=parent_url));
  if matches<>1 then return jsonb_build_object('root',initial_source,'established',false,'limitation','original_reference_missing_or_ambiguous'); end if;
  current_revision:=next_revision;
 end loop;
 return jsonb_build_object('root',initial_source,'established',false,'limitation','repost_chain_limit');
end $$;
create function public.build_evidence_qualification(p_principal text,p_workspace uuid,p_actor text,p_cycle uuid,p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.evidence_integrity_cycles; m public.evidence_integrity_monitors; b public.evidence_analytical_bindings; q public.evidence_qualification_policies; s public.evidence_qualification_snapshots; item record; root jsonb; screen public.evidence_screenings; row_flags text[]; v_observations integer; comparisons text[]; cursor_value integer; total integer; v_metrics jsonb; h text;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 if p_limit not between 1 and 500 then raise exception 'Invalid qualification page size'; end if;
 select * into c from public.evidence_integrity_cycles where id=p_cycle and principal_id=p_principal and workspace_id=p_workspace and status in ('completed','dead_letter');
 if not found then return '[]'; end if;
 select * into m from public.evidence_integrity_monitors where id=c.monitor_id;
 -- Historical cycles are retained but cannot replace the current policy view.
 if c.monitor_revision<>m.revision then return '[]'; end if;
 for b in select * from public.evidence_analytical_bindings where monitor_id=m.id loop
  select * into q from public.evidence_qualification_policies where id=b.qualification_policy_id;
  select coalesce(array_agg(value),'{}') into comparisons from jsonb_array_elements_text(q.config->'comparisonFlags');
  select * into s from public.evidence_qualification_snapshots where binding_id=b.id and binding_revision=b.revision and cycle_id=c.id;
  if not found then
   insert into public.evidence_qualification_snapshots(principal_id,workspace_id,binding_id,binding_revision,cycle_id,qualification_policy_id) values(p_principal,p_workspace,b.id,b.revision,c.id,q.id) returning * into s;
  end if;
  if s.status='sealed' then continue; end if;
  cursor_value:=s.cursor;
  for item in select i.*,r.source_record_id as record_id from public.evidence_assessment_inputs i join public.evidence_source_revisions r on r.id=i.source_revision_id where run_id=c.assessment_run_id and ordinal>s.cursor order by ordinal limit p_limit loop
   root:=public.resolve_evidence_original(c.assessment_run_id,item.source_revision_id);
   select sc.* into screen from public.evidence_screenings sc join public.evidence_assessments a on a.id=sc.assessment_id where a.run_id=c.assessment_run_id and a.source_revision_id=item.source_revision_id and sc.screening_policy_id=c.screening_policy_id;
   row_flags:=coalesce(screen.flags,'{}');
   select count(*) into v_observations from public.evidence_source_observations o join public.evidence_source_revisions r on r.id=o.source_revision_id join public.evidence_ingestion_batches batch on batch.id=o.batch_id where r.source_record_id=item.record_id and batch.corpus_id=m.corpus_id and batch.import_sequence<=c.source_sequence;
   insert into public.evidence_qualification_entries values(p_principal,p_workspace,s.id,item.source_revision_id,item.ordinal,(root->>'root')::uuid,q.config->>'countingMode'='all_eligible_posts' or not (root->>'established')::boolean,(root->>'established')::boolean,case when row_flags && comparisons then 'separately_analyzed' when cardinality(row_flags)>0 then 'flagged_retained' else 'eligible' end,row_flags,screen.id is not null,v_observations,greatest(v_observations-1,0),(root->>'established')::boolean,root->>'limitation') on conflict do nothing;
   cursor_value:=item.ordinal;
  end loop;
  select count(*) into total from public.evidence_assessment_inputs where run_id=c.assessment_run_id;
  update public.evidence_qualification_snapshots set cursor=cursor_value where id=s.id;
  if cursor_value>=total-1 then
   select jsonb_build_object('collectedRecords',coalesce(sum(observations),0),'uniqueSourceRecords',count(*),'analyticallyCountedRecords',count(*) filter(where counted),'technicalRepeatOccurrences',coalesce(sum(technical_repeats),0),'amplificationRecords',count(*) filter(where amplification),'assessedRecords',count(*) filter(where assessed),'retainedWithFlags',count(*) filter(where cardinality(flags)>0),'separateComparisonRecords',count(*) filter(where category='separately_analyzed'),'insufficientEvidenceRecords',count(*) filter(where 'insufficient_evidence'=any(flags)),'suspectedActivityRecords',count(*) filter(where flags && array['suspected_automation','suspected_coordination']),'countingMode',q.config->>'countingMode','methodologyVersion','qualification-3.0.0') into v_metrics from public.evidence_qualification_entries where snapshot_id=s.id;
   h:=encode(sha256(convert_to(jsonb_build_object('cycleId',c.id,'bindingRevision',b.revision,'policyHash',q.policy_hash,'entries',(select coalesce(jsonb_agg(to_jsonb(e) order by ordinal),'[]') from public.evidence_qualification_entries e where snapshot_id=s.id))::text,'UTF8')),'hex');
   update public.evidence_qualification_snapshots set status='sealed',sealed_at=clock_timestamp(),snapshot_hash=h,metrics=v_metrics where id=s.id returning * into s;
   update public.evidence_analytical_bindings set active_snapshot_id=s.id where id=b.id and revision=s.binding_revision;
   perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'qualification.snapshot.seal',s.id,jsonb_build_object('snapshotHash',h,'policyId',q.id,'sourceRecords',total));
  end if;
 end loop;
 return coalesce((select jsonb_agg(to_jsonb(x)) from public.evidence_qualification_snapshots x where cycle_id=c.id),'[]');
end $$;
create function public.read_evidence_qualification(p_principal text,p_workspace uuid,p_actor text,p_snapshot uuid,p_after integer default -1,p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.evidence_qualification_snapshots; rows jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 if p_limit not between 1 and 500 or p_after < -1 then raise exception 'Invalid qualification read bounds'; end if;
 select * into s from public.evidence_qualification_snapshots where id=p_snapshot and principal_id=p_principal and workspace_id=p_workspace and status='sealed';
 if not found then raise exception 'Sealed snapshot unavailable'; end if;
 select coalesce(jsonb_agg(value order by ordinal),'[]') into rows from (
  select e.ordinal,jsonb_build_object('ordinal',e.ordinal,'sourceRevisionId',r.id,'sourceRecordId',r.source_record_id,'sourceKey',src.record_key,'sourceIdentifier',src.source_identifier,'sourceUrl',i.provenance->>'sourceUrl','publishedAt',i.published_at,'platform',src.platform,'sourceNamespace',src.source_namespace,'originalFields',r.original_fields,'contentHash',r.content_hash,'countUnitId',e.count_unit_id,'counted',e.counted,'amplification',e.amplification,'establishedRepost',e.established_repost,'category',e.category,'flags',e.flags,'observations',e.observations,'technicalRepeats',e.technical_repeats,'assessed',e.assessed,'rootLimitation',e.root_limitation) as value
  from public.evidence_qualification_entries e join public.evidence_source_revisions r on r.id=e.source_revision_id join public.evidence_source_records src on src.id=r.source_record_id join public.evidence_integrity_cycles c on c.id=s.cycle_id join public.evidence_assessment_inputs i on i.run_id=c.assessment_run_id and i.source_revision_id=r.id where e.snapshot_id=s.id and e.ordinal>p_after order by e.ordinal limit p_limit
 ) page;
 return jsonb_build_object('snapshot',to_jsonb(s),'entries',rows);
end $$;
create function public.resolve_evidence_binding(p_principal text,p_workspace uuid,p_actor text,p_area text,p_module text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.evidence_analytical_bindings; s public.evidence_qualification_snapshots; c public.evidence_integrity_cycles; m public.evidence_integrity_monitors;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 select * into b from public.evidence_analytical_bindings where principal_id=p_principal and workspace_id=p_workspace and area_key=p_area and module_key=p_module;
 if not found then return null; end if;
 select * into s from public.evidence_qualification_snapshots where id=b.active_snapshot_id and status='sealed';
 select * into c from public.evidence_integrity_cycles where id=s.cycle_id;
 select * into m from public.evidence_integrity_monitors where id=b.monitor_id;
 if s.id is null or b.revision<>s.binding_revision or c.monitor_revision<>m.revision or c.source_sequence<>(select max(import_sequence) from public.evidence_ingestion_batches where corpus_id=m.corpus_id) then return jsonb_build_object('binding',to_jsonb(b),'snapshot',null); end if;
 return jsonb_build_object('binding',to_jsonb(b),'snapshot',to_jsonb(s));
end $$;

do $$ declare t text; begin
 foreach t in array array['evidence_qualification_policies','evidence_analytical_bindings','evidence_analytical_binding_events','evidence_qualification_snapshots','evidence_qualification_entries'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  if t not in ('evidence_analytical_bindings','evidence_qualification_snapshots') then execute format('create trigger evidence_qualification_immutable before update or delete on public.%I for each row execute function public.evidence_foundation_immutable()',t); end if;
  execute format('create trigger evidence_qualification_no_truncate before truncate on public.%I execute function public.evidence_foundation_immutable()',t);
 end loop;
end $$;
revoke all on function public.guard_evidence_snapshot(),public.resolve_evidence_original(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.register_evidence_qualification_policy(text,uuid,text,text,jsonb,text),public.bind_evidence_analytics(text,uuid,text,uuid,jsonb),public.build_evidence_qualification(text,uuid,text,uuid,integer),public.read_evidence_qualification(text,uuid,text,uuid,integer,integer),public.resolve_evidence_binding(text,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.register_evidence_qualification_policy(text,uuid,text,text,jsonb,text),public.bind_evidence_analytics(text,uuid,text,uuid,jsonb),public.build_evidence_qualification(text,uuid,text,uuid,integer),public.read_evidence_qualification(text,uuid,text,uuid,integer,integer),public.resolve_evidence_binding(text,uuid,text,text,text) to service_role;
commit;
