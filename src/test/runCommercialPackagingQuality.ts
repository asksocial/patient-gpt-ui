import {
  buildCommercialPackaging,
  buildEcosystemNavigation,
  configurationFromEntitlements,
  resolveCustomerIntelligenceAccess,
} from "../lib/intelligence-platform";
import {
  resolveEntitlements,
} from "../lib/entitlements";

const entitlements =
  resolveEntitlements({
    userId: "user_1",
    organizationId: "org_1",
    organizationMetadata: {
      grants: [
        "module_patient",
        "agent_patient_journey_advisor",
        "data_package_social",
        "governance_enterprise",
      ],
      attributes: {
        agent_patient_journey_advisor:
          {
            monthlyUsageLimit:
              250,
          },
      },
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
const packaging =
  buildCommercialPackaging(
    entitlements
  );
const navigation =
  buildEcosystemNavigation(access);
const moduleNavigation =
  navigation.find(
    (group) =>
      group.id === "modules"
  )?.items;

if (
  moduleNavigation?.length !== 1 ||
  moduleNavigation[0].id !==
    "module_patient"
) {
  throw new Error(
    "Only licensed modules may appear in primary navigation."
  );
}

const clinicalExpansion =
  packaging.availableToAdd.find(
    (module) =>
      module.moduleId ===
      "clinical_trials"
  );

if (
  !clinicalExpansion ||
  !clinicalExpansion.value ||
  clinicalExpansion
    .compatibleModes[0]
    ?.agentId !==
    "clinical_trial_companion" ||
  "capabilities" in
    clinicalExpansion ||
  "dataSourceTypes" in
    clinicalExpansion
) {
  throw new Error(
    "Locked modules must show restrained value and mode information without restricted content."
  );
}

const layers = new Set(
  packaging.licenses.map(
    (license) => license.layer
  )
);
const usageLicense =
  packaging.licenses.find(
    (license) =>
      license.entitlement ===
      "agent_patient_journey_advisor"
  );

if (
  layers.size !== 5 ||
  usageLicense?.usageLimit !==
    250 ||
  packaging.activationGuarantees
    .length !== 5
) {
  throw new Error(
    "Packaging must represent all five subscription layers, agent usage, and activation continuity."
  );
}

console.log(
  JSON.stringify(
    {
      licenseLayers:
        [...layers],
      licensedNavigation:
        moduleNavigation,
      availableToAdd:
        packaging.availableToAdd,
      usageLimit:
        usageLicense.usageLimit,
      activationGuarantees:
        packaging.activationGuarantees,
    },
    null,
    2
  )
);
