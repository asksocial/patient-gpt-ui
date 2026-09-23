import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shell = readFileSync(resolve(process.cwd(), "src/components/WorkspaceShell.jsx"), "utf8");
const navigation = readFileSync(resolve(process.cwd(), "src/components/EcosystemNavigation.jsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const landing = readFileSync(resolve(process.cwd(), "src/app/page.js"), "utf8");
const designSystem = readFileSync(resolve(process.cwd(), "docs/design/asksocial-design-system-2.md"), "utf8");

assert(shell.includes("asksocial-v2") && shell.includes("From conversation to intelligence"), "The redesigned shell must expose the AskSocial 2.0 brand thesis.");
assert(shell.includes("What would you like to understand?") && shell.includes("Human conversations") && shell.includes("Decisions"), "The query workspace must communicate the conversation-to-decision journey.");
assert(shell.includes('name="close"') && !shell.includes("<span>Collapse</span>"), "The expanded rail must use a compact X control instead of a text Collapse control.");
assert(shell.includes('name="menu"') && !shell.includes("<span>Show left rail</span>"), "The collapsed rail must use a hamburger control instead of a text Show left rail control.");
assert(shell.includes("AskSocialWordmark") && shell.includes("asksocial-wordmark-symbol"), "The rail must use the supplied AskSocial wordmark instead of the legacy AS tile.");
assert(styles.includes(".asksocial-wordmark-bubble") && styles.includes(".asksocial-wordmark-block") && styles.includes(".asksocial-wordmark-text > strong"), "The AskSocial wordmark must retain its split speech mark and mixed-weight typography.");
assert(shell.includes("asksocial-workarea-header-card") && shell.includes("data-asksocial-workarea-content"), "The primary work area must expose the Sage Mist header-card and content-surface contracts.");
assert(shell.includes("asksocial-pv-context-chips") && shell.includes("Potential records, not AE determinations"), "PV context must remain visible in the Sage Mist page header.");
for (const icon of ["topic", "investigate", "questions", "intelligence", "user"]) {
  assert(shell.includes(`name=\"${icon}\"`), `The contextual left-rail icon set is missing ${icon}.`);
}
assert(shell.includes("asksocial-rail-collapsed") && styles.includes('data-rail-collapsed="true"'), "The collapsed rail must remain as an icon-only dock instead of disappearing.");
for (const label of ["Ask", "Explore", "Analyze", "Monitor", "Verify", "Manage"]) {
  assert(navigation.includes(`label: \"${label}\"`) || navigation.includes(`<span>${label}</span>`), `The task-oriented navigation is missing ${label}.`);
}
for (const token of ["--as-ink", "--as-sage-mist", "--as-sage-paper", "--as-sage-ink", "--as-sage-active", "--as-ivory", "--as-mint", "--as-gold", "--as-danger"]) {
  assert(styles.includes(token), `The design system is missing ${token}.`);
}
assert(styles.includes(".pv-metric-category") && styles.includes(".pv-metric-category-reconciliation"), "PV metrics must use the Sage Mist category-chip system.");
assert(styles.includes(".pv-compliance-hero") && styles.includes("display: none"), "The redundant PV hero must stay removed from the Sage Mist work area.");
assert(styles.includes("prefers-reduced-motion") && styles.includes(":focus"), "The visual system must retain motion and focus accessibility safeguards.");
assert(landing.includes('bg-[#edf3f0]') && landing.includes("LandingWordmark"), "The public landing page must use the Sage Mist ground and AskSocial wordmark.");
assert(landing.includes("Turn social data into strategic answers.") && landing.includes("Report-backed intelligence + live emerging narratives"), "The landing hero must communicate the reference value proposition.");
assert(landing.includes("IntelligencePreview") && landing.includes("What themes are driving confusion or concern?"), "The landing hero must retain its conversational intelligence preview.");
for (const capability of ["Ask strategic questions", "Blend baseline and live context", "Surface narratives, not just volume"]) {
  assert(landing.includes(capability), `The landing capability grid is missing ${capability}.`);
}
assert(designSystem.includes("Insight → Theme → Supporting evidence → Full mention → Original source"), "Evidence provenance must be documented as a first-class product journey.");

console.log("AskSocial Design System 2.0 quality checks passed.");
