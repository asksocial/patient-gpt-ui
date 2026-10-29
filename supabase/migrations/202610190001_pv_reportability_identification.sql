-- Separate first recognition from escalation; retain existing immutable review/audit history.
alter table public.pv_reviews drop constraint if exists pv_reviews_decision_check;
alter table public.pv_reviews add constraint pv_reviews_decision_check check (decision in ('escalate','identify_reportability','close_not_relevant','reclassify_health_experience','forward_observation'));

create or replace function public.save_pv_review(p_principal_id text,p_actor_id text,p_record_id uuid,p_expected_updated_at timestamptz,p_review jsonb,p_updates jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_record public.pv_records; review public.pv_reviews; updated public.pv_records;
begin
  select * into current_record from public.pv_records where id=p_record_id and principal_id=p_principal_id for update;
  if not found then raise exception 'Record not found'; end if;
  if current_record.updated_at is distinct from p_expected_updated_at then raise exception 'revision conflict'; end if;
  if current_record.odcs_program_id is not null and not exists(select 1 from public.pv_odcs_programs p where p.id=current_record.odcs_program_id and p.principal_id=p_principal_id and (p.configuration->'qualifiedReviewerIds') ? p_actor_id and (p.configuration->>'qualificationExpiresAt')::timestamptz > clock_timestamp()) then raise exception 'Current ODCS reviewer qualification required'; end if;
  if current_record.status in ('ready_for_transfer','transferred','acknowledged','reconciled') then raise exception 'Record requires a governed follow-up'; end if;
  if p_review->>'decision' not in ('escalate','identify_reportability','forward_observation','close_not_relevant','reclassify_health_experience') then raise exception 'Unsupported review decision'; end if;
  if p_review->>'decision' = 'identify_reportability' and (p_updates->>'status' <> 'in_review' or p_updates->>'escalated_at' is not null) then raise exception 'Identification must remain in review without escalation'; end if;
  if p_review->>'decision' in ('identify_reportability','escalate') then
    if coalesce(p_review->'validated_ae_ontology'->'icsrAssessment'->'minimumCriteria'->'suspectProduct'->>'status','') <> 'yes'
      or coalesce(p_review->'validated_ae_ontology'->'icsrAssessment'->'minimumCriteria'->'adverseEventOrObservation'->>'status','') <> 'yes'
      or coalesce(p_review->'validated_ae_ontology'->'icsrAssessment'->'minimumCriteria'->'identifiablePatient'->>'status','') <> 'yes'
      or coalesce(p_review->'validated_ae_ontology'->'icsrAssessment'->'minimumCriteria'->'identifiableReporter'->>'status','') <> 'yes'
      or coalesce(p_review->'validated_ae_ontology'->'icsrAssessment'->'patientAssessment'->>'reviewerConfirmed','false') <> 'true'
    then raise exception 'Confirmed minimum ICSR criteria required for identification'; end if;
    if (p_updates->>'reportability_identified_at') is null
      or (p_updates->>'reportability_identified_at')::timestamptz > clock_timestamp()
      or (p_updates->>'reportability_identified_at')::timestamptz < current_record.posted_at
      or (current_record.reportability_identified_at is not null and (p_updates->>'reportability_identified_at')::timestamptz > current_record.reportability_identified_at)
    then raise exception 'Invalid identification time or attempt to move first identification later'; end if;
  elsif p_updates->>'reportability_identified_at' is not null then raise exception 'Identification requires confirmed criteria';
  end if;
  insert into public.pv_reviews(principal_id,record_id,reviewer_id,product_mention,health_experience,classifications,rationale,decision,reviewed_at,validated_ae_ontology,e2b_mapping_version)
  values(p_principal_id,p_record_id,p_actor_id,p_review->>'product_mention',p_review->>'health_experience',array(select jsonb_array_elements_text(p_review->'classifications')),p_review->>'rationale',p_review->>'decision',(p_review->>'reviewed_at')::timestamptz,p_review->'validated_ae_ontology',p_review->>'e2b_mapping_version') returning * into review;
  update public.pv_records set status=p_updates->>'status',assigned_reviewer_id=p_actor_id,updated_at=(p_updates->>'updated_at')::timestamptz,
    reportability_identified_at=coalesce((p_updates->>'reportability_identified_at')::timestamptz,reportability_identified_at),
    escalated_at=coalesce((p_updates->>'escalated_at')::timestamptz,escalated_at),
    day_zero_basis=coalesce(p_updates->>'day_zero_basis',day_zero_basis),day_zero_reason=coalesce(p_updates->>'day_zero_reason',day_zero_reason),
    reviewer_detection_segment=p_updates->>'reviewer_detection_segment',
    reviewer_health_experience_tags=case when jsonb_typeof(p_updates->'reviewer_health_experience_tags')='array' then array(select jsonb_array_elements_text(p_updates->'reviewer_health_experience_tags')) else null end,
    segment_reclassified_at=(p_updates->>'segment_reclassified_at')::timestamptz,segment_reclassified_by=p_updates->>'segment_reclassified_by',
    follow_up_owner=coalesce(p_updates->>'follow_up_owner',follow_up_owner),follow_up_due_at=coalesce((p_updates->>'follow_up_due_at')::timestamptz,follow_up_due_at)
    where id=p_record_id returning * into updated;
  perform public.append_pv_audit_event(p_principal_id,p_actor_id,'review.' || review.decision,'pv_record',p_record_id::text,'completed',coalesce(p_review->'audit_metadata','{}') || jsonb_build_object('reviewId',review.id,'reportabilityIdentifiedAt',updated.reportability_identified_at,'e2bMappingVersion',review.e2b_mapping_version));
  return jsonb_build_object('review',to_jsonb(review),'record',to_jsonb(updated));
end $$;
