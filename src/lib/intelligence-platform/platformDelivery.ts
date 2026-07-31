export const PLATFORM_DELIVERY_SEQUENCE =
  [
    {
      id: "formalize_schemas",
      name:
        "Formalize platform schemas",
    },
    {
      id:
        "gateway_and_permissioned_retrieval",
      name:
        "Build the AI gateway and permission-aware retrieval",
    },
    {
      id:
        "knowledge_graph_and_ontology",
      name:
        "Establish the knowledge graph and shared ontology",
    },
    {
      id:
        "search_and_evidence_answers",
      name:
        "Launch unified search and evidence-backed answers",
    },
    {
      id:
        "module_shell_and_navigation",
      name:
        "Add the module shell and ecosystem navigation",
    },
    {
      id:
        "medical_affairs_module",
      name:
        "Migrate Medical Affairs into the module model",
    },
    {
      id:
        "scientific_intelligence_mode",
      name:
        "Launch Scientific Intelligence Advisor",
    },
    {
      id:
        "clinical_trials_module_and_mode",
      name:
        "Add Clinical Trials and Clinical Trial Companion",
    },
    {
      id:
        "patient_module_and_modes",
      name:
        "Add Patient, Patient Journey Advisor, and Referral Navigator",
    },
    {
      id:
        "scheduling_approvals_reporting",
      name:
        "Launch scheduling, approvals, and reporting",
    },
    {
      id: "governance_center",
      name:
        "Add the Governance Center",
    },
    {
      id:
        "domain_expansion",
      name:
        "Expand Congress, Corporate Affairs, Competitive, Advocacy, and Commercial",
    },
    {
      id:
        "cross_module_workflows",
      name:
        "Introduce governed cross-module workflows",
    },
    {
      id:
        "commercial_entitlements",
      name:
        "Package modules and agents as expandable entitlements",
    },
  ] as const;

export type PlatformDeliveryMilestoneId =
  (typeof PLATFORM_DELIVERY_SEQUENCE)[number]["id"];

export const CAPABILITY_OWNERSHIP =
  {
    platform: [
      "identity",
      "security",
      "ai_gateway",
      "search",
      "knowledge_graph",
      "reporting",
      "governance",
      "measurement",
    ],
    module: [
      "domain_ontology",
      "domain_sources",
      "signals",
      "visualizations",
      "report_templates",
      "evaluation_criteria",
    ],
    agent: [
      "governed_workflows",
      "domain_instructions",
      "approved_tool_usage",
      "evidence_backed_deliverables",
    ],
  } as const;

export function getNextPlatformDeliveryMilestone(
  completed:
    readonly PlatformDeliveryMilestoneId[]
) {
  const completedSet = new Set(
    completed
  );
  return (
    PLATFORM_DELIVERY_SEQUENCE.find(
      (milestone) =>
        !completedSet.has(
          milestone.id
        )
    ) || null
  );
}
