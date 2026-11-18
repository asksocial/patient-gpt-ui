begin;
create table public.evidence_robustness_runs (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, snapshot_id uuid not null,
 input_hash text not null, methodology_version text not null check(methodology_version='robustness-3.0.0'), analytical_method_hash text not null,
 filters jsonb not null, result jsonb not null, created_by text not null, created_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,snapshot_id) references public.evidence_qualification_snapshots(principal_id,workspace_id,id), unique(snapshot_id,input_hash)
);
create table public.evidence_evaluation_sets (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null, snapshot_id uuid not null,
 name text not null, selection_spec jsonb not null default '{}', data_origin text not null check(data_origin in ('real','constructed')), evidence_reference text not null check(length(evidence_reference)>=10),
 created_by text not null, created_at timestamptz not null default clock_timestamp(),
 foreign key(principal_id,workspace_id,snapshot_id) references public.evidence_qualification_snapshots(principal_id,workspace_id,id)
);
create table public.evidence_evaluation_items (
 id uuid primary key default gen_random_uuid(), set_id uuid not null references public.evidence_evaluation_sets(id), source_revision_id uuid not null references public.evidence_source_revisions(id), unique(set_id,source_revision_id), unique(set_id,id)
);
create table public.evidence_evaluation_reviews (
 id uuid primary key default gen_random_uuid(), set_id uuid not null references public.evidence_evaluation_sets(id), item_id uuid not null references public.evidence_evaluation_items(id),
 reviewer_id text not null, labels jsonb not null, rationale text not null check(length(rationale)>=20), reviewed_at timestamptz not null default clock_timestamp(), unique(item_id,reviewer_id), foreign key(set_id,item_id) references public.evidence_evaluation_items(set_id,id)
);
create function public.save_evidence_robustness(p_principal text,p_workspace uuid,p_actor text,p_snapshot uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_robustness_runs; cohort jsonb; ref jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 if not exists(select 1 from public.evidence_qualification_snapshots where id=p_snapshot and principal_id=p_principal and workspace_id=p_workspace and status='sealed') then raise exception 'Snapshot outside comparison scope'; end if;
 if p_result->>'methodologyVersion' is distinct from 'robustness-3.0.0' or p_result->>'snapshotId' is distinct from p_snapshot::text or jsonb_array_length(p_result->'cohorts')<>3 or octet_length(p_result::text)>4194304 then raise exception 'Invalid comparison'; end if;
 for cohort in select value from jsonb_array_elements(p_result->'cohorts') loop
  for ref in select value from jsonb_array_elements(cohort->'sourceRecordIds') loop
   if not exists(select 1 from public.evidence_qualification_entries e join public.evidence_source_revisions r on r.id=e.source_revision_id where e.snapshot_id=p_snapshot and r.source_record_id=(ref#>>'{}')::uuid) then raise exception 'Comparison source outside snapshot'; end if;
  end loop;
 end loop;
 select * into v from public.evidence_robustness_runs where snapshot_id=p_snapshot and input_hash=p_result->>'inputHash';
 if found then return to_jsonb(v); end if;
 insert into public.evidence_robustness_runs(principal_id,workspace_id,snapshot_id,input_hash,methodology_version,analytical_method_hash,filters,result,created_by) values(p_principal,p_workspace,p_snapshot,p_result->>'inputHash','robustness-3.0.0',p_result->>'analyticalMethodHash',p_result->'filters',p_result,p_actor) returning * into v;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'robustness.compare',v.id,jsonb_build_object('snapshotId',p_snapshot,'inputHash',v.input_hash)); return to_jsonb(v);
end $$;
create function public.create_evidence_evaluation_set(p_principal text,p_workspace uuid,p_actor text,p_snapshot uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_evaluation_sets; n integer;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 if not exists(select 1 from public.evidence_qualification_snapshots where id=p_snapshot and principal_id=p_principal and workspace_id=p_workspace and status='sealed') then raise exception 'Snapshot outside evaluation scope'; end if;
 n:=(p_input->>'sampleSize')::integer; if n is null or n not between 1 and 200 then raise exception 'Invalid evaluation sample size'; end if;
 insert into public.evidence_evaluation_sets(principal_id,workspace_id,snapshot_id,name,selection_spec,data_origin,evidence_reference,created_by) values(p_principal,p_workspace,p_snapshot,p_input->>'name',coalesce(p_input->'filters','{}'),p_input->>'dataOrigin',p_input->>'evidenceReference',p_actor) returning * into v;
 insert into public.evidence_evaluation_items(set_id,source_revision_id) select v.id,e.source_revision_id from public.evidence_qualification_entries e join public.evidence_source_revisions r on r.id=e.source_revision_id join public.evidence_source_records s on s.id=r.source_record_id where e.snapshot_id=p_snapshot and (nullif(p_input->'filters'->>'platform','') is null or s.platform=p_input->'filters'->>'platform') and (nullif(p_input->'filters'->>'language','') is null or r.original_fields->>'Language'=p_input->'filters'->>'language') order by s.record_key limit n;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'evaluation.set.create',v.id,jsonb_build_object('origin',v.data_origin,'snapshotId',p_snapshot)); return to_jsonb(v);
end $$;
create function public.read_evidence_evaluation(p_principal text,p_workspace uuid,p_actor text,p_set uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_evaluation_sets; records jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 select * into v from public.evidence_evaluation_sets where id=p_set and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Evaluation unavailable'; end if;
 -- Blinded: no model flags/scores, original URLs, raw account IDs or admin notes.
 select coalesce(jsonb_agg(jsonb_build_object('itemId',i.id,'text',r.original_content,'platform',s.platform,'language',coalesce(r.original_fields->>'Language','unknown'),'sourceType',coalesce(r.original_fields->>'Source Type',r.original_fields->>'Source','unknown'),'alreadyReviewed',exists(select 1 from public.evidence_evaluation_reviews review where review.item_id=i.id and review.reviewer_id=p_actor)) order by s.record_key),'[]') into records
 from public.evidence_evaluation_items i join public.evidence_source_revisions r on r.id=i.source_revision_id join public.evidence_source_records s on s.id=r.source_record_id where i.set_id=v.id;
 return jsonb_build_object('set',to_jsonb(v),'items',records,'rubric','Label whether source evidence supports each pattern flag: present, absent or uncertain. This does not verify human authorship. The set creator cannot supply its independent labels.');
end $$;
create function public.submit_evidence_evaluation(p_principal text,p_workspace uuid,p_actor text,p_set uuid,p_item uuid,p_labels jsonb,p_rationale text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_evaluation_sets; k text; v_label text;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 select * into v from public.evidence_evaluation_sets where id=p_set and principal_id=p_principal and workspace_id=p_workspace;
 if not found or v.created_by=p_actor then raise exception 'Independent scoped reviewer required'; end if;
 if not exists(select 1 from public.evidence_evaluation_items where id=p_item and set_id=p_set) then raise exception 'Item outside evaluation'; end if;
 if jsonb_typeof(p_labels) is distinct from 'object' or p_labels='{}' then raise exception 'Reference labels required'; end if;
 for k,v_label in select key,value from jsonb_each_text(p_labels) loop
  if k not in ('suspected_automation','suspected_coordination','repetitive_template','potential_synthetic_content','provenance_incomplete','exact_duplicate','near_duplicate','repost','insufficient_evidence') or v_label not in ('present','absent','uncertain') then raise exception 'Invalid reference label'; end if;
 end loop;
 insert into public.evidence_evaluation_reviews(set_id,item_id,reviewer_id,labels,rationale) values(p_set,p_item,p_actor,p_labels,p_rationale);
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'evaluation.reference.submit',p_item,jsonb_build_object('setId',p_set));
end $$;
create function public.evidence_evaluation_reference_rows(p_principal text,p_workspace uuid,p_actor text,p_set uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.evidence_evaluation_sets; rows jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 select * into v from public.evidence_evaluation_sets where id=p_set and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Evaluation unavailable'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('sourceKey',src.record_key,'platform',src.platform,'language',coalesce(r.original_fields->>'Language','unknown'),'sourceType',coalesce(r.original_fields->>'Source Type',r.original_fields->>'Source','unknown'),'predicted',q.flags,'labels',review.labels,'independent',review.reviewer_id<>v.created_by)),'[]') into rows
 from public.evidence_evaluation_reviews review join public.evidence_evaluation_items item on item.id=review.item_id join public.evidence_source_revisions r on r.id=item.source_revision_id join public.evidence_source_records src on src.id=r.source_record_id join public.evidence_qualification_entries q on q.snapshot_id=v.snapshot_id and q.source_revision_id=r.id where review.set_id=v.id;
 return jsonb_build_object('origin',v.data_origin,'records',rows);
end $$;

do $$ declare t text; begin
 foreach t in array array['evidence_robustness_runs','evidence_evaluation_sets','evidence_evaluation_items','evidence_evaluation_reviews'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger evidence_validation_immutable before update or delete on public.%I for each row execute function public.evidence_foundation_immutable()',t);
  execute format('create trigger evidence_validation_no_truncate before truncate on public.%I execute function public.evidence_foundation_immutable()',t);
 end loop;
end $$;
revoke all on function public.save_evidence_robustness(text,uuid,text,uuid,jsonb),public.create_evidence_evaluation_set(text,uuid,text,uuid,jsonb),public.read_evidence_evaluation(text,uuid,text,uuid),public.submit_evidence_evaluation(text,uuid,text,uuid,uuid,jsonb,text),public.evidence_evaluation_reference_rows(text,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_evidence_robustness(text,uuid,text,uuid,jsonb),public.create_evidence_evaluation_set(text,uuid,text,uuid,jsonb),public.read_evidence_evaluation(text,uuid,text,uuid),public.submit_evidence_evaluation(text,uuid,text,uuid,uuid,jsonb,text),public.evidence_evaluation_reference_rows(text,uuid,text,uuid) to service_role;
commit;
