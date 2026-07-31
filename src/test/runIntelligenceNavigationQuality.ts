import {
  buildEcosystemNavigation,
  configurationFromEntitlements,
  getIntelligenceModeOptions,
  getModuleSwitcherOptions,
  resolveCustomerIntelligenceAccess,
} from "../lib/intelligence-platform";
import {
  resolveEntitlements,
} from "../lib/entitlements";

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
  !labels.includes("Reports") ||
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
    },
    null,
    2
  )
);
