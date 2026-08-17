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
const askRoute = readFileSync(
  join(process.cwd(), "src/app/api/ask/route.ts"),
  "utf8"
);

const requiredContracts = [
  "<AnalyticalAssistantAnswer responsePayload={responsePayload} />",
  "showDirectAnswer={false}",
  "showWhatThisMeans={!analyticalIncludesWhatThisMeans}",
  'title="From Curated Intelligence"',
  'typeof responsePayload?.curatedIntelligenceAvailable === "boolean"',
  "{curatedIntelligenceAvailable ? (",
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

if (
  workspaceShell.includes(
    "No baseline report themes were available for this response."
  )
) {
  throw new Error(
    "Search must hide From Curated Intelligence instead of rendering an empty curated-intelligence panel."
  );
}

if (
  !askRoute.includes(
    "curatedThemes.length > 0 || curatedInsights.length > 0"
  ) ||
  !askRoute.includes("curatedIntelligenceAvailable,")
) {
  throw new Error(
    "The Ask API must explicitly report whether curated intelligence exists for the selected therapeutic area."
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
