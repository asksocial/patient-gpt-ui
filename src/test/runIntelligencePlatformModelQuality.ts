import {
  AI_AGENT_CATALOG,
  INTELLIGENCE_MODULE_CATALOG,
  WORKFLOW_CATALOG,
  assertIntelligenceRegistryIntegrity,
  configurationFromEntitlements,
  resolveCustomerIntelligenceAccess,
} from "../lib/intelligence-platform";
import {
  resolveEntitlements,
} from "../lib/entitlements";

assertIntelligenceRegistryIntegrity();

if (
  INTELLIGENCE_MODULE_CATALOG.length !==
    7 ||
  AI_AGENT_CATALOG.length !== 8 ||
  WORKFLOW_CATALOG.length !== 8
) {
  throw new Error(
    "The Step 1 registry must expose all initial modules, agents, and workflows."
  );
}

const defaultEntitlements =
  resolveEntitlements({
    userId: "user_default",
    organizationId:
      "org_default",
    knowledgePersistenceEnabled:
      true,
  });
const defaultAccess =
  resolveCustomerIntelligenceAccess(
    configurationFromEntitlements(
      defaultEntitlements
    )
  );

if (
  defaultAccess.modules.length ||
  defaultAccess.agents.length
) {
  throw new Error(
    "New modules and agents must remain default-off."
  );
}

const medicalEntitlements =
  resolveEntitlements({
    userId: "user_medical",
    organizationId:
      "org_medical",
    organizationMetadata: {
      grants: [
        "module_medical_affairs",
        "agent_scientific_intelligence_advisor",
      ],
    },
    knowledgePersistenceEnabled:
      true,
  });
const medicalConfiguration =
  configurationFromEntitlements(
    medicalEntitlements,
    {
      approvedUseCases: [
        "scientific landscape synthesis",
      ],
      connectedDataSources: [
        {
          id: "source_research",
          type: "curated_research",
          label:
            "Curated research library",
          status: "connected",
          moduleIds: [
            "medical_affairs",
          ],
        },
      ],
    }
  );
const medicalAccess =
  resolveCustomerIntelligenceAccess(
    medicalConfiguration
  );

if (
  medicalAccess.modules[0]?.id !==
    "medical_affairs" ||
  medicalAccess.agents[0]?.id !==
    "scientific_intelligence_advisor" ||
  medicalAccess.workflows[0]?.id !==
    "scientific_landscape_synthesis" ||
  medicalAccess.blockedAgentIds
    .length
) {
  throw new Error(
    "Licensed modules must expose only their enabled agents and workflows."
  );
}

const orphanAgentEntitlements =
  resolveEntitlements({
    userId: "user_orphan",
    organizationId: "org_orphan",
    organizationMetadata: {
      grants: [
        "agent_clinical_trial_companion",
      ],
    },
    knowledgePersistenceEnabled:
      true,
  });
const orphanAccess =
  resolveCustomerIntelligenceAccess(
    configurationFromEntitlements(
      orphanAgentEntitlements
    )
  );

if (
  orphanAccess.agents.length ||
  orphanAccess.blockedAgentIds[0] !==
    "clinical_trial_companion"
) {
  throw new Error(
    "An agent entitlement must not bypass its required module license."
  );
}

const platformDenied =
  resolveEntitlements({
    userId:
      "user_platform_denied",
    organizationId:
      "org_platform_denied",
    organizationMetadata: {
      grants: [
        "module_patient",
        "agent_referral_navigator",
      ],
      denials: ["platform_core"],
    },
    knowledgePersistenceEnabled:
      true,
  });
const platformDeniedAccess =
  resolveCustomerIntelligenceAccess(
    configurationFromEntitlements(
      platformDenied
    )
  );

if (
  platformDeniedAccess.modules
    .length ||
  platformDeniedAccess.agents.length
) {
  throw new Error(
    "Module and agent access must require the shared platform entitlement."
  );
}

console.log(
  JSON.stringify(
    {
      modules:
        INTELLIGENCE_MODULE_CATALOG.map(
          (module) => module.id
        ),
      agents:
        AI_AGENT_CATALOG.map(
          (agent) => agent.id
        ),
      enabledMedicalAgents:
        medicalAccess.agents.map(
          (agent) => agent.id
        ),
      blockedOrphanAgents:
        orphanAccess.blockedAgentIds,
    },
    null,
    2
  )
);
