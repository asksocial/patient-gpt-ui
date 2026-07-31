import {
  isEntitlementKey,
} from "../entitlements";
import {
  AI_AGENT_CATALOG,
  INTELLIGENCE_MODULE_CATALOG,
  WORKFLOW_CATALOG,
} from "./catalog";
import type {
  AgentDefinition,
  IntelligenceModuleDefinition,
  WorkflowDefinition,
} from "./types";

export type RegistryValidationIssue = {
  path: string;
  message: string;
};

function duplicateIds(
  values: string[]
) {
  return values.filter(
    (value, index) =>
      values.indexOf(value) !== index
  );
}

export function validateIntelligenceRegistry(
  params: {
    modules?:
      IntelligenceModuleDefinition[];
    agents?: AgentDefinition[];
    workflows?: WorkflowDefinition[];
  } = {}
): RegistryValidationIssue[] {
  const modules =
    params.modules ||
    INTELLIGENCE_MODULE_CATALOG;
  const agents =
    params.agents || AI_AGENT_CATALOG;
  const workflows =
    params.workflows ||
    WORKFLOW_CATALOG;
  const issues:
    RegistryValidationIssue[] = [];
  const moduleIds = new Set(
    modules.map((item) => item.id)
  );
  const agentIds = new Set(
    agents.map((item) => item.id)
  );
  const workflowIds = new Set(
    workflows.map((item) => item.id)
  );

  for (const id of duplicateIds(
    modules.map((item) => item.id)
  )) {
    issues.push({
      path: `modules.${id}`,
      message:
        "Module IDs must be unique.",
    });
  }
  for (const id of duplicateIds(
    agents.map((item) => item.id)
  )) {
    issues.push({
      path: `agents.${id}`,
      message:
        "Agent IDs must be unique.",
    });
  }
  for (const id of duplicateIds(
    workflows.map((item) => item.id)
  )) {
    issues.push({
      path: `workflows.${id}`,
      message:
        "Workflow IDs must be unique.",
    });
  }

  for (const moduleDefinition of
    modules) {
    for (const entitlement of
      moduleDefinition.requiredEntitlements) {
      if (
        !isEntitlementKey(
          entitlement
        )
      ) {
        issues.push({
          path:
            `modules.${moduleDefinition.id}.requiredEntitlements`,
          message:
            `Unknown entitlement: ${entitlement}`,
        });
      }
    }

    for (const agentId of
      moduleDefinition.agentIds) {
      const agent = agents.find(
        (item) =>
          item.id === agentId
      );
      if (!agent) {
        issues.push({
          path:
            `modules.${moduleDefinition.id}.agentIds`,
          message:
            `Unknown agent: ${agentId}`,
        });
      } else if (
        !agent.moduleIds.includes(
          moduleDefinition.id
        )
      ) {
        issues.push({
          path:
            `modules.${moduleDefinition.id}.agentIds`,
          message:
            `Agent ${agentId} does not reference module ${moduleDefinition.id}.`,
        });
      }
    }
  }

  for (const agent of agents) {
    for (const moduleId of
      agent.moduleIds) {
      const moduleDefinition =
        modules.find(
          (item) =>
            item.id === moduleId
        );
      if (!moduleDefinition) {
        issues.push({
          path:
            `agents.${agent.id}.moduleIds`,
          message:
            `Unknown module: ${moduleId}`,
        });
      } else if (
        !moduleDefinition.agentIds.includes(
          agent.id
        )
      ) {
        issues.push({
          path:
            `agents.${agent.id}.moduleIds`,
          message:
            `Module ${moduleId} does not reference agent ${agent.id}.`,
        });
      }
    }
    for (const workflowId of
      agent.workflowIds) {
      const workflow =
        workflows.find(
          (item) =>
            item.id === workflowId
        );
      if (!workflow) {
        issues.push({
          path:
            `agents.${agent.id}.workflowIds`,
          message:
            `Unknown workflow: ${workflowId}`,
        });
      } else if (
        workflow.agentId !==
        agent.id
      ) {
        issues.push({
          path:
            `agents.${agent.id}.workflowIds`,
          message:
            `Workflow ${workflowId} belongs to ${workflow.agentId}.`,
        });
      }
    }
    for (const entitlement of
      agent.requiredEntitlements) {
      if (
        !isEntitlementKey(
          entitlement
        )
      ) {
        issues.push({
          path:
            `agents.${agent.id}.requiredEntitlements`,
          message:
            `Unknown entitlement: ${entitlement}`,
        });
      }
    }
  }

  for (const workflow of
    workflows) {
    const agent = agents.find(
      (item) =>
        item.id === workflow.agentId
    );
    if (!agent) {
      issues.push({
        path:
          `workflows.${workflow.id}.agentId`,
        message:
          `Unknown agent: ${workflow.agentId}`,
      });
    } else if (
      !agent.workflowIds.includes(
        workflow.id
      )
    ) {
      issues.push({
        path:
          `workflows.${workflow.id}.agentId`,
        message:
          `Agent ${workflow.agentId} does not reference workflow ${workflow.id}.`,
      });
    }
    if (!workflow.steps.length) {
      issues.push({
        path:
          `workflows.${workflow.id}.steps`,
        message:
          "A workflow must contain at least one step.",
      });
    }
    for (const stepId of duplicateIds(
      workflow.steps.map(
        (step) => step.id
      )
    )) {
      issues.push({
        path:
          `workflows.${workflow.id}.steps.${stepId}`,
        message:
          "Workflow step IDs must be unique.",
      });
    }
  }

  if (
    moduleIds.size !==
    modules.length ||
    agentIds.size !== agents.length ||
    workflowIds.size !==
      workflows.length
  ) {
    return issues;
  }

  return issues;
}

export function assertIntelligenceRegistryIntegrity() {
  const issues =
    validateIntelligenceRegistry();

  if (issues.length) {
    throw new Error(
      [
        "Invalid intelligence platform registry:",
        ...issues.map(
          (issue) =>
            `${issue.path}: ${issue.message}`
        ),
      ].join("\n")
    );
  }
}
