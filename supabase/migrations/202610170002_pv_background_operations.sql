-- Durable retries, tenant notification policy, incidents and worker heartbeat.
alter table public.pv_delivery_outbox
  add column purpose text not null default 'legacy' check(purpose in ('legacy','sponsor_handoff','qa','operations_notification')),
  add column next_attempt_at timestamptz not null default now(),
  add column last_attempt_at timestamptz,
  add column claim_token uuid,
  add column lease_until timestamptz;
alter table public.pv_delivery_outbox drop constraint pv_delivery_outbox_status_check;
alter table public.pv_delivery_outbox add constraint pv_delivery_outbox_status_check check(status in ('queued','retry','provider_accepted','needs_reconciliation','cancelled'));
-- Existing requests have no reliable binding to transfers. Never guess/resend.
update public.pv_delivery_outbox set status='needs_reconciliation',last_error='Legacy delivery requires reconciliation before background dispatch' where status in ('queued','retry');
create index pv_delivery_due on public.pv_delivery_outbox(next_attempt_at) where status in ('queued','retry');

create table public.pv_operations_policies (
  principal_id text primary key, revision uuid not null default gen_random_uuid(), configuration jsonb not null,
  approved_by text not null, updated_at timestamptz not null default now()
);
create table public.pv_operational_incidents (
  id uuid primary key default gen_random_uuid(), principal_id text not null, signal_key text not null,
  kind text not null, resource_id text not null, severity text not null check(severity in ('warning','critical')),
  message text not null, due_at timestamptz, status text not null default 'open' check(status in ('open','acknowledged','resolved')),
  generation integer not null default 1, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  acknowledged_by text, acknowledged_at timestamptz, resolved_at timestamptz,
  primary_queued_at timestamptz, escalation_queued_at timestamptz,
  unique(principal_id,signal_key)
);
create table public.pv_operations_heartbeat (
  id text primary key, last_started_at timestamptz, last_completed_at timestamptz, last_error text,
  lease_until timestamptz, claim_token uuid, tenant_cursor text not null default ''
);
insert into public.pv_operations_heartbeat(id) values('pv-operations');
create table public.pv_operations_tenant_health (principal_id text primary key,last_scanned_at timestamptz not null);
alter table public.pv_operations_tenant_health enable row level security;
revoke all on public.pv_operations_tenant_health from anon,authenticated;
grant select on public.pv_operations_tenant_health to service_role;
alter table public.pv_operations_policies enable row level security;
alter table public.pv_operational_incidents enable row level security;
alter table public.pv_operations_heartbeat enable row level security;
revoke all on public.pv_operations_policies,public.pv_operational_incidents,public.pv_operations_heartbeat from anon,authenticated;
grant select on public.pv_operations_policies,public.pv_operational_incidents,public.pv_operations_heartbeat to service_role;

create or replace function public.pv_delivery_payload_immutable() returns trigger language plpgsql as $$
begin
  if new.principal_id is distinct from old.principal_id or new.idempotency_key is distinct from old.idempotency_key or new.request_body is distinct from old.request_body or new.evidence is distinct from old.evidence or new.purpose is distinct from old.purpose or (old.first_attempt_at is not null and new.first_attempt_at is distinct from old.first_attempt_at) then raise exception 'Delivery identity and original payload are immutable'; end if;
  return new;
end $$;

create function public.validate_pv_delivery_binding() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare transfer_id text; t public.pv_transfers;
begin
  if new.purpose='sponsor_handoff' then
    perform pg_advisory_xact_lock(hashtextextended('pv-delivery-bind:'||new.principal_id,0));
    if jsonb_typeof(new.evidence->'transferIds') is distinct from 'array' or jsonb_array_length(new.evidence->'transferIds')=0 then raise exception 'Transfer binding required'; end if;
    for transfer_id in select jsonb_array_elements_text(new.evidence->'transferIds') loop
      select * into t from public.pv_transfers where id=transfer_id::uuid and principal_id=new.principal_id;
      if not found or t.transfer_method <> 'secure_email' or not (new.request_body->'to' @> jsonb_build_array(t.destination)) then raise exception 'Delivery transfer or destination mismatch'; end if;
      if exists(select 1 from public.pv_delivery_outbox d where d.principal_id=new.principal_id and d.purpose='sponsor_handoff' and d.idempotency_key<>new.idempotency_key and d.evidence->'transferIds' @> jsonb_build_array(transfer_id) and d.status<>'cancelled') then raise exception 'A retained handoff already binds this transfer; reconcile that delivery before preparing a different batch'; end if;
    end loop;
  end if;
  return new;
end $$;
create trigger validate_pv_delivery_binding before insert on public.pv_delivery_outbox for each row execute function public.validate_pv_delivery_binding();

create or replace function public.claim_pv_delivery(p_principal_id text,p_key text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.pv_delivery_outbox; policy public.pv_operations_policies;
begin
  select * into result from public.pv_delivery_outbox where principal_id=p_principal_id and idempotency_key=p_key for update skip locked;
  if not found then return null; end if;
  if result.status not in ('queued','retry') then return null; end if;
  if result.purpose='legacy' then return null; end if;
  if result.next_attempt_at>clock_timestamp() or result.lease_until>clock_timestamp() then return null; end if;
  if result.purpose='operations_notification' then
    select * into policy from public.pv_operations_policies where principal_id=p_principal_id;
    if not found or coalesce((policy.configuration->>'emailEnabled')::boolean,false)=false or policy.revision::text is distinct from result.evidence->>'policyRevision' then
      update public.pv_delivery_outbox set status='cancelled',last_error='Notification policy superseded or disabled' where id=result.id;
      return null;
    end if;
    if not exists(select 1 from jsonb_array_elements(result.evidence->'incidents') e join public.pv_operational_incidents i on i.id=(e->>'id')::uuid and i.principal_id=p_principal_id where i.status<>'resolved' and i.generation=(e->>'generation')::int) then
      update public.pv_delivery_outbox set status='cancelled',last_error='Incident snapshot no longer active' where id=result.id; return null;
    end if;
  end if;
  if result.attempts>=5 or (result.first_attempt_at is not null and clock_timestamp()-result.first_attempt_at>=interval '23 hours') then
    update public.pv_delivery_outbox set status='needs_reconciliation',last_error='Reconcile provider history before further dispatch',claim_token=null,lease_until=null where id=result.id;
    perform public.append_pv_audit_event(p_principal_id,'pv-worker','delivery.exhausted','pv_delivery',result.id::text,'failed','{}');
    return null;
  end if;
  update public.pv_delivery_outbox set first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),last_attempt_at=clock_timestamp(),attempts=attempts+1,claim_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=result.id returning * into result;
  return to_jsonb(result) || jsonb_build_object('attempts',result.attempts-1);
end $$;

create function public.claim_due_pv_deliveries(p_limit integer default 20) returns setof jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d record; claimed jsonb;
begin
  for d in select principal_id,idempotency_key from public.pv_delivery_outbox where status in ('queued','retry') and purpose<>'legacy' and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp()) order by next_attempt_at,id limit least(greatest(p_limit,1),100) for update skip locked loop
    claimed:=public.claim_pv_delivery(d.principal_id,d.idempotency_key);
    if claimed is not null then return next claimed; end if;
  end loop;
end $$;

create function public.finish_pv_delivery(p_principal_id text,p_id uuid,p_token uuid,p_status text,p_reference text,p_error text,p_retry_after_ms integer default 0) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.pv_delivery_outbox; retry_at timestamptz; transfer_id text;
begin
  select * into d from public.pv_delivery_outbox where id=p_id and principal_id=p_principal_id for update;
  if not found or d.claim_token is distinct from p_token or p_token is null or d.lease_until<=clock_timestamp() or d.status not in ('queued','retry') then raise exception 'Delivery lease lost'; end if;
  if p_status not in ('provider_accepted','retry','needs_reconciliation') then raise exception 'Invalid delivery outcome'; end if;
  if p_status='provider_accepted' and length(trim(coalesce(p_reference,'')))=0 then raise exception 'Provider reference required'; end if;
  retry_at:=clock_timestamp()+make_interval(secs=>greatest(least(greatest(coalesce(p_retry_after_ms,0),0),86400000)/1000.0,least(3600,60*power(5,d.attempts-1))));
  if p_status='retry' and (d.attempts>=5 or retry_at>=d.first_attempt_at+interval '23 hours') then p_status:='needs_reconciliation'; end if;
  -- Acknowledging provider acceptance and updating bound transfers is one transaction.
  if p_status='provider_accepted' and d.purpose='sponsor_handoff' then
    for transfer_id in select jsonb_array_elements_text(d.evidence->'transferIds') loop
      perform public.confirm_pv_dispatch(p_principal_id,transfer_id::uuid,'pv-worker',jsonb_build_object('provider','resend','reference',p_reference,'outboxId',d.id),true);
    end loop;
  end if;
  update public.pv_delivery_outbox set status=p_status,provider_reference=p_reference,last_error=p_error,next_attempt_at=retry_at,claim_token=null,lease_until=null where id=d.id returning * into d;
  perform public.append_pv_audit_event(p_principal_id,'pv-worker','delivery.attempt','pv_delivery',d.id::text,case when p_status='provider_accepted' then 'completed' else 'failed' end,jsonb_build_object('status',p_status,'attempts',d.attempts,'providerReference',p_reference));
  return to_jsonb(d);
end $$;

create function public.configure_pv_operations(p_principal_id text,p_actor_id text,p_configuration jsonb) returns public.pv_operations_policies language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.pv_operations_policies; recipients jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('pv-operations:'||p_principal_id,0));
  if jsonb_typeof(p_configuration->'emailEnabled') is distinct from 'boolean' or length(trim(coalesce(p_configuration->>'approvalReference','')))=0 then raise exception 'Approved notification policy required'; end if;
  foreach recipients in array array[p_configuration->'recipients',p_configuration->'escalationRecipients'] loop
    if jsonb_typeof(recipients) is distinct from 'array' or jsonb_array_length(recipients)>20 or exists(select 1 from jsonb_array_elements_text(recipients) r where r !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$') then raise exception 'Invalid operational recipients'; end if;
    if (p_configuration->>'emailEnabled')::boolean and jsonb_array_length(recipients)=0 then raise exception 'Notification recipients required'; end if;
  end loop;
  if coalesce((p_configuration->>'escalationAfterMinutes')::int,0) not between 1 and 1440 or coalesce((p_configuration->>'reminderMinutes')::int,0) not between 15 and 1440 then raise exception 'Invalid notification timing'; end if;
  insert into public.pv_operations_policies(principal_id,configuration,approved_by) values(p_principal_id,p_configuration,p_actor_id)
    on conflict(principal_id) do update set configuration=excluded.configuration,revision=gen_random_uuid(),approved_by=p_actor_id,updated_at=clock_timestamp() returning * into result;
  update public.pv_delivery_outbox set status='cancelled',last_error='Notification policy superseded' where principal_id=p_principal_id and purpose='operations_notification' and status in ('queued','retry') and (lease_until is null or lease_until<=clock_timestamp());
  update public.pv_operational_incidents set primary_queued_at=null,escalation_queued_at=null where principal_id=p_principal_id and status<>'resolved';
  perform public.append_pv_audit_event(p_principal_id,p_actor_id,'operations.configure','pv_operations',p_principal_id,'completed',jsonb_build_object('revision',result.revision,'configuration',p_configuration));
  return result;
end $$;

create function public.sync_pv_incidents(p_principal_id text,p_signals jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb; prior public.pv_operational_incidents; reopened boolean;
begin
  if jsonb_typeof(p_signals) is distinct from 'array' then raise exception 'Complete signal snapshot required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pv-operations:'||p_principal_id,0));
  insert into public.pv_operations_tenant_health(principal_id,last_scanned_at) values(p_principal_id,clock_timestamp()) on conflict(principal_id) do update set last_scanned_at=excluded.last_scanned_at;
  for s in select * from jsonb_array_elements(p_signals) loop
    select * into prior from public.pv_operational_incidents where principal_id=p_principal_id and signal_key=s->>'key' for update;
    reopened:=found and (prior.status='resolved' or (prior.severity='warning' and s->>'severity'='critical'));
    insert into public.pv_operational_incidents(principal_id,signal_key,kind,resource_id,severity,message,due_at)
      values(p_principal_id,s->>'key',s->>'kind',s->>'resourceId',s->>'severity',s->>'message',(s->>'dueAt')::timestamptz)
      on conflict(principal_id,signal_key) do update set last_seen_at=clock_timestamp(),severity=excluded.severity,message=excluded.message,due_at=excluded.due_at,
      status=case when reopened then 'open' else pv_operational_incidents.status end,
      generation=pv_operational_incidents.generation+case when reopened then 1 else 0 end,
      first_seen_at=case when reopened then clock_timestamp() else pv_operational_incidents.first_seen_at end,
      acknowledged_at=case when reopened then null else pv_operational_incidents.acknowledged_at end,
      acknowledged_by=case when reopened then null else pv_operational_incidents.acknowledged_by end,
      resolved_at=null,
      primary_queued_at=case when reopened then null else pv_operational_incidents.primary_queued_at end,
      escalation_queued_at=case when reopened then null else pv_operational_incidents.escalation_queued_at end;
    if prior.id is null or reopened then
      perform public.append_pv_audit_event(p_principal_id,'pv-worker','incident.open','pv_incident',s->>'key','completed',jsonb_build_object('severity',s->>'severity'));
    end if;
  end loop;
  for prior in select * from public.pv_operational_incidents i where principal_id=p_principal_id and status<>'resolved' and not exists(select 1 from jsonb_array_elements(p_signals) candidate where candidate->>'key'=i.signal_key) for update loop
    update public.pv_operational_incidents set status='resolved',resolved_at=clock_timestamp() where id=prior.id;
    perform public.append_pv_audit_event(p_principal_id,'pv-worker','incident.resolve','pv_incident',prior.id::text,'completed','{}');
  end loop;
end $$;

create function public.acknowledge_pv_incident(p_principal_id text,p_actor_id text,p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.pv_operational_incidents set status='acknowledged',acknowledged_by=p_actor_id,acknowledged_at=clock_timestamp() where id=p_id and principal_id=p_principal_id and status='open';
  if not found then raise exception 'Open incident not found'; end if;
  perform public.append_pv_audit_event(p_principal_id,p_actor_id,'incident.acknowledge','pv_incident',p_id::text,'completed','{}');
end $$;

create function public.queue_pv_incident_notifications(p_principal_id text,p_sender text) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare policy public.pv_operations_policies; level text; recipients jsonb; ids uuid[]; evidence_rows jsonb; key text; queued integer:=0;
begin
  perform pg_advisory_xact_lock(hashtextextended('pv-operations:'||p_principal_id,0));
  select * into policy from public.pv_operations_policies where principal_id=p_principal_id;
  if not found or not coalesce((policy.configuration->>'emailEnabled')::boolean,false) then return 0; end if;
  if length(trim(coalesce(p_sender,'')))=0 then raise exception 'Notification sender required'; end if;
  foreach level in array array['primary','escalation'] loop
    -- Do not stack reminders behind a digest still being retried.
    if exists(select 1 from public.pv_delivery_outbox where principal_id=p_principal_id and purpose='operations_notification' and status in ('queued','retry') and evidence->>'policyRevision'=policy.revision::text and evidence->>'level'=level) then continue; end if;
    select array_agg(id order by id),jsonb_agg(jsonb_build_object('id',id,'generation',generation) order by id) into ids,evidence_rows
    from public.pv_operational_incidents where principal_id=p_principal_id and status<>'resolved' and
      case when level='primary' then status='open' and (primary_queued_at is null or primary_queued_at<clock_timestamp()-make_interval(mins=>(policy.configuration->>'reminderMinutes')::int))
      else severity='critical' and first_seen_at<=clock_timestamp()-make_interval(mins=>(policy.configuration->>'escalationAfterMinutes')::int) and
        (escalation_queued_at is null or (status='open' and escalation_queued_at<clock_timestamp()-make_interval(mins=>(policy.configuration->>'reminderMinutes')::int))) end;
    if cardinality(ids)>0 then
      recipients:=policy.configuration->case when level='primary' then 'recipients' else 'escalationRecipients' end;
      key:='pv-ops-'||gen_random_uuid()::text;
      insert into public.pv_delivery_outbox(principal_id,idempotency_key,purpose,request_body,evidence)
        values(p_principal_id,key,'operations_notification',jsonb_build_object('from',p_sender,'to',recipients,'subject',case when level='escalation' then 'AskSocial PV: unresolved critical exceptions' else 'AskSocial PV: operational exceptions' end,
        'text',format('%s unresolved operational exceptions require attention. Sign in to AskSocial and open PV Configuration to inspect and acknowledge incidents. This message contains no clinical details. Email acceptance does not confirm sponsor receipt.',cardinality(ids))),
        jsonb_build_object('policyRevision',policy.revision,'level',level,'incidents',evidence_rows));
      if level='primary' then update public.pv_operational_incidents set primary_queued_at=clock_timestamp() where id=any(ids);
      else update public.pv_operational_incidents set escalation_queued_at=clock_timestamp() where id=any(ids); end if;
      queued:=queued+1;
    end if;
  end loop;
  return queued;
end $$;

-- A global lease prevents overlapping scans from resolving a newer snapshot.
-- Cursor bounds each invocation while rotating through every tenant.
create function public.claim_pv_operations_run() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare h public.pv_operations_heartbeat;
begin
  update public.pv_operations_heartbeat set claim_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '4 minutes',last_started_at=clock_timestamp() where id='pv-operations' and (lease_until is null or lease_until<=clock_timestamp()) returning * into h;
  if not found then return null; end if; return to_jsonb(h);
end $$;
create function public.finish_pv_operations_run(p_token uuid,p_cursor text,p_error text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.pv_operations_heartbeat set last_completed_at=case when p_error is null then clock_timestamp() else last_completed_at end,last_error=p_error,tenant_cursor=p_cursor,claim_token=null,lease_until=null where id='pv-operations' and claim_token=p_token and lease_until>clock_timestamp();
  if not found then raise exception 'Worker lease lost'; end if;
end $$;
create function public.pv_operations_tenants(p_after text,p_limit integer default 10) returns table(principal_id text) language sql security definer set search_path=public,pg_temp as $$
  select t.principal_id from (select principal_id from public.pv_odcs_programs union select principal_id from public.pv_operations_policies union select principal_id from public.pv_delivery_outbox) t where t.principal_id>p_after order by t.principal_id limit least(greatest(p_limit,1),100);
$$;

create function public.pv_operations_stale_tenants() returns bigint language sql security definer set search_path=public,pg_temp as $$
  select count(*) from (select principal_id from public.pv_odcs_programs union select principal_id from public.pv_operations_policies union select principal_id from public.pv_delivery_outbox) t
  left join public.pv_operations_tenant_health h on h.principal_id=t.principal_id where h.last_scanned_at is null or h.last_scanned_at<clock_timestamp()-interval '5 minutes';
$$;

-- No browser session may execute privileged worker/configuration functions.
do $$ declare fn record; begin
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_due_pv_deliveries','finish_pv_delivery','configure_pv_operations','sync_pv_incidents','acknowledge_pv_incident','queue_pv_incident_notifications','claim_pv_operations_run','finish_pv_operations_run','pv_operations_tenants','pv_operations_stale_tenants') loop
    execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end $$;
