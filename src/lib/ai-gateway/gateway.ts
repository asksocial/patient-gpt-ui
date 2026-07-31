import {
  ConsoleAiAuditSink,
} from "./audit";
import {
  filterAiInput,
  requiresHumanApproval,
  validateToolAccess,
} from "./policies";
import {
  getModelRoute,
  getPromptDefinition,
  getToolDefinition,
} from "./registries";
import type {
  AiAuditEvent,
  AiAuditSink,
  AiGatewayContext,
  AiGatewayGenerationRequest,
  AiGatewayResult,
  AiProvider,
  AiRetriever,
  AiUsage,
} from "./types";

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function zeroUsage(): AiUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: null,
  };
}

function addRetrievalContext(
  input: string,
  retrievalContext?: string
) {
  if (!retrievalContext) {
    return input;
  }

  return `${input}\n\nPermitted retrieved evidence:\n${retrievalContext}`;
}

export class AiGateway {
  constructor(
    private readonly dependencies: {
      provider: AiProvider;
      auditSink?: AiAuditSink;
      retriever?: AiRetriever;
    }
  ) {}

  private get auditSink() {
    return (
      this.dependencies
        .auditSink ||
      new ConsoleAiAuditSink()
    );
  }

  private async audit(
    event: Omit<
      AiAuditEvent,
      "id" | "occurredAt"
    >
  ) {
    const auditEvent: AiAuditEvent =
      Object.freeze({
        ...event,
        id: createId("audit"),
        occurredAt:
          new Date().toISOString(),
        toolIds: Object.freeze([
          ...event.toolIds,
        ]),
        moduleIds: Object.freeze([
          ...event.moduleIds,
        ]),
      });
    await this.auditSink.record(
      auditEvent
    );
    return auditEvent.id;
  }

  async generate<T>(
    request:
      AiGatewayGenerationRequest<T>
  ): Promise<AiGatewayResult<T>> {
    const prompt =
      getPromptDefinition(
        request.promptId
      );
    if (!prompt) {
      throw new Error(
        `Unknown prompt: ${request.promptId}`
      );
    }

    const route =
      getModelRoute(
        prompt.routeId
      );
    if (!route) {
      throw new Error(
        `Unknown model route: ${prompt.routeId}`
      );
    }

    const toolIds =
      request.toolIds || [];
    const tools = toolIds.map(
      (toolId) => {
        const tool =
          getToolDefinition(
            toolId
          );
        if (!tool) {
          throw new Error(
            `Unknown tool: ${toolId}`
          );
        }
        return tool;
      }
    );
    validateToolAccess({
      context: request.context,
      prompt,
      tools,
    });

    const filterResult =
      filterAiInput(
        request.input
      );
    if (!filterResult.allowed) {
      const auditEventId =
        await this.audit({
          type: "blocked",
          requestId:
            request.context
              .requestId,
          organizationId:
            request.context
              .organizationId,
          userId:
            request.context.userId,
          promptId: prompt.id,
          promptVersion:
            prompt.version,
          routeId: route.id,
          toolIds,
          moduleIds:
            request.context
              .moduleIds,
          reason:
            filterResult.reason,
        });
      return {
        status: "blocked",
        reason:
          filterResult.reason ||
          "Input blocked.",
        auditEventId,
      };
    }

    if (
      requiresHumanApproval(
        !!request.requireApproval,
        tools
      ) &&
      !request.context.approved
    ) {
      const auditEventId =
        await this.audit({
          type:
            "approval_required",
          requestId:
            request.context
              .requestId,
          organizationId:
            request.context
              .organizationId,
          userId:
            request.context.userId,
          promptId: prompt.id,
          promptVersion:
            prompt.version,
          routeId: route.id,
          toolIds,
          moduleIds:
            request.context
              .moduleIds,
          reason:
            "Human approval is required.",
        });
      return {
        status:
          "approval_required",
        reason:
          "Human approval is required.",
        auditEventId,
      };
    }

    const retrieval =
      request.retrieval
        ? await this.retrieve(
            request.context,
            request.retrieval
          )
        : undefined;
    const input =
      addRetrievalContext(
        request.input,
        retrieval?.context
      );
    const modelIds = [
      route.primaryModelId,
      ...route.fallbackModelIds,
    ];
    let lastError:
      unknown = undefined;

    for (
      let index = 0;
      index < modelIds.length;
      index += 1
    ) {
      const modelId =
        modelIds[index];
      try {
        const providerResult =
          await this.dependencies.provider.generate(
            {
              modelId,
              instructions:
                prompt.instructions,
              input,
              jsonSchema:
                request.jsonSchema,
            }
          );
        const output =
          request.parse(
            providerResult.text
          );
        request.validate?.(output);
        const fallbackUsed =
          index > 0;
        const auditEventId =
          await this.audit({
            type: "completed",
            requestId:
              request.context
                .requestId,
            organizationId:
              request.context
                .organizationId,
            userId:
              request.context
                .userId,
            promptId: prompt.id,
            promptVersion:
              prompt.version,
            routeId: route.id,
            modelId,
            fallbackUsed,
            toolIds,
            moduleIds:
              request.context
                .moduleIds,
            usage:
              providerResult.usage,
          });
        return {
          status: "completed",
          output,
          modelId,
          fallbackUsed,
          citations:
            retrieval?.citations ||
            [],
          usage:
            providerResult.usage,
          auditEventId,
        };
      } catch (error) {
        lastError = error;
      }
    }

    await this.audit({
      type: "failed",
      requestId:
        request.context.requestId,
      organizationId:
        request.context
          .organizationId,
      userId:
        request.context.userId,
      promptId: prompt.id,
      promptVersion:
        prompt.version,
      routeId: route.id,
      modelId:
        modelIds.at(-1),
      fallbackUsed:
        modelIds.length > 1,
      toolIds,
      moduleIds:
        request.context.moduleIds,
      usage: zeroUsage(),
      reason:
        lastError instanceof Error
          ? lastError.message
          : "Model generation failed.",
    });

    throw lastError;
  }

  async embed(request: {
    context: AiGatewayContext;
    input: string[];
  }): Promise<
    AiGatewayResult<number[][]>
  > {
    const route =
      getModelRoute(
        "semantic_embedding"
      );
    if (!route) {
      throw new Error(
        "Embedding route is not configured."
      );
    }

    for (const input of
      request.input) {
      const filtered =
        filterAiInput(input);
      if (!filtered.allowed) {
        const auditEventId =
          await this.audit({
            type: "blocked",
            requestId:
              request.context
                .requestId,
            organizationId:
              request.context
                .organizationId,
            userId:
              request.context
                .userId,
            routeId: route.id,
            toolIds: [],
            moduleIds:
              request.context
                .moduleIds,
            reason:
              filtered.reason,
          });
        return {
          status: "blocked",
          reason:
            filtered.reason ||
            "Input blocked.",
          auditEventId,
        };
      }
    }

    const result =
      await this.dependencies.provider.embed(
        {
          modelId:
            route.primaryModelId,
          input: request.input,
        }
      );
    const auditEventId =
      await this.audit({
        type: "completed",
        requestId:
          request.context.requestId,
        organizationId:
          request.context
            .organizationId,
        userId:
          request.context.userId,
        routeId: route.id,
        modelId:
          route.primaryModelId,
        fallbackUsed: false,
        toolIds: [],
        moduleIds:
          request.context.moduleIds,
        usage: result.usage,
      });

    return {
      status: "completed",
      output: result.embeddings,
      modelId:
        route.primaryModelId,
      fallbackUsed: false,
      citations: [],
      usage: result.usage,
      auditEventId,
    };
  }

  private async retrieve(
    context: AiGatewayContext,
    request: {
      query: string;
      limit?: number;
    }
  ) {
    if (
      !this.dependencies.retriever
    ) {
      throw new Error(
        "Retrieval was requested but no governed retriever is configured."
      );
    }

    return this.dependencies.retriever.retrieve(
      {
        query: request.query,
        context,
        limit: request.limit,
      }
    );
  }
}
