import type {
  AgentActionDefinition,
} from "./agentActions";
import type {
  AiAgentId,
  IntelligenceModuleId,
} from "./ids";

export const AGENT_WORKSPACE_REGIONS = [
  "conversation",
  "plan",
  "evidence",
  "deliverable",
] as const;

export type AgentWorkspaceRegion =
  (typeof AGENT_WORKSPACE_REGIONS)[number];

export type AgentWorkspaceContextSelectors = {
  product?: string;
  disease?: string;
  geography?: string;
  timePeriod?: string;
};

export type AgentWorkspaceState = {
  id: string;
  organizationId: string;
  workspaceId: string;
  moduleId:
    IntelligenceModuleId;
  modeId: AiAgentId;
  regions:
    readonly AgentWorkspaceRegion[];
  context:
    AgentWorkspaceContextSelectors;
  suggestedActions:
    AgentActionDefinition[];
  savedSessionIds: string[];
  templateIds: string[];
  scheduledRunIds: string[];
  pendingApprovalIds: string[];
  commentThreadIds: string[];
  exportFormats: Array<
    "docx" | "pptx" | "xlsx" | "pdf"
  >;
  whyThisAnswerEnabled: true;
  viewEvidenceEnabled: true;
  updatedAt: string;
};

export function createAgentWorkspaceState(
  params: Omit<
    AgentWorkspaceState,
    | "regions"
    | "exportFormats"
    | "whyThisAnswerEnabled"
    | "viewEvidenceEnabled"
  >
): AgentWorkspaceState {
  return {
    ...params,
    regions:
      AGENT_WORKSPACE_REGIONS,
    exportFormats: [
      "docx",
      "pptx",
      "xlsx",
      "pdf",
    ],
    whyThisAnswerEnabled:
      true,
    viewEvidenceEnabled: true,
  };
}
