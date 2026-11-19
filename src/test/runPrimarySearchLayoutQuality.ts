import assert from "node:assert/strict";
import { getCurrentSearchResult } from "../lib/answers/currentSearchResult";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceShell = readFileSync(
  resolve(process.cwd(), "src/components/WorkspaceShell.jsx"),
  "utf8"
);

assert(
  /data-testid="primary-search-composer"\s+className="[^"]*\border-2\b/.test(workspaceShell),
  "The primary Search composer must appear before the empty-state content."
);
assert(
  /data-search-page=\{[^}]+\}\s+className="[^"]*\border-3\b/.test(workspaceShell),
  "The primary Search content must follow the composer."
);
assert(
  !workspaceShell.includes(
    'className="sticky bottom-0 border-t'
  ),
  "The composer must not remain a separate sticky bottom section."
);
assert(
  workspaceShell.includes("setQuestion(trimmed);") &&
    workspaceShell.includes("const latestUserQuestion = [...restoredMessages]") &&
    workspaceShell.includes("setQuestion(latestUserQuestion);") &&
    workspaceShell.includes('data-testid="search-current-response"') &&
    !workspaceShell.includes("function UserMessage({ text })"),
  "The submitted or restored question must remain in the Search composer instead of rendering below it."
);
assert(
  workspaceShell.includes(
    'className="ask-response w-full"'
  ) &&
    !workspaceShell.includes("w-full max-w-6xl rounded-3xl rounded-bl-md"),
  "Search answer sections must use the full composer width."
);
assert(
  !workspaceShell.includes('import CitationManifest from "./CitationManifest"') &&
    !workspaceShell.includes("<CitationManifest"),
  "Sources & Verification must not render on the Search screen."
);
assert(
  workspaceShell.includes(
    'data-testid="primary-search-footer"'
  ) &&
    workspaceShell.includes(
      'className="order-4 border-t border-white/10 px-6 py-4"'
    ) &&
    workspaceShell.includes(
      "© 2026 Eavesdrop LLC. All rights reserved."
    ),
  "The Search evidence-basis footer must remain below the primary content."
);
assert(
  !workspaceShell.includes(
    'aria-label="Intelligence Mode"'
  ) &&
    !workspaceShell.includes(
      "suggestedModeActions"
    ) &&
    workspaceShell.includes(
      'intelligenceMode:\n            "general"'
    ),
  "Primary Search must hide mode controls and use automatic general routing."
);

console.log("Primary Search layout quality checks passed.");


const firstQuestion = { id: "q1", role: "user", text: "What are people saying in Brazil?" };
const firstAnswer = { id: "a1", role: "assistant", text: "Brazil response" };
const nextQuestion = { id: "q2", role: "user", text: "What are people saying in Japan?" };
const nextAnswer = { id: "a2", role: "assistant", text: "Japan response" };
const history = Object.freeze([firstQuestion, firstAnswer, nextQuestion, nextAnswer]);
assert.equal(getCurrentSearchResult([]).message, null);
assert.equal(getCurrentSearchResult([firstQuestion, firstAnswer]).message, firstAnswer);
assert.equal(getCurrentSearchResult([firstQuestion, firstAnswer, nextQuestion]).message, null, "A pending or failed new question must not leave stale response data on screen");
assert.equal(getCurrentSearchResult(history).message, nextAnswer, "Restored conversations display only the current response");
assert.equal(getCurrentSearchResult(history).question, nextQuestion.text, "The Search heading follows the submitted question rather than the original session title");
assert.equal(history.length, 4, "Selecting a current view does not remove conversation history");
assert.ok(!workspaceShell.includes("messages.map("), "Search must not append response cards from the full transcript");
console.log("PASS Search replaces the displayed response on each question, clears stale data while pending, and preserves saved history");
