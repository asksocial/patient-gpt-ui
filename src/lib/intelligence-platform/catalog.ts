import type {
  EntitlementKey,
} from "../entitlements";
import type {
  AiAgentId,
  IntelligenceModuleId,
} from "./ids";
import type {
  AgentDefinition,
  IntelligenceModuleDefinition,
  WorkflowDefinition,
} from "./types";

export const MODULE_ENTITLEMENTS: Record<
  IntelligenceModuleId,
  EntitlementKey
> = {
  medical_affairs:
    "module_medical_affairs",
  patient: "module_patient",
  clinical_trials:
    "module_clinical_trials",
  corporate_affairs:
    "module_corporate_affairs",
  commercial: "module_commercial",
  competitive: "module_competitive",
  advocacy: "module_advocacy",
};

export const AGENT_ENTITLEMENTS: Record<
  AiAgentId,
  EntitlementKey
> = {
  scientific_intelligence_advisor:
    "agent_scientific_intelligence_advisor",
  clinical_trial_companion:
    "agent_clinical_trial_companion",
  patient_journey_advisor:
    "agent_patient_journey_advisor",
  congress_intelligence_advisor:
    "agent_congress_intelligence_advisor",
  corporate_reputation_advisor:
    "agent_corporate_reputation_advisor",
  referral_navigator:
    "agent_referral_navigator",
  medical_information_assistant:
    "agent_medical_information_assistant",
  pharmacovigilance_assistant:
    "agent_pharmacovigilance_assistant",
};

export const INTELLIGENCE_MODULE_CATALOG:
  IntelligenceModuleDefinition[] = [
  {
    id: "medical_affairs",
    name: "Medical Affairs",
    description:
      "Scientific, congress, medical-information, and safety intelligence.",
    capabilities: [
      "scientific_landscape",
      "congress_intelligence",
      "medical_information",
      "safety_signal_triage",
    ],
    dataSourceTypes: [
      "curated_research",
      "scientific_literature",
      "congress_content",
      "social_intelligence",
    ],
    agentIds: [
      "scientific_intelligence_advisor",
      "congress_intelligence_advisor",
      "medical_information_assistant",
      "pharmacovigilance_assistant",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_medical_affairs",
    ],
  },
  {
    id: "patient",
    name: "Patient",
    description:
      "Patient journey, unmet need, access, and referral intelligence.",
    capabilities: [
      "patient_journey",
      "unmet_need",
      "referral_navigation",
    ],
    dataSourceTypes: [
      "patient_research",
      "social_intelligence",
      "provider_directory",
    ],
    agentIds: [
      "patient_journey_advisor",
      "referral_navigator",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_patient",
    ],
  },
  {
    id: "clinical_trials",
    name: "Clinical Trials",
    description:
      "Trial, eligibility, investigator, site, and enrollment intelligence.",
    capabilities: [
      "trial_discovery",
      "eligibility",
      "site_intelligence",
      "enrollment_barriers",
    ],
    dataSourceTypes: [
      "trial_registry",
      "scientific_literature",
      "site_directory",
    ],
    agentIds: [
      "clinical_trial_companion",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_clinical_trials",
    ],
  },
  {
    id: "corporate_affairs",
    name: "Corporate Affairs",
    description:
      "Corporate narrative, stakeholder, and reputation intelligence.",
    capabilities: [
      "narrative_monitoring",
      "stakeholder_analysis",
      "reputation_risk",
    ],
    dataSourceTypes: [
      "news",
      "social_intelligence",
      "corporate_content",
    ],
    agentIds: [
      "corporate_reputation_advisor",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_corporate_affairs",
    ],
  },
  {
    id: "commercial",
    name: "Commercial",
    description:
      "Commercial market, customer, and performance intelligence.",
    capabilities: [
      "market_intelligence",
      "customer_intelligence",
      "performance_intelligence",
    ],
    dataSourceTypes: [
      "market_research",
      "commercial_analytics",
    ],
    agentIds: [],
    requiredEntitlements: [
      "platform_core",
      "module_commercial",
    ],
  },
  {
    id: "competitive",
    name: "Competitive",
    description:
      "Competitive landscape, signal, and positioning intelligence.",
    capabilities: [
      "landscape_monitoring",
      "competitive_signals",
      "positioning_analysis",
    ],
    dataSourceTypes: [
      "market_research",
      "news",
      "scientific_literature",
    ],
    agentIds: [],
    requiredEntitlements: [
      "platform_core",
      "module_competitive",
    ],
  },
  {
    id: "advocacy",
    name: "Advocacy",
    description:
      "Advocacy organization, community, and stakeholder intelligence.",
    capabilities: [
      "organization_landscape",
      "community_signals",
      "stakeholder_monitoring",
    ],
    dataSourceTypes: [
      "advocacy_content",
      "social_intelligence",
      "news",
    ],
    agentIds: [],
    requiredEntitlements: [
      "platform_core",
      "module_advocacy",
    ],
  },
];

export const AI_AGENT_CATALOG:
  AgentDefinition[] = [
  {
    id:
      "scientific_intelligence_advisor",
    name:
      "Scientific Intelligence Advisor",
    description:
      "Synthesizes evidence and monitors scientific landscapes.",
    moduleIds: ["medical_affairs"],
    workflowIds: [
      "scientific_landscape_synthesis",
    ],
    allowedTools: [
      "search",
      "knowledge_graph",
      "evidence_reasoning",
      "reporting",
      "persistent_monitor",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_medical_affairs",
      "agent_scientific_intelligence_advisor",
    ],
  },
  {
    id: "clinical_trial_companion",
    name: "Clinical Trial Companion",
    description:
      "Supports trial discovery, eligibility, site, and enrollment workflows.",
    moduleIds: ["clinical_trials"],
    workflowIds: [
      "clinical_trial_discovery",
    ],
    allowedTools: [
      "search",
      "knowledge_graph",
      "trial_registry",
      "evidence_reasoning",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_clinical_trials",
      "agent_clinical_trial_companion",
    ],
  },
  {
    id: "patient_journey_advisor",
    name: "Patient Journey Advisor",
    description:
      "Maps patient journeys, barriers, and unmet needs.",
    moduleIds: ["patient"],
    workflowIds: [
      "patient_journey_mapping",
    ],
    allowedTools: [
      "search",
      "knowledge_graph",
      "evidence_reasoning",
      "signal_monitoring",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_patient",
      "agent_patient_journey_advisor",
    ],
  },
  {
    id:
      "congress_intelligence_advisor",
    name:
      "Congress Intelligence Advisor",
    description:
      "Monitors congress content and creates evidence-backed briefings.",
    moduleIds: ["medical_affairs"],
    workflowIds: [
      "congress_monitoring",
    ],
    allowedTools: [
      "search",
      "congress_content",
      "reporting",
      "persistent_monitor",
      "evidence_reasoning",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_medical_affairs",
      "agent_congress_intelligence_advisor",
    ],
  },
  {
    id:
      "corporate_reputation_advisor",
    name:
      "Corporate Reputation Advisor",
    description:
      "Monitors narratives, stakeholders, and reputation risk.",
    moduleIds: [
      "corporate_affairs",
    ],
    workflowIds: [
      "corporate_reputation_monitoring",
    ],
    allowedTools: [
      "search",
      "knowledge_graph",
      "signal_monitoring",
      "reporting",
      "persistent_monitor",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_corporate_affairs",
      "agent_corporate_reputation_advisor",
    ],
  },
  {
    id: "referral_navigator",
    name: "Referral Navigator",
    description:
      "Identifies referral pathways, providers, centers, and access barriers.",
    moduleIds: ["patient"],
    workflowIds: [
      "referral_pathway_navigation",
    ],
    allowedTools: [
      "search",
      "knowledge_graph",
      "provider_directory",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_patient",
      "agent_referral_navigator",
    ],
  },
  {
    id:
      "medical_information_assistant",
    name:
      "Medical Information Assistant",
    description:
      "Retrieves evidence and drafts governed medical-information responses.",
    moduleIds: ["medical_affairs"],
    workflowIds: [
      "medical_information_response",
    ],
    allowedTools: [
      "search",
      "approved_content",
      "medical_information",
      "evidence_reasoning",
      "reporting",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_medical_affairs",
      "agent_medical_information_assistant",
    ],
  },
  {
    id:
      "pharmacovigilance_assistant",
    name:
      "Pharmacovigilance Assistant",
    description:
      "Detects potential safety events and routes them for required review.",
    moduleIds: ["medical_affairs"],
    workflowIds: [
      "safety_event_triage",
    ],
    allowedTools: [
      "search",
      "safety_classifier",
      "case_escalation",
      "safety_triage",
    ],
    requiredEntitlements: [
      "platform_core",
      "module_medical_affairs",
      "agent_pharmacovigilance_assistant",
    ],
  },
];

function standardSteps(params: {
  retrieveTool: string;
  approval?: boolean;
}) {
  return [
    {
      id: "understand",
      label:
        "Establish the request and authorized context",
      kind: "understand" as const,
    },
    {
      id: "retrieve",
      label:
        "Retrieve permitted evidence",
      kind: "retrieve" as const,
      toolId: params.retrieveTool,
    },
    {
      id: "reason",
      label:
        "Synthesize evidence and limitations",
      kind: "reason" as const,
      toolId: "evidence_reasoning",
    },
    ...(params.approval
      ? [
          {
            id: "approve",
            label:
              "Obtain required human approval",
            kind: "approve" as const,
            requiresApproval: true,
          },
        ]
      : []),
    {
      id: "deliver",
      label:
        "Deliver an evidence-backed result",
      kind: "deliver" as const,
    },
  ];
}

export const WORKFLOW_CATALOG:
  WorkflowDefinition[] = [
  {
    id:
      "scientific_landscape_synthesis",
    name:
      "Scientific Landscape Synthesis",
    description:
      "Synthesize an evidence-backed scientific landscape.",
    agentId:
      "scientific_intelligence_advisor",
    trigger: "interactive",
    steps: standardSteps({
      retrieveTool: "search",
    }),
    outputSchemaId:
      "evidence_backed_brief",
    approvalPolicyId:
      "standard_evidence_review",
  },
  {
    id: "clinical_trial_discovery",
    name: "Clinical Trial Discovery",
    description:
      "Find and explain relevant clinical trials.",
    agentId:
      "clinical_trial_companion",
    trigger: "interactive",
    steps: standardSteps({
      retrieveTool: "trial_registry",
    }),
    outputSchemaId:
      "trial_discovery_result",
    approvalPolicyId:
      "clinical_information_review",
  },
  {
    id: "patient_journey_mapping",
    name: "Patient Journey Mapping",
    description:
      "Map stages, barriers, needs, and evidence across a patient journey.",
    agentId:
      "patient_journey_advisor",
    trigger: "interactive",
    steps: standardSteps({
      retrieveTool: "search",
    }),
    outputSchemaId:
      "patient_journey_map",
    approvalPolicyId:
      "standard_evidence_review",
  },
  {
    id: "congress_monitoring",
    name: "Congress Monitoring",
    description:
      "Monitor congress content and produce a supported briefing.",
    agentId:
      "congress_intelligence_advisor",
    trigger: "scheduled",
    steps: standardSteps({
      retrieveTool:
        "congress_content",
    }),
    outputSchemaId:
      "congress_brief",
    approvalPolicyId:
      "standard_evidence_review",
  },
  {
    id:
      "corporate_reputation_monitoring",
    name:
      "Corporate Reputation Monitoring",
    description:
      "Monitor narratives, stakeholders, and emerging reputation risk.",
    agentId:
      "corporate_reputation_advisor",
    trigger: "scheduled",
    steps: standardSteps({
      retrieveTool:
        "signal_monitoring",
    }),
    outputSchemaId:
      "reputation_brief",
    approvalPolicyId:
      "corporate_affairs_review",
  },
  {
    id:
      "referral_pathway_navigation",
    name:
      "Referral Pathway Navigation",
    description:
      "Identify appropriate referral pathways and documented access barriers.",
    agentId: "referral_navigator",
    trigger: "interactive",
    steps: standardSteps({
      retrieveTool:
        "provider_directory",
    }),
    outputSchemaId:
      "referral_pathway_result",
    approvalPolicyId:
      "patient_information_review",
  },
  {
    id:
      "medical_information_response",
    name:
      "Medical Information Response",
    description:
      "Retrieve approved evidence and draft a response for review.",
    agentId:
      "medical_information_assistant",
    trigger: "interactive",
    steps: standardSteps({
      retrieveTool:
        "approved_content",
      approval: true,
    }),
    outputSchemaId:
      "medical_information_response",
    approvalPolicyId:
      "medical_information_approval",
  },
  {
    id: "safety_event_triage",
    name: "Safety Event Triage",
    description:
      "Detect and route a potential safety event for mandatory human review.",
    agentId:
      "pharmacovigilance_assistant",
    trigger: "event",
    steps: standardSteps({
      retrieveTool:
        "safety_classifier",
      approval: true,
    }),
    outputSchemaId:
      "safety_triage_result",
    approvalPolicyId:
      "mandatory_safety_escalation",
  },
];
