import type {
  AiGatewayContext,
  AiPromptDefinition,
  AiToolDefinition,
} from "./types";

const PROMPT_INJECTION_PATTERNS = [
  /\bignore (all|any|the|your)?\s*(previous|prior|system) instructions?\b/i,
  /\breveal (the )?(system|developer) prompt\b/i,
  /\bexfiltrat(e|ion)\b.{0,40}\b(secret|credential|token|data)\b/i,
];

export type ContentFilterResult = {
  allowed: boolean;
  reason?: string;
};

export function filterAiInput(
  input: string
): ContentFilterResult {
  if (!input.trim()) {
    return {
      allowed: false,
      reason:
        "Model input is empty.",
    };
  }

  const maxCharacters =
    Number(
      process.env
        .AI_GATEWAY_MAX_INPUT_CHARACTERS ||
        500_000
    );
  if (
    input.length > maxCharacters
  ) {
    return {
      allowed: false,
      reason:
        "Model input exceeds the configured size limit.",
    };
  }

  if (
    PROMPT_INJECTION_PATTERNS.some(
      (pattern) =>
        pattern.test(input)
    )
  ) {
    return {
      allowed: false,
      reason:
        "Potential prompt-injection or data-exfiltration instruction detected.",
    };
  }

  return { allowed: true };
}

export function validateToolAccess(
  params: {
    context: AiGatewayContext;
    prompt: AiPromptDefinition;
    tools: AiToolDefinition[];
  }
) {
  const {
    context,
    prompt,
    tools,
  } = params;

  for (const tool of tools) {
    if (
      !prompt.allowedToolIds.includes(
        tool.id
      )
    ) {
      throw new Error(
        `Tool ${tool.id} is not allowed for prompt ${prompt.id}.`
      );
    }

    if (
      tool.allowedModuleIds?.length &&
      !tool.allowedModuleIds.some(
        (moduleId) =>
          context.moduleIds.includes(
            moduleId
          )
      )
    ) {
      throw new Error(
        `Tool ${tool.id} is not permitted in the active module context.`
      );
    }
  }
}

export function requiresHumanApproval(
  requested: boolean,
  tools: AiToolDefinition[]
) {
  return (
    requested ||
    tools.some(
      (tool) =>
        tool.approvalRequired
    )
  );
}
