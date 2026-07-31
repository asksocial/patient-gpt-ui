import type {
  EntitlementKey,
} from "../entitlements";
import type {
  AiAgentId,
  IntelligenceModuleId,
  WorkflowId,
} from "./ids";

export type IntelligenceModuleDefinition = {
  id: IntelligenceModuleId;
  name: string;
  description: string;
  capabilities: string[];
  dataSourceTypes: string[];
  agentIds: AiAgentId[];
  requiredEntitlements: EntitlementKey[];
};

export type AgentDefinition = {
  id: AiAgentId;
  name: string;
  description: string;
  moduleIds: IntelligenceModuleId[];
  workflowIds: WorkflowId[];
  allowedTools: string[];
  requiredEntitlements: EntitlementKey[];
};

export type WorkflowTrigger =
  | "interactive"
  | "scheduled"
  | "event";

export type WorkflowStepKind =
  | "understand"
  | "retrieve"
  | "reason"
  | "approve"
  | "deliver";

export type WorkflowStep = {
  id: string;
  label: string;
  kind: WorkflowStepKind;
  toolId?: string;
  requiresApproval?: boolean;
};

export type WorkflowDefinition = {
  id: WorkflowId;
  name: string;
  description: string;
  agentId: AiAgentId;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  outputSchemaId: string;
  approvalPolicyId: string;
};

export type ConnectedDataSource = {
  id: string;
  type: string;
  label: string;
  status:
    | "connected"
    | "disabled"
    | "error";
  moduleIds: IntelligenceModuleId[];
};

export type CustomerUserAccess = {
  userId: string;
  roles: string[];
  permissions: EntitlementKey[];
};

export type AiPolicy = {
  allowedModelIds: string[];
  requireCitations: boolean;
  requireHumanApprovalFor:
    string[];
};

export type CompliancePolicy = {
  dataResidency?: string;
  retentionDays?: number;
  protectedDataAllowed: boolean;
  auditLoggingRequired: boolean;
};

export type CustomerIntelligenceConfiguration = {
  organizationId: string;
  licensedModuleIds:
    IntelligenceModuleId[];
  enabledAgentIds: AiAgentId[];
  connectedDataSources:
    ConnectedDataSource[];
  userAccess: CustomerUserAccess[];
  approvedUseCases: string[];
  aiPolicy: AiPolicy;
  compliancePolicy:
    CompliancePolicy;
};

export type CustomerIntelligenceAccess = {
  organizationId: string;
  modules:
    IntelligenceModuleDefinition[];
  agents: AgentDefinition[];
  workflows: WorkflowDefinition[];
  connectedDataSources:
    ConnectedDataSource[];
  userAccess: CustomerUserAccess[];
  approvedUseCases: string[];
  aiPolicy: AiPolicy;
  compliancePolicy:
    CompliancePolicy;
  blockedAgentIds: AiAgentId[];
};
