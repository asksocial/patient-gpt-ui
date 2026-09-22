import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shell = readFileSync(resolve(process.cwd(), "src/components/WorkspaceShell.jsx"), "utf8");
const navigation = readFileSync(resolve(process.cwd(), "src/components/EcosystemNavigation.jsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const designSystem = readFileSync(resolve(process.cwd(), "docs/design/asksocial-design-system-2.md"), "utf8");

assert(shell.includes("asksocial-v2") && shell.includes("From conversation to intelligence"), "The redesigned shell must expose the AskSocial 2.0 brand thesis.");
assert(shell.includes("What would you like to understand?") && shell.includes("Human conversations") && shell.includes("Decisions"), "The query workspace must communicate the conversation-to-decision journey.");
for (const label of ["Ask", "Explore", "Analyze", "Monitor", "Verify", "Manage"]) {
  assert(navigation.includes(`label: \"${label}\"`) || navigation.includes(`<span>${label}</span>`), `The task-oriented navigation is missing ${label}.`);
}
for (const token of ["--as-ink", "--as-ivory", "--as-mint", "--as-gold", "--as-danger"]) {
  assert(styles.includes(token), `The design system is missing ${token}.`);
}
assert(styles.includes("prefers-reduced-motion") && styles.includes(":focus"), "The visual system must retain motion and focus accessibility safeguards.");
assert(designSystem.includes("Insight → Theme → Supporting evidence → Full mention → Original source"), "Evidence provenance must be documented as a first-class product journey.");

console.log("AskSocial Design System 2.0 quality checks passed.");
