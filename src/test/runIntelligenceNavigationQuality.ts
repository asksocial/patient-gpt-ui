import {
  buildEcosystemNavigation,
  configurationFromEntitlements,
  getIntelligenceModeOptions,
  getModuleSwitcherOptions,
  resolveCustomerIntelligenceAccess,
} from "../lib/intelligence-platform";
import "./runKnowledgeGraphWorkspaceQuality";
import {
  resolveEntitlements,
} from "../lib/entitlements";
import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";

const entitlements =
  resolveEntitlements({
    userId: "navigation_user",
    organizationId:
      "navigation_org",
    organizationMetadata: {
      grants: [
        "module_patient",
        "agent_referral_navigator",
        "agent_scientific_intelligence_advisor",
      ],
    },
    knowledgePersistenceEnabled:
      true,
  });

const access =
  resolveCustomerIntelligenceAccess(
    configurationFromEntitlements(
      entitlements
    )
  );
const navigation =
  buildEcosystemNavigation(access);
const labels = navigation.flatMap(
  (group) =>
    group.items.map(
      (item) => item.label
    )
);

if (
  !labels.includes("Home") ||
  !labels.includes("Ask AskSocial") ||
  !labels.includes("Search") ||
  !labels.includes(
    "Knowledge Graph"
  ) ||
  !labels.includes(
    "Executive Brief"
  ) ||
  !labels.includes("Patient") ||
  !labels.includes("My Modes") ||
  !labels.includes("Mode Library") ||
  labels.includes("Medical Affairs") ||
  labels.includes(
    "Referral Navigator"
  ) ||
  labels.includes(
    "Scientific Intelligence Advisor"
  )
) {
  throw new Error(
    "Navigation must expose the ecosystem hierarchy while hiding unlicensed modules and blocked agents."
  );
}

const navigationComponent =
  readFileSync(
    join(
      process.cwd(),
      "src/components/EcosystemNavigation.jsx"
    ),
    "utf8"
  );

for (const groupId of [
  "intelligence",
  "modules",
  "modes",
  "workflows",
  "pv_compliance",
]) {
  if (
    !navigationComponent.includes(
      `"${groupId}"`
    )
  ) {
    throw new Error(
      `Left-rail disclosure navigation is missing ${groupId}.`
    );
  }
}

if (
  !navigationComponent.includes(
    'aria-label="Platform navigation"'
  ) ||
  !navigationComponent.includes(
    "aria-expanded"
  ) ||
  !navigationComponent.includes(
    "openGroup"
  ) ||
  !navigationComponent.includes(
    'className="relative"'
  ) ||
  !navigationComponent.includes(
    'label: "More"'
  ) ||
  !navigationComponent.includes(
    'event.key === "Escape"'
  ) ||
  !navigationComponent.includes(
    '"mousedown"'
  )
) {
  throw new Error(
    "Platform categories must render as collapsed top-navigation dropdowns that reveal their items on demand."
  );
}

const workspaceShell = readFileSync(
  join(
    process.cwd(),
    "src/components/WorkspaceShell.jsx"
  ),
  "utf8"
);

if (
  !workspaceShell.includes(
    "Executive brief"
  ) ||
  !workspaceShell.includes(
    'handleNavigation("ask")'
  ) ||
  !workspaceShell.includes(
    '"intelligence_reports"'
  ) ||
  !workspaceShell.includes(
    ">\n                Workspace\n              </div>"
  )
) {
  throw new Error(
    "The restored Workspace left rail must provide Conversation and Executive Brief views."
  );
}

const modeOptions =
  getIntelligenceModeOptions(
    access,
    "patient"
  );

if (
  modeOptions.length !== 2 ||
  modeOptions[0]?.value !==
    "general" ||
  modeOptions[1]?.value !==
    "referral_navigator" ||
  modeOptions[1]?.label !==
    "Referral Intelligence"
) {
  throw new Error(
    "Licensed agents must be presented as Intelligence Modes within AskSocial."
  );
}

const moduleOptions =
  getModuleSwitcherOptions(access);

if (
  moduleOptions.length !== 1 ||
  moduleOptions[0]?.value !==
    "patient"
) {
  throw new Error(
    "The module switcher must contain only licensed modules."
  );
}

const nonAdminLabels =
  buildEcosystemNavigation(
    access
  ).flatMap((group) =>
    group.items.map(
      (item) => item.label
    )
  );
const adminLabels =
  buildEcosystemNavigation(
    access,
    { isAdmin: true }
  ).flatMap((group) =>
    group.items.map(
      (item) => item.label
    )
  );

if (
  nonAdminLabels.includes(
    "Administration"
  ) ||
  !adminLabels.includes(
    "Administration"
  )
) {
  throw new Error(
    "Administration navigation must be restricted to administrators."
  );
}

console.log(
  JSON.stringify(
    {
      licensedModules:
        access.modules.map(
          (module) => module.id
        ),
      permittedAgents:
        access.agents.map(
          (agent) => agent.id
        ),
      navigationGroups:
        navigation.map(
          (group) => group.id
        ),
      intelligenceModes:
        modeOptions.map(
          (mode) => mode.value
        ),
      topDropdownNavigation: true,
      restoredExecutiveBrief: true,
    },
    null,
    2
  )
);
