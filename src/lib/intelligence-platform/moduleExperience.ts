import type {
  AgentDefinition,
  IntelligenceModuleDefinition,
  WorkflowDefinition,
} from "./types";

export const MODULE_SHELL_TABS = [
  "overview",
  "signals",
  "entities",
  "questions",
  "workspaces",
  "reports",
  "agents",
  "data_sources",
  "settings",
] as const;

export type ModuleShellTab =
  (typeof MODULE_SHELL_TABS)[number];

export type ModuleExperience = {
  module:
    IntelligenceModuleDefinition;
  tabs: readonly ModuleShellTab[];
  agents: AgentDefinition[];
  workflows:
    WorkflowDefinition[];
  ontologyExtensions: string[];
  signalDefinitions: string[];
  visualizationIds: string[];
  reportTemplateIds: string[];
  evaluationCriteria: string[];
};

const MODULE_EXTENSIONS: Record<
  string,
  Pick<
    ModuleExperience,
    | "ontologyExtensions"
    | "signalDefinitions"
    | "visualizationIds"
    | "reportTemplateIds"
    | "evaluationCriteria"
  >
> = {
  medical_affairs: {
    ontologyExtensions: [
      "scientific_claim",
      "medical_inquiry",
      "evidence_gap",
    ],
    signalDefinitions: [
      "scientific_perception_shift",
      "unanswered_hcp_question",
      "congress_impact",
    ],
    visualizationIds: [
      "scientific_landscape",
      "evidence_gap_map",
    ],
    reportTemplateIds: [
      "scientific_landscape",
      "congress_intelligence",
    ],
    evaluationCriteria: [
      "citation_coverage",
      "scientific_accuracy",
      "claim_traceability",
    ],
  },
  patient: {
    ontologyExtensions: [
      "journey_stage",
      "experience_barrier",
      "caregiver_need",
    ],
    signalDefinitions: [
      "unmet_need",
      "access_barrier",
      "experience_shift",
    ],
    visualizationIds: [
      "patient_journey",
      "barrier_map",
    ],
    reportTemplateIds: [
      "patient_journey",
    ],
    evaluationCriteria: [
      "lived_experience_fidelity",
      "journey_coverage",
      "evidence_diversity",
    ],
  },
  clinical_trials: {
    ontologyExtensions: [
      "trial_site",
      "eligibility_criterion",
      "protocol_amendment",
      "enrollment_barrier",
    ],
    signalDefinitions: [
      "recruitment_risk",
      "protocol_burden",
      "retention_risk",
    ],
    visualizationIds: [
      "trial_landscape",
      "site_network",
    ],
    reportTemplateIds: [
      "trial_landscape",
    ],
    evaluationCriteria: [
      "registry_accuracy",
      "eligibility_fidelity",
      "site_signal_precision",
    ],
  },
};

const EMPTY_EXTENSIONS = {
  ontologyExtensions: [],
  signalDefinitions: [],
  visualizationIds: [],
  reportTemplateIds: [],
  evaluationCriteria: [
    "citation_coverage",
    "retrieval_accuracy",
  ],
};

export function buildModuleExperience(
  module:
    IntelligenceModuleDefinition,
  agents: AgentDefinition[],
  workflows:
    WorkflowDefinition[]
): ModuleExperience {
  const extensions =
    MODULE_EXTENSIONS[
      module.id
    ] || EMPTY_EXTENSIONS;
  const permittedAgents =
    agents.filter((agent) =>
      agent.moduleIds.includes(
        module.id
      )
    );
  const permittedAgentIds =
    new Set(
      permittedAgents.map(
        (agent) => agent.id
      )
    );

  return {
    module,
    tabs: MODULE_SHELL_TABS,
    agents: permittedAgents,
    workflows:
      workflows.filter(
        (workflow) =>
          permittedAgentIds.has(
            workflow.agentId
          )
      ),
    ...extensions,
  };
}
