import {
  EVIDENCE_BACKED_ANSWER_JSON_SCHEMA,
  type AiGateway,
  type AiGatewayContext,
} from "../ai-gateway";
import {
  AI_AGENT_CATALOG,
} from "./catalog";
import {
  assertEvidenceBackedAnswer,
  type EvidenceBackedAnswer,
} from "./evidence";
import type {
  AiAgentId,
  IntelligenceModuleId,
} from "./ids";

export const AGENT_LIFECYCLE = [
  "understand_request",
  "establish_context",
  "create_visible_plan",
  "retrieve_permitted_evidence",
  "execute_approved_tools",
  "validate_results",
  "request_approval_if_required",
  "generate_evidence_backed_output",
  "save_export_or_schedule",
  "record_audit_event",
] as const;

export type AgentLifecycleStage =
  (typeof AGENT_LIFECYCLE)[number];

export type AgentExecutionProfile = {
  agentId: AiAgentId;
  version: string;
  jobDescription: string;
  inputDescription: string;
  outputDescription: string;
  allowedModuleIds:
    IntelligenceModuleId[];
  toolAllowlist: string[];
  dataAccessPolicy:
    "tenant_module_permission_scoped";
  approvalRules: string[];
  domainGlossary: string[];
  citationRequired: true;
  evaluationSuiteId: string;
  escalationBehavior: string;
  refusalBehavior: string;
};

const TOOL_ALIASES: Record<
  string,
  string
> = {
  search: "unified_search",
  reporting: "report_export",
};

export const AGENT_EXECUTION_PROFILES:
  AgentExecutionProfile[] =
  AI_AGENT_CATALOG.map(
    (agent) => ({
      agentId: agent.id,
      version: "1.0.0",
      jobDescription:
        agent.description,
      inputDescription:
        "A user request plus the active tenant, workspace, module, and permission context.",
      outputDescription:
        "An evidence-backed work product with claims, citations, limitations, and disclosed capabilities.",
      allowedModuleIds:
        agent.moduleIds,
      toolAllowlist:
        agent.allowedTools,
      dataAccessPolicy:
        "tenant_module_permission_scoped",
      approvalRules: [
        "external_action",
        "regulated_action",
        "export",
        "persistent_monitoring",
      ],
      domainGlossary:
        agent.moduleIds,
      citationRequired: true,
      evaluationSuiteId:
        `${agent.id}_v1`,
      escalationBehavior:
        "Escalate regulated, safety, and unsupported decisions to an authorized human.",
      refusalBehavior:
        "Refuse requests outside licensed modules, permitted sources, allowed tools, or supported evidence.",
    })
  );

export type AgentExecutionRequest = {
  context: AiGatewayContext;
  agentId: AiAgentId;
  request: string;
  requestedToolIds?: string[];
  retrievalQuery?: string;
  visiblePlan?: string[];
};

export type AgentExecutionResult = {
  status:
    | "completed"
    | "approval_required"
    | "blocked";
  agentId: AiAgentId;
  profileVersion: string;
  plan: Array<{
    stage: AgentLifecycleStage;
    label: string;
    status:
      | "pending"
      | "completed"
      | "waiting";
  }>;
  capabilitiesUsed: string[];
  output?: EvidenceBackedAnswer;
  reason?: string;
  auditEventId?: string;
};

function normalizeToolId(
  toolId: string
) {
  return (
    TOOL_ALIASES[toolId] ||
    toolId
  );
}

function buildPlan(
  custom: string[] = []
): AgentExecutionResult["plan"] {
  return AGENT_LIFECYCLE.map(
    (stage, index) => ({
      stage,
      label:
        custom[index] ||
        stage
          .split("_")
          .map(
            (part) =>
              part.charAt(0).toUpperCase() +
              part.slice(1)
          )
          .join(" "),
      status: "pending",
    })
  );
}

export class AgentExecutionEngine {
  constructor(
    private readonly gateway: AiGateway
  ) {}

  async execute(
    request: AgentExecutionRequest
  ): Promise<AgentExecutionResult> {
    const profile =
      AGENT_EXECUTION_PROFILES.find(
        (item) =>
          item.agentId ===
          request.agentId
      );
    if (!profile) {
      throw new Error(
        `Unknown agent: ${request.agentId}`
      );
    }

    const plan = buildPlan(
      request.visiblePlan
    );
    if (
      !profile.allowedModuleIds.some(
        (moduleId) =>
          request.context.moduleIds.includes(
            moduleId
          )
      )
    ) {
      return {
        status: "blocked",
        agentId:
          request.agentId,
        profileVersion:
          profile.version,
        plan,
        capabilitiesUsed: [],
        reason:
          profile.refusalBehavior,
      };
    }

    const requestedTools =
      request.requestedToolIds ||
      [];
    const unauthorizedTool =
      requestedTools.find(
        (toolId) =>
          !profile.toolAllowlist.includes(
            toolId
          )
      );
    if (unauthorizedTool) {
      return {
        status: "blocked",
        agentId:
          request.agentId,
        profileVersion:
          profile.version,
        plan,
        capabilitiesUsed: [],
        reason:
          `Tool ${unauthorizedTool} is not allowed for this capability.`,
      };
    }

    plan
      .slice(0, 5)
      .forEach(
        (item) =>
          (item.status =
            "completed")
      );
    const toolIds =
      requestedTools.map(
        normalizeToolId
      );
    const generated =
      await this.gateway.generate({
        context: request.context,
        promptId:
          "agent_workflow_execution",
        input: [
          `Capability: ${profile.jobDescription}`,
          `Request: ${request.request}`,
          `Visible plan: ${plan
            .map(
              (item) =>
                item.label
            )
            .join(" -> ")}`,
        ].join("\n"),
        toolIds,
        retrieval:
          request.retrievalQuery
            ? {
                query:
                  request.retrievalQuery,
              }
            : undefined,
        jsonSchema: {
          name:
            "evidence_backed_answer",
          schema:
            EVIDENCE_BACKED_ANSWER_JSON_SCHEMA,
        },
        parse: (text) =>
          JSON.parse(
            text
          ) as EvidenceBackedAnswer,
        validate:
          assertEvidenceBackedAnswer,
      });

    if (
      generated.status !==
      "completed"
    ) {
      plan[6].status =
        "waiting";
      return {
        status:
          generated.status,
        agentId:
          request.agentId,
        profileVersion:
          profile.version,
        plan,
        capabilitiesUsed:
          toolIds,
        reason:
          generated.reason,
        auditEventId:
          generated.auditEventId,
      };
    }

    plan.forEach(
      (item) =>
        (item.status =
          "completed")
    );
    return {
      status: "completed",
      agentId: request.agentId,
      profileVersion:
        profile.version,
      plan,
      capabilitiesUsed:
        toolIds,
      output: generated.output,
      auditEventId:
        generated.auditEventId,
    };
  }
}
