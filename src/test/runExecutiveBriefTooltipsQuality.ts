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
const sharedTooltip = readFileSync(join(process.cwd(), "src/components/ui/Tooltip.jsx"), "utf8");
const globalStyles = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

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

for (const contract of ["useId", '"aria-describedby"', 'event.key === "Escape"', 'role="tooltip"', "asksocial-tooltip"] as const) {
  if (!sharedTooltip.includes(contract)) throw new Error(`Shared tooltips are missing the accessibility contract: ${contract}`);
}

for (const contract of ['[role="tooltip"].asksocial-tooltip', "background: #0b2b24 !important", "color: #ffffff !important", "max-width: min(20rem"] as const) {
  if (!globalStyles.includes(contract)) throw new Error(`Sage Mist tooltips are missing the high-contrast visibility contract: ${contract}`);
}

if (sharedTooltip.includes("pointer-events-none")) throw new Error("Visible tooltips must remain hoverable under WCAG 1.4.13.");

console.log(
  JSON.stringify(
    {
      priorityThemeHeadings: expectedHeadings,
      tooltipCount: expectedHeadings.length,
      keyboardAccessible: true,
      escapeDismissible: true,
      hoverable: true,
      sageMistContrastProtected: true,
    },
    null,
    2
  )
);
