import {
  AiGateway,
} from "./gateway";
import {
  OpenAiProvider,
  isOpenAiConfigured,
} from "./openaiProvider";

export {
  InMemoryAiAuditSink,
  ConsoleAiAuditSink,
} from "./audit";
export {
  AiGateway,
} from "./gateway";
export {
  AI_MODEL_ROUTES,
  AI_PROMPT_REGISTRY,
  AI_TOOL_REGISTRY,
  getModelRoute,
  getPromptDefinition,
  getToolDefinition,
} from "./registries";
export {
  filterAiInput,
  requiresHumanApproval,
  validateToolAccess,
} from "./policies";
export {
  CURATED_THEMES_JSON_SCHEMA,
  EVIDENCE_BACKED_ANSWER_JSON_SCHEMA,
  HYBRID_ANSWER_JSON_SCHEMA,
  NOISE_THEMES_JSON_SCHEMA,
  THEME_MATCH_JSON_SCHEMA,
} from "./schemas";
export {
  OpenAiProvider,
  isOpenAiConfigured,
} from "./openaiProvider";
export type {
  AiAuditEvent,
  AiAuditEventType,
  AiAuditSink,
  AiCapability,
  AiGatewayCompleted,
  AiGatewayContext,
  AiGatewayGenerationRequest,
  AiGatewayNotExecuted,
  AiGatewayResult,
  AiModelRoute,
  AiPromptDefinition,
  AiProvider,
  AiProviderEmbeddingResult,
  AiProviderGenerationRequest,
  AiProviderGenerationResult,
  AiRetrievalResult,
  AiRetriever,
  AiToolDefinition,
  AiUsage,
} from "./types";

export const aiGateway =
  new AiGateway({
    provider:
      new OpenAiProvider(),
  });

export function isAiGatewayConfigured() {
  return isOpenAiConfigured();
}

export function createSystemAiContext(
  requestId: string
) {
  return {
    requestId,
    organizationId:
      "platform_system",
    userId: "platform_system",
    moduleIds: [],
  };
}
