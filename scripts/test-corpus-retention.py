"""Exercise retention and a synthetic provider release workflow on two fresh profiles."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("connector_profile", Path(__file__).with_name("test-corpus-acquisition.py"))
connector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(connector)
base = connector.base


def exercise(http, sql):
    home = {"p_workspace": base.WORKSPACE, "p_principal": "org_builder", "p_actor": "builder-admin"}
    foreign = {"p_workspace": base.FOREIGN, "p_principal": "org_foreign", "p_actor": "other-admin"}
    executor = {**home, "p_actor": "other-admin"}
    sql(f"""insert into public.intelligence_workspace_members(workspace_id,principal_id,user_id,role,added_by)
        values ('{base.WORKSPACE}','org_builder','other-admin','editor','builder-admin');
        insert into corpus_builder.exclusive_provider_accounts(provider,account_id,approval_ref,release_enabled,execution_mode)
        values ('apify','SyntheticOwner','fixture-approval',true,'fixture');""")

    digests = connector.exercise(http, sql, retention=True)

    def call(name, payload, scope=home, role="service_role"):
        return http("rpc/corpus_" + name, role, {**scope, **payload})

    def ok(name, payload, scope=home):
        status, value = call(name, payload, scope)
        assert status in (200, 204), (name, status, value)
        return value

    def deny(name, payload, scope=home, role="service_role", code=None):
        status, value = call(name, payload, scope, role)
        assert status in (400, 401, 403, 404, 409), (name, status, value)
        if code:
            assert value["code"] == code, (name, status, value)

    def protocol_for(key, scope=home, **config):
        protocol = ok("builder_configure", {"p_config": {**base.CONFIG, "corpus_key": key, **config}}, scope)
        return protocol, ok("builder_status", {"p_protocol": protocol}, scope)["queries"][0]["id"]

    protocol, query = protocol_for("revision-retention")
    job = ok("builder_queue", {"p_query": query, "p_start": base.START, "p_end": base.END})
    attempt = ok("builder_reserve", {"p_job": job, "p_key": "mixed", "p_dataset": "synthetic-direct",
                                    "p_expected_rows": 1, "p_cents": 10})
    older = base.native_fixture("mixed-post", 1, "a")
    newer = {**older, "content": "synthetic updated revision", "collected_at": "2026-04-01T13:00:00Z",
             "source_url": "https://example.invalid/new", "author_key": "b" * 64}
    first = {"p_attempt": attempt, "p_offset": 0, "p_rows": [older]}
    deny("builder_page", {**first, "p_rows": [{**older, "unknown_field": "synthetic"}]}, code="22023")
    assert ok("builder_page", first) == 1
    ok("builder_finish", {"p_attempt": attempt, "p_status": "succeeded", "p_actual": 3})
    old_frame = ok("builder_freeze_frame", {"p_protocol": protocol})
    old_manifest = ok("builder_frame_manifest", {"p_frame": old_frame})
    old_version = ok("builder_freeze_version", {"p_frame": old_frame, "p_method": "synthetic", "p_seed": "fixed",
                                                "p_records": old_manifest["record_ids"]})
    query2 = ok("builder_status", {"p_protocol": protocol})["queries"][1]["id"]
    job2 = ok("builder_queue", {"p_query": query2, "p_start": base.START, "p_end": base.END})
    attempt2 = ok("builder_reserve", {"p_job": job2, "p_key": "mixed-new", "p_dataset": "synthetic-direct",
                                     "p_expected_rows": 1, "p_cents": 10})
    assert ok("builder_page", {"p_attempt": attempt2, "p_offset": 0, "p_rows": [newer]}) == 1
    ok("builder_finish", {"p_attempt": attempt2, "p_status": "succeeded", "p_actual": 3})

    def revision(body):
        return sql(f"select revision_id from corpus_builder.source_content where workspace_id='{base.WORKSPACE}' and content='{body}'")
    old_id, new_id = revision(older["content"]), revision(newer["content"])
    current_frame = ok("builder_freeze_frame", {"p_protocol": protocol})
    manifest = ok("builder_frame_manifest", {"p_frame": current_frame})
    version = ok("builder_freeze_version", {"p_frame": current_frame, "p_method": "synthetic", "p_seed": "fixed",
                                            "p_records": manifest["record_ids"]})
    key = "31000000-0000-4000-8000-000000000055"
    params = {"p_revision": old_id, "p_key": key}
    vector = [0.25, 0.75]
    ok("builder_revision_artifact_put", {**params, "p_kind": "embedding", "p_payload": vector})
    ok("builder_revision_artifact_put", {**params, "p_revision": new_id, "p_kind": "extract", "p_payload": "synthetic"})
    assert ok("builder_revision_artifact_get", params) == vector
    deny("builder_revision_artifact_get", params, role="authenticated")
    assert ok("builder_revision_artifact_get", params, foreign) is None
    lookup = {"p_platform": "synthetic", "p_post_id": "mixed-post"}
    identity = ok("builder_source_lookup", lookup)

    cutoff = sql(f"""update corpus_builder.source_content set expires_at=clock_timestamp()
        where workspace_id='{base.WORKSPACE}' and revision_id='{old_id}' returning expires_at::text""")
    assert ok("builder_revision_artifact_get", params) is None
    status_before_cleanup = ok("builder_version_status", {"p_version": old_version})
    assert not status_before_cleanup["valid"]
    assert not ok("builder_frame_manifest", {"p_frame": old_frame})["available"]
    assert sql(f"select count(*) from corpus_builder.revision_artifacts where revision_id='{old_id}'") == "1"
    expire = {"p_cutoff": cutoff, "p_limit": 1}
    deny("builder_expire_revisions", expire, scope={**home, "p_actor": "builder-viewer"}, code="42501")
    assert ok("builder_expire_revisions", expire, foreign) == 0
    assert ok("builder_expire_revisions", expire) == 1
    assert ok("builder_expire_revisions", expire) == 0
    assert sql(f"select retention_policy_ref from corpus_builder.revision_expirations where revision_id='{old_id}'") == "test-retention"
    assert sql(f"select count(*) from corpus_builder.revision_artifacts where revision_id='{old_id}'") == "0"
    assert sql("select count(*) from corpus_builder.observation_details where source_url='https://example.invalid/mixed-post'") == "0"
    assert ok("builder_revision_artifact_get", {**params, "p_revision": new_id}) == "synthetic"
    assert ok("builder_source_lookup", lookup) == identity
    assert ok("builder_version_status", {"p_version": version})["valid"]
    assert ok("builder_frame_manifest", {"p_frame": current_frame}) == manifest
    assert ok("builder_version_status", {"p_version": old_version}) == status_before_cleanup
    assert ok("builder_frame_manifest", {"p_frame": old_frame})["digest"] == old_manifest["digest"]
    assert ok("builder_page", first) == 1
    deny("builder_page", {**first, "p_rows": [{**older, "content": "changed"}]}, code="22023")
    assert sql(f"select count(*) from corpus_builder.source_content where revision_id='{old_id}'") == "0"
    ok("builder_withdraw", {"p_record": identity["id"], "p_reason": "withdrawn"})
    assert ok("builder_revision_artifact_get", {**params, "p_revision": new_id}) is None

    def create_plan(key, scope=home, days=1):
        protocol_id, query_id = protocol_for(key, scope, retain_days=days)
        payload = {"protocol_id": protocol_id, "request_key": key, "provider": "apify",
                   "mapping_ref": "synthetic:v1", "mapping_digest": "b" * 64,
                   "normalization_version": "apify-row-v1", "platform": "synthetic",
                   "source_policy_ref": "synthetic-only", "retention_policy_ref": "test-retention",
                   "concurrency": 1, "hours": 1, "jobs": [
                       {"query_id": query_id, "start": base.START, "end": base.END, "cents": 25, "max_rows": 1}]}
        plan = ok("acquisition_approve", {"p_plan": payload}, scope)
        return plan

    def claim(plan, scope=home):
        return ok("acquisition_claim", {"p_plan": plan}, scope)

    def transition(work, step, **data):
        return {"p_work": work["id"], "p_lease": work["lease_token"], "p_step": step, "p_data": data}

    def advance(work, step, scope=home, **data):
        ok("acquisition_advance", transition(work, step, **data), scope)

    def start(plan, run, scope=home):
        work = claim(plan, scope)
        advance(work, "submit", scope)
        advance(work, "run", scope, run_id=run)
        return claim(plan, scope)

    def bind(work, dataset, owner="SyntheticOwner", *, total=0):
        run = work["run_id"]
        return {"run_id": run, "dataset_id": dataset, "collected_at": "2026-04-01T12:00:00Z",
                "total": total, "cents": 5, "ownership": {"method": "apify.dataset-owner-v1",
                    "dataset_id": dataset, "run_id": run, "account_id": owner}}

    release_plan = create_plan("dataset-release")
    w = start(release_plan, "release-run")
    wref = {"p_work": w["id"]}
    approval = {**wref, "p_discard_incomplete": False}
    deny("acquisition_release_approve", approval, code="22023")
    deny("acquisition_advance", transition(w, "bind", **bind(w, "exclusive-one", "UnapprovedAccount")), code="22023")
    without_evidence = bind(w, "exclusive-one")
    del without_evidence["ownership"]
    deny("acquisition_advance", transition(w, "bind", **without_evidence), code="22023")
    advance(w, "bind", **bind(w, "exclusive-one"))
    w = claim(release_plan)
    read_args = {**wref, "p_lease": w["lease_token"]}
    read = ok("acquisition_dataset_read_begin", read_args)
    deny("acquisition_dataset_read_begin", read_args, foreign, code="42501")
    deny("acquisition_release_approve", approval, code="22023")
    advance(w, "finish", outcome="succeeded", cents=5)
    deny("acquisition_release_approve", approval, code="22023")  # Hung reader survives settlement and lease expiry.
    ok("acquisition_dataset_read_end", {**wref, "p_reader": read})
    for kind in ("internal", "legal"):
        hold = {**wref, "p_kind": kind}
        ok("acquisition_dataset_hold", {**hold, "p_active": True})
        deny("acquisition_release_approve", approval, code="22023")
        ok("acquisition_dataset_hold", {**hold, "p_active": False})

    foreign_plan = create_plan("dataset-reuse", foreign)
    other_work = start(foreign_plan, "foreign-run", foreign)
    deny("acquisition_advance", transition(other_work, "bind", **bind(other_work, "exclusive-one")), foreign, code="22023")

    deny("acquisition_release_approve", approval, foreign, code="22023")
    deny("acquisition_release_approve", approval, role="authenticated")
    release_id = ok("acquisition_release_approve", approval)
    assert release_id == ok("acquisition_release_approve", approval)
    deny("acquisition_release_approve", {**approval, "p_discard_incomplete": True}, code="22023")
    deny("acquisition_release_claim_fixture", wref, home, code="42501")

    sql(f"update corpus_builder.exclusive_provider_accounts set execution_mode='disabled' where account_id='SyntheticOwner'")
    deny("acquisition_release_claim_fixture", wref, executor, code="42501")
    sql(f"update corpus_builder.exclusive_provider_accounts set execution_mode='fixture' where account_id='SyntheticOwner'")
    hold = {**wref, "p_kind": "legal"}
    ok("acquisition_dataset_hold", {**hold, "p_active": True})
    assert ok("acquisition_release_claim_fixture", wref, executor) is None
    ok("acquisition_dataset_hold", {**hold, "p_active": False})
    with ThreadPoolExecutor(2) as pool:
        leases = list(pool.map(lambda _: ok("acquisition_release_claim_fixture", wref, executor), range(2)))
    assert sum(lease is not None for lease in leases) == 1
    old_lease = next(lease for lease in leases if lease)
    assert old_lease["release_id"] == release_id
    finish_args = lambda lease, outcome: {**wref, "p_token": lease["lease_token"], "p_outcome": outcome}
    deny("acquisition_release_finish_fixture", finish_args(old_lease, "deleted"), home, code="42501")
    ok("acquisition_release_finish_fixture", finish_args(old_lease, "uncertain"), executor)
    assert ok("acquisition_release_claim_fixture", wref, executor) is None
    sql(f"update corpus_builder.dataset_releases set next_at=clock_timestamp()-interval '1 second' where id='{release_id}'")
    lost_lease = ok("acquisition_release_claim_fixture", wref, executor)
    sql(f"update corpus_builder.dataset_releases set lease_until=clock_timestamp()-interval '1 second' where id='{release_id}'")
    new_lease = ok("acquisition_release_claim_fixture", wref, executor)
    assert len({old_lease["lease_token"], lost_lease["lease_token"], new_lease["lease_token"]}) == 3
    deny("acquisition_release_finish_fixture", finish_args(lost_lease, "verified_absent"), executor, code="42501")
    ok("acquisition_release_finish_fixture", finish_args(new_lease, "verified_absent"), executor)
    assert ok("acquisition_release_claim_fixture", wref, executor) is None
    ok("acquisition_release_finish_fixture", finish_args(new_lease, "verified_absent"), executor)
    assert sql(f"select state from corpus_builder.dataset_releases where id='{release_id}'") == "completed"

    legacy = sql("select work_id from corpus_builder.exclusive_datasets where dataset_id='dataset-empty'")
    deny("acquisition_release_approve", {**approval, "p_work": legacy}, code="22023")
    recent_plan = create_plan("dataset-future", days=3650)
    recent = start(recent_plan, "recent-run")
    advance(recent, "bind", **bind(recent, "dataset-retained"))
    advance(claim(recent_plan), "finish", outcome="succeeded", cents=5)
    deny("acquisition_release_approve", {**approval, "p_work": recent["id"]}, code="22023")

    incomplete_plan = create_plan("dataset-incomplete")
    incomplete = start(incomplete_plan, "incomplete-run")
    advance(incomplete, "bind", **bind(incomplete, "dataset-incomplete", total=1))
    advance(claim(incomplete_plan), "review", code="partial")
    deny("acquisition_release_approve", {**approval, "p_work": incomplete["id"], "p_discard_incomplete": True}, code="22023")
    ok("acquisition_resume", {"p_work": incomplete["id"]})
    advance(claim(incomplete_plan), "finish", outcome="failed", cents=5)
    deny("acquisition_release_approve", {**approval, "p_work": incomplete["id"]}, code="22023")
    ok("acquisition_release_approve", {**approval, "p_work": incomplete["id"], "p_discard_incomplete": True})

    assert sql("""select bool_and(extract(epoch from expires_at-recorded_at)=7776000)
        from corpus_builder.retention_operations""") == "t"
    control_count = """select jsonb_build_array((select count(*) from corpus_builder.pages),
        (select count(*) from corpus_builder.usage_ledger),(select count(*) from corpus_builder.acquisition_callbacks),
        (select count(*) from corpus_builder.dataset_releases))"""
    controls = sql(control_count)
    sql(f"""update corpus_builder.retention_operations set recorded_at=clock_timestamp()-interval '91 days',
          expires_at=clock_timestamp()-interval '1 day' where id in (
          select id from corpus_builder.retention_operations where workspace_id='{base.WORKSPACE}' limit 2)""")
    assert ok("builder_purge_operations", {"p_limit": 1}) == 1
    assert ok("builder_purge_operations", {"p_limit": 100}) == 1
    assert ok("builder_purge_operations", {"p_limit": 100}) == 0
    assert sql(control_count) == controls
    assert sql("""with a as (
      select *,lag(event_digest) over (partition by workspace_id order by sequence) as prior,
        row_number() over (partition by workspace_id order by sequence) as line
      from corpus_builder.audit_events
    ) select bool_and(sequence=line and previous_digest is not distinct from prior and event_digest =
       sha256(convert_to(jsonb_build_array(workspace_id,sequence,actor_id,action,resource_id,
         extract(epoch from recorded_at),encode(prior,'hex'))::text,'UTF8'))) from a""") == "t"
    print("PASS retention: revision-only purge, expiry access gate, replay, audit integrity, exclusive ownership and release fencing", flush=True)
    return digests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", required=True, type=lambda path: Path(path).resolve())
    parser.add_argument("--postgrest", required=True, type=lambda path: Path(path).resolve())
    args = parser.parse_args()
    names = ("202611180004_corpus_acquisition_connector.sql", "202611180005_corpus_revision_retention.sql",
             "202611180006_corpus_dataset_release.sql")
    migrations = tuple(base.MIGRATIONS / name for name in names)
    first, second = (base.build(args, base.migrations(), label, extension=migrations,
                               check_extension=exercise, retention=True) for label in ("one", "two"))
    assert first == second, (first, second)
    print("PASS two fresh retention profiles with matching fingerprints", first)


if __name__ == "__main__":
    main()
