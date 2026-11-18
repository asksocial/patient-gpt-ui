begin;
-- Operational metadata only. No source text, account linkage or PV dependency.
create table public.evidence_operational_alert_states (
 monitor_id uuid not null references public.evidence_integrity_monitors(id), environment text not null check(environment in ('local','staging','production')),
 category text not null check(category in ('job_failures','dead_letters','cycle_stalled','lease_expired','backlog','latency','coverage_decline','database_failures','binding_invalidated')),
 active boolean not null, metric numeric not null, last_notified_at timestamptz, config_hash text not null,
 primary key(monitor_id,environment,category)
);
create table public.evidence_operational_alert_events (
 id uuid primary key default gen_random_uuid(), monitor_id uuid not null references public.evidence_integrity_monitors(id), environment text not null,
 category text not null, severity text not null check(severity in ('warning','critical','recovery')), metric numeric not null, threshold numeric not null,
 config_hash text not null, recorded_at timestamptz not null default clock_timestamp(), correlation_id uuid not null default gen_random_uuid()
);
create table public.evidence_operational_alert_outbox (
 id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.evidence_operational_alert_events(id),
 status text not null default 'queued' check(status in ('queued','running','retry','delivered','needs_attention')), attempts integer not null default 0,
 next_attempt_at timestamptz not null default clock_timestamp(), claim_token uuid, lease_until timestamptz
);
create table public.evidence_operational_delivery_events (
 id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.evidence_operational_alert_outbox(id),
 event text not null check(event in ('claimed','delivered','retry','needs_attention')), attempt integer not null, recorded_at timestamptz not null default clock_timestamp()
);
create table public.evidence_operational_alert_configs (
 monitor_id uuid not null references public.evidence_integrity_monitors(id), environment text not null, config_hash text not null,
 config jsonb not null, actor_id text not null, recorded_at timestamptz not null default clock_timestamp(),primary key(monitor_id,environment,config_hash)
);
create table public.evidence_operational_scan_health (
 environment text primary key check(environment in ('local','staging','production')), last_completed_at timestamptz not null
);
create index evidence_alert_due on public.evidence_operational_alert_outbox(status,next_attempt_at,lease_until);

-- Service-only bounded aggregate reader. It never returns originals, accounts or notes.
create function public.read_evidence_operational_metrics(p_after uuid default null,p_limit integer default 100)
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
 exists(select 1 from evidence_analytical_bindings b where b.monitor_id=m.id and (b.active_snapshot_id is null or c.source_sequence is distinct from (select max(import_sequence) from evidence_ingestion_batches where corpus_id=m.corpus_id))) as "bindingInvalidated"
 from evidence_integrity_monitors m left join lateral (select * from evidence_integrity_cycles cy where cy.monitor_id=m.id order by created_at desc,id desc limit 1)c on true
 where m.enabled and (p_after is null or m.id>p_after) order by m.id limit least(greatest(p_limit,1),100)
 )x;
$$;

create function public.record_evidence_operational_alerts(p_principal text,p_workspace uuid,p_actor text,p_monitor uuid,p_environment text,p_signals jsonb,p_config jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_column
declare signal jsonb;state evidence_operational_alert_states;event_id uuid;h text;sent integer:=0;v_category text;active boolean;value numeric;threshold numeric;
begin
 perform evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform 1 from evidence_integrity_monitors where id=p_monitor and principal_id=p_principal and workspace_id=p_workspace and created_by=p_actor and enabled for update;
 if not found or p_environment not in ('local','staging','production') or jsonb_typeof(p_signals)<>'array' or jsonb_array_length(p_signals)<>9 then raise exception 'Invalid operational scope'; end if;
 -- Configuration consists only of numeric provisional thresholds; it is auditable.
 if jsonb_typeof(p_config)<>'object' or (select count(*) from jsonb_each(p_config))<>9 or exists(select 1 from jsonb_each(p_config) where jsonb_typeof(value)<>'number' or key not in ('job_failures','dead_letters','cycle_stalled','lease_expired','backlog','latency','coverage_decline','database_failures','binding_invalidated')) then raise exception 'Invalid alert thresholds';end if;
 h:=encode(sha256(convert_to(p_config::text,'UTF8')),'hex');
 insert into evidence_operational_alert_configs(monitor_id,environment,config_hash,config,actor_id) values(p_monitor,p_environment,h,p_config,p_actor) on conflict do nothing;
 if(select count(distinct v->>'category') from jsonb_array_elements(p_signals)v)<>9 then raise exception 'Duplicate alert categories';end if;
 for signal in select value from jsonb_array_elements(p_signals)loop
  v_category:=signal->>'category';
  if not p_config?v_category or (select count(*) from jsonb_each(signal))<>4 or jsonb_typeof(signal->'active')<>'boolean' or jsonb_typeof(signal->'metric')<>'number' or jsonb_typeof(signal->'threshold')<>'number' then raise exception 'Invalid operational signal';end if;
  active:=(signal->>'active')::boolean;value:=(signal->>'metric')::numeric;threshold:=(signal->>'threshold')::numeric;
  if value<0 or value>1e12 or threshold<0 or threshold>1e12 or threshold<>(p_config->>v_category)::numeric then raise exception 'Invalid operational metric';end if;
  select * into state from evidence_operational_alert_states where monitor_id=p_monitor and environment=p_environment and evidence_operational_alert_states.category=v_category for update;
  if (active and (not found or not state.active or state.last_notified_at<clock_timestamp()-interval '15 minutes')) or (not active and coalesce(state.active,false)) then
   insert into evidence_operational_alert_events(monitor_id,environment,category,severity,metric,threshold,config_hash) values(p_monitor,p_environment,v_category,case when not active then 'recovery' when v_category in ('dead_letters','database_failures','cycle_stalled','binding_invalidated') then 'critical' else 'warning' end,value,threshold,h) returning id into event_id;
   insert into evidence_operational_alert_outbox(event_id)values(event_id);sent:=sent+1;
   insert into evidence_operational_alert_states(monitor_id,environment,category,active,metric,last_notified_at,config_hash)values(p_monitor,p_environment,v_category,active,value,clock_timestamp(),h)on conflict(monitor_id,environment,category)do update set active=excluded.active,metric=excluded.metric,last_notified_at=excluded.last_notified_at,config_hash=h;
  else
   insert into evidence_operational_alert_states(monitor_id,environment,category,active,metric,config_hash)values(p_monitor,p_environment,v_category,active,value,h)on conflict(monitor_id,environment,category)do update set active=excluded.active,metric=excluded.metric,config_hash=h;
  end if;
 end loop;
 perform evidence_foundation_audit(p_principal,p_workspace,p_actor,'operations.alert.scan',p_monitor,jsonb_build_object('environment',p_environment,'events',sent,'configHash',h));
 return sent;
end $$;

create function public.claim_evidence_operational_deliveries(p_environment text,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare delivery evidence_operational_alert_outbox;result jsonb:='[]';begin
 if p_environment not in ('local','staging','production')or p_limit not between 1 and 10 then raise exception 'Invalid delivery bounds';end if;
 -- Serialize claims across sessions: at most ten attempts per minute/environment.
 perform pg_advisory_xact_lock(hashtextextended('evidence-alert-delivery:'||p_environment,171002));
 p_limit:=least(p_limit,greatest(0,10-(select count(*)::integer from evidence_operational_delivery_events d join evidence_operational_alert_outbox o on o.id=d.delivery_id join evidence_operational_alert_events e on e.id=o.event_id where e.environment=p_environment and d.event='claimed'and d.recorded_at>clock_timestamp()-interval '1 minute')));
 for delivery in select o.* from evidence_operational_alert_outbox o join evidence_operational_alert_events e on e.id=o.event_id where e.environment=p_environment and o.attempts<5 and ((o.status in ('queued','retry')and o.next_attempt_at<=clock_timestamp())or(o.status='running'and o.lease_until<=clock_timestamp()))order by o.next_attempt_at,o.id for update of o skip locked limit p_limit loop
  update evidence_operational_alert_outbox set status='running',attempts=attempts+1,claim_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '30 seconds'where id=delivery.id returning * into delivery;
  insert into evidence_operational_delivery_events(delivery_id,event,attempt)values(delivery.id,'claimed',delivery.attempts);
  result:=result||jsonb_build_array(jsonb_build_object('deliveryId',delivery.id,'claimToken',delivery.claim_token,'event',(select to_jsonb(e)from evidence_operational_alert_events e where e.id=delivery.event_id)));
 end loop;return result;
end $$;
create function public.finish_evidence_operational_delivery(p_delivery uuid,p_token uuid,p_success boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d evidence_operational_alert_outbox;s text;begin
 select * into d from evidence_operational_alert_outbox where id=p_delivery and status='running'and claim_token=p_token and lease_until>clock_timestamp()for update;
 if not found or p_success is null then raise exception 'Alert delivery lease unavailable';end if;
 s:=case when p_success then 'delivered'when d.attempts>=5 then 'needs_attention'else 'retry'end;
 update evidence_operational_alert_outbox set status=s,claim_token=null,lease_until=null,next_attempt_at=clock_timestamp()+make_interval(secs=>least(300,5*power(2,d.attempts-1)::integer))where id=d.id;
 insert into evidence_operational_delivery_events(delivery_id,event,attempt)values(d.id,s,d.attempts);
end $$;
create function public.evidence_operational_health(p_environment text,p_completed boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_environment not in ('local','staging','production')then raise exception 'Invalid environment';end if;
 if p_completed then insert into evidence_operational_scan_health values(p_environment,clock_timestamp())on conflict(environment)do update set last_completed_at=excluded.last_completed_at;end if;
 return jsonb_build_object('lastCompletedAt',(select last_completed_at from evidence_operational_scan_health where environment=p_environment),'needsAttention',(select count(*)from evidence_operational_alert_outbox o join evidence_operational_alert_events e on e.id=o.event_id where e.environment=p_environment and(o.status='needs_attention'or(o.status in ('queued','retry','running')and o.next_attempt_at<clock_timestamp()-interval '5 minutes'))));
end $$;

do $$declare t text;begin
 foreach t in array array['evidence_operational_alert_states','evidence_operational_alert_events','evidence_operational_alert_outbox','evidence_operational_delivery_events','evidence_operational_alert_configs','evidence_operational_scan_health']loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger evidence_ops_no_truncate before truncate on public.%I execute function evidence_foundation_immutable()',t);
 end loop;
 foreach t in array array['evidence_operational_alert_events','evidence_operational_delivery_events','evidence_operational_alert_configs']loop execute format('create trigger evidence_ops_immutable before update or delete on public.%I for each row execute function evidence_foundation_immutable()',t);end loop;
end $$;
revoke all on function public.read_evidence_operational_metrics(uuid,integer),public.record_evidence_operational_alerts(text,uuid,text,uuid,text,jsonb,jsonb),public.claim_evidence_operational_deliveries(text,integer),public.finish_evidence_operational_delivery(uuid,uuid,boolean),public.evidence_operational_health(text,boolean)from public,anon,authenticated,service_role;
grant execute on function public.read_evidence_operational_metrics(uuid,integer),public.record_evidence_operational_alerts(text,uuid,text,uuid,text,jsonb,jsonb),public.claim_evidence_operational_deliveries(text,integer),public.finish_evidence_operational_delivery(uuid,uuid,boolean),public.evidence_operational_health(text,boolean)to service_role;
commit;
