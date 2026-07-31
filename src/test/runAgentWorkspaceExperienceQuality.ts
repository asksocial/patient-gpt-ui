import {
  AGENT_ACTION_CATALOG,
  AGENT_WORKSPACE_REGIONS,
  createAgentWorkspaceState,
} from "../lib/intelligence-platform";

const state =
  createAgentWorkspaceState({
    id: "agent_workspace_1",
    organizationId: "org_1",
    workspaceId:
      "workspace_xolair",
    moduleId:
      "medical_affairs",
    modeId:
      "scientific_intelligence_advisor",
    context: {
      product: "Xolair",
      disease: "Food allergy",
      geography: "US",
      timePeriod:
        "Previous quarter",
    },
    suggestedActions:
      AGENT_ACTION_CATALOG.filter(
        (item) =>
          item.agentId ===
          "scientific_intelligence_advisor"
      ),
    savedSessionIds: [
      "session_1",
    ],
    templateIds: [
      "scientific_landscape",
    ],
    scheduledRunIds: [
      "monitor_1",
    ],
    pendingApprovalIds: [
      "approval_1",
    ],
    commentThreadIds: [
      "comment_1",
    ],
    updatedAt:
      "2026-07-30T12:00:00.000Z",
  });

if (
  JSON.stringify(
    state.regions
  ) !==
    JSON.stringify([
      "conversation",
      "plan",
      "evidence",
      "deliverable",
    ]) ||
  state.regions !==
    AGENT_WORKSPACE_REGIONS
) {
  throw new Error(
    "Agent work must use the four persistent regions inside AskSocial."
  );
}

if (
  !state.context.product ||
  !state.context.disease ||
  !state.context.geography ||
  !state.context.timePeriod ||
  !state.savedSessionIds
    .length ||
  !state.templateIds.length ||
  !state.scheduledRunIds
    .length ||
  !state.pendingApprovalIds
    .length ||
  !state.commentThreadIds
    .length ||
  state.exportFormats.length !==
    4 ||
  !state.whyThisAnswerEnabled ||
  !state.viewEvidenceEnabled
) {
  throw new Error(
    "The persistent work environment must include selectors, sessions, templates, schedules, approvals, collaboration, exports, and evidence controls."
  );
}

console.log(
  JSON.stringify(
    {
      regions: state.regions,
      context: state.context,
      suggestedWorkflows:
        state.suggestedActions.map(
          (item) =>
            item.slashCommand
        ),
      exportFormats:
        state.exportFormats,
    },
    null,
    2
  )
);
