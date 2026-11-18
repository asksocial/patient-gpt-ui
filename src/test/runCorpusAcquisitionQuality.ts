import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { createApifyProvider, type ApifyMapping, type ApifyTransport } from "../lib/corpus-builder/acquisition/apify";
import { verifyAcquisitionCallback } from "../lib/corpus-builder/acquisition/callback";
import { AcquisitionStoreError, runAcquisitionStep, type AcquisitionStore, type Work } from "../lib/corpus-builder/acquisition/orchestrator";
import { ProviderFailure } from "../lib/corpus-builder/acquisition/provider";
import { createAcquisitionService } from "../lib/corpus-builder/acquisition/service";

const workspace = "31000000-0000-4000-8000-000000000001";
const plan = "31000000-0000-4000-8000-000000000002";
const workId = "31000000-0000-4000-8000-000000000003";
const submitted = "2026-04-01T12:00:00Z";
const finished = "2026-04-01T12:10:00Z";
const mapping: ApifyMapping = {
  ref: "synthetic-fixture", version: 1, actorId: "SyntheticActor", build: "0.0.1",
  buildId: "SyntheticBuild", platform: "synthetic", sourcePolicyRef: "synthetic-only",
  retentionPolicyRef: "fixture-retention", timeoutSeconds: 120,
  fields: { query: "terms", start: "startUtc", end: "endUtc", maxRows: "maxRows", correlation: "requestId" },
  output: { id: "native", content: "body", published: "date", url: "link", author: "account", engagement: "count" },
  permittedUrlHosts: ["example.invalid"], retainAuthor: true, authorKeyVersion: "fixture-key-1",
};
const source = {
  native: "000123", body: "Synthetic example only", date: "2026-02-01T00:00:00Z",
  link: "https://example.invalid/post/000123?unneeded=identifier#fragment", account: "synthetic-author", count: 0,
};
const input = {
  correlationId: workId, query: "synthetic data centers", start: "2026-01-01T00:00:00.000Z",
  end: "2026-04-01T00:00:00.000Z", maxRows: 15, cents: 100,
};
const makeResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) => ({ status, headers, body });

function fixture(mode = "successful") {
  const calls: Parameters<ApifyTransport>[0][] = [];
  let originalInput: Record<string, string | number> | undefined;
  let status = "SUCCEEDED";
  let failedOnce = false;
  const items = Array.from({ length: mode === "empty" ? 0 : 11 }, (_, i) =>
    i === 0 || i === 1 ? source : { native: `synthetic-${i}`, body: "No external source material" });
  const detail = () => ({ id: "run-fixture", actId: mapping.actorId, buildId: mapping.buildId,
    defaultKeyValueStoreId: "kv-fixture", defaultDatasetId: "dataset-fixture", status,
    finishedAt: finished, usageTotalUsd: mode === "over-budget" ? 2 : mode === "unknown-usage" ? null : 0.2654 });
  const transport: ApifyTransport = async request => {
    calls.push(request);
    const { path, method, query } = request;
    if (path === "/v2/acts/SyntheticActor/runs" && method === "POST") {
      originalInput = request.body;
      assert.equal(query?.maxTotalChargeUsd, "1.00");
      assert.equal(query?.forcePermissionLevel, "LIMITED_PERMISSIONS");
      assert.equal(query?.build, mapping.build);
      assert.equal(query?.restartOnError, "false");
      assert.equal(originalInput?.requestId, workId);
      if (mode === "lost-submit" || mode === "ambiguous") throw new Error("synthetic timeout");
      return makeResponse({ data: detail() }, 201);
    }
    if (path === "/v2/acts/SyntheticActor/runs" && method === "GET") {
      return makeResponse({ data: { items: mode === "ambiguous" ? [] : [{ id: "run-fixture", startedAt: submitted }] } });
    }
    if (path === "/v2/key-value-stores/kv-fixture/records/INPUT") return makeResponse(originalInput);
    if (path === "/v2/actor-runs/run-fixture/abort") {
      status = "ABORTED";
      return makeResponse({ data: detail() });
    }
    if (path === "/v2/actor-runs/run-fixture") {
      if (mode === "rate-limit" && !failedOnce) {
        failedOnce = true;
        return makeResponse(null, 429, { "retry-after": "40" });
      }
      return makeResponse({ data: detail() });
    }
    if (path === "/v2/datasets/dataset-fixture") {
      return makeResponse({ data: {
        id: "dataset-fixture", itemCount: items.length, actId: mapping.actorId, actRunId: "run-fixture",
        userId: mode === "wrong-account" ? "UnexpectedOwner" : "SyntheticOwner",
        generalAccess: mode === "public-dataset" ? "PUBLIC" : "RESTRICTED",
      } });
    }
    if (path === "/v2/datasets/dataset-fixture/items") {
      const offset = Number(query?.offset);
      assert.equal(query?.clean, "false");
      if (mode === "interrupted" && offset === 10 && !failedOnce) {
        failedOnce = true;
        throw new Error("synthetic interrupted page");
      }
      const page = mode === "partial" ? items.slice(0, 2) : items.slice(offset, offset + Number(query?.limit));
      if (mode === "drift") page[0] = { native: "missing-content", body: "" };
      return makeResponse(page, 200, {
        "x-apify-pagination-offset": String(offset), "x-apify-pagination-count": String(page.length),
        "x-apify-pagination-total": String(items.length),
      });
    }
    throw new Error("Unexpected synthetic request");
  };
  const provider = createApifyProvider({ ...mapping, exclusiveDatasetAccountId: "SyntheticOwner" }, {
    approvedActors: new Set([mapping.actorId]), transport, authorKey: "synthetic-".repeat(4),
  });
  return { provider, calls, pending: () => { status = "RUNNING"; } };
}

function execution(mode: string) {
  const { provider, calls, pending } = fixture(mode);
  const work: Work = {
    id: workId, plan_id: plan, provider: "apify", mapping_ref: provider.approval.ref,
    mapping_digest: provider.approval.fingerprint, platform: "synthetic", deadline: "2026-12-01T00:00:00Z",
    normalization_version: provider.approval.normalizationVersion,
    exclusive_dataset_required: true,
    ...input, max_rows: input.maxRows, rows: input.maxRows, offset: 0, phase: "ready", lease_token: "synthetic-lease",
    submitted_at: null, run_id: null, dataset_id: null, collected_at: null, verified_cost: null,
    failures: 0, cancel_requested: false, abort_sent: false,
  };
  let completed: string | null = null;
  let reviewed: string | null = null;
  const delays: number[] = [];
  const pages: number[] = [];
  let interrupted = false;
  const store: AcquisitionStore = {
    async claim() { return completed || reviewed ? null : { ...work }; },
    async cancel() { work.cancel_requested = true; },
    async openDatasetRead() { return work.lease_token; },
    async closeDatasetRead() { return; },
    async advance(_work, ...[step, data]) {
      switch (step) {
        case "submit":
          work.phase = "submitting";
          work.submitted_at = submitted;
          break;
        case "run":
          work.phase = "running";
          work.run_id = data.run_id;
          break;
        case "bind":
          assert.equal(data.ownership?.account_id, "SyntheticOwner");
          assert.equal(data.ownership?.dataset_id, data.dataset_id);
          assert.equal(data.ownership?.run_id, work.run_id);
          work.phase = "paging";
          Object.assign(work, {
            dataset_id: data.dataset_id, rows: data.total, collected_at: data.collected_at, verified_cost: data.cents,
          });
          break;
        case "page":
          if (mode === "withdrawal") throw new AcquisitionStoreError(400, "22023");
          assert.equal(data.offset, work.offset);
          pages.push(work.offset);
          work.offset += data.rows.length;
          if (mode === "lost-page-response" && !interrupted) {
            interrupted = true;
            throw new AcquisitionStoreError(503);
          }
          break;
        case "finish":
          completed = data.outcome;
          break;
        case "review":
          reviewed = data.code;
          break;
        case "abort_sent":
          work.abort_sent = true;
          break;
        case "retry":
          delays.push(data.delay);
          if (++work.failures >= 6) reviewed = "retries";
          return;
        case "wait":
          break;
      }
      work.failures = 0;
    },
  };
  const step = () => runAcquisitionStep({ planId: plan, workspace, store, providerFor: () => provider, now: () => Date.parse(submitted) });
  const drain = async () => {
    for (let pass = 0; pass < 15; pass++) if (await step() === "idle") return;
    assert.fail("Worker did not settle or review");
  };
  return { work, calls, pending, step, drain, pages, delays, result: () => completed ?? reviewed };
}

async function main() {
  const { provider } = fixture();
  assert.throws(() => createApifyProvider(mapping, { approvedActors: new Set(), transport: async () => makeResponse(null) }), ProviderFailure);
  const row = provider.normalize(source, finished, workspace);
  assert.equal(row.post_id, "000123");
  assert.equal(row.source_url, "https://example.invalid/post/000123");
  assert.equal(row.engagement, 0);
  assert.match(row.author_key!, /^[0-9a-f]{64}$/);
  assert.notEqual(row.author_key, provider.normalize(source, finished, plan).author_key);
  assert.equal(provider.normalize({ native: "only-id", body: "synthetic" }, finished, workspace).published_at, null);
  assert.equal(provider.normalize({ ...source, link: "https://unapproved.invalid/private" }, finished, workspace).source_url, null);
  assert.throws(() => provider.normalize({ ...source, native: 123 }, finished, workspace), ProviderFailure);
  assert.throws(() => provider.normalize({ ...source, date: "yesterday" }, finished, workspace), ProviderFailure);
  await assert.rejects(() => provider.submit({ ...input, query: "x\u0000y" }), ProviderFailure);

  for (const [mode, result] of [
    ["successful", "succeeded"], ["empty", "succeeded"], ["lost-submit", "succeeded"],
    ["ambiguous", "retries"], ["rate-limit", "succeeded"], ["interrupted", "succeeded"],
    ["partial", "failed"], ["drift", "failed"], ["over-budget", "usage"], ["unknown-usage", "usage"],
    ["withdrawal", "failed"], ["wrong-account", "schema"], ["public-dataset", "schema"],
  ]) {
    const run = execution(mode);
    await run.drain();
    assert.equal(run.result(), result, mode);
    assert.equal(run.calls.filter(call => call.method === "POST" && call.path.endsWith("/runs")).length, 1, mode);
    if (mode === "rate-limit") assert.deepEqual(run.delays, [40]);
    if (mode === "empty") assert.deepEqual(run.pages, []);
    if (mode === "successful") assert.equal(run.work.verified_cost, 27);
    if (mode === "interrupted") assert.deepEqual(run.pages, [0, 10]);
  }

  const recovered = execution("lost-page-response");
  await recovered.step();
  await recovered.step();
  await assert.rejects(recovered.step, AcquisitionStoreError);
  await recovered.drain();
  assert.deepEqual(recovered.pages, [0, 10]);
  const changedNormalizer = execution("successful");
  changedNormalizer.work.normalization_version = "apify-row-v2";
  await changedNormalizer.drain();
  assert.equal(changedNormalizer.result(), "provider");
  assert.deepEqual(changedNormalizer.calls, []);
  const cancelled = execution("successful");
  await cancelled.step();
  cancelled.pending();
  cancelled.work.cancel_requested = true;
  await cancelled.drain();
  assert.equal(cancelled.result(), "cancelled");
  assert.equal(cancelled.calls.filter(call => call.path.endsWith("/abort")).length, 1);

  const now = Date.now();
  const secret = "synthetic-relay-key-".repeat(3);
  const body = Buffer.from(JSON.stringify({ kind: "run.completed", workspace, planId: plan, runId: "run-fixture", eventId: "event-fixture" }));
  const timestamp = String(Math.floor(now / 1000));
  const signature = "sha256=" + createHmac("sha256", secret).update(timestamp + ".").update(body).digest("hex");
  const callback = { body, timestamp, signature, secret, now };
  assert.equal(verifyAcquisitionCallback(callback).runId, "run-fixture");
  assert.throws(() => verifyAcquisitionCallback({ ...callback, body: Buffer.from("{}") }), AcquisitionStoreError);
  assert.throws(() => verifyAcquisitionCallback({ ...callback, now: now + 301000 }), AcquisitionStoreError);

  let enabled = false;
  let identity: null | { userId: string; principalId: string; active: boolean; administrator: boolean } = null;
  const seen: Record<string, unknown>[] = [];
  const acquisition = createAcquisitionService({
    enabled: () => enabled, session: async () => identity, providers: [provider],
    async rpc(_name, args) { seen.push(args); return { data: true, error: null }; },
  });
  const status = () => acquisition.status(workspace, plan);
  const denied = (status: number) => (error: unknown) => error instanceof AcquisitionStoreError && error.status === status;
  await assert.rejects(status, denied(404));
  enabled = true;
  await assert.rejects(status, denied(401));
  identity = { userId: "admin", principalId: "own", active: true, administrator: false };
  await assert.rejects(status, denied(403));
  identity = { ...identity, active: false, administrator: true };
  await assert.rejects(status, denied(403));
  identity = { ...identity, active: true };
  await assert.rejects(() => acquisition.approve(workspace, {
    protocol_id: plan, request_key: "key", provider: "unknown", mapping_ref: "unknown",
    concurrency: 1, hours: 1, jobs: [],
  }), denied(400));
  await assert.rejects(() => acquisition.completion(plan, callback), denied(403));
  assert.equal(seen.length, 0);
  const planRequest = {
    protocol_id: plan, request_key: "key", provider: provider.approval.provider, mapping_ref: provider.approval.ref,
    concurrency: 1, hours: 1, jobs: [],
  };
  await acquisition.approve(workspace, planRequest);
  assert.deepEqual(seen[0].p_plan, {
    ...planRequest, mapping_digest: provider.approval.fingerprint, normalization_version: provider.approval.normalizationVersion,
    platform: provider.approval.platform, source_policy_ref: provider.approval.sourcePolicyRef,
    retention_policy_ref: provider.approval.retentionPolicyRef,
  });
  assert.equal(await acquisition.completion(workspace, callback), true);
  assert.equal(seen[1].p_actor, "admin");
  console.log("PASS synthetic Apify mapping, recovery, budget holds, cancellation, callback verification and authorization");
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
