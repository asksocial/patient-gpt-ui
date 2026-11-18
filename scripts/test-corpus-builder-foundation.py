"""Replay Gate 1B twice in new loopback-only PostgreSQL/PostgREST profiles.

Pass directories for a PostgreSQL 17 runtime and a local PostgREST 16 binary.
The runner reads the checked-in baseline, never application configuration.
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"
CORRECTION = "202611180002_restrict_provisioning_privileges.sql"
FOUNDATION = "202611180003_corpus_builder_foundation.sql"
WORKSPACE = "31000000-0000-4000-8000-000000000001"
FOREIGN = "31000000-0000-4000-8000-000000000002"
START, END = "2026-01-01T00:00:00Z", "2026-04-01T00:00:00Z"
CONFIG = {
    "corpus_key": "synthetic", "name": "Synthetic corpus", "subject": "Synthetic infrastructure",
    "window_start": START, "window_end": END, "platform": "synthetic",
    "source_policy_ref": "synthetic-only", "retention_policy_ref": "test-retention",
    "retain_days": 3650, "sampling_policy": {"unit": "post"}, "budget_cents": 100,
    "attempt_limit_cents": 80, "queries": [
        {"key": "alpha", "expression": "synthetic alpha"},
        {"key": "beta", "expression": "synthetic beta"},
    ],
}


def migrations():
    manifest = ROOT / "docs/database-baseline/migrations.sha256"
    entries = [tuple(line.split()) for line in manifest.read_text().splitlines()]
    entries.append((CORRECTION, "a9bae49aaaf4a25ce21aa0aee05a97fea1cc388e0cad6e22897bf1bb0630f84a"))
    for name, digest in entries:
        assert hashlib.sha256((MIGRATIONS / name).read_bytes()).hexdigest() == digest, name
    return [MIGRATIONS / name for name, _ in entries]


def free_port():
    with socket.socket() as conn:
        conn.bind(("127.0.0.1", 0))
        return conn.getsockname()[1]


def token(role, key):
    def segment(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=")
    body = b".".join([
        segment({"alg": "HS256", "typ": "JWT"}),
        segment({"role": role, "sub": "synthetic-http", "exp": int(time.time()) + 600}),
    ])
    sig = base64.urlsafe_b64encode(hmac.digest(key.encode(), body, "sha256")).rstrip(b"=")
    return (body + b"." + sig).decode()


def native_fixture(row_id, day=None, author=None):
    row = {"post_id": row_id, "content": f"synthetic content for {row_id}", "collected_at": "2026-04-01T12:00:00Z"}
    if day:
        row.update(published_at=f"2026-01-{day:02}T10:00:00Z", source_url=f"https://example.invalid/{row_id}", engagement=day)
    if author:
        row["author_key"] = author * 64
    return row


def exercise(http, sql, *, retention=False):
    scope = {"p_workspace": WORKSPACE, "p_principal": "org_builder", "p_actor": "builder-admin"}

    def invoke(operation, payload, role="service_role", override=None):
        return http("rpc/corpus_builder_" + operation, role, {**scope, **payload, **(override or {})})

    def ok(operation, payload, override=None):
        status, value = invoke(operation, payload, override=override)
        assert status in (200, 204), (operation, status, value)
        return value

    def deny(operation, payload, role="service_role", override=None, code="42501"):
        status, info = invoke(operation, payload, role, override)
        assert status in (400, 401, 403, 404) and info.get("code") in (code, "PGRST202"), (operation, status, info)

    for role in (None, "authenticated"):
        deny("configure", {"p_config": CONFIG}, role)
    for actor in ("builder-client", "builder-suspended", "unknown-actor", "builder-viewer"):
        deny("configure", {"p_config": CONFIG}, override={"p_actor": actor})
    deny("configure", {"p_config": CONFIG}, override={"p_principal": "foreign"})
    deny("configure", {"p_config": CONFIG}, override={"p_workspace": FOREIGN, "p_principal": "org_foreign"})

    protocol = ok("configure", {"p_config": CONFIG})
    overview = ok("status", {"p_protocol": protocol}, override={"p_actor": "builder-viewer"})
    assert len(overview["queries"]) == 2 and overview["revision"] == 1
    foreign = {"p_workspace": FOREIGN, "p_principal": "org_foreign", "p_actor": "other-admin"}
    deny("status", {"p_protocol": protocol}, override=foreign)
    query_ids = [query["id"] for query in overview["queries"]]
    jobs = []
    for query in query_ids:
        payload = {"p_query": query, "p_start": START, "p_end": END}
        job = ok("queue", payload)
        assert ok("queue", payload) == job
        jobs.append(job)

    def reserve(job, key, cents=60, expected=3):
        return {"p_job": job, "p_key": key, "p_dataset": key+"-dataset", "p_expected_rows": expected, "p_cents": cents}

    with ThreadPoolExecutor(2) as pool:
        outcomes = list(pool.map(lambda job: invoke("reserve", reserve(job, "race")), jobs))
    assert sorted(status for status, _ in outcomes) == [200, 400], outcomes
    assert any(data.get("code") == "22023" for status, data in outcomes if status == 400)
    winner = next(i for i, (status, _) in enumerate(outcomes) if status == 200)
    failed_attempt = outcomes[winner][1]
    assert ok("reserve", reserve(jobs[winner], "race")) == failed_attempt
    deny("reserve", reserve(jobs[winner], "race", cents=59), code="22023")
    deny("job_status", {"p_job": jobs[winner]}, override=foreign)
    assert ok("page", {"p_attempt": failed_attempt, "p_offset": 0, "p_rows": [native_fixture("failed-only")]}) == 1
    deny("finish", {"p_attempt": failed_attempt, "p_status": "succeeded", "p_actual": 10}, code="22023")
    failed = {"p_attempt": failed_attempt, "p_status": "failed", "p_actual": 10}
    ok("finish", failed)
    ok("finish", failed)

    retry = ok("reserve", reserve(jobs[winner], "retry", cents=40))
    other = ok("reserve", reserve(jobs[1-winner], "other", cents=45, expected=3))
    extra_job = ok("queue", {"p_query": query_ids[0], "p_start": START, "p_end": "2026-02-01T00:00:00Z"})
    deny("reserve", reserve(extra_job, "over-budget", cents=6), code="22023")
    a = native_fixture("A", 8, "a")
    b = native_fixture("B")
    c = native_fixture("C", 20, "c")

    def page(attempt, offset, rows):
        return {"p_attempt": attempt, "p_offset": offset, "p_rows": rows}

    first_page = page(retry, 0, [a, a])
    assert ok("page", first_page) == 2
    assert ok("page", first_page) == 2
    deny("page", page(retry, 0, [a, b]), code="22023")
    deny("page", page(retry, 1, [b]), code="22023")
    deny("page", page(other, 0, [native_fixture("rollback-only"), {"content": "invalid"}]), code="22023")
    assert ok("job_status", {"p_job": jobs[1-winner]})["attempts"][0]["next_offset"] == 0
    assert ok("page", page(retry, 2, [b])) == 3
    older_a = {**a, "content": "older synthetic revision for A", "collected_at": "2026-03-30T12:00:00Z"}
    assert ok("page", page(other, 0, [{**a, "match_kind": "confirmed"}, c, older_a])) == 3
    ok("finish", {"p_attempt": retry, "p_status": "succeeded", "p_actual": 40})
    ok("finish", {"p_attempt": other, "p_status": "succeeded", "p_actual": 45})

    assert sql("select count(*) from corpus_builder.social_records") == "4"
    assert sql("select count(*) from corpus_builder.source_revisions") == "5"
    assert sql("select count(*) from corpus_builder.observations where cardinality(missing_fields)=4") == "2"
    assert sql("select count(*) from corpus_builder.query_matches where match_kind='confirmed'") == "1"
    assert sql("""select count(distinct q.query_id) from corpus_builder.query_matches q
      join corpus_builder.observations o on (o.workspace_id,o.id)=(q.workspace_id,q.observation_id)
      join corpus_builder.social_records s on (s.workspace_id,s.id)=(o.workspace_id,o.record_id)
      where s.native_post_id='A'""") == "2"
    assert sql("select sum(cents) from corpus_builder.usage_ledger where event_type='settle'") == "95"

    frame = ok("freeze_frame", {"p_protocol": protocol})
    assert ok("freeze_frame", {"p_protocol": protocol}) == frame
    manifest = ok("frame_manifest", {"p_frame": frame})
    assert manifest["record_count"] == 3 and manifest["available"]
    ids = manifest["record_ids"]
    lookup = {"p_platform": "synthetic", "p_post_id": "A"}
    source = ok("source_lookup", lookup)
    a_id = source["id"]
    assert not source["withdrawn"] and ok("source_lookup", lookup, override=foreign) is None
    assert a_id in ids
    assert sql(f"""select m.match_kind from corpus_builder.frame_entries e
      join corpus_builder.query_matches m on (m.workspace_id,m.observation_id)=(e.workspace_id,e.observation_id)
      where e.frame_id='{frame}' and e.record_id='{a_id}'""") == "confirmed"
    selection = {"p_frame": frame, "p_method": "synthetic-v1", "p_seed": "fixed", "p_records": ids}
    deny("freeze_version", {**selection, "p_records": [a_id, a_id]}, code="22023")
    deny("frame_manifest", {"p_frame": frame}, override=foreign)
    version = ok("freeze_version", selection)
    assert ok("freeze_version", selection) == version
    subset = ok("freeze_version", {**selection, "p_records": [i for i in ids if i != a_id]})
    version_status = ok("version_status", {"p_version": version})
    assert version_status["valid"]
    for statement in ("update corpus_builder.versions set seed='changed'", "delete from corpus_builder.audit_events",
                      "truncate corpus_builder.audit_events"):
        assert sql(f"""do $$ begin
           begin execute $statement${statement}$statement$;
             raise exception 'Unexpected mutation';
           exception when raise_exception then
             if sqlerrm <> 'Frozen Corpus Builder metadata cannot be changed' then raise; end if;
           end;
         end $$;""") == ""

    deny("withdraw", {"p_record": a_id, "p_reason": "expired"}, code="22023")
    deny("withdraw", {"p_record": a_id, "p_reason": "withdrawn"}, override=foreign)
    for _ in range(2):
        ok("withdraw", {"p_record": a_id, "p_reason": "withdrawn"})
    assert ok("source_lookup", lookup) == {"id": a_id, "withdrawn": True}
    assert not ok("version_status", {"p_version": version})["valid"]
    assert not ok("version_status", {"p_version": subset})["valid"]
    assert not ok("frame_manifest", {"p_frame": frame})["available"]
    deny("freeze_version", selection, code="22023")
    assert sql("select count(*) from corpus_builder.version_invalidations") == "2"
    assert sql("select count(*) from corpus_builder.source_content where content like '%for A'") == "0"
    assert sql("select count(*) from corpus_builder.observation_details where source_url like '%/A'") == "0"
    assert sql("select count(*) from corpus_builder.social_records where native_post_id is null") == "1"

    tombstone_retry = ok("reserve", reserve(extra_job, "withdrawn-source", cents=5, expected=1))
    deny("page", page(tombstone_retry, 0, [a]), code="22023")
    assert ok("job_status", {"p_job": extra_job})["attempts"][0]["next_offset"] == 0
    ok("finish", {"p_attempt": tombstone_retry, "p_status": "cancelled", "p_actual": 0})
    refreshed = ok("freeze_frame", {"p_protocol": protocol})
    refreshed_manifest = ok("frame_manifest", {"p_frame": refreshed})
    assert refreshed_manifest["record_count"] == 2
    refreshed_version = ok("freeze_version", {**selection, "p_frame": refreshed, "p_records": refreshed_manifest["record_ids"]})
    # Age a synthetic source in place to exercise the retention path.
    c_id = sql("select id from corpus_builder.social_records where native_post_id='C'")
    sql("update corpus_builder.source_content set expires_at=clock_timestamp()-interval '1 second' where content='synthetic content for C'")
    assert not ok("version_status", {"p_version": refreshed_version})["valid"]
    if retention:
        deny("withdraw", {"p_record": c_id, "p_reason": "expired"}, code="22023")
        assert ok("expire_revisions", {"p_cutoff": sql("select clock_timestamp()::text"), "p_limit": 5}) == 1
        assert sql("select count(*) from corpus_builder.revision_expirations") == "1"
    else:
        ok("withdraw", {"p_record": c_id, "p_reason": "expired"})
        assert sql("select count(*) from corpus_builder.version_invalidations where reason='expired'") == "3"
    assert sql("""with a as (
      select *,lag(event_digest) over (partition by workspace_id order by sequence) as prior
      from corpus_builder.audit_events
    ) select bool_and(previous_digest is not distinct from prior and event_digest =
       sha256(convert_to(jsonb_build_array(workspace_id,sequence,actor_id,action,resource_id,
         extract(epoch from recorded_at),encode(prior,'hex'))::text,'UTF8'))) from a""") == "t"
    assert sql("""select count(*) from corpus_builder.audit_events a
      where row_to_json(a)::text like '%synthetic content%' or row_to_json(a)::text like '%example.invalid%'""") == "0"
    return {"frame": manifest["digest"], "manifest": version_status["digest"]}


def build(args, files, label, *, extension=None, check_extension=None, retention=False):
    with tempfile.TemporaryDirectory(prefix=f"asksocial-corpus-{label}-") as directory:
        root = Path(directory)
        pg_port = free_port()
        http_port = free_port()
        while http_port == pg_port:
            http_port = free_port()
        owner_password, api_password, jwt_key = [secrets.token_hex(32) for _ in range(3)]
        password_file = root / "postgres-password"
        password_file.touch(mode=0o600)
        password_file.write_text(owner_password + "\n")
        data = root / "data"
        env = {"PATH": os.defpath, "LANG": "C", "PGSSLMODE": "disable", "PGCONNECT_TIMEOUT": "4",
               "DYLD_LIBRARY_PATH": str(args.pg_bin.parent / "lib")}
        pg_env = {**env, "PGHOST": "127.0.0.1", "PGHOSTADDR": "127.0.0.1", "PGPORT": str(pg_port),
                  "PGUSER": "postgres", "PGPASSWORD": owner_password, "PGDATABASE": "postgres"}

        def run(command, *, statement=None, selected_env=env):
            result = subprocess.run(command, input=statement, text=True, capture_output=True,
                                    env=selected_env, timeout=30)
            if result.returncode:
                # Command parameters never contain credentials. Database diagnostics
                # here refer only to synthetic fixtures.
                raise RuntimeError(f"{Path(command[0]).name}: {result.stderr[-2200:]}")
            return result.stdout.strip()

        def sql(statement):
            return run([args.pg_bin / "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-f", "-"],
                       statement=statement, selected_env=pg_env)

        run([args.pg_bin / "initdb", "--locale=C", "--encoding=UTF8", "--username=postgres",
             "--auth=scram-sha-256", f"--pwfile={password_file}", "-D", data])
        pg_ctl = [args.pg_bin / "pg_ctl", "-D", data]
        run([*pg_ctl, "-l", root / "postgres.log", "-o", f"-h 127.0.0.1 -p {pg_port} -k {root}", "-w", "start"])
        postgrest = None
        try:
            assert sql("select current_setting('listen_addresses')") == "127.0.0.1"
            assert sql("select current_setting('server_version_num')::integer / 10000") == "17"
            sql(f"""create role anon nologin noinherit;
              create role authenticated nologin noinherit;
              create role service_role nologin noinherit bypassrls;
              create role authenticator login noinherit password '{api_password}';
              grant anon,authenticated,service_role to authenticator;
              grant usage on schema public to anon,authenticated,service_role;
              alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
              alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
              alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
              create schema extensions;
              grant usage on schema extensions to anon,authenticated,service_role;
              create extension pgcrypto with schema extensions;
              create schema auth;
              grant usage on schema auth to anon,authenticated,service_role;
              create function auth.jwt() returns jsonb language sql stable set search_path='' as $$
                select nullif(current_setting('request.jwt.claims',true),'')::jsonb
              $$;""")
            for file in files:
                try:
                    sql(file.read_text())
                except RuntimeError as error:
                    raise RuntimeError(f"{file.name}: {error}") from error
            sql(f"""insert into public.user_provisioning(email,clerk_user_id,organization_id,account_role,state)
              values ('owner@example.invalid','builder-admin',null,'platform_admin','active'),
                     ('viewer@example.invalid','builder-viewer',null,'platform_admin','active'),
                     ('other@example.invalid','other-admin',null,'platform_admin','active'),
                     ('suspended@example.invalid','builder-suspended',null,'platform_admin','suspended'),
                     ('client@example.invalid','builder-client','org_builder','client_admin','active');
              insert into public.intelligence_workspaces(id,principal_id,principal_type,name,created_by)
              values ('{WORKSPACE}','org_builder','organization','Synthetic workspace','builder-admin'),
                     ('{FOREIGN}','org_foreign','organization','Synthetic foreign workspace','other-admin');
              insert into public.intelligence_workspace_members(workspace_id,principal_id,user_id,role,added_by)
              values ('{WORKSPACE}','org_builder','builder-viewer','viewer','builder-admin'),
                     ('{WORKSPACE}','org_builder','builder-client','editor','builder-admin'),
                     ('{WORKSPACE}','org_builder','builder-suspended','editor','builder-admin');
              select public.create_evidence_corpus('org_builder','{WORKSPACE}','builder-admin',
                '{{"corpusKey":"coexistence","name":"Synthetic Evidence Integrity sentinel"}}'::jsonb);""")
            preservation = """select jsonb_build_array(
              (select jsonb_agg(to_jsonb(e) order by e.id) from public.evidence_corpora e),
              (select jsonb_agg(to_jsonb(a) order by a.sequence) from public.evidence_audit_events a),
              (select count(*) from public.pv_records),
              (select count(*) from public.pv_audit_events))::text"""
            before = sql(preservation)
            catalog = """select jsonb_agg(jsonb_build_array(c.relname,c.relacl,c.relrowsecurity,
                (select jsonb_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where conrelid=c.oid))
                order by c.relname)::text from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'"""
            routines = """select jsonb_agg(jsonb_build_array(pg_get_functiondef(p.oid),p.proacl) order by oid::regprocedure::text)::text
                from pg_proc p where pronamespace='public'::regnamespace and prokind='f'
                  and left(proname,15)<>'corpus_builder_' and left(proname,19)<>'corpus_acquisition_'"""
            contracts = sql(catalog), sql(routines)
            sql((MIGRATIONS / FOUNDATION).read_text())
            if extension is not None:
                for migration in extension if isinstance(extension, tuple) else (extension,):
                    sql(migration.read_text())
            assert contracts == (sql(catalog), sql(routines))
            assert sql(preservation) == before
            assert sql("""select bool_and(relrowsecurity and not has_table_privilege('service_role',oid,'SELECT,INSERT,UPDATE,DELETE')
                 and not has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE'))
              from pg_class where relnamespace='corpus_builder'::regnamespace and relkind='r'""") == "t"
            assert sql("""select not has_schema_privilege('service_role','corpus_builder','USAGE')
              and not has_schema_privilege('authenticated','corpus_builder','USAGE')""") == "t"
            for role in ("anon", "authenticated", "authenticator", "service_role"):
                try:
                    sql(f"set role {role}; select count(*) from corpus_builder.social_records;")
                except RuntimeError as error:
                    assert "permission denied" in str(error)
                else:
                    raise AssertionError(f"{role} read private Builder storage")
            schema = run([args.pg_bin / "pg_dump", "--schema-only"], selected_env=pg_env)
            lines = [line for line in schema.splitlines() if not line.startswith(("\\restrict ", "\\unrestrict "))]
            schema_digest = hashlib.sha256("\n".join(lines).encode()).hexdigest()

            api_env = {**env, "PGRST_DB_URI": f"postgresql://authenticator:{api_password}@127.0.0.1:{pg_port}/postgres",
                       "PGRST_DB_SCHEMAS": "public", "PGRST_DB_EXTRA_SEARCH_PATH": "extensions",
                       "PGRST_DB_ANON_ROLE": "anon", "PGRST_SERVER_HOST": "127.0.0.1",
                       "PGRST_SERVER_PORT": str(http_port), "PGRST_JWT_SECRET": jwt_key}
            with (root / "postgrest.log").open("w") as log:
                postgrest = subprocess.Popen([args.postgrest], env=api_env, stdout=log, stderr=log)

            def http(path, role, body):
                headers = {"Content-Type": "application/json", "Connection": "close"}
                if role:
                    headers["Authorization"] = "Bearer " + token(role, jwt_key)
                request = Request(f"http://127.0.0.1:{http_port}/{path}", headers=headers,
                                  data=json.dumps(body).encode(), method="POST")
                try:
                    response = build_opener(ProxyHandler({})).open(request, timeout=8)
                except HTTPError as error:
                    response = error
                with response:
                    raw = response.read()
                    return response.status, json.loads(raw) if raw else None

            for _ in range(60):
                if postgrest.poll() is not None:
                    raise RuntimeError((root / "postgrest.log").read_text()[-1500:])
                try:
                    if http("rpc/corpus_builder_status", None, {})[0] != 503:
                        break
                except OSError:
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("PostgREST did not become ready")

            digests = exercise(http, sql, retention=retention)
            if check_extension is not None:
                digests.update(check_extension(http, sql))
            assert sql(preservation) == before
            assert contracts == (sql(catalog), sql(routines))
            print(f"PASS {label}: authorized PostgREST lifecycle, budget race, immutability, source deletion and coexistence", flush=True)
            return {"schema": schema_digest, **digests}
        finally:
            if postgrest is not None and postgrest.poll() is None:
                postgrest.terminate()
                postgrest.wait(timeout=10)
            run([*pg_ctl, "-m", "fast", "-w", "stop"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", required=True, type=lambda path: Path(path).resolve())
    parser.add_argument("--postgrest", required=True, type=lambda path: Path(path).resolve())
    args = parser.parse_args()
    files = migrations()
    first, second = (build(args, files, label) for label in ("one", "two"))
    assert first == second, (first, second)
    print("PASS two fresh replays with matching schema, frame and manifest digests", json.dumps(first, sort_keys=True))


if __name__ == "__main__":
    main()
