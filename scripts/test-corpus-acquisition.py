"""Validate Gate 2A state and privilege transitions in two fresh local profiles."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import importlib.util
from pathlib import Path
import sys

# Reuse the verified Gate 1B profile, catalog checks and synthetic fixtures.
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("builder_profile", Path(__file__).with_name("test-corpus-builder-foundation.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
END_OF_FIRST = "2026-02-01T00:00:00Z"
END_OF_SECOND = "2026-03-01T00:00:00Z"


def exercise(http, sql):
    scope = {"p_workspace": base.WORKSPACE, "p_principal": "org_builder", "p_actor": "builder-admin"}
    foreign = {"p_workspace": base.FOREIGN, "p_principal": "org_foreign", "p_actor": "other-admin"}

    def call(rpc, arguments, role="service_role", override=None):
        return http("rpc/" + rpc, role, {**scope, **arguments, **(override or {})})

    def ok(rpc, arguments, **kwargs):
        status, result = call(rpc, arguments, **kwargs)
        assert status in (200, 204), (rpc, status, result)
        return result

    def denied(rpc, arguments, code=None, **kwargs):
        status, result = call(rpc, arguments, **kwargs)
        assert status in (400, 401, 403, 404, 409), (rpc, status, result)
        if code:
            assert result.get("code") == code, (rpc, status, result)

    def configure(key):
        protocol = ok("corpus_builder_configure", {"p_config": {**base.CONFIG, "corpus_key": key}})
        queries = ok("corpus_builder_status", {"p_protocol": protocol})["queries"]
        return protocol, [value["id"] for value in queries]

    protocol, queries = configure("connector-synthetic")
    approved = {
        "protocol_id": protocol, "request_key": "approved-synthetic", "provider": "apify",
        "mapping_ref": "synthetic:v1", "mapping_digest": "a" * 64, "normalization_version": "apify-row-v1",
        "platform": "synthetic",
        "source_policy_ref": "synthetic-only", "retention_policy_ref": "test-retention",
        "concurrency": 1, "hours": 1, "jobs": [
            {"query_id": queries[0], "start": base.START, "end": END_OF_FIRST, "cents": 25, "max_rows": 20},
            {"query_id": queries[1], "start": base.START, "end": END_OF_FIRST, "cents": 25, "max_rows": 20},
            {"query_id": queries[0], "start": END_OF_FIRST, "end": END_OF_SECOND, "cents": 25, "max_rows": 20},
            {"query_id": queries[0], "start": END_OF_SECOND, "end": base.END, "cents": 25, "max_rows": 20},
        ],
    }
    for role in (None, "authenticated"):
        denied("corpus_acquisition_approve", {"p_plan": approved}, role=role)
    for actor in ("builder-client", "builder-suspended", "builder-viewer"):
        denied("corpus_acquisition_approve", {"p_plan": approved}, "42501", override={"p_actor": actor})
    denied("corpus_acquisition_approve", {"p_plan": {**approved, "retention_policy_ref": "other"}}, "42501")
    denied("corpus_acquisition_approve", {"p_plan": {
        **approved, "jobs": [{**item, "cents": 26} for item in approved["jobs"]],
    }}, "22023")
    assert sql("select count(*) from corpus_builder.acquisition_plans") == "0"
    assert sql("select count(*) from corpus_builder.acquisition_work") == "0"

    plan = ok("corpus_acquisition_approve", {"p_plan": approved})
    assert ok("corpus_acquisition_approve", {"p_plan": approved}) == plan
    denied("corpus_acquisition_approve", {"p_plan": {**approved, "hours": 2}}, "22023")
    denied("corpus_acquisition_approve", {"p_plan": {**approved, "normalization_version": "apify-row-v2"}}, "22023")
    denied("corpus_acquisition_claim", {"p_plan": plan}, "42501", override=foreign)
    assert sql("""select bool_and(relrowsecurity
        and not has_table_privilege('service_role',oid,'SELECT,INSERT,UPDATE,DELETE')
        and not has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE'))
      from pg_class where relnamespace='corpus_builder'::regnamespace and relname like 'acquisition_%'
      and relkind='r'""") == "t"

    with ThreadPoolExecutor(2) as pool:
        claims = list(pool.map(lambda _: ok("corpus_acquisition_claim", {"p_plan": plan}), range(2)))
    assert sum(work is not None for work in claims) == 1
    current = next(work for work in claims if work is not None)

    def transition(work, step, **data):
        return {"p_work": work["id"], "p_lease": work["lease_token"], "p_step": step, "p_data": data}

    def advance(work, step, **data):
        ok("corpus_acquisition_advance", transition(work, step, **data))

    def claim(plan_id=plan):
        return ok("corpus_acquisition_claim", {"p_plan": plan_id})

    assert current["phase"] == "ready"
    assert current["normalization_version"] == approved["normalization_version"]
    advance(current, "submit")
    # Lost submission acknowledgement. Move only the synthetic lease clock.
    sql(f"update corpus_builder.acquisition_work set lease_until=clock_timestamp()-interval '1 second' where id='{current['id']}'")
    recovered = claim()
    assert recovered["id"] == current["id"] and recovered["phase"] == "submitting"
    denied("corpus_acquisition_advance", transition(current, "run", run_id="stale-run"), "42501")
    denied("corpus_acquisition_advance", transition(recovered, "submit"), "P0001")
    advance(recovered, "run", run_id="provider-first")
    callback = {"p_plan": plan, "p_run": "provider-first", "p_event": "fixture-event"}
    denied("corpus_acquisition_callback", callback, "42501", override=foreign)
    assert ok("corpus_acquisition_callback", callback) is True
    assert ok("corpus_acquisition_callback", callback) is False
    assert sql("select count(*) from corpus_builder.acquisition_callbacks") == "1"

    def binding(run, dataset, total, cents=20):
        return {"run_id": run, "dataset_id": dataset, "total": total,
                "collected_at": "2026-04-01T12:00:00Z", "cents": cents}

    current = claim()
    denied("corpus_acquisition_advance", transition(current, "bind", **binding("provider-first", "dataset-one", 2, 26)), "P0001")
    advance(current, "bind", **binding("provider-first", "dataset-one", 2))
    current = claim()
    assert current["offset"] == 0
    denied("corpus_acquisition_advance", transition(current, "finish", outcome="succeeded", cents=20), "22023")
    duplicate = base.native_fixture("connector-duplicate", 8, "d")
    advance(current, "page", dataset_id="dataset-one", offset=0, total=2, rows=[duplicate])
    denied("corpus_acquisition_advance", transition(current, "page", dataset_id="dataset-one", offset=0, total=2, rows=[duplicate]), "42501")
    current = claim()
    assert current["offset"] == 1
    denied("corpus_acquisition_advance", transition(current, "page", dataset_id="dataset-one", offset=1, total=3, rows=[duplicate]), "P0001")
    advance(current, "page", dataset_id="dataset-one", offset=1, total=2, rows=[duplicate])
    advance(claim(), "finish", outcome="succeeded", cents=20)

    second = claim()
    advance(second, "submit")
    advance(second, "run", run_id="provider-second")
    advance(claim(), "bind", **binding("provider-second", "dataset-two", 2))
    advance(claim(), "page", dataset_id="dataset-two", offset=0, total=2,
            rows=[duplicate, base.native_fixture("connector-missing")])
    advance(claim(), "finish", outcome="succeeded", cents=20)
    cancelled = claim()
    ok("corpus_acquisition_cancel", {"p_work": cancelled["id"]})
    denied("corpus_acquisition_advance", transition(cancelled, "submit"), "P0001")
    advance(cancelled, "finish", outcome="cancelled", cents=0)

    empty = claim()
    advance(empty, "submit")
    advance(empty, "run", run_id="provider-empty")
    advance(claim(), "bind", **binding("provider-empty", "dataset-empty", 0, 0))
    advance(claim(), "finish", outcome="succeeded", cents=0)
    assert claim() is None

    status = ok("corpus_acquisition_status", {"p_plan": plan})
    assert all(job["phase"] == "done" for job in status["jobs"])
    assert sorted(job["attempt_status"] for job in status["jobs"]) == ["cancelled", "succeeded", "succeeded", "succeeded"]
    assert sum(job["reserved_cents"] for job in status["jobs"]) == 100
    assert sum(job["actual_cents"] for job in status["jobs"]) == 40
    assert sql(f"""select count(distinct o.query_id) from corpus_builder.observations o
      join corpus_builder.social_records r on (r.workspace_id,r.id)=(o.workspace_id,o.record_id)
      where r.native_post_id='connector-duplicate' and r.workspace_id='{base.WORKSPACE}'""") == "2"
    assert sql("""select count(*) from corpus_builder.acquisition_work
      where run_id is not null and dataset_id is not null""") == "3"
    frame = ok("corpus_builder_freeze_frame", {"p_protocol": protocol})
    manifest = ok("corpus_builder_frame_manifest", {"p_frame": frame})
    assert manifest["record_count"] == 2
    version = ok("corpus_builder_freeze_version", {
        "p_frame": frame, "p_method": "synthetic", "p_seed": "fixed", "p_records": manifest["record_ids"],
    })
    source = ok("corpus_builder_source_lookup", {"p_platform": "synthetic", "p_post_id": "connector-duplicate"})
    ok("corpus_builder_withdraw", {"p_record": source["id"], "p_reason": "withdrawn"})
    assert not ok("corpus_builder_version_status", {"p_version": version})["valid"]

    ambiguous_protocol, ambiguous_queries = configure("connector-ambiguous")
    ambiguous = ok("corpus_acquisition_approve", {"p_plan": {
        **approved, "protocol_id": ambiguous_protocol, "request_key": "ambiguous",
        "jobs": [{**approved["jobs"][0], "query_id": ambiguous_queries[0]}],
    }})
    work = claim(ambiguous)
    advance(work, "submit")
    for failure in range(6):
        if failure:
            sql(f"update corpus_builder.acquisition_work set next_at=clock_timestamp()-interval '1 second' where id='{work['id']}'")
            work = claim(ambiguous)
        assert work["phase"] in ("ready", "submitting")
        advance(work, "retry", delay=5)
        assert claim(ambiguous) is None
    review = ok("corpus_acquisition_status", {"p_plan": ambiguous})["jobs"][0]
    assert review["phase"] == "review" and review["actual_cents"] is None and review["review_code"] == "retries"
    assert claim(ambiguous) is None
    assert sql("""select count(*) from corpus_builder.acquisition_work w join corpus_builder.usage_ledger l
      on (w.workspace_id,w.attempt_id)=(l.workspace_id,l.attempt_id)
      where w.phase='review' and l.event_type='reserve' and l.cents=25""") == "1"
    denied("corpus_acquisition_resume", {"p_work": work["id"]}, "42501", override=foreign)
    ok("corpus_acquisition_cancel", {"p_work": work["id"]})
    ok("corpus_acquisition_resume", {"p_work": work["id"]})
    resumed = claim(ambiguous)
    assert resumed["phase"] == "submitting" and resumed["cancel_requested"]
    denied("corpus_acquisition_advance", transition(resumed, "submit"), "P0001")
    advance(resumed, "run", run_id="provider-recovered")
    advance(claim(ambiguous), "finish", outcome="cancelled", cents=3, run_id="provider-recovered")

    print("PASS connector: atomic approval, lease fencing, budget/concurrency, callback replay, page recovery, cancellation and withdrawal", flush=True)
    return {"connector_frame": manifest["digest"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", required=True, type=lambda path: Path(path).resolve())
    parser.add_argument("--postgrest", required=True, type=lambda path: Path(path).resolve())
    args = parser.parse_args()
    extension = base.MIGRATIONS / "202611180004_corpus_acquisition_connector.sql"
    first, second = (base.build(args, base.migrations(), name, extension=extension, check_extension=exercise)
                     for name in ("one", "two"))
    assert first == second, (first, second)
    print("PASS two fresh provider connector profiles with matching fingerprints", first)


if __name__ == "__main__":
    main()
