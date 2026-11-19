import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  accountAccess, hasInvitationProof, permitsManagedRequest, PROVISIONING_MARKER, type ManagedAccount,
} from "../lib/auth/provisioning/model";
import { sendProviderInvitation, type InvitationProvider } from "../lib/auth/provisioning/invitations";
import { resolveEntitlements } from "../lib/entitlements/resolveEntitlements";
import { assertSupabasePublishableKey, getScopedSupabaseClient } from "../lib/supabase/server";
import { permitsTopic } from "../lib/therapeuticAccess/scope";

async function testScopedSupabaseCredentials() {
  const token = (role?: string) => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  const publishable = "sb_publishable_test_fixture";
  assert.doesNotThrow(() => assertSupabasePublishableKey(publishable));
  assert.doesNotThrow(() => assertSupabasePublishableKey(token("anon")));
  for (const invalid of [undefined, "sb_secret_test_fixture", token("service_role"), token("authenticated"), "not-a-jwt"]) {
    assert.throws(() => assertSupabasePublishableKey(invalid), /SUPABASE_PUBLISHABLE_KEY/);
  }

  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const previousFetch = globalThis.fetch;
  let requests = 0;
  try {
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_PUBLISHABLE_KEY = publishable;
    globalThis.fetch = async (input, options) => {
      requests += 1;
      assert.equal(new URL(String(input)).pathname, "/rest/v1/user_therapeutic_access");
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("apikey"), publishable);
      assert.equal(headers.get("authorization"), `Bearer ${token("authenticated")}`);
      return Response.json([{ therapeutic_area: "GLP-1" }]);
    };
    for (const invalid of ["", token(), token("anon"), token("service_role")]) {
      assert.throws(() => getScopedSupabaseClient(invalid), /authenticated role claim/);
    }
    assert.equal(requests, 0);
    const { data, error } = await getScopedSupabaseClient(token("authenticated"))
      .from("user_therapeutic_access").select("therapeutic_area");
    assert.equal(error, null);
    assert.deepEqual(data, [{ therapeutic_area: "GLP-1" }]);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
}

async function testInvitations(account: ManagedAccount) {
  const events: string[] = [];
  let nextInvitation = 1;
  let invitations = [
    { id: "expired", status: "expired", publicMetadata: { [PROVISIONING_MARKER]: account.id } },
    { id: "unrelated", status: "pending", publicMetadata: { unrelated: "different-flow" } },
    { id: "ours", status: "pending", publicMetadata: { [PROVISIONING_MARKER]: account.id } },
  ];
  const provider = {
    organizations: {
      async getOrganizationInvitationList(options) {
        assert.equal(options.organizationId, account.organization_id);
        assert.deepEqual(options.status, ["pending"]);
        const data = invitations.filter(item => item.status === "pending");
        return { data, totalCount: data.length };
      },
      async revokeOrganizationInvitation(options) {
        events.push(`revoke:${options.invitationId}`);
        invitations = invitations.filter(item => item.id !== options.invitationId);
      },
      async createOrganizationInvitation(options) {
        assert.equal(options.organizationId, account.organization_id);
        assert.equal(options.emailAddress, account.email);
        assert.equal(options.role, "org:member");
        assert.equal(options.expiresInDays, 7);
        assert.deepEqual(options.publicMetadata, { [PROVISIONING_MARKER]: account.id });
        events.push("send:client");
        const id = `new-client-${nextInvitation++}`;
        invitations.push({ id, status: "pending", publicMetadata: options.publicMetadata! });
        return { id };
      },
    },
    invitations: {
      async getInvitationList(options) {
        assert.equal(options.status, "pending");
        return { data: [] };
      },
      async createInvitation(options) {
        assert.deepEqual(options.publicMetadata, { [PROVISIONING_MARKER]: account.id });
        assert.equal(options.ignoreExisting, undefined);
        events.push("send:platform");
        return { id: "new-platform" };
      },
    },
  } satisfies {
    organizations: {
      [K in keyof InvitationProvider["organizations"]]: (...args: Parameters<InvitationProvider["organizations"][K]>) => unknown;
    };
    invitations: {
      [K in "getInvitationList" | "createInvitation"]: (...args: Parameters<InvitationProvider["invitations"][K]>) => unknown;
    };
  };
  const fixture = provider as unknown as InvitationProvider;
  assert.equal(await sendProviderInvitation(fixture, account, false), "ours");
  assert.deepEqual(events, []);
  assert.equal(await sendProviderInvitation(fixture, account, true), "new-client-1");
  assert.deepEqual(events, ["revoke:ours", "send:client"]);
  const replacement = invitations.find(invitation => invitation.id === "new-client-1")!;
  replacement.status = "expired";
  assert.equal(await sendProviderInvitation(fixture, account, true), "new-client-2");
  // A retry after the provider accepted the resend reuses the pending replacement.
  assert.equal(await sendProviderInvitation(fixture, account, false), "new-client-2");
  assert.deepEqual(events, ["revoke:ours", "send:client", "send:client"]);
  assert.equal(await sendProviderInvitation(fixture, { ...account, organization_id: null }, false), "new-platform");
}

async function main(previewLayout = false) {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      grant usage on schema auth to authenticated;
      create function auth.jwt() returns jsonb language sql stable as $$
        select current_setting('request.jwt.claims', true)::jsonb;
      $$;
    `);
    for (const migration of [
      "202607160001_create_application_foundation.sql",
      "202607310001_create_platform_persistence.sql",
      "202611180001_admin_user_provisioning.sql",
    ]) {
      const sql = await readFile(new URL(`../../supabase/migrations/${migration}`, import.meta.url), "utf8");
      await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
      if (previewLayout && migration === "202607160001_create_application_foundation.sql") {
        await db.exec(`
          alter table public.user_therapeutic_access
            drop constraint user_therapeutic_access_clerk_user_id_therapeutic_area_key;
          create unique index user_therapeutic_access_unique
            on public.user_therapeutic_access (clerk_user_id, therapeutic_area);
        `);
      }
    }
    await db.exec(`
      grant all on public.intelligence_audit_events to service_role;
      insert into public.therapeutic_areas (name, is_active) values ('GLP-1', true), ('Hepatitis B', true), ('Inactive', false);
      insert into public.user_therapeutic_access (clerk_user_id, therapeutic_area) values ('user_recipient', 'Hepatitis B');
    `);

    async function change(
      action: string, {
        account, email, role = "client_analyst", org = "org_client", topics = ["GLP-1"], actor = "user_admin", user, invitation,
      }: {
        account?: ManagedAccount; email?: string; role?: string; org?: string | null;
        topics?: string[]; actor?: string; user?: string; invitation?: string;
      } = {},
    ) {
      const result = await db.query<ManagedAccount>(
        "select * from public.change_user_provisioning($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [action, actor, account?.id ?? null, account?.revision ?? null, email ?? null, org, role, topics, user ?? null, invitation ?? null],
      );
      return result.rows[0];
    }

    async function asAuthenticated<T>(user: string, org: string, operation: () => Promise<T>) {
      await db.exec("set role authenticated");
      try {
        await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user, o: { id: org } })]);
        return await operation();
      } finally {
        await db.exec("reset role");
      }
    }

    const rows = () => db.query<{ therapeutic_area: string }>(
      "select therapeutic_area from public.user_therapeutic_access order by therapeutic_area",
    ).then(result => result.rows.map(row => row.therapeutic_area));

    const pending = await change("reserve", { email: "client@example.com" });
    assert.equal(pending.state, "pending");
    await testInvitations(pending);
    await assert.rejects(change("reserve", { email: pending.email }), /duplicate key/);
    await assert.rejects(change("reserve", { email: "inactive@example.com", topics: ["Inactive"] }), /unique and active/);
    const sending = await change("send", { account: pending });
    await assert.rejects(change("send", { account: sending }), /already sending/);
    const failed = await change("delivery_failed", { account: sending });
    assert.equal(failed.state, "pending");
    const retry = await change("send", { account: failed });
    const sent = await change("sent", { account: retry, invitation: "inv_local" });
    assert.equal(sent.invitation_id, "inv_local");

    const user = { id: "user_recipient", verifiedEmail: pending.email, banned: false };
    const membership = { organizationId: "org_client", marker: pending.id };
    assert.equal(hasInvitationProof(sent, user, membership), true);
    assert.equal(hasInvitationProof(sent, user, { ...membership, organizationId: "org_other" }), false);
    assert.equal(hasInvitationProof(sent, user, { ...membership, marker: "some-other-account" }), false);
    assert.equal(hasInvitationProof(sent, { ...user, banned: true }, membership), false);
    assert.equal(hasInvitationProof(sent, { ...user, verifiedEmail: "different@example.com" }, membership), false);
    assert.equal(hasInvitationProof(sent, { ...user, verifiedEmail: undefined }, membership), false);
    assert.equal(accountAccess(sent, "org_client", true), "pending");

    await asAuthenticated(user.id, "org_client", async () => {
      assert.deepEqual(await rows(), []);
      await assert.rejects(db.query("select * from public.user_provisioning"), /permission denied/);
      await assert.rejects(db.query("select public.change_user_provisioning('reserve', 'user_recipient')"), /permission denied/);
    });

    const active = await change("activate", { account: sent, actor: user.id, user: user.id });
    assert.equal(accountAccess(active, "org_client", true), "allowed");
    assert.equal(accountAccess(active, "org_client", false), "organization_required");
    assert.equal(accountAccess(active, "org_other", true), "organization_required");
    assert.equal(accountAccess(active), "organization_required");
    assert.equal(hasInvitationProof(active, user, membership), false);
    await assert.rejects(change("activate", { account: sent, actor: user.id, user: user.id }), /changed/);
    assert.deepEqual(await asAuthenticated(user.id, "org_client", rows), ["GLP-1"]);
    assert.deepEqual(await asAuthenticated(user.id, "org_other", rows), []);
    assert.deepEqual(await asAuthenticated("user_other", "org_client", rows), []);
    await db.exec("update public.therapeutic_areas set is_active = false where name = 'GLP-1'");
    assert.deepEqual(await asAuthenticated(user.id, "org_client", rows), []);
    await db.exec("update public.therapeutic_areas set is_active = true where name = 'GLP-1'");
    const existing = await change("reserve", { email: "existing@example.com", org: "org_other", user: "user_known" });
    assert.equal(hasInvitationProof(existing, { ...user, verifiedEmail: existing.email },
      { organizationId: "org_other", marker: existing.id }), false);
    await assert.rejects(change("activate", { account: existing, user: user.id }), /cannot be activated/);
    assert.equal((await change("activate", { account: existing, user: "user_known" })).state, "active");
    assert.equal(permitsTopic(["GLP-1"], "glp_1"), true);
    assert.equal(permitsTopic(["GLP-1"], "Hepatitis B"), false);

    const downgraded = await change("update_access", { account: active, role: "viewer", topics: ["Hepatitis B"] });
    assert.equal(downgraded.account_role, "viewer");
    assert.deepEqual(await asAuthenticated(user.id, "org_client", rows), ["Hepatitis B"]);
    await assert.rejects(change("update_access", { account: downgraded, role: "platform_admin", topics: [] }), /Cannot move/);
    await assert.rejects(change("update_access", { account: downgraded, topics: ["Inactive"] }), /unique and active/);
    assert.deepEqual(await asAuthenticated(user.id, "org_client", rows), ["Hepatitis B"]);
    await assert.rejects(change("suspend", { account: downgraded, actor: user.id }), /Platform Admin/);
    await assert.rejects(change("reserve", { email: "escalation@example.com", actor: user.id }), /Platform Admin/);
    const suspended = await change("suspend", { account: downgraded });
    assert.equal(accountAccess(suspended, "org_client", true), "suspended");
    assert.deepEqual(await asAuthenticated(user.id, "org_client", rows), []);
    const restored = await change("restore", { account: suspended });
    assert.equal(accountAccess(restored, "org_client", true), "allowed");
    assert.deepEqual(await asAuthenticated(user.id, "org_client", rows), ["Hepatitis B"]);

    const platform = await change("reserve", { email: "platform@example.com", role: "platform_admin", org: null, topics: [] });
    assert.equal(hasInvitationProof(platform, { id: "user_platform", verifiedEmail: platform.email, banned: false, marker: platform.id }), true);
    assert.equal(hasInvitationProof(platform, { id: "user_platform", verifiedEmail: platform.email, banned: false, marker: "wrong" }), false);
    const platformActive = await change("activate", { account: platform, actor: "user_platform", user: "user_platform" });
    await assert.rejects(change("suspend", { account: platformActive, actor: "user_platform" }), /own account/);
    await change("suspend", { account: platformActive });
    await assert.rejects(change("reserve", { email: "suspended-admin@example.com", actor: "user_platform" }), /Platform Admin/);
    assert.equal(permitsManagedRequest("client_admin", "/api/admin/user-provisioning", "POST"), false);
    assert.equal(permitsManagedRequest("platform_admin", "/api/admin/user-provisioning", "POST"), true);
    assert.equal(permitsManagedRequest("client_admin", "/api/workspaces/members", "POST"), true);
    assert.equal(permitsManagedRequest("client_analyst", "/api/workspaces/members", "POST"), false);
    assert.equal(permitsManagedRequest("viewer", "/api/workspaces", "GET"), true);
    assert.equal(permitsManagedRequest("viewer", "/api/workspaces", "PATCH"), false);
    assert.equal(permitsManagedRequest("viewer", "/api/chat/messages", "POST"), false);
    assert.equal(permitsManagedRequest("viewer", "/api/ask", "POST"), true);

    const managedAdmin = { userId: "user_admin", isAdmin: true, requireExplicitPvGrant: true };
    assert.equal(resolveEntitlements(managedAdmin).capabilities.agent_pharmacovigilance_assistant.granted, false);
    assert.equal(resolveEntitlements({
      ...managedAdmin,
      userMetadata: { grants: ["agent_pharmacovigilance_assistant"] },
    }).capabilities.agent_pharmacovigilance_assistant.granted, true);
    assert.equal(resolveEntitlements({ userId: "legacy_admin", isAdmin: true }).capabilities.agent_pharmacovigilance_assistant.granted, true);

    const audit = await db.query<{ previous_hash: string; event_hash: string; outcome: string }>(
      "select previous_hash,event_hash,outcome from public.intelligence_audit_events where principal_id='org_client' order by occurred_at",
    );
    assert.equal(audit.rows.length, 9);
    for (const [index, row] of audit.rows.entries()) {
      assert.equal(row.previous_hash, audit.rows[index - 1]?.event_hash ?? "GENESIS");
    }
    assert.equal(audit.rows.filter(row => row.outcome === "failed").length, 1);

    console.log(`User provisioning passed invitation, role, RLS, suspension, PV and audit checks with the ${previewLayout ? "hosted preview" : "repository"} legacy schema.`);
  } finally {
    await db.close();
  }
}

void testScopedSupabaseCredentials().then(() => main()).then(() => main(true)).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
