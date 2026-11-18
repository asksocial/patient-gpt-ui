begin;
-- Newly configured bindings have no prior accepted snapshot; awaiting their first
-- reconciliation is normal, not an unexpected invalidation. Keep the evidence
-- from already-applied migrations unchanged.
create or replace function public.read_evidence_operational_metrics(p_after uuid default null,p_limit integer default 100)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
 select m.id as "monitorId",m.principal_id as "principalId",m.workspace_id as "workspaceId",m.created_by as "actorId",m.enabled,m.lease_until as "leaseUntil",m.claim_token is not null as "claimed",m.last_error_code as "lastError",
 c.id as "cycleId",c.status as "cycleStatus",c.created_at as "cycleStartedAt",c.completed_at as "cycleCompletedAt",
 (select count(*) from evidence_assessment_jobs j where j.run_id=c.assessment_run_id and status='failed') as "failedJobs",
 (select count(*) from evidence_assessment_jobs j where j.run_id=c.assessment_run_id and status in ('queued','retry','running')) as "pendingJobs",
 (select extract(epoch from(clock_timestamp()-min(j.created_at))) from evidence_assessment_jobs j where j.run_id=c.assessment_run_id and status in ('queued','retry','running')) as "oldestPendingSeconds",
 (select count(*) from evidence_assessment_jobs j where j.run_id=c.assessment_run_id and status='running' and lease_until<clock_timestamp()) as "expiredJobs",
 (select count(*) from evidence_assessment_inputs i where i.run_id=c.assessment_run_id) as "inputRecords",
 (select count(*) from evidence_assessments a join evidence_screenings s on s.assessment_id=a.id and s.screening_policy_id=c.screening_policy_id where a.run_id=c.assessment_run_id) as "screenedRecords",
 exists(select 1 from evidence_analytical_bindings b where b.monitor_id=m.id and exists(select 1 from evidence_qualification_snapshots prior where prior.binding_id=b.id and prior.status='sealed') and (b.active_snapshot_id is null or c.source_sequence is distinct from (select max(import_sequence) from evidence_ingestion_batches where corpus_id=m.corpus_id))) as "bindingInvalidated"
 from evidence_integrity_monitors m left join lateral (select * from evidence_integrity_cycles cy where cy.monitor_id=m.id order by created_at desc,id desc limit 1)c on true
 where m.enabled and (p_after is null or m.id>p_after) order by m.id limit least(greatest(p_limit,1),100)
 )x;
$$;


-- An interrupted fifth delivery attempt must become visible as terminal work.
create or replace function public.claim_evidence_operational_deliveries(p_environment text,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare delivery evidence_operational_alert_outbox;result jsonb:='[]';begin
 if p_environment not in ('local','staging','production')or p_limit not between 1 and 10 then raise exception 'Invalid delivery bounds';end if;
 -- Serialize claims across sessions: at most ten attempts per minute/environment.
 perform pg_advisory_xact_lock(hashtextextended('evidence-alert-delivery:'||p_environment,171002));
 with expired as(update evidence_operational_alert_outbox o set status='needs_attention',claim_token=null,lease_until=null from evidence_operational_alert_events e where e.id=o.event_id and e.environment=p_environment and o.status='running'and o.attempts>=5 and o.lease_until<=clock_timestamp()returning o.id,o.attempts)insert into evidence_operational_delivery_events(delivery_id,event,attempt)select id,'needs_attention',attempts from expired;
 p_limit:=least(p_limit,greatest(0,10-(select count(*)::integer from evidence_operational_delivery_events d join evidence_operational_alert_outbox o on o.id=d.delivery_id join evidence_operational_alert_events e on e.id=o.event_id where e.environment=p_environment and d.event='claimed'and d.recorded_at>clock_timestamp()-interval '1 minute')));
 for delivery in select o.* from evidence_operational_alert_outbox o join evidence_operational_alert_events e on e.id=o.event_id where e.environment=p_environment and o.attempts<5 and ((o.status in ('queued','retry')and o.next_attempt_at<=clock_timestamp())or(o.status='running'and o.lease_until<=clock_timestamp()))order by o.next_attempt_at,o.id for update of o skip locked limit p_limit loop
  update evidence_operational_alert_outbox set status='running',attempts=attempts+1,claim_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '30 seconds'where id=delivery.id returning * into delivery;
  insert into evidence_operational_delivery_events(delivery_id,event,attempt)values(delivery.id,'claimed',delivery.attempts);
  result:=result||jsonb_build_array(jsonb_build_object('deliveryId',delivery.id,'claimToken',delivery.claim_token,'event',(select to_jsonb(e)from evidence_operational_alert_events e where e.id=delivery.event_id)));
 end loop;return result;
end $$;

commit;
