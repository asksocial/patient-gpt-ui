import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";

const workspaceShell = readFileSync(
  join(
    process.cwd(),
    "src/components/WorkspaceShell.jsx"
  ),
  "utf8"
);

const requiredContracts = [
  "<AnalyticalAssistantAnswer responsePayload={responsePayload} />",
  "showDirectAnswer={false}",
  "showWhatThisMeans={!analyticalIncludesWhatThisMeans}",
  'title="From Curated Intelligence"',
  'title="What’s Emerging In Social Data"',
  'title="Relevant Curated Insights"',
  'title="What This Means"',
  'title="Recommended Actions"',
  '<span className="whitespace-nowrap">',
];

for (const contract of requiredContracts) {
  if (!workspaceShell.includes(contract)) {
    throw new Error(
      `Workspace answer rendering is missing the required contract: ${contract}`
    );
  }
}

if (
  !workspaceShell.includes('sections.filter((section) => section.key !== "live_data_check")') ||
  workspaceShell.includes('title="What’s Emerging In Live Data"')
) {
  throw new Error(
    "Search must hide the Live Data Check panel and label emerging intelligence as social data."
  );
}

const analyticalComposition =
  workspaceShell.match(
    /hasAnalyticalAnswer[\s\S]*?<AnalyticalAssistantAnswer[\s\S]*?<AssistantAnswer[\s\S]*?showDirectAnswer=\{false\}/
  );

if (!analyticalComposition) {
  throw new Error(
    "Analytical answers must compose the validated analytical view with the curated/live intelligence context instead of replacing it."
  );
}

console.log(
  JSON.stringify(
    {
      analyticalAnswer: true,
      curatedIntelligence: true,
      liveIntelligence: true,
      insightTags: true,
      whatThisMeans: true,
      recommendedActions: true,
    },
    null,
    2
  )
);
