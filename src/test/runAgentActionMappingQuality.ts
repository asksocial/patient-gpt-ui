import {
  AGENT_ACTION_CATALOG,
  AGENT_EXECUTION_PROFILES,
  getAvailableAgentActions,
} from "../lib/intelligence-platform";

const minimumActions = {
  scientific_intelligence_advisor:
    3,
  clinical_trial_companion: 4,
  patient_journey_advisor: 3,
  congress_intelligence_advisor:
    4,
  corporate_reputation_advisor:
    3,
  referral_navigator: 3,
  medical_information_assistant:
    3,
  pharmacovigilance_assistant:
    2,
} as const;

for (const [
  agentId,
  minimum,
] of Object.entries(
  minimumActions
)) {
  const actions =
    AGENT_ACTION_CATALOG.filter(
      (item) =>
        item.agentId === agentId
    );
  if (
    actions.length < minimum ||
    actions.some(
      (item) =>
        !item.label ||
        !item.slashCommand.startsWith(
          "/"
        ) ||
        !item.requiredTools
          .length
    )
  ) {
    throw new Error(
      `${agentId} does not expose the prescribed discoverable jobs.`
    );
  }
}

const profileTools =
  new Map(
    AGENT_EXECUTION_PROFILES.map(
      (profile) => [
        profile.agentId,
        new Set(
          profile.toolAllowlist
        ),
      ]
    )
  );

const toolViolations =
  AGENT_ACTION_CATALOG.flatMap(
    (item) =>
      item.requiredTools
        .filter(
          (toolId) =>
            !profileTools
              .get(item.agentId)
              ?.has(toolId)
        )
        .map(
          (toolId) =>
            `${item.agentId}:${toolId}`
        )
  );

if (toolViolations.length) {
  throw new Error(
    `Actions must stay inside their agent execution profile tool allowlist: ${toolViolations.join(", ")}`
  );
}

const patientActions =
  getAvailableAgentActions({
    permittedAgentIds: [
      "patient_journey_advisor",
    ],
    moduleId: "patient",
  });

if (
  !patientActions.some(
    (item) =>
      item.id ===
      "patient_journey_mapping"
  ) ||
  patientActions.some(
    (item) =>
      item.moduleIds.includes(
        "medical_affairs"
      )
  )
) {
  throw new Error(
    "Suggested actions must be filtered to licensed agents and the active module."
  );
}

const pharmacovigilance =
  AGENT_EXECUTION_PROFILES.find(
    (profile) =>
      profile.agentId ===
      "pharmacovigilance_assistant"
  );

if (!pharmacovigilance) {
  throw new Error(
    "Pharmacovigilance Assistant must use the corrected product identity."
  );
}

console.log(
  JSON.stringify(
    {
      actionCount:
        AGENT_ACTION_CATALOG.length,
      actionsByAgent:
        Object.fromEntries(
          Object.keys(
            minimumActions
          ).map((agentId) => [
            agentId,
            AGENT_ACTION_CATALOG.filter(
              (item) =>
                item.agentId ===
                agentId
            ).length,
          ])
        ),
      patientSuggestedActions:
        patientActions.map(
          (item) =>
            item.slashCommand
        ),
    },
    null,
    2
  )
);
