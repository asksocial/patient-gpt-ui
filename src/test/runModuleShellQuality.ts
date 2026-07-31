import {
  AI_AGENT_CATALOG,
  buildModuleExperience,
  INTELLIGENCE_MODULE_CATALOG,
  MODULE_SHELL_TABS,
  WORKFLOW_CATALOG,
} from "../lib/intelligence-platform";

const expectedTabs = [
  "overview",
  "signals",
  "entities",
  "questions",
  "workspaces",
  "reports",
  "agents",
  "data_sources",
  "settings",
];

if (
  JSON.stringify(
    MODULE_SHELL_TABS
  ) !== JSON.stringify(expectedTabs)
) {
  throw new Error(
    "Every module must use the prescribed shared shell sections."
  );
}

const experiences =
  INTELLIGENCE_MODULE_CATALOG.map(
    (module) =>
      buildModuleExperience(
        module,
        AI_AGENT_CATALOG,
        WORKFLOW_CATALOG
      )
  );
const medical =
  experiences.find(
    (experience) =>
      experience.module.id ===
      "medical_affairs"
  );
const clinical =
  experiences.find(
    (experience) =>
      experience.module.id ===
      "clinical_trials"
  );

if (
  experiences.some(
    (experience) =>
      experience.tabs !==
      MODULE_SHELL_TABS
  ) ||
  !medical?.ontologyExtensions.includes(
    "evidence_gap"
  ) ||
  !clinical?.signalDefinitions.includes(
    "recruitment_risk"
  ) ||
  medical.agents.some(
    (agent) =>
      !agent.moduleIds.includes(
        "medical_affairs"
      )
  )
) {
  throw new Error(
    "Module extensions must remain inside a consistent licensed module shell."
  );
}

console.log(
  JSON.stringify(
    {
      moduleCount:
        experiences.length,
      sharedTabs:
        MODULE_SHELL_TABS,
      medicalExtensions:
        medical.ontologyExtensions,
      clinicalSignals:
        clinical.signalDefinitions,
    },
    null,
    2
  )
);
