import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceShell = readFileSync(
  resolve(process.cwd(), "src/components/WorkspaceShell.jsx"),
  "utf8"
);

assert(
  workspaceShell.includes(
    'data-testid="primary-search-composer"'
  ) &&
    workspaceShell.includes(
      'className="order-2 px-6 pt-6"'
    ),
  "The primary Search composer must appear before the empty-state content."
);
assert(
  workspaceShell.includes(
    'className="order-3 flex-1 px-6 py-6"'
  ),
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
    workspaceShell.includes('message.role ===\n                      "assistant"') &&
    !workspaceShell.includes("function UserMessage({ text })"),
  "The submitted or restored question must remain in the Search composer instead of rendering below it."
);
assert(
  workspaceShell.includes(
    'className="w-full rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.03] p-4 md:p-5"'
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
      "Report-backed insights + structured curated intelligence + live"
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
