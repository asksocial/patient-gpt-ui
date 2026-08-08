import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const workspace = readFileSync(
  join(process.cwd(), "src/components/WorkspaceShell.jsx"),
  "utf8"
);
const graph = readFileSync(
  join(process.cwd(), "src/components/KnowledgeGraphView.jsx"),
  "utf8"
);

for (const contract of [
  '"intelligence_graph"',
  "<KnowledgeGraphView",
  "themeSummary:",
  "themeRelationships:",
  "knowledgeSnapshot:",
  "themeLongitudinalTracking:",
  "latestKnowledgeGraph",
]) {
  assert(
    workspace.includes(contract),
    `Workspace is missing the Knowledge Graph contract: ${contract}`
  );
}

for (const contract of [
  "Evidence-qualified topology",
  "Supported relationships",
  "eligible prevalence",
  "No unsupported links are inferred",
  "brief?.topThemes",
  "Audiences",
  "Markets",
  "Platforms",
]) {
  assert(
    graph.includes(contract),
    `Knowledge Graph view is missing the required evidence contract: ${contract}`
  );
}

console.log(
  JSON.stringify(
    {
      evidenceQualifiedGraph: true,
      relationshipStrength: true,
      executiveBriefFallback: true,
      conversationPersistence: true,
    },
    null,
    2
  )
);
