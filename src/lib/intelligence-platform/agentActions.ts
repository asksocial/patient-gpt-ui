import type {
  AiAgentId,
  IntelligenceModuleId,
} from "./ids";

export type AgentActionDefinition = {
  id: string;
  label: string;
  description: string;
  slashCommand: string;
  agentId: AiAgentId;
  moduleIds:
    IntelligenceModuleId[];
  outputType:
    | "analysis"
    | "brief"
    | "map"
    | "monitor"
    | "triage";
  autonomyLevel: 1 | 2 | 3;
  requiredTools: string[];
};

function action(
  definition:
    AgentActionDefinition
) {
  return definition;
}

export const AGENT_ACTION_CATALOG:
  AgentActionDefinition[] = [
  action({
    id: "literature_synthesis",
    label:
      "Synthesize literature",
    description:
      "Create a cited synthesis of the permitted scientific literature.",
    slashCommand:
      "/literature-synthesis",
    agentId:
      "scientific_intelligence_advisor",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "brief",
    autonomyLevel: 1,
    requiredTools: [
      "search",
      "evidence_reasoning",
    ],
  }),
  action({
    id: "evidence_gap_analysis",
    label:
      "Analyze evidence gaps",
    description:
      "Identify supported evidence gaps and unanswered scientific questions.",
    slashCommand:
      "/evidence-gaps",
    agentId:
      "scientific_intelligence_advisor",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "search",
      "knowledge_graph",
    ],
  }),
  action({
    id:
      "scientific_landscape_monitoring",
    label:
      "Monitor scientific landscape",
    description:
      "Run an approved recurring scientific landscape monitor.",
    slashCommand:
      "/monitor-science",
    agentId:
      "scientific_intelligence_advisor",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "monitor",
    autonomyLevel: 3,
    requiredTools: [
      "search",
      "persistent_monitor",
    ],
  }),
  action({
    id: "trial_matching",
    label: "Match trials",
    description:
      "Find permitted trials relevant to supplied criteria.",
    slashCommand:
      "/trial-match",
    agentId:
      "clinical_trial_companion",
    moduleIds: [
      "clinical_trials",
    ],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "trial_registry",
    ],
  }),
  action({
    id:
      "eligibility_explanation",
    label:
      "Explain eligibility",
    description:
      "Explain trial eligibility criteria with cited registry evidence.",
    slashCommand:
      "/explain-eligibility",
    agentId:
      "clinical_trial_companion",
    moduleIds: [
      "clinical_trials",
    ],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "trial_registry",
      "evidence_reasoning",
    ],
  }),
  action({
    id: "site_intelligence",
    label:
      "Assess site intelligence",
    description:
      "Analyze sites, investigators, and related enrollment context.",
    slashCommand:
      "/site-intelligence",
    agentId:
      "clinical_trial_companion",
    moduleIds: [
      "clinical_trials",
    ],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "trial_registry",
      "knowledge_graph",
    ],
  }),
  action({
    id:
      "enrollment_barrier_analysis",
    label:
      "Analyze enrollment barriers",
    description:
      "Identify evidence-backed recruitment and retention barriers.",
    slashCommand:
      "/enrollment-barriers",
    agentId:
      "clinical_trial_companion",
    moduleIds: [
      "clinical_trials",
    ],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "search",
      "trial_registry",
    ],
  }),
  action({
    id:
      "patient_journey_mapping",
    label:
      "Map patient journey",
    description:
      "Create an evidence-backed patient journey map.",
    slashCommand:
      "/patient-journey",
    agentId:
      "patient_journey_advisor",
    moduleIds: ["patient"],
    outputType: "map",
    autonomyLevel: 1,
    requiredTools: [
      "search",
      "knowledge_graph",
    ],
  }),
  action({
    id: "unmet_need_discovery",
    label:
      "Discover unmet needs",
    description:
      "Identify supported unmet needs across the selected population.",
    slashCommand:
      "/unmet-needs",
    agentId:
      "patient_journey_advisor",
    moduleIds: ["patient"],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "search",
      "evidence_reasoning",
    ],
  }),
  action({
    id:
      "experience_signal_synthesis",
    label:
      "Synthesize experience signals",
    description:
      "Synthesize changing patient and caregiver experience signals.",
    slashCommand:
      "/experience-signals",
    agentId:
      "patient_journey_advisor",
    moduleIds: ["patient"],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "search",
      "signal_monitoring",
    ],
  }),
  action({
    id: "abstract_monitoring",
    label:
      "Monitor abstracts",
    description:
      "Monitor approved congress abstract sources.",
    slashCommand:
      "/monitor-abstracts",
    agentId:
      "congress_intelligence_advisor",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "monitor",
    autonomyLevel: 3,
    requiredTools: [
      "congress_content",
      "persistent_monitor",
    ],
  }),
  action({
    id: "session_planning",
    label:
      "Plan congress sessions",
    description:
      "Build a prioritized, evidence-linked congress session plan.",
    slashCommand:
      "/session-plan",
    agentId:
      "congress_intelligence_advisor",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "brief",
    autonomyLevel: 1,
    requiredTools: [
      "congress_content",
    ],
  }),
  action({
    id:
      "congress_competitive_summary",
    label:
      "Summarize congress competitors",
    description:
      "Summarize relevant competitor activity at a congress.",
    slashCommand:
      "/congress-competitive",
    agentId:
      "congress_intelligence_advisor",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "brief",
    autonomyLevel: 1,
    requiredTools: [
      "congress_content",
      "evidence_reasoning",
    ],
  }),
  action({
    id:
      "post_congress_reporting",
    label:
      "Create post-congress report",
    description:
      "Prepare a cited post-congress work product for review.",
    slashCommand:
      "/post-congress-report",
    agentId:
      "congress_intelligence_advisor",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "brief",
    autonomyLevel: 2,
    requiredTools: [
      "congress_content",
      "reporting",
    ],
  }),
  action({
    id: "narrative_monitoring",
    label:
      "Monitor narratives",
    description:
      "Monitor material corporate narratives and changes.",
    slashCommand:
      "/monitor-narratives",
    agentId:
      "corporate_reputation_advisor",
    moduleIds: [
      "corporate_affairs",
    ],
    outputType: "monitor",
    autonomyLevel: 3,
    requiredTools: [
      "signal_monitoring",
      "persistent_monitor",
    ],
  }),
  action({
    id: "stakeholder_analysis",
    label:
      "Analyze stakeholders",
    description:
      "Map relevant stakeholders and supported relationships.",
    slashCommand:
      "/stakeholder-analysis",
    agentId:
      "corporate_reputation_advisor",
    moduleIds: [
      "corporate_affairs",
    ],
    outputType: "map",
    autonomyLevel: 1,
    requiredTools: [
      "knowledge_graph",
      "search",
    ],
  }),
  action({
    id:
      "reputation_risk_alert",
    label:
      "Assess reputation risk",
    description:
      "Assess a narrative risk and prepare a reviewable alert.",
    slashCommand:
      "/reputation-risk",
    agentId:
      "corporate_reputation_advisor",
    moduleIds: [
      "corporate_affairs",
    ],
    outputType: "brief",
    autonomyLevel: 2,
    requiredTools: [
      "signal_monitoring",
      "reporting",
    ],
  }),
  action({
    id:
      "provider_center_discovery",
    label:
      "Find providers and centers",
    description:
      "Find permitted provider and center records.",
    slashCommand:
      "/find-centers",
    agentId:
      "referral_navigator",
    moduleIds: ["patient"],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "provider_directory",
    ],
  }),
  action({
    id:
      "referral_pathway_guidance",
    label:
      "Map referral pathway",
    description:
      "Map a referral pathway and supporting access context.",
    slashCommand:
      "/referral-pathway",
    agentId:
      "referral_navigator",
    moduleIds: ["patient"],
    outputType: "map",
    autonomyLevel: 1,
    requiredTools: [
      "provider_directory",
      "knowledge_graph",
    ],
  }),
  action({
    id:
      "access_barrier_identification",
    label:
      "Identify access barriers",
    description:
      "Identify evidence-backed access barriers across a referral pathway.",
    slashCommand:
      "/access-barriers",
    agentId:
      "referral_navigator",
    moduleIds: ["patient"],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "search",
      "provider_directory",
    ],
  }),
  action({
    id:
      "approved_response_drafting",
    label:
      "Draft medical response",
    description:
      "Prepare an evidence-backed medical response for approval.",
    slashCommand:
      "/draft-medical-response",
    agentId:
      "medical_information_assistant",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "brief",
    autonomyLevel: 2,
    requiredTools: [
      "medical_information",
      "reporting",
    ],
  }),
  action({
    id:
      "medical_evidence_retrieval",
    label:
      "Retrieve medical evidence",
    description:
      "Retrieve approved evidence for a medical inquiry.",
    slashCommand:
      "/medical-evidence",
    agentId:
      "medical_information_assistant",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "analysis",
    autonomyLevel: 1,
    requiredTools: [
      "medical_information",
      "evidence_reasoning",
    ],
  }),
  action({
    id:
      "inquiry_classification",
    label:
      "Classify medical inquiry",
    description:
      "Classify and route a medical inquiry for governed handling.",
    slashCommand:
      "/classify-inquiry",
    agentId:
      "medical_information_assistant",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "triage",
    autonomyLevel: 1,
    requiredTools: [
      "medical_information",
    ],
  }),
  action({
    id:
      "potential_adverse_event_detection",
    label:
      "Detect potential safety event",
    description:
      "Detect a potential adverse event without making a case determination.",
    slashCommand:
      "/detect-safety-event",
    agentId:
      "pharmacovigilance_assistant",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "triage",
    autonomyLevel: 1,
    requiredTools: [
      "safety_triage",
    ],
  }),
  action({
    id: "safety_case_triage",
    label:
      "Prepare safety triage",
    description:
      "Prepare a potential case triage and require human escalation.",
    slashCommand:
      "/safety-triage",
    agentId:
      "pharmacovigilance_assistant",
    moduleIds: [
      "medical_affairs",
    ],
    outputType: "triage",
    autonomyLevel: 2,
    requiredTools: [
      "safety_triage",
    ],
  }),
];

export function getAvailableAgentActions(
  params: {
    permittedAgentIds:
      AiAgentId[];
    moduleId?:
      IntelligenceModuleId;
    agentId?: AiAgentId;
  }
) {
  const permitted = new Set(
    params.permittedAgentIds
  );
  return AGENT_ACTION_CATALOG.filter(
    (item) =>
      permitted.has(item.agentId) &&
      (!params.moduleId ||
        item.moduleIds.includes(
          params.moduleId
        )) &&
      (!params.agentId ||
        item.agentId ===
          params.agentId)
  );
}
