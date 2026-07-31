import {
  authorizeCrossModuleContext,
  formatCrossModuleDisclosure,
} from "../lib/intelligence-platform";

const authorized =
  authorizeCrossModuleContext({
    organizationId: "org_1",
    requestedModuleIds: [
      "clinical_trials",
      "patient",
      "advocacy",
      "corporate_affairs",
    ],
    permittedModuleIds: [
      "clinical_trials",
      "patient",
      "advocacy",
    ],
    explicitlyApprovedModuleIds:
      [
        "clinical_trials",
        "patient",
      ],
    sources: [
      {
        sourceId:
          "trial_signal_1",
        moduleId:
          "clinical_trials",
        sourceType:
          "trial_registry",
        summary:
          "Enrollment is below target.",
      },
      {
        sourceId:
          "patient_barrier_1",
        moduleId: "patient",
        sourceType:
          "patient_research",
        summary:
          "Travel burden affects participation.",
      },
      {
        sourceId:
          "advocacy_activity_1",
        moduleId: "advocacy",
        sourceType:
          "advocacy_content",
        summary:
          "An organization published new support resources.",
      },
      {
        sourceId:
          "corporate_risk_1",
        moduleId:
          "corporate_affairs",
        sourceType: "news",
        summary:
          "A reputation implication was reported.",
      },
    ],
  });

if (
  JSON.stringify(
    authorized.disclosure
      .modulesUsed
  ) !==
    JSON.stringify([
      "clinical_trials",
      "patient",
    ]) ||
  authorized.contexts.length !==
    2 ||
  authorized.contexts.some(
    (context) =>
      context.moduleId ===
        "advocacy" ||
      context.moduleId ===
        "corporate_affairs"
  )
) {
  throw new Error(
    "Cross-module reasoning must include only explicitly approved, permitted modules."
  );
}

const excluded = new Map(
  authorized.disclosure
    .excludedModules.map(
      (item) => [
        item.moduleId,
        item.reason,
      ]
    )
);

if (
  excluded.get("advocacy") !==
    "not_explicitly_approved" ||
  excluded.get(
    "corporate_affairs"
  ) !== "not_permitted"
) {
  throw new Error(
    "Cross-module exclusions must disclose the correct authorization reason."
  );
}

const disclosure =
  formatCrossModuleDisclosure(
    authorized.disclosure
  );

if (
  !disclosure.includes(
    "clinical_trials"
  ) ||
  !disclosure.includes(
    "patient"
  ) ||
  !disclosure.includes(
    "Excluded context"
  )
) {
  throw new Error(
    "Every cross-module result must disclose modules, sources, and excluded context."
  );
}

console.log(
  JSON.stringify(
    {
      modulesUsed:
        authorized.disclosure
          .modulesUsed,
      sourcesUsed:
        authorized.disclosure
          .sourcesUsed,
      excludedModules:
        authorized.disclosure
          .excludedModules,
      disclosure,
    },
    null,
    2
  )
);
