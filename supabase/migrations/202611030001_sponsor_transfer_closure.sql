-- Independent additive lifecycle. No legacy table, function, status or trigger changes.
begin;
do $$ begin
 if to_regclass('public.pv_odcs_programs') is null or to_regclass('public.pv_icsr_cases') is null
  or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='pv_records' and column_name='odcs_program_id') then
  raise exception 'Sponsor closure requires the existing ODCS and structured ICSR migrations first';
 end if;
end $$;
create table public.pv_sponsor_closure_settings (
 principal_id text not null,
 sponsor_id text not null,
 configuration jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(principal_id,sponsor_id)
);
create unique index pv_sponsor_closure_program_scope on public.pv_sponsor_closure_settings(principal_id,(configuration->>'odcsProgramId'));
create table public.pv_sponsor_closures (
 id uuid primary key,
 principal_id text not null,
 sponsor_id text not null,
 record_id uuid not null references public.pv_records(id),
 revision integer not null check(revision>0),
 state text not null check(state in ('ready','awaiting_acknowledgement','acknowledgement_overdue','transfer_failed','acknowledgement_disputed','acknowledged','reconciled','transfer_closed','reopened','superseded')),
 snapshot jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(principal_id,sponsor_id,id),
 foreign key(principal_id,sponsor_id) references public.pv_sponsor_closure_settings(principal_id,sponsor_id)
);
create table public.pv_sponsor_closure_events (
 id uuid primary key default gen_random_uuid(),
 principal_id text not null,
 sponsor_id text not null,
 transfer_id uuid not null references public.pv_sponsor_closures(id),
 revision integer not null,
 request_key text not null,
 action text not null,
 actor_id text not null,
 evidence jsonb not null,
 recorded_at timestamptz not null default now(),
 unique(transfer_id,revision), unique(principal_id,sponsor_id,request_key)
 ,foreign key(principal_id,sponsor_id,transfer_id) references public.pv_sponsor_closures(principal_id,sponsor_id,id)
);
create table public.pv_sponsor_closure_settings_events (
 id uuid primary key default gen_random_uuid(), principal_id text not null,
 sponsor_id text not null, actor_id text not null, configuration jsonb not null,
 recorded_at timestamptz not null default now()
);
create index pv_sponsor_closures_scope on public.pv_sponsor_closures(principal_id,sponsor_id,record_id,created_at);
create function public.guard_pv_sponsor_closure_history() returns trigger language plpgsql as $$
begin raise exception 'Sponsor transfer history is append-only'; end $$;
create trigger pv_sponsor_closure_events_immutable before update or delete on public.pv_sponsor_closure_events for each row execute function public.guard_pv_sponsor_closure_history();
create trigger pv_sponsor_closure_settings_history_immutable before update or delete on public.pv_sponsor_closure_settings_events for each row execute function public.guard_pv_sponsor_closure_history();
alter table public.pv_sponsor_closure_settings enable row level security;
alter table public.pv_sponsor_closures enable row level security;
alter table public.pv_sponsor_closure_events enable row level security;
alter table public.pv_sponsor_closure_settings_events enable row level security;
-- No browser/client policies: Clerk authorization is enforced in the server boundary.
revoke all on public.pv_sponsor_closure_settings,public.pv_sponsor_closures,public.pv_sponsor_closure_events,public.pv_sponsor_closure_settings_events from public,anon,authenticated,service_role;
grant select on public.pv_sponsor_closure_settings,public.pv_sponsor_closures,public.pv_sponsor_closure_events,public.pv_sponsor_closure_settings_events to service_role;

create function public.configure_pv_sponsor_closure(p_principal text,p_sponsor text,p_actor text,p_config jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if nullif(btrim(p_actor),'') is null or nullif(btrim(p_sponsor),'') is null then raise exception 'Identity required'; end if;
 if exists(select 1 from public.pv_sponsor_closures where principal_id=p_principal and sponsor_id=p_sponsor) and exists(select 1 from public.pv_sponsor_closure_settings where principal_id=p_principal and sponsor_id=p_sponsor and configuration->>'odcsProgramId' is distinct from p_config->>'odcsProgramId') then raise exception 'Historical sponsor program binding is immutable'; end if;
 insert into public.pv_sponsor_closure_settings values(p_principal,p_sponsor,p_config,now())
 on conflict(principal_id,sponsor_id) do update set configuration=excluded.configuration,updated_at=now();
 insert into public.pv_sponsor_closure_settings_events(principal_id,sponsor_id,actor_id,configuration) values(p_principal,p_sponsor,p_actor,p_config);
end $$;

create function public.save_pv_sponsor_closure(p_principal text,p_sponsor text,p_actor text,p_id uuid,p_record uuid,p_expected integer,p_key text,p_action text,p_snapshot jsonb,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.pv_sponsor_closures; prior public.pv_sponsor_closure_events; target text:=p_snapshot->>'state';
begin
 if nullif(btrim(p_actor),'') is null or nullif(btrim(p_key),'') is null then raise exception 'Identity and request key required'; end if;
 -- Serialize approval and retries for this case; record is locked but NEVER modified.
 perform 1 from public.pv_records where id=p_record and principal_id=p_principal for update;
 if not found then raise exception 'Case unavailable'; end if;
 select * into prior from public.pv_sponsor_closure_events where principal_id=p_principal and sponsor_id=p_sponsor and request_key=p_key;
 if found then
  if prior.transfer_id<>p_id or prior.action<>p_action then raise exception 'Idempotency key reused'; end if;
  return (select to_jsonb(c) from public.pv_sponsor_closures c where id=p_id and principal_id=p_principal and sponsor_id=p_sponsor);
 end if;
 select * into v from public.pv_sponsor_closures where id=p_id and principal_id=p_principal and sponsor_id=p_sponsor for update;
 if p_expected=0 then
  if found or p_action<>'approve' or target<>'ready' then raise exception 'Invalid approval'; end if;
  perform 1 from public.pv_icsr_cases where record_id=p_record and principal_id=p_principal
   and revision=(p_snapshot->'package'->>'version')::integer
   and snapshot->'caseData'->'approval' is not null
   and snapshot->'caseData'->'approval'<>'null'::jsonb
   and snapshot->'caseData'->>'structuredReviewId'=p_snapshot->'package'->>'reviewId' for update;
  if not found then raise exception 'Current approved structured review required'; end if;
  if not exists(select 1 from public.pv_records where id=p_record and principal_id=p_principal
   and status in ('ready_for_transfer','transferred','acknowledged','reconciled')
   and odcs_program_id::text=p_snapshot->'package'->>'odcsProgramId') then raise exception 'Sponsor program or case review mismatch'; end if;
  if not exists(select 1 from public.pv_reviews where id::text=p_snapshot->'package'->>'reviewId'
   and record_id=p_record and principal_id=p_principal and decision='escalate') then raise exception 'Complete ICSR review required'; end if;
  if exists(select 1 from public.pv_sponsor_closures where record_id=p_record and principal_id=p_principal and sponsor_id=p_sponsor and state<>'superseded') then raise exception 'Supersede prior transfer before approving corrected package'; end if;
  insert into public.pv_sponsor_closures(id,principal_id,sponsor_id,record_id,revision,state,snapshot) values(p_id,p_principal,p_sponsor,p_record,1,target,p_snapshot);
 else
  if not found or v.record_id<>p_record or v.revision<>p_expected then raise exception 'Transfer revision conflict'; end if;
  if p_snapshot->'package' is distinct from v.snapshot->'package' then raise exception 'Approved package is immutable'; end if;
  if p_action='supersede' and exists(select 1 from public.pv_sponsor_closure_deliveries where transfer_id=p_id and principal_id=p_principal and status in ('queued','retry')) then raise exception 'Reconcile pending delivery before superseding'; end if;
  if not (
   (p_action='transmit' and v.state in ('ready','transfer_failed') and target in ('awaiting_acknowledgement','transfer_failed')) or
   (p_action='record_ack' and v.state in ('awaiting_acknowledgement','acknowledgement_overdue','acknowledgement_disputed','acknowledged','reopened') and target in (v.state,'acknowledgement_disputed')) or
   (p_action='verify_ack' and v.state in ('awaiting_acknowledgement','acknowledgement_overdue','acknowledgement_disputed','reopened') and target='acknowledged') or
   (p_action='reconcile' and v.state='acknowledged' and target='reconciled') or
   (p_action='close' and v.state='reconciled' and target='transfer_closed') or
   (p_action='reopen' and v.state='transfer_closed' and target='reopened') or
   (p_action='supersede' and v.state not in ('superseded','ready') and target='superseded') or
   (p_action='escalate' and v.state in ('awaiting_acknowledgement','acknowledgement_overdue') and target='acknowledgement_overdue') or
   (p_action='resolve_exception' and v.state<>'superseded' and target=v.state)
  ) then raise exception 'Invalid transfer transition'; end if;
  if p_action in ('reconcile','close') and (p_snapshot->'verifiedAck' is null or p_snapshot->'verifiedAck'='null'::jsonb or jsonb_array_length(coalesce(p_snapshot->'exceptions','[]'))>0) then raise exception 'Verified receipt and resolved exceptions required'; end if;
  if p_action='close' and (p_snapshot->'reconciliation' is null or p_snapshot->'reconciliation'='null'::jsonb) then raise exception 'Reconciliation required'; end if;
  update public.pv_sponsor_closures set revision=p_expected+1,state=target,snapshot=p_snapshot,updated_at=now() where id=p_id;
 end if;
 insert into public.pv_sponsor_closure_events(principal_id,sponsor_id,transfer_id,revision,request_key,action,actor_id,evidence)
 values(p_principal,p_sponsor,p_id,p_expected+1,p_key,p_action,p_actor,p_evidence);
 return (select to_jsonb(c) from public.pv_sponsor_closures c where id=p_id);
end $$;
revoke all on function public.configure_pv_sponsor_closure(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.save_pv_sponsor_closure(text,text,text,uuid,uuid,integer,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.configure_pv_sponsor_closure(text,text,text,jsonb) to service_role;
grant execute on function public.save_pv_sponsor_closure(text,text,text,uuid,uuid,integer,text,text,jsonb,jsonb) to service_role;

-- Dedicated delivery retention; legacy outbox side effects stay unchanged.
create table public.pv_sponsor_closure_deliveries (
 id uuid primary key default gen_random_uuid(),principal_id text not null,sponsor_id text not null,
 transfer_id uuid not null references public.pv_sponsor_closures(id),purpose text not null check(purpose in ('case','escalation')),
 idempotency_key text not null unique,request_body jsonb not null,
 status text not null default 'queued' check(status in ('queued','retry','provider_accepted','needs_reconciliation','cancelled')),
 attempts integer not null default 0,first_attempt_at timestamptz,last_attempt_at timestamptz,
 next_attempt_at timestamptz not null default now(),claim_token uuid,lease_until timestamptz,
 provider_reference text,last_error text,accepted_at timestamptz,created_at timestamptz not null default now(),
 foreign key(principal_id,sponsor_id) references public.pv_sponsor_closure_settings(principal_id,sponsor_id)
 ,unique(transfer_id,purpose)
 ,unique(principal_id,sponsor_id,id)
 ,foreign key(principal_id,sponsor_id,transfer_id) references public.pv_sponsor_closures(principal_id,sponsor_id,id)
);
create table public.pv_sponsor_closure_delivery_attempts (
 id uuid primary key default gen_random_uuid(),delivery_id uuid not null references public.pv_sponsor_closure_deliveries(id),
 principal_id text not null,sponsor_id text not null,attempt integer not null,status text not null,
 provider_reference text,error text,recorded_at timestamptz not null default now(),
 foreign key(principal_id,sponsor_id,delivery_id) references public.pv_sponsor_closure_deliveries(principal_id,sponsor_id,id)
);
alter table public.pv_sponsor_closure_deliveries enable row level security;
alter table public.pv_sponsor_closure_delivery_attempts enable row level security;
revoke all on public.pv_sponsor_closure_deliveries,public.pv_sponsor_closure_delivery_attempts from public,anon,authenticated,service_role;
grant select on public.pv_sponsor_closure_deliveries,public.pv_sponsor_closure_delivery_attempts to service_role;
create trigger pv_sponsor_delivery_attempts_immutable before update or delete on public.pv_sponsor_closure_delivery_attempts for each row execute function public.guard_pv_sponsor_closure_history();
create index pv_sponsor_delivery_due on public.pv_sponsor_closure_deliveries(status,next_attempt_at);
create function public.guard_pv_sponsor_delivery_identity() returns trigger language plpgsql as $$
begin
 if new.principal_id is distinct from old.principal_id or new.sponsor_id is distinct from old.sponsor_id or new.transfer_id is distinct from old.transfer_id or new.purpose is distinct from old.purpose or new.idempotency_key is distinct from old.idempotency_key or new.request_body is distinct from old.request_body or (old.first_attempt_at is not null and new.first_attempt_at is distinct from old.first_attempt_at) then raise exception 'Sponsor delivery identity is immutable'; end if;
 return new;
end $$;
create trigger pv_sponsor_delivery_identity before update on public.pv_sponsor_closure_deliveries for each row execute function public.guard_pv_sponsor_delivery_identity();
create view public.pv_sponsor_closure_delivery_recovery with (security_invoker=true) as
 select c.*,d.id delivery_id,d.status delivery_status,d.provider_reference,d.first_attempt_at,d.accepted_at
 from public.pv_sponsor_closures c join public.pv_sponsor_closure_deliveries d on d.transfer_id=c.id and d.principal_id=c.principal_id and d.sponsor_id=c.sponsor_id
 where d.purpose='case' and c.state in ('ready','transfer_failed') and d.status in ('provider_accepted','needs_reconciliation','cancelled')
 and c.snapshot->'transmission'->>'outcome' is distinct from case when d.status='cancelled' then 'needs_reconciliation' else d.status end;
revoke all on public.pv_sponsor_closure_delivery_recovery from public,anon,authenticated;
grant select on public.pv_sponsor_closure_delivery_recovery to service_role;

create function public.queue_pv_sponsor_delivery(p_principal text,p_sponsor text,p_transfer uuid,p_purpose text,p_key text,p_request jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.pv_sponsor_closures;d public.pv_sponsor_closure_deliveries;
begin
 select * into t from public.pv_sponsor_closures where id=p_transfer and principal_id=p_principal and sponsor_id=p_sponsor for update;
 if not found then raise exception 'Transfer unavailable'; end if;
 if p_purpose='case' then
  if t.state not in ('ready','transfer_failed') or t.snapshot->'package'->>'method'<>'secure_email' then raise exception 'Package is not ready for email'; end if;
  if p_request->'to' is distinct from jsonb_build_array(t.snapshot->'package'->>'recipient') or
   p_request->>'text' is distinct from t.snapshot->'package'->>'body' or
   p_request->>'subject' is distinct from t.snapshot->'package'->>'subject' or
   p_request->'attachments'->0->>'content' is distinct from t.snapshot->'package'->>'content' then raise exception 'Delivery package mismatch'; end if;
 elsif p_purpose='escalation' then
  if t.state not in ('awaiting_acknowledgement','acknowledgement_overdue') then raise exception 'Receipt no longer pending'; end if;
 else raise exception 'Invalid delivery purpose'; end if;
 insert into public.pv_sponsor_closure_deliveries(principal_id,sponsor_id,transfer_id,purpose,idempotency_key,request_body)
 values(p_principal,p_sponsor,p_transfer,p_purpose,p_key,p_request) on conflict(idempotency_key) do nothing;
 select * into d from public.pv_sponsor_closure_deliveries where idempotency_key=p_key and principal_id=p_principal and sponsor_id=p_sponsor;
 if not found or d.transfer_id<>p_transfer or d.purpose<>p_purpose then raise exception 'Delivery identity conflict'; end if;
 return to_jsonb(d);
end $$;

create function public.claim_pv_sponsor_delivery(p_principal text,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.pv_sponsor_closure_deliveries;
begin
 select * into d from public.pv_sponsor_closure_deliveries where id=p_id and principal_id=p_principal for update skip locked;
 if not found or d.status not in ('queued','retry') or d.lease_until>now() or d.next_attempt_at>now() then return null; end if;
 if not exists(select 1 from public.pv_sponsor_closure_settings where principal_id=d.principal_id and sponsor_id=d.sponsor_id and configuration->>'enabled'='true') then return null; end if;
 if not exists(select 1 from public.pv_sponsor_closure_settings where principal_id=d.principal_id and sponsor_id=d.sponsor_id and
  ((d.purpose='case' and (configuration->'methods') @> '["secure_email"]'::jsonb and (configuration->'destinations') @> (d.request_body->'to')) or
   (d.purpose='escalation' and (configuration->'escalationRecipients') @> (d.request_body->'to')))) then
  update public.pv_sponsor_closure_deliveries set status='cancelled',last_error='Current sponsor policy no longer permits this delivery' where id=d.id;return null;
 end if;
 if d.attempts>=5 or d.first_attempt_at<now()-interval '23 hours' then
  update public.pv_sponsor_closure_deliveries set status='needs_reconciliation',last_error='Reconcile provider before further dispatch' where id=d.id;return null;
 end if;
 if exists(select 1 from public.pv_sponsor_closures where id=d.transfer_id and ((d.purpose='case' and state not in ('ready','transfer_failed')) or (d.purpose='escalation' and state not in ('awaiting_acknowledgement','acknowledgement_overdue')))) then
  update public.pv_sponsor_closure_deliveries set status='cancelled',last_error='Transfer state changed before dispatch' where id=d.id;return null;
 end if;
 update public.pv_sponsor_closure_deliveries set attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),last_attempt_at=clock_timestamp(),claim_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=d.id returning * into d;
 return to_jsonb(d)||jsonb_build_object('attempts',d.attempts-1);
end $$;

create function public.finish_pv_sponsor_delivery(p_principal text,p_id uuid,p_token uuid,p_status text,p_reference text,p_error text,p_retry integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.pv_sponsor_closure_deliveries;next_at timestamptz;
begin
 select * into d from public.pv_sponsor_closure_deliveries where id=p_id and principal_id=p_principal for update;
 if not found or p_token is null or d.claim_token is distinct from p_token or d.lease_until<clock_timestamp() then raise exception 'Delivery lease lost'; end if;
 if p_status not in ('provider_accepted','retry','needs_reconciliation') then raise exception 'Invalid delivery result'; end if;
 if p_status='provider_accepted' and nullif(btrim(p_reference),'') is null then raise exception 'Provider reference required'; end if;
 next_at:=clock_timestamp()+make_interval(secs=>greatest(least(greatest(coalesce(p_retry,0),0),86400000)/1000.0,least(3600,60*power(5,d.attempts-1))));
 if p_status='retry' and (d.attempts>=5 or next_at>=d.first_attempt_at+interval '23 hours') then p_status:='needs_reconciliation'; end if;
 insert into public.pv_sponsor_closure_delivery_attempts(delivery_id,principal_id,sponsor_id,attempt,status,provider_reference,error) values(d.id,d.principal_id,d.sponsor_id,d.attempts,p_status,p_reference,p_error);
 update public.pv_sponsor_closure_deliveries set status=p_status,provider_reference=p_reference,last_error=p_error,accepted_at=case when p_status='provider_accepted' then coalesce(accepted_at,clock_timestamp()) else accepted_at end,next_attempt_at=next_at,claim_token=null,lease_until=null where id=d.id returning * into d;
 return to_jsonb(d);
end $$;
revoke all on function public.queue_pv_sponsor_delivery(text,text,uuid,text,text,jsonb),public.claim_pv_sponsor_delivery(text,uuid),public.finish_pv_sponsor_delivery(text,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.queue_pv_sponsor_delivery(text,text,uuid,text,text,jsonb),public.claim_pv_sponsor_delivery(text,uuid),public.finish_pv_sponsor_delivery(text,uuid,uuid,text,text,text,integer) to service_role;
create function public.pv_sponsor_closure_metrics(p_principal text,p_sponsor text,p_record uuid default null,p_status text default null,p_area text default null,p_since timestamptz default null,p_until timestamptz default null)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'awaiting',count(*) filter(where c.state in ('awaiting_acknowledgement','acknowledgement_overdue','acknowledgement_disputed')),
 'acknowledged',count(*) filter(where c.state='acknowledged'),
 'overdue',count(*) filter(where c.state in ('awaiting_acknowledgement','acknowledgement_overdue') and (c.snapshot->'transmission'->>'deadline')::timestamptz<now()),
 'failed',count(*) filter(where c.state='transfer_failed'),
 'closed',count(*) filter(where c.state='transfer_closed'),
 'exceptions',coalesce(sum(jsonb_array_length(c.snapshot->'exceptions')),0),'total',count(*))
 from public.pv_sponsor_closures c join public.pv_records r on r.id=c.record_id and r.principal_id=c.principal_id
 where c.principal_id=p_principal and c.sponsor_id=p_sponsor and (p_record is null or c.record_id=p_record)
 and (p_status is null or r.status=p_status) and (p_area is null or r.therapeutic_area=p_area)
 and (p_since is null or c.created_at>=p_since) and (p_until is null or c.created_at<=p_until)
$$;
revoke all on function public.pv_sponsor_closure_metrics(text,text,uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.pv_sponsor_closure_metrics(text,text,uuid,text,text,timestamptz,timestamptz) to service_role;
commit;
