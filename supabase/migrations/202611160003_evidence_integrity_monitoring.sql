begin;
create function public.evidence_monitor_selected(p_run uuid,p_policy uuid,p_filters jsonb) returns setof uuid
language sql stable security definer set search_path=public,pg_temp as $$
 select i.source_revision_id from public.evidence_assessment_inputs i join public.evidence_source_records src on src.id=i.source_record_id
 left join public.evidence_assessments a on a.run_id=i.run_id and a.source_revision_id=i.source_revision_id
 left join public.evidence_screenings sc on sc.assessment_id=a.id and sc.screening_policy_id=p_policy
 where i.run_id=p_run and (nullif(p_filters->>'platform','') is null or src.platform=p_filters->>'platform')
 and (nullif(p_filters->>'flag','') is null or p_filters->>'flag'=any(coalesce(sc.flags,'{}')))
 and (nullif(p_filters->>'since','') is null or i.published_at>=(p_filters->>'since')::timestamptz)
 and (nullif(p_filters->>'until','') is null or i.published_at<=(p_filters->>'until')::timestamptz)
 and (nullif(p_filters->>'batchId','') is null or exists(select 1 from public.evidence_source_observations o join public.evidence_ingestion_batches b on b.id=o.batch_id where o.source_revision_id=i.source_revision_id and b.id=(p_filters->>'batchId')::uuid and b.corpus_id=(select corpus_id from public.evidence_assessment_runs where id=p_run)))
$$;
create function public.read_evidence_monitoring(p_principal text,p_workspace uuid,p_actor text,p_corpus uuid default null,p_filters jsonb default '{}',p_after integer default -1,p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.evidence_integrity_cycles; items jsonb; metrics jsonb; flag_counts jsonb; relations jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 if p_limit not between 1 and 100 or p_after < -1 then raise exception 'Invalid monitoring read bounds'; end if;
 if p_corpus is not null and not exists(select 1 from public.evidence_corpora where id=p_corpus and principal_id=p_principal and workspace_id=p_workspace) then raise exception 'Corpus outside scope'; end if;
 select cy.* into c from public.evidence_integrity_cycles cy join public.evidence_integrity_monitors m on m.id=cy.monitor_id where cy.principal_id=p_principal and cy.workspace_id=p_workspace and (p_corpus is null or m.corpus_id=p_corpus) order by cy.created_at desc,cy.id desc limit 1;
 if c.id is not null then
  with selected as (
   select i.*,sc.flags,sc.result as screening,a.result as assessment from public.evidence_assessment_inputs i
   join public.evidence_source_records source on source.id=i.source_record_id
   left join public.evidence_assessments a on a.run_id=i.run_id and a.source_revision_id=i.source_revision_id
   left join public.evidence_screenings sc on sc.assessment_id=a.id and sc.screening_policy_id=c.screening_policy_id
   where i.run_id=c.assessment_run_id and (nullif(p_filters->>'platform','') is null or source.platform=p_filters->>'platform')
    and (nullif(p_filters->>'flag','') is null or p_filters->>'flag'=any(coalesce(sc.flags,'{}')))
    and (nullif(p_filters->>'since','') is null or i.published_at>=(p_filters->>'since')::timestamptz)
    and (nullif(p_filters->>'until','') is null or i.published_at<=(p_filters->>'until')::timestamptz)
    and (nullif(p_filters->>'batchId','') is null or exists(select 1 from public.evidence_source_observations o join public.evidence_ingestion_batches b on b.id=o.batch_id where o.source_revision_id=i.source_revision_id and b.id=(p_filters->>'batchId')::uuid and b.principal_id=p_principal and b.workspace_id=p_workspace))
  ) select jsonb_build_object('sourceRecords',count(*),'recordsScreened',count(*) filter(where screening is not null),'assessmentCoveragePercent',case when count(*)=0 then null else round(count(*) filter(where screening is not null)*100.0/count(*),2) end,'recordsWithFlags',count(*) filter(where cardinality(flags)>0),'insufficientEvidenceRecords',count(*) filter(where 'insufficient_evidence'=any(flags))) into metrics from selected;
  select jsonb_object_agg(code,(select count(*) from public.evidence_assessment_inputs i join public.evidence_assessments a on a.run_id=i.run_id and a.source_revision_id=i.source_revision_id join public.evidence_screenings s on s.assessment_id=a.id where i.run_id=c.assessment_run_id and s.screening_policy_id=c.screening_policy_id and code=any(s.flags) and i.source_revision_id in (select public.evidence_monitor_selected(c.assessment_run_id,c.screening_policy_id,p_filters)))) into flag_counts from unnest(array['suspected_automation','suspected_coordination','potential_synthetic_content','repetitive_template','provenance_incomplete','exact_duplicate','near_duplicate','repost','insufficient_evidence']) as code;
  select coalesce(jsonb_object_agg(kind,n),'{}') into relations from (select l.kind,count(distinct (least(a.source_revision_id,l.related_revision_id),greatest(a.source_revision_id,l.related_revision_id))) as n from public.evidence_assessment_relationships l join public.evidence_assessments a on a.id=l.assessment_id where a.run_id=c.assessment_run_id and a.source_revision_id in (select public.evidence_monitor_selected(c.assessment_run_id,c.screening_policy_id,p_filters)) and l.related_revision_id in (select public.evidence_monitor_selected(c.assessment_run_id,c.screening_policy_id,p_filters)) group by l.kind) x;
  select coalesce(jsonb_agg(value order by ordinal),'[]') into items from (
   select i.ordinal,jsonb_build_object('ordinal',i.ordinal,'revisionId',i.source_revision_id,'platform',src.platform,'publishedAt',i.published_at,'text',left(r.original_content,500),'flags',coalesce(sc.flags,'{}'),'screening',sc.result,'assessment',a.result) as value
   from public.evidence_assessment_inputs i join public.evidence_source_revisions r on r.id=i.source_revision_id join public.evidence_source_records src on src.id=i.source_record_id
   left join public.evidence_assessments a on a.run_id=i.run_id and a.source_revision_id=i.source_revision_id
   left join public.evidence_screenings sc on sc.assessment_id=a.id and sc.screening_policy_id=c.screening_policy_id
   where i.run_id=c.assessment_run_id and i.ordinal>p_after
    and (nullif(p_filters->>'platform','') is null or src.platform=p_filters->>'platform') and (nullif(p_filters->>'flag','') is null or p_filters->>'flag'=any(coalesce(sc.flags,'{}')))
    and (nullif(p_filters->>'since','') is null or i.published_at>=(p_filters->>'since')::timestamptz) and (nullif(p_filters->>'until','') is null or i.published_at<=(p_filters->>'until')::timestamptz)
    and (nullif(p_filters->>'batchId','') is null or exists(select 1 from public.evidence_source_observations o join public.evidence_ingestion_batches b on b.id=o.batch_id where o.source_revision_id=i.source_revision_id and b.id=(p_filters->>'batchId')::uuid and b.principal_id=p_principal and b.workspace_id=p_workspace))
   order by i.ordinal limit p_limit
  ) page;
 end if;
 return jsonb_build_object(
 'corpora',coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.evidence_corpora x where principal_id=p_principal and workspace_id=p_workspace),'[]'),
 'monitors',coalesce((select jsonb_agg(to_jsonb(x)-array['claim_token','lease_until']) from public.evidence_integrity_monitors x where principal_id=p_principal and workspace_id=p_workspace),'[]'),
 'assessmentPolicies',coalesce((select jsonb_agg(to_jsonb(x)) from public.evidence_assessment_policies x where principal_id=p_principal and workspace_id=p_workspace),'[]'),
 'screeningPolicies',coalesce((select jsonb_agg(to_jsonb(x)) from public.evidence_screening_policies x where principal_id=p_principal and workspace_id=p_workspace),'[]'),
 'qualificationPolicies',coalesce((select jsonb_agg(to_jsonb(x)) from public.evidence_qualification_policies x where principal_id=p_principal and workspace_id=p_workspace),'[]'),
 'bindings',coalesce((select jsonb_agg(to_jsonb(x)) from public.evidence_analytical_bindings x where principal_id=p_principal and workspace_id=p_workspace),'[]'),
 'snapshots',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.evidence_qualification_snapshots where principal_id=p_principal and workspace_id=p_workspace order by created_at desc limit 30) x),'[]'),
 'processing',jsonb_build_object('collectedOccurrences',(select count(*) from public.evidence_source_observations o join public.evidence_ingestion_batches b on b.id=o.batch_id where b.principal_id=p_principal and b.workspace_id=p_workspace and (p_corpus is null or b.corpus_id=p_corpus)),'batchesAwaitingNewCycle',(select count(*) from public.evidence_ingestion_batches b join public.evidence_integrity_monitors m on m.corpus_id=b.corpus_id where m.id=c.monitor_id and b.import_sequence>c.source_sequence),'oldestPendingSeconds',(select extract(epoch from(clock_timestamp()-min(created_at))) from public.evidence_assessment_jobs where run_id=c.assessment_run_id and status in ('queued','retry','running')),'lastCompletedAssessmentRun',(select max(completed_at) from public.evidence_integrity_cycles where principal_id=p_principal and workspace_id=p_workspace and status='completed')),'cycle',to_jsonb(c),'filteredMetrics',metrics,'flagRecordCounts',flag_counts,'uniqueRelationshipPairs',relations,'records',coalesce(items,'[]'),
 'failures',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,cycle_id,assessment_id,code,attempt,recorded_at from public.evidence_screening_errors where principal_id=p_principal and workspace_id=p_workspace order by recorded_at desc limit 50) x),'[]'),
 'jobMetrics',case when c.id is not null then public.read_evidence_assessments(p_principal,p_workspace,p_actor,c.assessment_run_id,-1,1)->'metrics' else null end,
 'policyHistory',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.evidence_analytical_binding_events where principal_id=p_principal and workspace_id=p_workspace order by recorded_at desc limit 30) x),'[]'),
 'monitorHistory',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.evidence_integrity_monitor_events where principal_id=p_principal and workspace_id=p_workspace order by recorded_at desc limit 30) x),'[]'),
 'trends',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,status,created_at,completed_at,(select count(*) from public.evidence_assessments a where a.run_id=cy.assessment_run_id) as assessed_records,(select count(*) from public.evidence_assessments a join public.evidence_screenings sc on sc.assessment_id=a.id where a.run_id=cy.assessment_run_id and sc.screening_policy_id=cy.screening_policy_id) as screened_records,(select count(*) from public.evidence_assessments a join public.evidence_screenings sc on sc.assessment_id=a.id where a.run_id=cy.assessment_run_id and sc.screening_policy_id=cy.screening_policy_id and sc.flags && array['suspected_automation','suspected_coordination']) as suspected_activity_records from public.evidence_integrity_cycles cy where principal_id=p_principal and workspace_id=p_workspace order by created_at desc limit 30) x),'[]'));
end $$;
create function public.record_evidence_file_revision(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_token uuid,p_fingerprint text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.evidence_integrity_monitors; b public.evidence_analytical_bindings;
begin
 m:=public.evidence_monitor_access(p_principal,p_workspace,p_actor,p_monitor,p_token);
 if p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source fingerprint'; end if;
 if m.file_fingerprint is not distinct from p_fingerprint then return; end if;
 update public.evidence_integrity_monitors set file_fingerprint=p_fingerprint where id=m.id;
 for b in select * from public.evidence_analytical_bindings where monitor_id=m.id loop
  update public.evidence_analytical_bindings set dataset_fingerprint=p_fingerprint,revision=revision+1,active_snapshot_id=null where id=b.id returning * into b;
  insert into public.evidence_analytical_binding_events(principal_id,workspace_id,binding_id,revision,configuration,actor_id,reason) values(p_principal,p_workspace,b.id,b.revision,to_jsonb(b),p_actor,'Automatic source-file revision invalidation');
 end loop;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'source.file.revision',m.id,jsonb_build_object('fingerprint',p_fingerprint));
end $$;
revoke all on function public.evidence_monitor_selected(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.read_evidence_monitoring(text,uuid,text,uuid,jsonb,integer,integer),public.record_evidence_file_revision(text,uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.read_evidence_monitoring(text,uuid,text,uuid,jsonb,integer,integer),public.record_evidence_file_revision(text,uuid,text,uuid,uuid,text) to service_role;
commit;
