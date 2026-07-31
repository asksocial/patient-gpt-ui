import type {
  Citation,
} from "../intelligence-platform/evidence";
import type {
  IntelligenceModuleId,
} from "../intelligence-platform/ids";

export type AiCapability =
  | "strategic_synthesis"
  | "structured_extraction"
  | "classification"
  | "embedding"
  | "agent_workflow";

export type AiGatewayContext = {
  requestId: string;
  organizationId: string;
  userId: string;
  moduleIds:
    IntelligenceModuleId[];
  permissionTags?: string[];
  approved?: boolean;
};

export type AiModelRoute = {
  id: string;
  capability: AiCapability;
  primaryModelId: string;
  fallbackModelIds: string[];
};

export type AiPromptDefinition = {
  id: string;
  version: string;
  description: string;
  instructions: string;
  routeId: string;
  allowedToolIds: string[];
};

export type AiToolDefinition = {
  id: string;
  description: string;
  approvalRequired: boolean;
  allowedModuleIds?:
    IntelligenceModuleId[];
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
};

export type AiProviderGenerationRequest = {
  modelId: string;
  instructions: string;
  input: string;
  jsonSchema?: {
    name: string;
    schema: Record<
      string,
      unknown
    >;
  };
};

export type AiProviderGenerationResult = {
  text: string;
  providerRequestId?: string;
  usage: AiUsage;
};

export type AiProviderEmbeddingResult = {
  embeddings: number[][];
  providerRequestId?: string;
  usage: AiUsage;
};

export interface AiProvider {
  generate(
    request:
      AiProviderGenerationRequest
  ): Promise<AiProviderGenerationResult>;
  embed(request: {
    modelId: string;
    input: string[];
  }): Promise<AiProviderEmbeddingResult>;
}

export type AiRetrievalResult = {
  context: string;
  citations: Citation[];
};

export interface AiRetriever {
  retrieve(request: {
    query: string;
    context: AiGatewayContext;
    limit?: number;
  }): Promise<AiRetrievalResult>;
}

export type AiAuditEventType =
  | "completed"
  | "blocked"
  | "approval_required"
  | "failed";

export type AiAuditEvent = Readonly<{
  id: string;
  occurredAt: string;
  type: AiAuditEventType;
  requestId: string;
  organizationId: string;
  userId: string;
  promptId?: string;
  promptVersion?: string;
  routeId?: string;
  modelId?: string;
  fallbackUsed?: boolean;
  toolIds: readonly string[];
  moduleIds:
    readonly IntelligenceModuleId[];
  usage?: Readonly<AiUsage>;
  reason?: string;
}>;

export interface AiAuditSink {
  record(
    event: AiAuditEvent
  ): Promise<void> | void;
}

export type AiGatewayCompleted<T> = {
  status: "completed";
  output: T;
  modelId: string;
  fallbackUsed: boolean;
  citations: Citation[];
  usage: AiUsage;
  auditEventId: string;
};

export type AiGatewayNotExecuted = {
  status:
    | "blocked"
    | "approval_required";
  reason: string;
  auditEventId: string;
};

export type AiGatewayResult<T> =
  | AiGatewayCompleted<T>
  | AiGatewayNotExecuted;

export type AiGatewayGenerationRequest<T> = {
  context: AiGatewayContext;
  promptId: string;
  input: string;
  toolIds?: string[];
  retrieval?: {
    query: string;
    limit?: number;
  };
  requireApproval?: boolean;
  jsonSchema?: {
    name: string;
    schema: Record<
      string,
      unknown
    >;
  };
  parse: (text: string) => T;
  validate?: (value: T) => void;
};
