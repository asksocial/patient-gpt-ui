import type {
  EntitlementKey,
  EntitlementResolution,
} from "../entitlements";
import {
  AGENT_ENTITLEMENTS,
  AI_AGENT_CATALOG,
  INTELLIGENCE_MODULE_CATALOG,
  MODULE_ENTITLEMENTS,
} from "./catalog";
import type {
  AiAgentId,
  IntelligenceModuleId,
} from "./ids";

export type CommercialLicenseLayer =
  | "platform"
  | "module"
  | "agent"
  | "data_source"
  | "governance";

export type CommercialLicense = {
  layer: CommercialLicenseLayer;
  entitlement: EntitlementKey;
  name: string;
  active: boolean;
  usageLimit?: number;
};

export type AvailableModuleExpansion = {
  moduleId: IntelligenceModuleId;
  name: string;
  value: string;
  compatibleModes: Array<{
    agentId: AiAgentId;
    name: string;
  }>;
  state: "available_to_add";
};

export type CommercialPackaging =
  {
    licenses:
      CommercialLicense[];
    licensedModuleIds:
      IntelligenceModuleId[];
    availableToAdd:
      AvailableModuleExpansion[];
    activationGuarantees: string[];
  };

const DATA_AND_GOVERNANCE:
  Array<{
    entitlement: EntitlementKey;
    layer:
      | "data_source"
      | "governance";
    name: string;
  }> = [
  {
    entitlement:
      "data_package_scientific",
    layer: "data_source",
    name: "Scientific data",
  },
  {
    entitlement:
      "data_package_social",
    layer: "data_source",
    name: "Social intelligence data",
  },
  {
    entitlement:
      "data_package_market",
    layer: "data_source",
    name: "Market intelligence data",
  },
  {
    entitlement:
      "governance_enterprise",
    layer: "governance",
    name: "Enterprise governance",
  },
];

export function buildCommercialPackaging(
  entitlements:
    EntitlementResolution
): CommercialPackaging {
  const granted = new Set(
    entitlements.granted
  );
  const platformActive =
    granted.has("platform_core");
  const licensedModuleIds =
    INTELLIGENCE_MODULE_CATALOG
      .filter((module) =>
        platformActive &&
        granted.has(
          MODULE_ENTITLEMENTS[
            module.id
          ]
        )
      )
      .map((module) => module.id);

  const licenses:
    CommercialLicense[] = [
    {
      layer: "platform",
      entitlement:
        "platform_core",
      name: "AskSocial Core Platform",
      active: granted.has(
        "platform_core"
      ),
    },
    ...INTELLIGENCE_MODULE_CATALOG.map(
      (module) => ({
        layer:
          "module" as const,
        entitlement:
          MODULE_ENTITLEMENTS[
            module.id
          ],
        name: module.name,
        active:
          licensedModuleIds.includes(
            module.id
          ),
      })
    ),
    ...AI_AGENT_CATALOG.map(
      (agent) => {
        const entitlement =
          AGENT_ENTITLEMENTS[
            agent.id
          ];
        const rawLimit =
          entitlements
            .capabilities[
              entitlement
            ].attributes
            .monthlyUsageLimit;
        return {
          layer:
            "agent" as const,
          entitlement,
          name: agent.name,
          active:
            granted.has(
              entitlement
            ),
          usageLimit:
            typeof rawLimit ===
            "number"
              ? rawLimit
              : undefined,
        };
      }
    ),
    ...DATA_AND_GOVERNANCE.map(
      (item) => ({
        ...item,
        active: granted.has(
          item.entitlement
        ),
      })
    ),
  ];

  const availableToAdd =
    INTELLIGENCE_MODULE_CATALOG
      .filter(
        (module) =>
          !licensedModuleIds.includes(
            module.id
          )
      )
      .map((module) => ({
        moduleId: module.id,
        name: module.name,
        value: module.description,
        compatibleModes:
          module.agentIds
            .map((agentId) => {
              const agent =
                AI_AGENT_CATALOG.find(
                  (candidate) =>
                    candidate.id ===
                    agentId
                );
              return agent
                ? {
                    agentId,
                    name: agent.name,
                  }
                : null;
            })
            .filter(
              (
                agent
              ): agent is {
                agentId: AiAgentId;
                name: string;
              } => !!agent
            ),
        state:
          "available_to_add" as const,
      }));

  return {
    licenses,
    licensedModuleIds,
    availableToAdd,
    activationGuarantees: [
      "Existing identity and governance settings remain intact.",
      "Relevant sources and ontology extensions become available.",
      "Associated modes appear in the Mode Library.",
      "Permitted cross-module workflows become available.",
      "No migration to a different product is required.",
    ],
  };
}
