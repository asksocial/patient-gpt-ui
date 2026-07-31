import type {
  EntitlementResolution,
} from "../entitlements";
import {
  AGENT_ENTITLEMENTS,
  AI_AGENT_CATALOG,
  INTELLIGENCE_MODULE_CATALOG,
  MODULE_ENTITLEMENTS,
  WORKFLOW_CATALOG,
} from "./catalog";
import type {
  AiAgentId,
  IntelligenceModuleId,
} from "./ids";
import type {
  AiPolicy,
  CompliancePolicy,
  ConnectedDataSource,
  CustomerIntelligenceAccess,
  CustomerIntelligenceConfiguration,
  CustomerUserAccess,
} from "./types";

export type CustomerConfigurationContext = {
  connectedDataSources?:
    ConnectedDataSource[];
  userAccess?: CustomerUserAccess[];
  approvedUseCases?: string[];
  aiPolicy?: Partial<AiPolicy>;
  compliancePolicy?:
    Partial<CompliancePolicy>;
};

const DEFAULT_AI_POLICY: AiPolicy = {
  allowedModelIds: [],
  requireCitations: true,
  requireHumanApprovalFor: [],
};

const DEFAULT_COMPLIANCE_POLICY:
  CompliancePolicy = {
  protectedDataAllowed: false,
  auditLoggingRequired: true,
};

export function configurationFromEntitlements(
  entitlements: EntitlementResolution,
  context:
    CustomerConfigurationContext = {}
): CustomerIntelligenceConfiguration {
  const platformEnabled =
    entitlements.capabilities
      .platform_core.granted;
  const licensedModuleIds =
    Object.entries(
      MODULE_ENTITLEMENTS
    )
      .filter(
        ([, entitlement]) =>
          platformEnabled &&
          entitlements.capabilities[
            entitlement
          ].granted
      )
      .map(
        ([moduleId]) =>
          moduleId as IntelligenceModuleId
      );
  const enabledAgentIds =
    Object.entries(
      AGENT_ENTITLEMENTS
    )
      .filter(
        ([, entitlement]) =>
          entitlements.capabilities[
            entitlement
          ].granted
      )
      .map(
        ([agentId]) =>
          agentId as AiAgentId
      );

  return {
    organizationId:
      entitlements.organizationId ||
      "unassigned",
    licensedModuleIds,
    enabledAgentIds,
    connectedDataSources:
      context.connectedDataSources ||
      [],
    userAccess:
      context.userAccess || [],
    approvedUseCases:
      context.approvedUseCases || [],
    aiPolicy: {
      ...DEFAULT_AI_POLICY,
      ...context.aiPolicy,
    },
    compliancePolicy: {
      ...DEFAULT_COMPLIANCE_POLICY,
      ...context.compliancePolicy,
    },
  };
}

export function resolveCustomerIntelligenceAccess(
  configuration:
    CustomerIntelligenceConfiguration
): CustomerIntelligenceAccess {
  const licensedModuleIds =
    new Set(
      configuration.licensedModuleIds
    );
  const requestedAgentIds =
    new Set(
      configuration.enabledAgentIds
    );
  const modules =
    INTELLIGENCE_MODULE_CATALOG.filter(
      (module) =>
        licensedModuleIds.has(
          module.id
        )
    );
  const agents =
    AI_AGENT_CATALOG.filter(
      (agent) =>
        requestedAgentIds.has(
          agent.id
        ) &&
        agent.moduleIds.every(
          (moduleId) =>
            licensedModuleIds.has(
              moduleId
            )
        )
    );
  const allowedAgentIds = new Set(
    agents.map((agent) => agent.id)
  );
  const workflows =
    WORKFLOW_CATALOG.filter(
      (workflow) =>
        allowedAgentIds.has(
          workflow.agentId
        )
    );
  const blockedAgentIds =
    configuration.enabledAgentIds.filter(
      (agentId) =>
        !allowedAgentIds.has(agentId)
    );

  return {
    organizationId:
      configuration.organizationId,
    modules,
    agents,
    workflows,
    connectedDataSources:
      configuration.connectedDataSources.filter(
        (source) =>
          source.moduleIds.some(
            (moduleId) =>
              licensedModuleIds.has(
                moduleId
              )
          )
      ),
    userAccess:
      configuration.userAccess,
    approvedUseCases:
      configuration.approvedUseCases,
    aiPolicy:
      configuration.aiPolicy,
    compliancePolicy:
      configuration.compliancePolicy,
    blockedAgentIds,
  };
}
