import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
async function main() {
  loadEnvConfig(process.cwd());
  const base = process.env.ASKSOCIAL_STAGING_URL;
  if (!base) throw new Error("Configure ASKSOCIAL_STAGING_URL locally.");
  const target = new URL(base);
  if (target.protocol !== "https:" && target.hostname !== "localhost" && target.hostname !== "127.0.0.1") throw new Error("Staging URL must use HTTPS.");
  const ownId = process.env.ASKSOCIAL_PV_STAGING_RECORD_ID;
  const otherId = process.env.ASKSOCIAL_PV_OTHER_TENANT_RECORD_ID;
  const cookie = process.env.ASKSOCIAL_STAGING_SESSION_COOKIE;
  const deniedCookie = process.env.ASKSOCIAL_PV_DENIED_SESSION_COOKIE;
  const route = (id: string) => `/api/pv/records/${encodeURIComponent(id)}/icsr`;
  const checks: Array<{ name: string; status: string; detail: string }> = [];
  async function request(path: string, session?: string) {
    return fetch(new URL(path, target), { redirect: "manual", headers: { ...(session ? { cookie: session } : {}), ...(process.env.ASKSOCIAL_STAGING_VERCEL_BYPASS ? { "x-vercel-protection-bypass": process.env.ASKSOCIAL_STAGING_VERCEL_BYPASS } : {}) }, signal: AbortSignal.timeout(20000) });
  }
  const publicProbe = await request(route(ownId || "00000000-0000-0000-0000-000000000000"));
  assert.ok([401, 301, 302, 303, 307, 308].includes(publicProbe.status), `Unauthenticated access must be denied; HTTP ${publicProbe.status}.`);
  if ([301, 302, 303, 307, 308].includes(publicProbe.status)) {
    const location = publicProbe.headers.get("location") || "";
    if (location.startsWith("https://vercel.com/sso-api")) throw new Error("Vercel deployment protection blocked the test before AskSocial authentication. Use the authenticated browser or configure an existing staging protection-bypass credential locally.");
    assert.match(location, /sign[-_]?in|login|clerk/i, "Redirect must be to authentication, not a generic deployment redirect.");
  }
  checks.push({ name: "unauthenticated_case_route", status: "passed", detail: `HTTP ${publicProbe.status}` });
  if (cookie && ownId) {
    const response = await request(route(ownId), cookie);
    assert.equal(response.status, 200, `Own-tenant case read failed; HTTP ${response.status}.`);
    assert.ok(response.headers.get("cache-control")?.includes("no-store"));
    const payload = await response.json();
    assert.ok(payload.ok && payload.snapshot?.caseData?.schemaVersion === "asksocial-r3-intake-1");
    assert.equal(payload.snapshot.caseData.id, ownId);
    checks.push({ name: "authenticated_own_case", status: "passed", detail: "Typed case available with private no-store response; no clinical content logged." });
    if (otherId) {
      const foreign = await request(route(otherId), cookie);
      assert.ok([400, 403, 404].includes(foreign.status), `Foreign-tenant case must be denied; HTTP ${foreign.status}.`);
      const body = await foreign.json();
      assert.equal(body.ok, false); assert.equal(body.snapshot, undefined); assert.equal(body.history, undefined);
      checks.push({ name: "foreign_tenant_denial", status: "passed", detail: `HTTP ${foreign.status}, no case/history returned.` });
    } else checks.push({ name: "foreign_tenant_denial", status: "skipped", detail: "Configure ASKSOCIAL_PV_OTHER_TENANT_RECORD_ID for a known synthetic foreign-tenant case." });
  } else checks.push({ name: "authenticated_case_flow", status: "skipped", detail: "Configure staging session cookie and synthetic own-tenant record ID locally." });
  if (deniedCookie) {
    const denied = await request(route(ownId || "00000000-0000-0000-0000-000000000000"), deniedCookie);
    assert.equal(denied.status, 403, "Signed-in user without PV entitlement must receive 403.");
    checks.push({ name: "missing_pv_entitlement", status: "passed", detail: "HTTP 403" });
  } else checks.push({ name: "missing_pv_entitlement", status: "skipped", detail: "Configure ASKSOCIAL_PV_DENIED_SESSION_COOKIE locally for a non-PV test user." });
  console.log(JSON.stringify({ readOnly: true, checks }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Staging check failed."); process.exitCode = 1; });
