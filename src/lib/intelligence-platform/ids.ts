export const INTELLIGENCE_MODULE_IDS = [
  "medical_affairs",
  "patient",
  "clinical_trials",
  "corporate_affairs",
  "commercial",
  "competitive",
  "advocacy",
] as const;

export type IntelligenceModuleId =
  (typeof INTELLIGENCE_MODULE_IDS)[number];

export const AI_AGENT_IDS = [
  "scientific_intelligence_advisor",
  "clinical_trial_companion",
  "patient_journey_advisor",
  "congress_intelligence_advisor",
  "corporate_reputation_advisor",
  "referral_navigator",
  "medical_information_assistant",
  "pharmacovigilance_assistant",
] as const;

export type AiAgentId =
  (typeof AI_AGENT_IDS)[number];

export const WORKFLOW_IDS = [
  "scientific_landscape_synthesis",
  "clinical_trial_discovery",
  "patient_journey_mapping",
  "congress_monitoring",
  "corporate_reputation_monitoring",
  "referral_pathway_navigation",
  "medical_information_response",
  "safety_event_triage",
] as const;

export type WorkflowId =
  (typeof WORKFLOW_IDS)[number];

export function isIntelligenceModuleId(
  value: unknown
): value is IntelligenceModuleId {
  return INTELLIGENCE_MODULE_IDS.includes(
    value as IntelligenceModuleId
  );
}

export function isAiAgentId(
  value: unknown
): value is AiAgentId {
  return AI_AGENT_IDS.includes(
    value as AiAgentId
  );
}

export function isWorkflowId(
  value: unknown
): value is WorkflowId {
  return WORKFLOW_IDS.includes(
    value as WorkflowId
  );
}
