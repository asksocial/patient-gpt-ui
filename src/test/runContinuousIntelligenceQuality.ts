import { NextRequest } from "next/server";
import { GET as runScheduledMonitoring } from "../app/api/cron/monitoring/route";
import fs from "node:fs";
import path from "node:path";
import { classifyAlertSeverity, nextMonitoringRun } from "../lib/continuous-intelligence/monitoring";
import { createMonitoringProfile, listMonitoringProfiles } from "../lib/continuous-intelligence/monitoring";
import { filterMonitoringFindings, normalizeMonitoringCriteria } from "../lib/continuous-intelligence/scope";
import type { CanonicalFinding } from "../answering/models/finding";
import { executeMonitoringProfile } from "../lib/continuous-intelligence/execution";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const baseline = new Date("2026-07-31T12:00:00.000Z");
assert(nextMonitoringRun("daily", baseline) === "2026-08-01T00:00:00.000Z", "Daily scheduling is incorrect.");
assert(nextMonitoringRun("weekly", baseline) === "2026-08-07T00:00:00.000Z", "Weekly scheduling is incorrect.");
assert(classifyAlertSeverity(4.9, 5) === "info", "Below-threshold changes must remain informational.");
assert(classifyAlertSeverity(5, 5) === "watch", "Threshold changes must create watch alerts.");
assert(classifyAlertSeverity(-10, 5) === "material", "Material declines must be detected by magnitude.");

const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202607310003_create_continuous_intelligence.sql"), "utf8");
for (const table of ["intelligence_monitoring_profiles", "intelligence_monitor_runs", "intelligence_alerts", "intelligence_delivery_outbox"]) {
  assert(migration.includes(table), `Continuous Intelligence migration is missing ${table}.`);
}
assert(migration.includes("Awaiting") === false, "Migration should store schema, not runtime status prose.");

const finding = (id: string, text: string, country?: string) => ({
  findingId: id, countries: country ? [country] : [], evidence: [{ excerpt: text }],
  rawMetadata: { fields: { "Hit Sentence": text, ...(country ? { Country: country } : {}) } },
}) as unknown as CanonicalFinding;
const records = [
  finding("us", "Wegovy insurance coverage is unclear", "United States"),
  finding("jp", "WEGOVY costs and access", "JP"),
  finding("fr", "Insurance coverage and náusea", "France"),
  finding("unknown", "Wegovy insurance coverage"),
  finding("substring", "costochondritis", "US"),
];
const ids = (criteria: unknown) => filterMonitoringFindings(records, criteria).map(record => record.findingId).join(",");
assert(ids({}) === "us,jp,fr,unknown,substring", "Legacy monitors must preserve the corpus scope.");
assert(ids({ keywords: ["wegovy"] }) === "us,jp,unknown", "Keyword-only scope must be case insensitive and include unspecified markets.");
assert(ids({ geographies: ["Europe"] }) === "fr", "Geography-only scope must match region countries.");
assert(ids({ keywords: ["insurance coverage"], geographies: ["US"] }) === "us", "Keyword and geography dimensions must intersect, excluding unknown geography.");
assert(ids({ keywords: ["Wegovy", "insurance coverage"], keywordMatch: "all" }) === "us,unknown", "All mode must require every complete keyword phrase.");
assert(ids({ keywords: ["Wegovy", "náusea"], keywordMatch: "any", geographies: ["Japan", "France"] }) === "jp,fr", "Any keywords and multiple countries must support alternatives within dimensions.");
assert(ids({ keywords: ["cost"] }) === "", "Literal keyword boundaries must not match unrelated substrings.");
assert(ids({ keywords: ["nonexistent-fixture-keyword"] }) === "", "No-match scopes must stay empty.");
assert(ids({ geographies: ["Australia"] }) === "", "No-match geography must not fall back to the full corpus.");
assert(normalizeMonitoringCriteria({ geographies: ["UK", "United Kingdom"] }).geographies.join() === "GB", "Geography aliases must canonicalize and deduplicate.");
for (const invalid of [{ keywords: "wegovy" }, { geographies: ["Atlantis"] }, { keywordMatch: "regex" }, { keywords: Array(31).fill(0).map((_, i) => String(i)) }]) {
  let rejected = false;
  try { normalizeMonitoringCriteria(invalid); } catch { rejected = true; }
  assert(rejected, "Malformed criteria must be rejected rather than broadening scope.");
}

async function persistenceAndExecutionChecks() {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalCronSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "monitoring-test-secret";
  process.env.SUPABASE_URL = "https://monitoring-test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-secret";
  let saved: any;
  let previousSignal: number | null = null;
  const writes: Array<{ table: string; row: any }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1)!;
    const method = init?.method || "GET";
    const row = init?.body ? JSON.parse(String(init.body)) : null;
    let data: any = null;
    if (method === "GET" && table === "intelligence_workspaces") {
      assert(url.searchParams.get("principal_id") === "eq.tenant-test", "Workspace ownership must be checked.");
      data = { id: "workspace-test" };
    } else if (method === "POST") {
      writes.push({ table, row });
      data = { id: "fixture-id", ...row };
      if (table === "intelligence_monitoring_profiles") saved = data;
    } else if (method === "GET" && table === "intelligence_monitoring_profiles") data = [saved];
    else if (method === "GET" && table === "intelligence_monitor_runs") data = previousSignal == null ? null : { signal_value: previousSignal };
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const denied = await runScheduledMonitoring(new NextRequest("https://test.invalid/api/cron/monitoring"));
    assert(denied.status === 401, "Scheduled monitoring must reject missing bearer authentication.");
    const wrong = await runScheduledMonitoring(new NextRequest("https://test.invalid/api/cron/monitoring", { headers: { authorization: "Bearer wrong" } }));
    assert(wrong.status === 401, "Scheduled monitoring must reject incorrect bearer authentication.");
    const principal = { principalId: "tenant-test", principalType: "organization" as const, actorId: "tester" };
    const profile = await createMonitoringProfile(principal, {
      workspaceId: "workspace-test", name: "Scoped fixture", monitorType: "theme_shift", therapeuticArea: "GLP-1",
      query: "What themes require attention?", cadence: "weekly", criteria: { keywords: ["nonexistent-monitor-fixture-921732"], geographies: ["Japan"] },
    });
    assert(profile.criteria.geographies[0] === "JP", "Saved profile must retain normalized geography.");
    const restored = await listMonitoringProfiles(principal);
    assert(restored[0].criteria.keywords[0] === "nonexistent-monitor-fixture-921732", "Readback must retain keyword criteria.");
    const result = await executeMonitoringProfile(restored[0]);
    assert(result.payload.scope.matchedFindings === 0, "Execution must apply persisted scope to the real corpus.");
    assert(result.payload.themeSummary.length === 0 && !result.alertCreated, "Empty scopes must not manufacture a theme or first-run alert.");
    const run = writes.find(write => write.table === "intelligence_monitor_runs");
    assert(run?.row.payload.criteria.geographies[0] === "JP", "Run provenance must retain the applied scope.");
    assert(writes.some(write => write.table === "intelligence_work_products"), "Scoped results must remain saved in the workspace.");
    const scheduled = await runScheduledMonitoring(new NextRequest("https://test.invalid/api/cron/monitoring", { headers: { authorization: "Bearer monitoring-test-secret" } }));
    const scheduledData = await scheduled.json();
    assert(scheduled.status === 200 && scheduledData.processed === 1 && scheduledData.results[0].payload.scope.matchedFindings === 0, "Authenticated scheduling must execute persisted scope.");
    previousSignal = 45;
    const emptyRerun = await executeMonitoringProfile(restored[0]);
    assert(!emptyRerun.alertCreated && emptyRerun.run.signal_value === null, "No matching evidence must not be represented as a measured drop to zero.");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalCronSecret;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
}

persistenceAndExecutionChecks().then(() => console.log("Continuous Intelligence checks passed: scope matching, validation, persistence and execution.")).catch(error => { console.error(error); process.exitCode = 1; });
