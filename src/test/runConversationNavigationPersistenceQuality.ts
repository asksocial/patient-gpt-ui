import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveWorkspaceNavigationDestination } from "../lib/intelligence-platform/navigation";

assert.equal(
  resolveWorkspaceNavigationDestination(
    "intelligence_search",
    true
  ),
  "ask",
  "Search should return to the active conversation when a query or result exists."
);

assert.equal(
  resolveWorkspaceNavigationDestination(
    "intelligence_search",
    false
  ),
  "intelligence_search",
  "Search should retain its cross-workspace library behavior before a conversation begins."
);

assert.equal(
  resolveWorkspaceNavigationDestination(
    "module_patient",
    true
  ),
  "module_patient",
  "Only the Search return path should be resolved to the active conversation."
);

const workspaceShell = readFileSync(
  resolve(process.cwd(), "src/components/WorkspaceShell.jsx"),
  "utf8"
);

assert(
  workspaceShell.includes(
    "resolveWorkspaceNavigationDestination("
  ),
  "Workspace navigation must use the conversation-preserving destination resolver."
);
assert(
  workspaceShell.includes("activeSessionId ||") &&
    workspaceShell.includes("messages.length > 0"),
  "An active session or in-memory messages must preserve the current conversation."
);
assert(
  workspaceShell.includes("function startNewConversation()") &&
    workspaceShell.includes("setActiveSessionId(null);") &&
    workspaceShell.includes("setMessages([]);") &&
    workspaceShell.includes('setActiveDestination("ask");'),
  "New conversation must remain the explicit conversation reset boundary."
);

console.log(
  "Conversation navigation persistence quality checks passed."
);
