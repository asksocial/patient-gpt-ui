-- Preserve actual retained review attribution; absent ICSR revisions remain explicitly null.
create or replace function public.complete_pv_structured_review(p_record_id uuid,p_principal_id text,p_actor_id text,p_expected_updated_at timestamptz,p_review jsonb,p_updates jsonb,p_expected_revision integer,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_record public.pv_records; v_review public.pv_reviews; v_revision integer; v_id uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended(p_record_id::text,0));
 select * into v_record from public.pv_records where id=p_record_id and principal_id=p_principal_id for update;
 if not found then raise exception 'PV record not found'; end if;
 if v_record.updated_at is distinct from p_expected_updated_at then raise exception 'Structured Review revision conflict'; end if;
 if v_record.status in ('transferred','acknowledged','reconciled') then raise exception 'Transferred case requires a governed follow-up'; end if;
 if exists(select 1 from public.pv_icsr_email_batches where principal_id=p_principal_id and status in ('sending','needs_reconciliation') and payload->'caseIds' ? p_record_id::text) then raise exception 'Reconcile the pending email before correcting this review'; end if;
 if p_review->>'decision' not in ('escalate','forward_observation','close_not_relevant','reclassify_health_experience') or nullif(btrim(p_review->>'rationale'),'') is null then raise exception 'Invalid Structured Review'; end if;
 select revision into v_revision from public.pv_icsr_cases where record_id=p_record_id and principal_id=p_principal_id;
 if coalesce(v_revision,0)<>p_expected_revision then raise exception 'ICSR revision conflict'; end if;
 if p_review->>'decision'='forward_observation' and (p_review->>'product_mention' is distinct from 'yes' or p_review->>'health_experience' is distinct from 'yes' or jsonb_array_length(p_review->'classifications')=0 or nullif(btrim(p_updates->>'follow_up_owner'),'') is null or nullif(p_updates->>'follow_up_due_at','') is null or (p_updates->>'follow_up_due_at')::timestamptz <= now()) then raise exception 'Observation forwarding requires confirmed relevance, classification, owner and future deadline'; end if;
 if p_review->>'decision'='escalate' then
  if p_snapshot is null or not (p_snapshot->'caseData'->'minimumCriteria' ?& array['patient','reporter','product','event']) or p_snapshot->'caseData'->'approval'->>'reviewer' is distinct from p_actor_id then raise exception 'Structured Review approval required'; end if;
  if exists(select 1 from jsonb_each(p_snapshot->'caseData'->'minimumCriteria') c where c.value->>'present' is distinct from 'present' or c.value->>'confirmed' is distinct from 'true' or nullif(btrim(c.value->>'evidence'),'') is null) then raise exception 'Minimum criteria evidence required'; end if;
  p_snapshot:=jsonb_set(p_snapshot,'{caseData,structuredReviewId}',to_jsonb(v_id::text));
  perform public.save_pv_icsr_revision(p_record_id,p_principal_id,p_actor_id,p_expected_revision,'structured_review.complete',p_snapshot,coalesce(p_review->'icsrChangedPaths','[]'::jsonb)||jsonb_build_array('caseData.structuredReviewId'));
 elsif v_revision is not null then
  p_snapshot:=(select snapshot from public.pv_icsr_cases where record_id=p_record_id);
  p_snapshot:=jsonb_set(p_snapshot,'{revision}',to_jsonb(v_revision+1));
  p_snapshot:=jsonb_set(p_snapshot,'{caseData,approval}','null'::jsonb);
  p_snapshot:=jsonb_set(p_snapshot,'{caseData,status}','"requires_review"'::jsonb);
  p_snapshot:=jsonb_set(p_snapshot,'{email}','null'::jsonb);
  perform public.save_pv_icsr_revision(p_record_id,p_principal_id,p_actor_id,v_revision,'structured_review.invalidate',p_snapshot,jsonb_build_array('caseData.approval','caseData.status','email'));
 end if;
 insert into public.pv_reviews(id,principal_id,record_id,reviewer_id,product_mention,health_experience,classifications,rationale,decision,reviewed_at,validated_ae_ontology,e2b_mapping_version)
 values(v_id,p_principal_id,p_record_id,p_actor_id,p_review->>'product_mention',p_review->>'health_experience',array(select jsonb_array_elements_text(p_review->'classifications')),p_review->>'rationale',p_review->>'decision',(p_review->>'reviewed_at')::timestamptz,p_review->'validated_ae_ontology',p_review->>'e2b_mapping_version') returning * into v_review;
 update public.pv_records set status=p_updates->>'status', assigned_reviewer_id=p_actor_id, updated_at=(p_updates->>'updated_at')::timestamptz,
 reportability_identified_at=coalesce((p_updates->>'reportability_identified_at')::timestamptz,reportability_identified_at),
 escalated_at=coalesce((p_updates->>'escalated_at')::timestamptz,escalated_at),day_zero_basis=coalesce(p_updates->>'day_zero_basis',day_zero_basis),day_zero_reason=coalesce(p_updates->>'day_zero_reason',day_zero_reason),
 follow_up_owner=coalesce(p_updates->>'follow_up_owner',follow_up_owner),follow_up_due_at=coalesce((p_updates->>'follow_up_due_at')::timestamptz,follow_up_due_at),
 reviewer_detection_segment=p_updates->>'reviewer_detection_segment',reviewer_health_experience_tags=case when jsonb_typeof(p_updates->'reviewer_health_experience_tags')='array' then array(select jsonb_array_elements_text(p_updates->'reviewer_health_experience_tags')) else null end,
 segment_reclassified_at=(p_updates->>'segment_reclassified_at')::timestamptz,segment_reclassified_by=p_updates->>'segment_reclassified_by'
 where id=p_record_id and principal_id=p_principal_id returning * into v_record;
 if p_review->>'decision'='reclassify_health_experience' and (v_record.status<>'health_experience' or v_record.reviewer_detection_segment is distinct from 'health_experience') then raise exception 'Health Experience reclassification was not retained'; end if;
 perform public.icsr_queue_audit(p_principal_id,p_actor_id,'structured_review.'||(p_review->>'decision'),p_record_id::text,jsonb_build_object('reviewId',v_id,'icsrRevision',(select revision from public.pv_icsr_cases where record_id=p_record_id and principal_id=p_principal_id),'originalDetectionSegment',p_review->'originalDetectionSegment','reviewerDetectionSegment',v_record.reviewer_detection_segment,'e2bMappingVersion',p_review->'e2b_mapping_version','emailEligible',p_review->>'decision'='escalate','dayZeroStarted',p_review->'dayZeroStarted','transmissionPerformed',false));
 return jsonb_build_object('review',to_jsonb(v_review),'record',to_jsonb(v_record));
end $$;
revoke all on function public.complete_pv_structured_review(uuid,text,text,timestamptz,jsonb,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.complete_pv_structured_review(uuid,text,text,timestamptz,jsonb,jsonb,integer,jsonb) to service_role;
