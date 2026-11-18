-- Additive controls. Apply to staging and run acceptance before production activation.
begin;
create table public.pv_odcs_programs (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  document_reference text not null,
  version text not null,
  configuration jsonb not null check (configuration->>'schemaVersion' = '1'),
  registered_by text not null,
  created_at timestamptz not null default now(),
  unique (principal_id, document_reference, version),
  unique (principal_id, id)
);
alter table public.pv_odcs_programs enable row level security;
revoke all on public.pv_odcs_programs from anon, authenticated;
grant select, insert on public.pv_odcs_programs to service_role;
alter table public.pv_records add column odcs_program_id uuid;
alter table public.pv_records add column scope_assessment jsonb;
alter table public.pv_records add column source_external_id text;
alter table public.pv_records add column follow_up_owner text;
alter table public.pv_records add column follow_up_due_at timestamptz;
alter table public.pv_records add column sponsor_disposition jsonb;
alter table public.pv_records add constraint pv_records_odcs_tenant_fk foreign key (principal_id, odcs_program_id) references public.pv_odcs_programs(principal_id,id);
alter table public.pv_import_batches add column odcs_program_id uuid;
alter table public.pv_import_batches add column dataset_reference text;
alter table public.pv_import_batches drop constraint pv_import_batches_principal_id_file_hash_key;
create unique index pv_import_scoped_hash on public.pv_import_batches(principal_id,file_hash,odcs_program_id) where odcs_program_id is not null;
create unique index pv_import_legacy_hash on public.pv_import_batches(principal_id,file_hash) where odcs_program_id is null;
alter table public.pv_import_batches add constraint pv_import_odcs_tenant_fk foreign key (principal_id, odcs_program_id) references public.pv_odcs_programs(principal_id,id);
alter table public.pv_reviews drop constraint if exists pv_reviews_decision_check;
alter table public.pv_reviews add constraint pv_reviews_decision_check check (decision in ('escalate','close_not_relevant','reclassify_health_experience','forward_observation'));
alter table public.pv_transfers drop constraint if exists pv_transfers_status_check;
alter table public.pv_transfers add constraint pv_transfers_status_check check (status in ('queued','provider_accepted','delivered','acknowledged','failed'));
alter table public.pv_transfers add column review_id uuid references public.pv_reviews(id);
alter table public.pv_transfers add column dispatch_evidence jsonb;
create unique index pv_transfer_review_destination on public.pv_transfers(principal_id,record_id,review_id,destination,transfer_method) where review_id is not null;

create function public.pv_odcs_immutable() returns trigger language plpgsql as $$
begin raise exception 'Approved ODCS configurations are immutable; register a new version'; end $$;
create trigger pv_odcs_immutable before update or delete on public.pv_odcs_programs for each row execute function public.pv_odcs_immutable();
create function public.pv_record_scope_immutable() returns trigger language plpgsql as $$
begin
  if old.odcs_program_id is distinct from new.odcs_program_id or old.scope_assessment is distinct from new.scope_assessment then raise exception 'Historical ODCS scope cannot be reassigned'; end if;
  return new;
end $$;
create trigger pv_record_scope_immutable before update on public.pv_records for each row execute function public.pv_record_scope_immutable();

-- New audit entries have a serial, verifiable canonical payload. Historical hashes
-- remain untouched and are explicitly outside this new verification format.
alter table public.pv_audit_events add column chain_sequence bigserial;
alter table public.pv_audit_events add column canonical_payload text;
create function public.pv_audit_no_mutation() returns trigger language plpgsql as $$
begin raise exception 'PV audit events cannot be changed or deleted'; end $$;
create trigger pv_audit_no_mutation before update or delete on public.pv_audit_events for each row execute function public.pv_audit_no_mutation();
create function public.append_pv_audit_event(p_principal_id text, p_actor_id text, p_action text, p_resource_type text, p_resource_id text, p_outcome text, p_metadata jsonb)
returns public.pv_audit_events language plpgsql security definer set search_path = public, pg_temp as $$
declare previous text; stamp timestamptz := clock_timestamp(); canonical text; result public.pv_audit_events;
begin
  if length(trim(p_principal_id)) = 0 or length(trim(p_actor_id)) = 0 then raise exception 'Principal and actor required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_principal_id, 17001));
  stamp := clock_timestamp();
  select event_hash into previous from public.pv_audit_events where principal_id = p_principal_id
    order by (canonical_payload is not null) desc, case when canonical_payload is not null then chain_sequence end desc nulls last, occurred_at desc,created_at desc,id desc limit 1;
  previous := coalesce(previous,'GENESIS');
  canonical := jsonb_build_object('format',2,'principalId',p_principal_id,'actorId',p_actor_id,'action',p_action,'resourceType',p_resource_type,'resourceId',p_resource_id,'outcome',p_outcome,'metadata',coalesce(p_metadata,'{}'::jsonb),'occurredAt',stamp,'previousHash',previous)::text;
  insert into public.pv_audit_events(principal_id,actor_id,action,resource_type,resource_id,outcome,metadata,previous_hash,event_hash,occurred_at,canonical_payload)
  values(p_principal_id,p_actor_id,p_action,p_resource_type,p_resource_id,p_outcome,coalesce(p_metadata,'{}'),previous,encode(sha256(convert_to(canonical,'UTF8')),'hex'),stamp,canonical) returning * into result;
  return result;
end $$;
revoke insert, update, delete on public.pv_audit_events from service_role;
revoke all on function public.append_pv_audit_event(text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.append_pv_audit_event(text,text,text,text,text,text,jsonb) to service_role;

-- Dispatch state and record state move together under a row lock. Neither a
-- prepared export nor an unconfigured transport is evidence of dispatch.
create function public.confirm_pv_dispatch(p_principal_id text,p_transfer_id uuid,p_actor_id text,p_evidence jsonb,p_provider boolean)
returns public.pv_transfers language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.pv_transfers; stamp timestamptz := clock_timestamp();
begin
  if p_provider is null then raise exception 'Dispatch mode required'; end if;
  select * into result from public.pv_transfers where id=p_transfer_id and principal_id=p_principal_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if result.status in ('provider_accepted','delivered','acknowledged') then return result; end if;
  if length(trim(coalesce(p_evidence->>'reference',''))) = 0 then raise exception 'Dispatch evidence required'; end if;
  if p_provider and (result.transfer_method <> 'secure_email' or coalesce(p_evidence->>'provider','') <> 'resend') then raise exception 'Unsupported provider'; end if;
  if not p_provider and (result.transfer_method <> 'manual_export' or coalesce(p_evidence->>'attested','false') <> 'true') then raise exception 'Explicit manual dispatch attestation required'; end if;
  update public.pv_transfers set status=case when p_provider then 'provider_accepted' else 'delivered' end, transferred_at=stamp,
    dispatch_evidence=p_evidence || jsonb_build_object('actorId',p_actor_id,'recordedAt',stamp),error=null,updated_at=stamp where id=result.id returning * into result;
  update public.pv_records set status='transferred', client_notified_at=stamp,updated_at=stamp where id=result.record_id and principal_id=p_principal_id;
  perform public.append_pv_audit_event(p_principal_id,p_actor_id,'transfer.dispatch','pv_record',result.record_id::text,'completed',jsonb_build_object('transferId',result.id,'providerAccepted',p_provider,'evidence',p_evidence));
  return result;
end $$;
revoke all on function public.confirm_pv_dispatch(text,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.confirm_pv_dispatch(text,uuid,text,jsonb,boolean) to service_role;

create function public.acknowledge_pv_transfer(p_principal_id text,p_transfer_id uuid,p_actor_id text,p_reference text)
returns public.pv_transfers language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.pv_transfers; stamp timestamptz := clock_timestamp();
begin
  if length(trim(coalesce(p_reference,'')))=0 then raise exception 'Sponsor receipt reference required'; end if;
  select * into result from public.pv_transfers where id=p_transfer_id and principal_id=p_principal_id for update;
  if not found or result.status not in ('provider_accepted','delivered','acknowledged') then raise exception 'Dispatched transfer not found'; end if;
  if result.status='acknowledged' then return result; end if;
  update public.pv_transfers set status='acknowledged',acknowledgment_reference=p_reference,acknowledged_at=stamp,updated_at=stamp where id=result.id returning * into result;
  update public.pv_records set status='acknowledged',updated_at=stamp where id=result.record_id and principal_id=p_principal_id;
  perform public.append_pv_audit_event(p_principal_id,p_actor_id,'transfer.acknowledge','pv_record',result.record_id::text,'completed',jsonb_build_object('transferId',result.id,'acknowledgmentReference',p_reference));
  return result;
end $$;
revoke all on function public.acknowledge_pv_transfer(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.acknowledge_pv_transfer(text,uuid,text,text) to service_role;

create table public.pv_delivery_outbox (
  id uuid primary key default gen_random_uuid(), principal_id text not null,
  idempotency_key text not null, request_body jsonb not null, evidence jsonb not null default '{}',
  status text not null default 'queued' check(status in ('queued','retry','provider_accepted','needs_reconciliation')),
  first_attempt_at timestamptz, provider_reference text, attempts integer not null default 0,
  last_error text, created_at timestamptz not null default now(),
  unique(principal_id,idempotency_key)
);
alter table public.pv_delivery_outbox enable row level security;
revoke all on public.pv_delivery_outbox from anon,authenticated;
grant select,insert,update on public.pv_delivery_outbox to service_role;
create function public.pv_delivery_payload_immutable() returns trigger language plpgsql as $$
begin
  if new.principal_id is distinct from old.principal_id or new.idempotency_key is distinct from old.idempotency_key or new.request_body is distinct from old.request_body or new.evidence is distinct from old.evidence or (old.first_attempt_at is not null and new.first_attempt_at is distinct from old.first_attempt_at) then raise exception 'Delivery identity and original payload are immutable'; end if;
  return new;
end $$;
create trigger pv_delivery_payload_immutable before update on public.pv_delivery_outbox for each row execute function public.pv_delivery_payload_immutable();
create function public.claim_pv_delivery(p_principal_id text,p_key text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.pv_delivery_outbox;
begin
  select * into result from public.pv_delivery_outbox where principal_id=p_principal_id and idempotency_key=p_key for update;
  if not found then raise exception 'Delivery not found'; end if;
  if result.status in ('provider_accepted','needs_reconciliation') then return to_jsonb(result); end if;
  if result.attempts>=5 or (result.first_attempt_at is not null and clock_timestamp()-result.first_attempt_at>=interval '23 hours') then
    update public.pv_delivery_outbox set status='needs_reconciliation',last_error='Reconcile provider history before further dispatch' where id=result.id returning * into result;
    return to_jsonb(result);
  end if;
  update public.pv_delivery_outbox set first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),attempts=attempts+1 where id=result.id returning * into result;
  return to_jsonb(result) || jsonb_build_object('attempts',result.attempts-1);
end $$;
revoke all on function public.claim_pv_delivery(text,text) from public,anon,authenticated;
grant execute on function public.claim_pv_delivery(text,text) to service_role;

-- Legacy review state and its audit record must commit together; reject stale edits.
create function public.save_pv_review(p_principal_id text,p_actor_id text,p_record_id uuid,p_expected_updated_at timestamptz,p_review jsonb,p_updates jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_record public.pv_records; review public.pv_reviews; updated public.pv_records;
begin
  select * into current_record from public.pv_records where id=p_record_id and principal_id=p_principal_id for update;
  if not found then raise exception 'Record not found'; end if;
  if current_record.updated_at is distinct from p_expected_updated_at then raise exception 'revision conflict'; end if;
  if current_record.odcs_program_id is not null and not exists(select 1 from public.pv_odcs_programs p where p.id=current_record.odcs_program_id and p.principal_id=p_principal_id and (p.configuration->'qualifiedReviewerIds') ? p_actor_id and (p.configuration->>'qualificationExpiresAt')::timestamptz > clock_timestamp()) then raise exception 'Current ODCS reviewer qualification required'; end if;
  if current_record.status in ('ready_for_transfer','transferred','acknowledged','reconciled') then raise exception 'Record requires a governed follow-up'; end if;
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
revoke all on function public.save_pv_review(text,text,uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_pv_review(text,text,uuid,timestamptz,jsonb,jsonb) to service_role;

create function public.record_pv_disposition(p_principal_id text,p_actor_id text,p_record_id uuid,p_disposition jsonb)
returns public.pv_records language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.pv_records; stamp timestamptz:=clock_timestamp();
begin
  select * into result from public.pv_records where id=p_record_id and principal_id=p_principal_id for update;
  if not found then raise exception 'Record not found'; end if;
  if coalesce(p_disposition->>'outcome','') not in ('received_for_follow_up','case_created','closed_non_case') or length(trim(coalesce(p_disposition->>'reference','')))=0 or coalesce(p_disposition->>'attested','false')<>'true' then raise exception 'Sponsor disposition, evidence reference and attestation required'; end if;
  if coalesce(p_disposition->>'followUpComplete','false')<>'true' and (length(trim(coalesce(p_disposition->>'followUpOwner','')))=0 or (p_disposition->>'followUpDueAt')::timestamptz is null or (p_disposition->>'followUpDueAt')::timestamptz <= stamp) then raise exception 'Open follow-up needs an owner and future deadline'; end if;
  update public.pv_records set sponsor_disposition=p_disposition || jsonb_build_object('recordedBy',p_actor_id,'recordedAt',stamp),
    follow_up_owner=coalesce(p_disposition->>'followUpOwner',follow_up_owner),follow_up_due_at=coalesce((p_disposition->>'followUpDueAt')::timestamptz,follow_up_due_at),updated_at=stamp
    where id=p_record_id returning * into result;
  perform public.append_pv_audit_event(p_principal_id,p_actor_id,'sponsor.disposition','pv_record',p_record_id::text,'completed',p_disposition);
  return result;
end $$;
revoke all on function public.record_pv_disposition(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_pv_disposition(text,text,uuid,jsonb) to service_role;
commit;
