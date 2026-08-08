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

console.log("Primary Search layout quality checks passed.");
