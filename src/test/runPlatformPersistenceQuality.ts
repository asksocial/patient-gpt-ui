import fs from "node:fs";
import path from "node:path";
import { platformPrincipalFromEntitlements } from "../lib/intelligence-platform";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const principal = platformPrincipalFromEntitlements({ userId: "user_1", organizationId: "org_1" });
assert(principal.principalId === "org_1", "Organization scope must take precedence.");
assert(principal.actorId === "user_1", "The authenticated user must remain the audit actor.");

const userPrincipal = platformPrincipalFromEntitlements({ userId: "user_2" });
assert(userPrincipal.principalType === "user", "Users without an organization require isolated user scope.");

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/202607310001_create_platform_persistence.sql"),
  "utf8"
);
for (const table of [
  "intelligence_workspaces",
  "intelligence_work_products",
  "intelligence_knowledge_entities",
  "intelligence_knowledge_relationships",
  "intelligence_audit_events",
]) {
  assert(migration.includes(table), `Persistence migration is missing ${table}.`);
}
assert(migration.includes("enable row level security"), "Persistent intelligence tables must enable RLS.");
assert(migration.includes("event_hash text not null unique"), "Audit events must retain a unique chain hash.");

console.log("Platform persistence quality checks passed.");
