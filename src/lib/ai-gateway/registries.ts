import type {
  AiModelRoute,
  AiPromptDefinition,
  AiToolDefinition,
} from "./types";

const DEFAULT_MODEL =
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini";

export const AI_MODEL_ROUTES:
  AiModelRoute[] = [
  {
    id: "strategic_synthesis",
    capability:
      "strategic_synthesis",
    primaryModelId: DEFAULT_MODEL,
    fallbackModelIds: [
      "gpt-4.1-mini",
    ].filter(
      (modelId) =>
        modelId !== DEFAULT_MODEL
    ),
  },
  {
    id: "high_quality_extraction",
    capability:
      "structured_extraction",
    primaryModelId: "gpt-5.4",
    fallbackModelIds: [
      "gpt-4.1-mini",
    ],
  },
  {
    id: "fast_classification",
    capability: "classification",
    primaryModelId:
      "gpt-4.1-mini",
    fallbackModelIds: [],
  },
  {
    id: "semantic_embedding",
    capability: "embedding",
    primaryModelId:
      "text-embedding-3-small",
    fallbackModelIds: [],
  },
];

export const AI_PROMPT_REGISTRY:
  AiPromptDefinition[] = [
  {
    id: "compose_hybrid_answer",
    version: "1.0.0",
    description:
      "Synthesize curated and live intelligence into an AskSocial answer.",
    instructions:
      "Return grounded, decision-useful intelligence using only the supplied evidence and the requested JSON shape.",
    routeId:
      "strategic_synthesis",
    allowedToolIds: [
      "unified_search",
      "knowledge_graph",
    ],
  },
  {
    id: "extract_curated_themes",
    version: "1.0.0",
    description:
      "Extract major themes from a curated intelligence report.",
    instructions:
      "Extract only supported themes from the supplied report and return valid structured data.",
    routeId:
      "high_quality_extraction",
    allowedToolIds: [],
  },
  {
    id: "extract_noise_themes",
    version: "1.0.0",
    description:
      "Group low-density observations into meaningful narratives.",
    instructions:
      "Group only repeated, supported narratives and return valid structured data.",
    routeId:
      "fast_classification",
    allowedToolIds: [],
  },
  {
    id: "adjudicate_theme_match",
    version: "1.0.0",
    description:
      "Classify the relationship between live and curated themes.",
    instructions:
      "Classify the supplied theme relationship using only the supplied evidence and return valid structured data.",
    routeId:
      "fast_classification",
    allowedToolIds: [],
  },
  {
    id: "agent_workflow_execution",
    version: "1.0.0",
    description:
      "Execute a governed agent workflow and return an evidence-backed work product.",
    instructions:
      "Follow the supplied visible plan, use only permitted evidence and tools, distinguish facts from inference, cite claims, disclose limitations, and return the requested structured work product.",
    routeId:
      "strategic_synthesis",
    allowedToolIds: [
      "unified_search",
      "knowledge_graph",
      "evidence_reasoning",
      "trial_registry",
      "congress_content",
      "signal_monitoring",
      "provider_directory",
      "medical_information",
      "safety_triage",
      "report_export",
      "persistent_monitor",
    ],
  },
];

export const AI_TOOL_REGISTRY:
  AiToolDefinition[] = [
  {
    id: "unified_search",
    description:
      "Search permitted platform evidence.",
    approvalRequired: false,
  },
  {
    id: "knowledge_graph",
    description:
      "Traverse permitted knowledge-graph relationships.",
    approvalRequired: false,
  },
  {
    id: "evidence_reasoning",
    description:
      "Validate claims against retrieved evidence.",
    approvalRequired: false,
  },
  {
    id: "trial_registry",
    description:
      "Retrieve permitted clinical-trial registry records.",
    approvalRequired: false,
    allowedModuleIds: [
      "clinical_trials",
    ],
  },
  {
    id: "congress_content",
    description:
      "Retrieve permitted congress content.",
    approvalRequired: false,
    allowedModuleIds: [
      "medical_affairs",
    ],
  },
  {
    id: "signal_monitoring",
    description:
      "Analyze configured intelligence signals.",
    approvalRequired: false,
  },
  {
    id: "provider_directory",
    description:
      "Retrieve permitted provider and center records.",
    approvalRequired: false,
    allowedModuleIds: [
      "patient",
    ],
  },
  {
    id: "medical_information",
    description:
      "Retrieve governed medical-information content.",
    approvalRequired: false,
    allowedModuleIds: [
      "medical_affairs",
    ],
  },
  {
    id: "safety_triage",
    description:
      "Prepare a potential safety-event triage for human review.",
    approvalRequired: true,
    allowedModuleIds: [
      "medical_affairs",
    ],
  },
  {
    id: "report_export",
    description:
      "Export a governed work product.",
    approvalRequired: true,
  },
  {
    id: "persistent_monitor",
    description:
      "Create or change a recurring monitoring workflow.",
    approvalRequired: true,
  },
];

export function getPromptDefinition(
  promptId: string
) {
  return AI_PROMPT_REGISTRY.find(
    (prompt) =>
      prompt.id === promptId
  );
}

export function getModelRoute(
  routeId: string
) {
  return AI_MODEL_ROUTES.find(
    (route) =>
      route.id === routeId
  );
}

export function getToolDefinition(
  toolId: string
) {
  return AI_TOOL_REGISTRY.find(
    (tool) => tool.id === toolId
  );
}
