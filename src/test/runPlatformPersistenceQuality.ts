import fs from "node:fs";
import path from "node:path";
import { platformPrincipalFromEntitlements } from "../lib/intelligence-platform";
import {
  addLegacyWorkspaceField,
  isMissingSessionWorkspaceColumn,
} from "../lib/chat/sessionCompatibility";

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
assert(
  migration.includes(
    "add column if not exists workspace_id"
  ),
  "Persistence migration must link chat sessions to workspaces."
);

assert(
  isMissingSessionWorkspaceColumn({
    code: "PGRST204",
    message:
      "Could not find the 'workspace_id' column of 'chat_sessions' in the schema cache",
  }),
  "Legacy staging schemas must be detected from the PostgREST error."
);
assert(
  isMissingSessionWorkspaceColumn({
    code: "42703",
    message:
      "column chat_sessions.workspace_id does not exist",
  }),
  "Legacy staging schemas must be detected from the PostgreSQL undefined-column error."
);
assert(
  !isMissingSessionWorkspaceColumn({
    code: "PGRST204",
    message:
      "Could not find another column",
  }),
  "Unrelated schema errors must not trigger chat-session compatibility."
);
assert(
  addLegacyWorkspaceField({
    id: "session_1",
  }).workspace_id === null,
  "Legacy sessions must expose a null workspace field to the UI."
);

const sessionRoute = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/app/api/chat/sessions/route.ts"
  ),
  "utf8"
);
assert(
  sessionRoute.includes(
    "if (workspaceId)"
  ) &&
    !sessionRoute.includes(
      "workspace_id: workspaceId || null"
    ),
  "Session-only conversations must not write a migration-dependent workspace column."
);

console.log("Platform persistence quality checks passed.");
