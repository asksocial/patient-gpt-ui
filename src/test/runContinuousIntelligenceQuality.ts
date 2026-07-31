import fs from "node:fs";
import path from "node:path";
import { classifyAlertSeverity, nextMonitoringRun } from "../lib/continuous-intelligence/monitoring";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const baseline = new Date("2026-07-31T12:00:00.000Z");
assert(nextMonitoringRun("daily", baseline) === "2026-08-01T12:00:00.000Z", "Daily scheduling is incorrect.");
assert(nextMonitoringRun("weekly", baseline) === "2026-08-07T12:00:00.000Z", "Weekly scheduling is incorrect.");
assert(classifyAlertSeverity(4.9, 5) === "info", "Below-threshold changes must remain informational.");
assert(classifyAlertSeverity(5, 5) === "watch", "Threshold changes must create watch alerts.");
assert(classifyAlertSeverity(-10, 5) === "material", "Material declines must be detected by magnitude.");

const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202607310003_create_continuous_intelligence.sql"), "utf8");
for (const table of ["intelligence_monitoring_profiles", "intelligence_monitor_runs", "intelligence_alerts", "intelligence_delivery_outbox"]) {
  assert(migration.includes(table), `Continuous Intelligence migration is missing ${table}.`);
}
assert(migration.includes("Awaiting") === false, "Migration should store schema, not runtime status prose.");

console.log("Continuous Intelligence quality checks passed.");
