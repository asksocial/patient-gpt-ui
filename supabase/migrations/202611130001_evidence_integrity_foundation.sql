-- Stage 1 only: retained source evidence, not analytical qualification or PV state.
-- Requires existing platform persistence and workspace membership migrations.
begin;

create table public.evidence_corpora (
 id uuid primary key default gen_random_uuid(), principal_id text not null,
 workspace_id uuid not null references public.intelligence_workspaces(id),
 corpus_key text not null check(length(corpus_key) between 1 and 200),
 name text not null check(length(name) between 1 and 300),
 therapeutic_area text, program_reference text,
 created_by text not null, created_at timestamptz not null default now(),
 unique(principal_id,workspace_id,corpus_key), unique(principal_id,workspace_id,id)
);
create table public.evidence_source_records (
 id uuid primary key default gen_random_uuid(), principal_id text not null,
 workspace_id uuid not null references public.intelligence_workspaces(id),
 platform text not null, source_namespace text not null, source_identifier text,
 record_key text not null, identity_basis text not null check(identity_basis in ('source_identifier','source_url','content_fallback')),
 created_at timestamptz not null default now(),
 unique(principal_id,workspace_id,record_key), unique(principal_id,workspace_id,id)
);
create table public.evidence_accounts (
 id uuid primary key default gen_random_uuid(), principal_id text not null,
 workspace_id uuid not null references public.intelligence_workspaces(id),
 platform text not null, pseudonym text not null check(pseudonym ~ '^[a-f0-9]{64}$'),
 key_version text not null, created_at timestamptz not null default now(),
 unique(principal_id,workspace_id,platform,key_version,pseudonym), unique(principal_id,workspace_id,id)
);
create table public.evidence_source_revisions (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null,
 source_record_id uuid not null, revision integer not null check(revision>0),
 content_hash text not null, payload_hash text not null,
 original_content text not null, normalized_content text not null,
 original_fields jsonb not null default '{}', account_id uuid,
 retained_at timestamptz not null default now(),
 foreign key(principal_id,workspace_id,source_record_id) references public.evidence_source_records(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,account_id) references public.evidence_accounts(principal_id,workspace_id,id),
 unique(source_record_id,revision), unique(source_record_id,payload_hash), unique(principal_id,workspace_id,id)
);
create table public.evidence_corpus_versions (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null,
 corpus_id uuid not null, version integer not null check(version>0), manifest_hash text not null,
 record_count integer not null check(record_count>=0), created_at timestamptz not null default now(),
 foreign key(principal_id,workspace_id,corpus_id) references public.evidence_corpora(principal_id,workspace_id,id),
 unique(corpus_id,version), unique(corpus_id,manifest_hash), unique(principal_id,workspace_id,id), unique(principal_id,workspace_id,corpus_id,id)
);
create table public.evidence_manifest_entries (
 principal_id text not null, workspace_id uuid not null, corpus_version_id uuid not null,
 ordinal integer not null check(ordinal>=0), source_revision_id uuid not null,
 primary key(corpus_version_id,ordinal),
 foreign key(principal_id,workspace_id,corpus_version_id) references public.evidence_corpus_versions(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,source_revision_id) references public.evidence_source_revisions(principal_id,workspace_id,id)
);
create table public.evidence_ingestion_batches (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null,
 corpus_id uuid not null, corpus_version_id uuid not null, request_key text not null,
 import_sequence bigint generated always as identity,
 input_hash text not null, provider text not null, provider_job_id text, provider_actor text,
 collected_at timestamptz, original_file_hash text,
 retention_basis text not null check(length(btrim(retention_basis))>=10),
 retention_policy_reference text not null check(length(btrim(retention_policy_reference))>0),
 row_count integer not null, status text not null default 'completed' check(status='completed'),
 imported_by text not null, imported_at timestamptz not null default now(),
 foreign key(principal_id,workspace_id,corpus_id) references public.evidence_corpora(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,corpus_id,corpus_version_id) references public.evidence_corpus_versions(principal_id,workspace_id,corpus_id,id),
 unique(corpus_id,request_key), unique(principal_id,workspace_id,id)
);
create table public.evidence_source_observations (
 principal_id text not null, workspace_id uuid not null, batch_id uuid not null,
 ordinal integer not null, source_revision_id uuid not null,
 source_url text, published_at timestamptz, collected_at timestamptz,
 provenance_status text not null check(provenance_status in ('available','incomplete')),
 missing_provenance text[] not null,
 primary key(batch_id,ordinal),
 foreign key(principal_id,workspace_id,batch_id) references public.evidence_ingestion_batches(principal_id,workspace_id,id),
 foreign key(principal_id,workspace_id,source_revision_id) references public.evidence_source_revisions(principal_id,workspace_id,id)
);
create table public.evidence_audit_events (
 id uuid primary key default gen_random_uuid(), principal_id text not null, workspace_id uuid not null,
 sequence bigint not null, actor_id text not null, action text not null,
 resource_id uuid not null, metadata jsonb not null, recorded_at timestamptz not null,
 previous_hash text not null, event_hash text not null, canonical_payload text not null,
 unique(principal_id,workspace_id,sequence)
);
create index evidence_observations_revision on public.evidence_source_observations(source_revision_id);
create index evidence_batches_scope on public.evidence_ingestion_batches(principal_id,workspace_id,corpus_id,imported_at);

-- Service-role bypass of RLS is NOT an authorization boundary. Only scoped RPCs
-- are granted, and each checks existing workspace ownership/membership itself.
create function public.evidence_foundation_access(p_principal text,p_workspace uuid,p_actor text,p_write boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.intelligence_workspaces; member_role text;
begin
 if nullif(btrim(p_principal),'') is null or nullif(btrim(p_actor),'') is null then raise exception 'Identity required'; end if;
 select * into w from public.intelligence_workspaces where id=p_workspace and principal_id=p_principal and archived_at is null;
 if not found then raise exception 'Evidence workspace unavailable'; end if;
 select role into member_role from public.intelligence_workspace_members where workspace_id=p_workspace and principal_id=p_principal and user_id=p_actor;
 if member_role is null and w.created_by=p_actor then member_role:='owner'; end if;
 if member_role is null or (p_write and member_role not in ('owner','editor')) then raise exception 'Evidence workspace access denied'; end if;
end $$;

create function public.evidence_foundation_immutable() returns trigger language plpgsql as $$
begin raise exception 'Retained evidence and audit history are append-only'; end $$;

-- Called only by transactional security-definer functions; not directly granted.
create function public.evidence_foundation_audit(p_principal text,p_workspace uuid,p_actor text,p_action text,p_resource uuid,p_metadata jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare prior text; seq bigint; stamp timestamptz:=clock_timestamp(); payload text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 select event_hash,sequence into prior,seq from public.evidence_audit_events where principal_id=p_principal and workspace_id=p_workspace order by sequence desc limit 1;
 prior:=coalesce(prior,'GENESIS'); seq:=coalesce(seq,0)+1;
 payload:=jsonb_build_object('principalId',p_principal,'workspaceId',p_workspace,'actorId',p_actor,'action',p_action,'resourceId',p_resource,'metadata',p_metadata,'sequence',seq,'recordedAt',stamp,'previousHash',prior)::text;
 insert into public.evidence_audit_events(principal_id,workspace_id,sequence,actor_id,action,resource_id,metadata,recorded_at,previous_hash,event_hash,canonical_payload)
 values(p_principal,p_workspace,seq,p_actor,p_action,p_resource,p_metadata,stamp,prior,encode(sha256(convert_to(payload,'UTF8')),'hex'),payload);
end $$;

create function public.create_evidence_corpus(p_principal text,p_workspace uuid,p_actor text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.evidence_corpora;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 -- Serialize creation and audit in the same order as imports.
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 select * into c from public.evidence_corpora where principal_id=p_principal and workspace_id=p_workspace and corpus_key=p_input->>'corpusKey';
 if found then
  if c.name is distinct from p_input->>'name' or c.therapeutic_area is distinct from p_input->>'therapeuticArea' or c.program_reference is distinct from p_input->>'programReference' then raise exception 'Corpus key reused with different metadata'; end if;
  return to_jsonb(c);
 end if;
 insert into public.evidence_corpora(principal_id,workspace_id,corpus_key,name,therapeutic_area,program_reference,created_by)
 values(p_principal,p_workspace,p_input->>'corpusKey',p_input->>'name',p_input->>'therapeuticArea',p_input->>'programReference',p_actor) returning * into c;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'corpus.create',c.id,'{}');
 return to_jsonb(c);
end $$;

create function public.import_evidence_batch(p_principal text,p_workspace uuid,p_actor text,p_corpus uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.evidence_ingestion_batches; r jsonb; source_id uuid; revision_id uuid; v_account_id uuid;
 identity text; identity_basis text; v_content_hash text; v_payload_hash text; payload jsonb; input_hash text;
 manifest jsonb:='[]'; revision_ids uuid[]:='{}'; batch_revision_ids uuid[]:='{}'; version_id uuid; v_manifest_hash text; i integer:=0; missing text[];
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_principal||':'||p_workspace::text,131001));
 perform 1 from public.evidence_corpora where id=p_corpus and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Evidence corpus unavailable'; end if;
 if octet_length(p_input::text)>4194304 then raise exception 'Evidence batch exceeds 4 MB'; end if;
 if jsonb_typeof(p_input->'records') is distinct from 'array' or jsonb_array_length(p_input->'records')>1000 then raise exception 'Expected at most 1000 source records'; end if;
 if nullif(btrim(p_input->>'requestKey'),'') is null or nullif(btrim(p_input->>'provider'),'') is null then raise exception 'Request key and provider required'; end if;
 if p_input->>'retentionPermitted' is distinct from 'true' then raise exception 'Source retention permission required'; end if;
 input_hash:=encode(sha256(convert_to((p_input-'requestKey')::text,'UTF8')),'hex');
 select * into b from public.evidence_ingestion_batches where corpus_id=p_corpus and request_key=p_input->>'requestKey';
 if found then
  if b.input_hash<>input_hash then raise exception 'Import request key reused for different evidence'; end if;
  return to_jsonb(b)||jsonb_build_object('replayed',true);
 end if;
 for r in select value from jsonb_array_elements(p_input->'records') loop
  if nullif(btrim(r->>'platform'),'') is null or nullif(btrim(r->>'sourceNamespace'),'') is null or jsonb_typeof(r->'originalContent') is distinct from 'string' then raise exception 'Platform, namespace and original content required'; end if;
  if jsonb_typeof(r->'originalFields') is distinct from 'object' or jsonb_typeof(r->'normalizedContent') is distinct from 'string' then raise exception 'Original fields and normalized text required'; end if;
  v_content_hash:=encode(sha256(convert_to(r->>'originalContent','UTF8')),'hex');
  identity_basis:=case when nullif(btrim(r->>'sourceIdentifier'),'') is not null then 'source_identifier' when nullif(btrim(r->>'sourceUrl'),'') is not null then 'source_url' else 'content_fallback' end;
  identity:=encode(sha256(convert_to(jsonb_build_array(r->>'platform',r->>'sourceNamespace',identity_basis,case when identity_basis='source_identifier' then r->>'sourceIdentifier' when identity_basis='source_url' then r->>'sourceUrl' else v_content_hash end)::text,'UTF8')),'hex');
  select id into source_id from public.evidence_source_records where principal_id=p_principal and workspace_id=p_workspace and record_key=identity;
  if not found then
   insert into public.evidence_source_records(principal_id,workspace_id,platform,source_namespace,source_identifier,record_key,identity_basis)
   values(p_principal,p_workspace,r->>'platform',r->>'sourceNamespace',r->>'sourceIdentifier',identity,identity_basis) returning id into source_id;
  end if;
  v_account_id:=null;
  if r->>'accountPseudonym' is not null then
   if nullif(btrim(r->>'accountKeyVersion'),'') is null then raise exception 'Account key version required'; end if;
   select id into v_account_id from public.evidence_accounts where principal_id=p_principal and workspace_id=p_workspace and platform=r->>'platform' and key_version=r->>'accountKeyVersion' and pseudonym=r->>'accountPseudonym';
   if not found then
    insert into public.evidence_accounts(principal_id,workspace_id,platform,pseudonym,key_version) values(p_principal,p_workspace,r->>'platform',r->>'accountPseudonym',r->>'accountKeyVersion') returning id into v_account_id;
   end if;
  end if;
  payload:=jsonb_build_object('originalContent',r->>'originalContent','normalizedContent',r->>'normalizedContent','originalFields',r->'originalFields','accountPseudonym',r->>'accountPseudonym','accountKeyVersion',r->>'accountKeyVersion');
  v_payload_hash:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
  select id into revision_id from public.evidence_source_revisions where source_record_id=source_id and evidence_source_revisions.payload_hash=v_payload_hash;
  if not found then
   insert into public.evidence_source_revisions(principal_id,workspace_id,source_record_id,revision,content_hash,payload_hash,original_content,normalized_content,original_fields,account_id)
   select p_principal,p_workspace,source_id,coalesce(max(revision),0)+1,v_content_hash,v_payload_hash,r->>'originalContent',r->>'normalizedContent',r->'originalFields',v_account_id from public.evidence_source_revisions where source_record_id=source_id
   returning id into revision_id;
  end if;
  revision_ids:=array_append(revision_ids,revision_id);
  manifest:=manifest||jsonb_build_array(jsonb_build_object('sourceKey',identity,'payloadHash',v_payload_hash));
 end loop;
 -- Corpus manifests are cumulative retained-source snapshots, not analytical
 -- qualification. Later batches update a source reference; they never remove
 -- previously retained sources. Repeated rows remain separate observations.
 batch_revision_ids:=revision_ids;
 with candidates as (
  select e.source_revision_id as id,-1::bigint as precedence
  from public.evidence_manifest_entries e
  where e.corpus_version_id=(select latest_batch.corpus_version_id from public.evidence_ingestion_batches latest_batch where latest_batch.corpus_id=p_corpus order by latest_batch.import_sequence desc limit 1)
  union all select u.id,u.ordinality from unnest(batch_revision_ids) with ordinality as u(id,ordinality)
 ), chosen as (
  select distinct on (s.id) r.id,s.record_key,r.payload_hash
  from candidates c join public.evidence_source_revisions r on r.id=c.id
  join public.evidence_source_records s on s.id=r.source_record_id
  order by s.id,c.precedence desc
 )
 select coalesce(array_agg(chosen.id order by chosen.record_key),'{}'),
 coalesce(jsonb_agg(jsonb_build_object('sourceKey',chosen.record_key,'payloadHash',chosen.payload_hash) order by chosen.record_key),'[]')
 into revision_ids,manifest from chosen;
 v_manifest_hash:=encode(sha256(convert_to(manifest::text,'UTF8')),'hex');
 select id into version_id from public.evidence_corpus_versions where corpus_id=p_corpus and evidence_corpus_versions.manifest_hash=v_manifest_hash;
 if not found then
  insert into public.evidence_corpus_versions(principal_id,workspace_id,corpus_id,version,manifest_hash,record_count)
  select p_principal,p_workspace,p_corpus,coalesce(max(version),0)+1,v_manifest_hash,cardinality(revision_ids) from public.evidence_corpus_versions where corpus_id=p_corpus returning id into version_id;
  if cardinality(revision_ids)>0 then
   for i in 1..cardinality(revision_ids) loop
    insert into public.evidence_manifest_entries values(p_principal,p_workspace,version_id,i-1,revision_ids[i]);
   end loop;
  end if;
 end if;
 insert into public.evidence_ingestion_batches(principal_id,workspace_id,corpus_id,corpus_version_id,request_key,input_hash,provider,provider_job_id,provider_actor,collected_at,original_file_hash,retention_basis,retention_policy_reference,row_count,imported_by)
 values(p_principal,p_workspace,p_corpus,version_id,p_input->>'requestKey',input_hash,p_input->>'provider',p_input->>'providerJobId',p_input->>'providerActor',(p_input->>'collectedAt')::timestamptz,p_input->>'originalFileHash',p_input->>'retentionBasis',p_input->>'retentionPolicyReference',cardinality(batch_revision_ids),p_actor) returning * into b;
 i:=0;
 for r in select value from jsonb_array_elements(p_input->'records') loop
  missing:='{}';
  if r->>'platform'='unknown' then missing:=array_append(missing,'platform'); end if;
  if r->>'sourceIdentifier' is null then missing:=array_append(missing,'source_identifier'); end if;
  if r->>'sourceUrl' is null then missing:=array_append(missing,'source_url'); end if;
  if r->>'publishedAt' is null then missing:=array_append(missing,'published_at'); end if;
  if coalesce(r->>'collectedAt',p_input->>'collectedAt') is null then missing:=array_append(missing,'collected_at'); end if;
  if p_input->>'providerJobId' is null then missing:=array_append(missing,'provider_job_id'); end if;
  insert into public.evidence_source_observations values(p_principal,p_workspace,b.id,i,batch_revision_ids[i+1],r->>'sourceUrl',(r->>'publishedAt')::timestamptz,coalesce(r->>'collectedAt',p_input->>'collectedAt')::timestamptz,case when cardinality(missing)=0 then 'available' else 'incomplete' end,missing);
  i:=i+1;
 end loop;
 perform public.evidence_foundation_audit(p_principal,p_workspace,p_actor,'batch.retain',b.id,jsonb_build_object('corpusId',p_corpus,'corpusVersionId',version_id,'recordCount',b.row_count));
 return to_jsonb(b)||jsonb_build_object('replayed',false);
end $$;

create function public.read_evidence_foundation(p_principal text,p_workspace uuid,p_actor text,p_corpus uuid default null,p_version uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 if p_corpus is null then
  if p_version is not null then raise exception 'Corpus required for manifest'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at,c.id) from public.evidence_corpora c where principal_id=p_principal and workspace_id=p_workspace),'[]');
 end if;
 perform 1 from public.evidence_corpora where id=p_corpus and principal_id=p_principal and workspace_id=p_workspace;
 if not found then raise exception 'Evidence corpus unavailable'; end if;
 if p_version is not null then
  perform 1 from public.evidence_corpus_versions where id=p_version and corpus_id=p_corpus and principal_id=p_principal and workspace_id=p_workspace;
  if not found then raise exception 'Evidence version unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('ordinal',e.ordinal,'source',to_jsonb(s),'revision',to_jsonb(r)) order by e.ordinal),'[]') into result
  from public.evidence_manifest_entries e join public.evidence_source_revisions r on r.id=e.source_revision_id join public.evidence_source_records s on s.id=r.source_record_id
  where e.corpus_version_id=p_version and e.principal_id=p_principal and e.workspace_id=p_workspace;
  return result;
 end if;
 return jsonb_build_object(
  'versions',coalesce((select jsonb_agg(to_jsonb(v) order by version) from public.evidence_corpus_versions v where corpus_id=p_corpus and principal_id=p_principal and workspace_id=p_workspace),'[]'),
  'batches',coalesce((select jsonb_agg(to_jsonb(b) order by import_sequence) from public.evidence_ingestion_batches b where corpus_id=p_corpus and principal_id=p_principal and workspace_id=p_workspace),'[]'),
  'observations',coalesce((select jsonb_agg(to_jsonb(o) order by o.batch_id,o.ordinal) from public.evidence_source_observations o join public.evidence_ingestion_batches b on b.id=o.batch_id where b.corpus_id=p_corpus and o.principal_id=p_principal and o.workspace_id=p_workspace),'[]'));
end $$;

create function public.read_evidence_audit(p_principal text,p_workspace uuid,p_actor text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.evidence_foundation_access(p_principal,p_workspace,p_actor,false);
 return coalesce((select jsonb_agg(to_jsonb(e) order by sequence) from public.evidence_audit_events e where principal_id=p_principal and workspace_id=p_workspace),'[]');
end $$;

do $$ declare t text; begin
 foreach t in array array['evidence_corpora','evidence_source_records','evidence_accounts','evidence_source_revisions','evidence_corpus_versions','evidence_manifest_entries','evidence_ingestion_batches','evidence_source_observations','evidence_audit_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger evidence_append_only before update or delete on public.%I for each row execute function public.evidence_foundation_immutable()',t);
  execute format('create trigger evidence_no_truncate before truncate on public.%I execute function public.evidence_foundation_immutable()',t);
 end loop;
end $$;
revoke all on sequence public.evidence_ingestion_batches_import_sequence_seq from public,anon,authenticated,service_role;
revoke all on function public.evidence_foundation_access(text,uuid,text,boolean),public.evidence_foundation_immutable(),public.evidence_foundation_audit(text,uuid,text,text,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.create_evidence_corpus(text,uuid,text,jsonb),public.import_evidence_batch(text,uuid,text,uuid,jsonb),public.read_evidence_foundation(text,uuid,text,uuid,uuid),public.read_evidence_audit(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.create_evidence_corpus(text,uuid,text,jsonb),public.import_evidence_batch(text,uuid,text,uuid,jsonb),public.read_evidence_foundation(text,uuid,text,uuid,uuid),public.read_evidence_audit(text,uuid,text) to service_role;
commit;
