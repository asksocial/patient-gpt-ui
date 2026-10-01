import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

/** Read-only schema/access check. Does not create cases or execute the write RPC. */
async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured locally.");
  const expectedRef = process.env.ASKSOCIAL_PV_EXPECTED_SUPABASE_REF;
  if (expectedRef && new URL(url).hostname !== `${expectedRef}.supabase.co`) throw new Error("Configured Supabase target does not match the expected project reference.");
  const client = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
  const checks: Array<{ name: string; status: "passed" | "failed" | "skipped"; detail: string }> = [];
  for (const [table, columns] of [
    ["pv_records", "id,principal_id,original_verbatim,ae_ontology"],
    ["pv_audit_events", "id,principal_id,event_hash"],
    ["pv_icsr_cases", "record_id,principal_id,revision,snapshot,updated_by,updated_at"],
    ["pv_icsr_case_revisions", "record_id,principal_id,revision,action,snapshot,changes,reviewer_id,reviewed_at"],
  ]) {
    const { error } = await client.from(table).select(columns).limit(0);
    checks.push({ name: table, status: error ? "failed" : "passed", detail: error ? `Schema/access query failed (${error.code || "connection error"}).` : "Required columns accessible; no case data retrieved." });
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (anonKey) {
    const anon = createClient(url, anonKey, { auth: { persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
    for (const table of ["pv_icsr_cases", "pv_icsr_case_revisions"]) {
      const { error } = await anon.from(table).select("record_id").limit(0);
      checks.push({ name: `${table}:anonymous_denial`, status: error?.code === "42501" ? "passed" : "failed", detail: error?.code === "42501" ? "Anonymous direct table permission denied." : "Expected explicit permission denial was not confirmed." });
    }
  } else checks.push({ name: "anonymous_database_permissions", status: "skipped", detail: "No anonymous database key configured locally; verify in staging SQL acceptance." });
  checks.push({ name: "rpc_concurrency_and_immutability", status: "skipped", detail: "Requires the transactional SQL acceptance test in a confirmed staging database." });
  console.log(JSON.stringify({ targetFingerprint: createHash("sha256").update(url).digest("hex").slice(0, 12), readOnly: true, checks }, null, 2));
  if (checks.some(check => check.status === "failed")) process.exitCode = 1;
}
main().catch(() => { console.error("ICSR preflight could not complete. Check the expected project reference, local configuration, and connectivity; credentials are not printed."); process.exitCode = 1; });
