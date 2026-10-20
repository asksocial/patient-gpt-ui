-- Scope A only: no scheduler, ODCS configuration or regulatory transmission.
create table public.pv_icsr_email_batches (
 id uuid primary key default gen_random_uuid(), principal_id text not null, created_by text not null,
 created_at timestamptz not null default now(), status text not null default 'draft'
 check(status in ('draft','sending','provider_accepted','manual_sent','failed','needs_reconciliation')),
 payload jsonb not null, provider_reference text, updated_at timestamptz not null default now()
);
create index pv_icsr_email_batches_principal_idx on public.pv_icsr_email_batches(principal_id,status,updated_at desc);
create index pv_icsr_email_batches_cases_idx on public.pv_icsr_email_batches using gin ((payload->'caseIds'));
alter table public.pv_icsr_email_batches enable row level security;
revoke all on public.pv_icsr_email_batches from public, anon, authenticated;
grant select on public.pv_icsr_email_batches to service_role;

alter table public.pv_transfers drop constraint pv_transfers_status_check;
alter table public.pv_transfers add constraint pv_transfers_status_check check(status in ('queued','provider_accepted','manual_sent','delivered','acknowledged','failed'));

-- Shared transactional audit helper. Existing audit entries remain immutable history.
create function public.icsr_queue_audit(p_principal text,p_actor text,p_action text,p_resource text,p_metadata jsonb)
returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_previous text; v_at timestamptz:=clock_timestamp(); v_payload jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('pv-audit:'||p_principal,0));
 select event_hash into v_previous from public.pv_audit_events where principal_id=p_principal order by occurred_at desc limit 1;
 v_previous:=coalesce(v_previous,'GENESIS');
 v_payload:=jsonb_build_object('principalId',p_principal,'actorId',p_actor,'action',p_action,'resourceId',p_resource,'metadata',p_metadata,'occurredAt',v_at,'previousHash',v_previous);
 insert into public.pv_audit_events(principal_id,actor_id,action,resource_type,resource_id,outcome,metadata,previous_hash,event_hash,occurred_at)
 values(p_principal,p_actor,p_action,'pv_icsr_email',p_resource,'completed',p_metadata||jsonb_build_object('hashFormat','icsr-queue-jsonb-v1'),v_previous,encode(sha256(convert_to(v_payload::text,'UTF8')),'hex'),v_at);
end $$;
revoke all on function public.icsr_queue_audit(text,text,text,text,jsonb) from public,anon,authenticated;

create function public.complete_pv_structured_review(p_record_id uuid,p_principal_id text,p_actor_id text,p_expected_updated_at timestamptz,p_review jsonb,p_updates jsonb,p_expected_revision integer,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_record public.pv_records; v_review public.pv_reviews; v_revision integer; v_id uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended(p_record_id::text,0));
 select * into v_record from public.pv_records where id=p_record_id and principal_id=p_principal_id for update;
 if not found then raise exception 'PV record not found'; end if;
 if v_record.updated_at is distinct from p_expected_updated_at then raise exception 'Structured Review revision conflict'; end if;
 if v_record.status in ('transferred','acknowledged','reconciled') then raise exception 'Transferred case requires a governed follow-up'; end if;
 if exists(select 1 from public.pv_icsr_email_batches where principal_id=p_principal_id and status in ('sending','needs_reconciliation') and payload->'caseIds' ? p_record_id::text) then raise exception 'Reconcile the pending email before correcting this review'; end if;
 if p_review->>'decision' not in ('escalate','close_not_relevant','reclassify_health_experience') or nullif(btrim(p_review->>'rationale'),'') is null then raise exception 'Invalid Structured Review'; end if;
 select revision into v_revision from public.pv_icsr_cases where record_id=p_record_id and principal_id=p_principal_id;
 if coalesce(v_revision,0)<>p_expected_revision then raise exception 'ICSR revision conflict'; end if;
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
 reviewer_detection_segment=p_updates->>'reviewer_detection_segment',reviewer_health_experience_tags=case when jsonb_typeof(p_updates->'reviewer_health_experience_tags')='array' then array(select jsonb_array_elements_text(p_updates->'reviewer_health_experience_tags')) else null end,
 segment_reclassified_at=(p_updates->>'segment_reclassified_at')::timestamptz,segment_reclassified_by=p_updates->>'segment_reclassified_by'
 where id=p_record_id and principal_id=p_principal_id returning * into v_record;
 if p_review->>'decision'='reclassify_health_experience' and (v_record.status<>'health_experience' or v_record.reviewer_detection_segment is distinct from 'health_experience') then raise exception 'Health Experience reclassification was not retained'; end if;
 perform public.icsr_queue_audit(p_principal_id,p_actor_id,'structured_review.'||(p_review->>'decision'),p_record_id::text,jsonb_build_object('reviewId',v_id,'icsrRevision',coalesce(v_revision,0)+1,'originalDetectionSegment',p_review->'originalDetectionSegment','reviewerDetectionSegment',p_review->'reviewerDetectionSegment','e2bMappingVersion',p_review->'e2b_mapping_version','emailEligible',p_review->>'decision'='escalate','dayZeroStarted',p_review->'dayZeroStarted','transmissionPerformed',false));
 return jsonb_build_object('review',to_jsonb(v_review),'record',to_jsonb(v_record));
end $$;
revoke all on function public.complete_pv_structured_review(uuid,text,text,timestamptz,jsonb,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.complete_pv_structured_review(uuid,text,text,timestamptz,jsonb,jsonb,integer,jsonb) to service_role;

-- Draft content, PDF bytes, case revisions and recipient list are immutable after preparation.
create function public.prepare_pv_icsr_email(p_principal text,p_actor text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_case jsonb; v_head public.pv_icsr_cases;
begin
 if jsonb_array_length(p_payload->'cases') not between 1 and 10 then raise exception 'Select 1 to 10 cases'; end if;
 for v_case in select value from jsonb_array_elements(p_payload->'cases') order by value->>'recordId' loop
  perform pg_advisory_xact_lock(hashtextextended(v_case->>'recordId',0));
  select * into v_head from public.pv_icsr_cases where record_id=(v_case->>'recordId')::uuid and principal_id=p_principal;
  if not found or v_head.revision<>(v_case->>'revision')::integer or v_head.snapshot->'caseData'->'approval'='null'::jsonb then raise exception 'Case review changed; compose a new preview'; end if;
  if not exists(select 1 from public.pv_records where id=v_head.record_id and principal_id=p_principal and status='ready_for_transfer') then raise exception 'Case is not ready for email'; end if;
 end loop;
 insert into public.pv_icsr_email_batches(principal_id,created_by,payload) values(p_principal,p_actor,p_payload) returning id into v_id;
 perform public.icsr_queue_audit(p_principal,p_actor,'icsr_email.preview',v_id::text,jsonb_build_object('caseIds',p_payload->'caseIds','transmissionPerformed',false));
 return v_id;
end $$;
revoke all on function public.prepare_pv_icsr_email(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_pv_icsr_email(text,text,jsonb) to service_role;

create function public.claim_pv_icsr_email(p_id uuid,p_principal text,p_actor text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_batch public.pv_icsr_email_batches; v_case jsonb; v_head public.pv_icsr_cases;
begin
 select * into v_batch from public.pv_icsr_email_batches where id=p_id and principal_id=p_principal and created_by=p_actor for update;
 if not found then raise exception 'Email preview not found'; end if;
 if v_batch.status<>'draft' then raise exception 'Email already processed or requires reconciliation'; end if;
 for v_case in select value from jsonb_array_elements(v_batch.payload->'cases') order by value->>'recordId' loop
  perform pg_advisory_xact_lock(hashtextextended(v_case->>'recordId',0));
  select * into v_head from public.pv_icsr_cases where record_id=(v_case->>'recordId')::uuid and principal_id=p_principal;
  if not found or v_head.revision<>(v_case->>'revision')::integer then raise exception 'Case review changed; compose a new preview'; end if;
  if not exists(select 1 from public.pv_records where id=v_head.record_id and principal_id=p_principal and status='ready_for_transfer') then raise exception 'Case already dispatched or not ready'; end if;
  if exists(select 1 from public.pv_icsr_email_batches where id<>p_id and principal_id=p_principal and status in ('sending','needs_reconciliation') and payload->'caseIds' ? (v_case->>'recordId')) then raise exception 'Case email pending; reconcile before another send'; end if;
 end loop;
 update public.pv_icsr_email_batches set status='sending',updated_at=now() where id=p_id;
 perform public.icsr_queue_audit(p_principal,p_actor,'icsr_email.send_requested',p_id::text,jsonb_build_object('caseIds',v_batch.payload->'caseIds'));
 return v_batch.payload;
end $$;
revoke all on function public.claim_pv_icsr_email(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_pv_icsr_email(uuid,text,text) to service_role;

create function public.finish_pv_icsr_email(p_id uuid,p_principal text,p_actor text,p_status text,p_reference text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_batch public.pv_icsr_email_batches; v_case jsonb; v_transfer uuid;
begin
 select * into v_batch from public.pv_icsr_email_batches where id=p_id and principal_id=p_principal and created_by=p_actor for update;
 if not found or v_batch.status<>'sending' or p_status not in ('provider_accepted','manual_sent','failed','needs_reconciliation') then raise exception 'Invalid email result transition'; end if;
 if p_status in ('provider_accepted','manual_sent') then
  if nullif(btrim(p_reference),'') is null then raise exception 'Provider reference required'; end if;
  for v_case in select value from jsonb_array_elements(v_batch.payload->'cases') loop
   insert into public.pv_transfers(principal_id,record_id,destination,transfer_method,package_version,payload,payload_hash,status,transferred_by,transferred_at)
   values(p_principal,(v_case->>'recordId')::uuid,v_batch.payload->'email'->>'recipients',case when p_status='manual_sent' then 'manual_export' else 'secure_email' end,(v_case->>'revision')::integer,v_case,encode(sha256(convert_to(v_case::text,'UTF8')),'hex'),p_status,p_actor,now()) returning id into v_transfer;
   update public.pv_records set status='transferred',updated_at=now() where id=(v_case->>'recordId')::uuid and principal_id=p_principal;
  end loop;
 end if;
 update public.pv_icsr_email_batches set status=p_status,provider_reference=p_reference,updated_at=now() where id=p_id;
 perform public.icsr_queue_audit(p_principal,p_actor,'icsr_email.'||p_status,p_id::text,jsonb_build_object('caseIds',v_batch.payload->'caseIds','providerReference',p_reference,'sponsorReceiptConfirmed',false));
end $$;
revoke all on function public.finish_pv_icsr_email(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_pv_icsr_email(uuid,text,text,text,text) to service_role;
