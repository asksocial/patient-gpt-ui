import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";

const executiveBriefView = readFileSync(
  join(
    process.cwd(),
    "src/components/ExecutiveIntelligenceView.jsx"
  ),
  "utf8"
);

const expectedHeadings = [
  "Theme",
  "Prevalence",
  "Trajectory",
  "Recent change",
  "Confidence",
  "Triangulation",
];

for (const label of expectedHeadings) {
  const contract = `label="${label}"`;

  if (!executiveBriefView.includes(contract)) {
    throw new Error(
      `Priority Themes is missing the tooltip heading contract: ${label}`
    );
  }
}

const requiredAccessibilityContracts = [
  "function TableHeading",
  "<Tooltip",
  "aria-label={`${label}: ${tooltip}`}",
  "focus-visible:ring-2",
];

for (const contract of requiredAccessibilityContracts) {
  if (!executiveBriefView.includes(contract)) {
    throw new Error(
      `Priority Themes tooltips are missing the accessibility contract: ${contract}`
    );
  }
}

console.log(
  JSON.stringify(
    {
      priorityThemeHeadings: expectedHeadings,
      tooltipCount: expectedHeadings.length,
      keyboardAccessible: true,
    },
    null,
    2
  )
);
