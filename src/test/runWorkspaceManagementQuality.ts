import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = source("supabase/migrations/202608080001_create_workspace_management.sql");
const persistence = source("src/lib/intelligence-platform/persistence.ts");
const manager = source("src/components/WorkspaceManager.jsx");
const shell = source("src/components/WorkspaceShell.jsx");
const library = source("src/components/IntelligenceLibrary.jsx");
const sessionRoute = source("src/app/api/chat/session/route.ts");

assert(migration.includes("intelligence_workspace_members"), "Workspace membership storage is required.");
assert(migration.includes("archived_at"), "Workspace archival is required.");
assert(migration.includes("'owner', 'editor', 'viewer'"), "Owner, editor, and viewer roles are required.");
assert(persistence.includes("A workspace must retain at least one owner."), "Workspaces must prevent orphaned ownership.");
assert(persistence.includes("workspace.member.upsert") && persistence.includes("workspace.delete"), "Workspace governance changes must be audited.");
assert(persistence.includes("row.created_by === principal.actorId") && persistence.includes('roles.get(row.id) || "owner"'), "Workspace creators must retain owner access when a membership row is temporarily unavailable.");
assert(manager.includes("Workspace manager") && manager.includes("Saved intelligence") && manager.includes("Members and permissions"), "The workspace manager must expose content and governance.");
assert(manager.includes("Delete permanently") && manager.includes("Archive") && manager.includes("Save changes"), "Workspace lifecycle controls are required.");
assert(shell.includes('data-testid="active-workspace-indicator"') && shell.includes('aria-label="Select current workspace"') && shell.includes("Workspace: Session only") && shell.includes("Workspace: {workspace.name}"), "The header must provide an explicit active-workspace selector.");
assert(shell.includes("text-cyan-300") && shell.includes("uppercase"), "The active-workspace indicator must be cyan and uppercase.");
assert(shell.includes("workspaceSaveStatus") && shell.includes("Saved to workspace"), "Visible save-state feedback must remain available within the workspace indicator.");
assert(!shell.includes('id="global-module-switcher"') && !shell.includes("Saved work becomes searchable across permitted workspaces."), "The redundant global module dropdown and legacy workspace selector must remain removed.");
assert(shell.includes("!workspace.archivedAt") && shell.includes('disabled={workspace.role === "viewer"}'), "The indicator dropdown must list only active associated workspaces and prevent selection of view-only destinations.");
assert(shell.includes('if (nextWorkspaces.some((workspace) => workspace.id === current)) return current;\n        return "";'), "Loading a user’s workspaces must preserve Session only until an explicit selection is made.");
assert(!shell.includes("setActiveWorkspaceId(data.session.workspace_id"), "Opening or creating a conversation must not implicitly change the active workspace.");
assert(shell.includes("const loadWorkspaces = useCallback") && shell.includes('activeDestination.startsWith("pv_")'), "Workspace state must refresh when users enter workspace-dependent views.");
assert(shell.includes("onRefreshWorkspaces={loadWorkspaces}"), "PV review-list saving must share the shell workspace refresh path.");
assert(sessionRoute.includes("workspaceId") && sessionRoute.includes("assertWorkspaceAccess"), "Changing workspace must update and authorize the active conversation.");
assert(library.includes("Open complete saved work"), "Cross-workspace search results must open their complete payload.");

console.log("Workspace management quality checks passed.");
