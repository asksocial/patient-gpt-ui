import OpenAI from "openai";
import type {
  AiProvider,
  AiUsage,
} from "./types";

function emptyUsage(): AiUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: null,
  };
}

export class OpenAiProvider
  implements AiProvider
{
  private client: OpenAI | null =
    null;

  private getClient() {
    if (
      !process.env.OPENAI_API_KEY
    ) {
      throw new Error(
        "OPENAI_API_KEY is not set"
      );
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey:
          process.env
            .OPENAI_API_KEY,
      });
    }

    return this.client;
  }

  async generate(request: {
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
  }) {
    const response =
      (await this.getClient().responses.create(
        {
          model: request.modelId,
          instructions:
            request.instructions,
          input: request.input,
          ...(request.jsonSchema
            ? {
                text: {
                  format: {
                    type: "json_schema",
                    name: request
                      .jsonSchema.name,
                    schema:
                      request
                        .jsonSchema
                        .schema,
                    strict: true,
                  },
                },
              }
            : {}),
        } as Parameters<
          OpenAI["responses"]["create"]
        >[0]
      )) as {
        id: string;
        output_text: string;
        usage?: {
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
        };
      };
    const usage =
      response.usage;

    return {
      text:
        response.output_text || "",
      providerRequestId:
        response.id,
      usage: usage
        ? {
            inputTokens:
              usage.input_tokens,
            outputTokens:
              usage.output_tokens,
            totalTokens:
              usage.total_tokens,
            estimatedCostUsd:
              null,
          }
        : emptyUsage(),
    };
  }

  async embed(request: {
    modelId: string;
    input: string[];
  }) {
    const response =
      await this.getClient().embeddings.create(
        {
          model: request.modelId,
          input: request.input,
        }
      );
    const totalTokens =
      response.usage
        .total_tokens || 0;

    return {
      embeddings:
        response.data.map(
          (item) =>
            item.embedding
        ),
      usage: {
        inputTokens: totalTokens,
        outputTokens: 0,
        totalTokens,
        estimatedCostUsd: null,
      },
    };
  }
}

export function isOpenAiConfigured() {
  return Boolean(
    process.env.OPENAI_API_KEY
  );
}
