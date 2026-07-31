import {
  canActivateModuleAgents,
  evaluateModuleReleaseReadiness,
  MODULE_IMPLEMENTATION_PLANS,
  MODULE_RELEASE_SEQUENCE,
} from "../lib/intelligence-platform";

const phaseOrder =
  MODULE_IMPLEMENTATION_PLANS.map(
    (plan) => plan.phase
  );
if (
  phaseOrder.some(
    (phase, index) =>
      index > 0 &&
      phase <
        phaseOrder[index - 1]
  )
) {
  throw new Error(
    "Module plans must follow the prescribed phase order."
  );
}

const phaseOne =
  MODULE_IMPLEMENTATION_PLANS.filter(
    (plan) => plan.phase === 1
  ).map((plan) => plan.moduleId);

if (
  JSON.stringify(phaseOne) !==
  JSON.stringify([
    "medical_affairs",
    "clinical_trials",
    "patient",
  ])
) {
  throw new Error(
    "Phase 1 must contain Medical Affairs, Clinical Trials, and Patient in the prescribed order."
  );
}

if (
  MODULE_IMPLEMENTATION_PLANS.some(
    (plan) =>
      !plan.primaryUsers.length ||
      !plan.decisionWorkflows
        .length ||
      !plan.domainOntology.length ||
      !plan.permissibleSourceTypes
        .length ||
      !plan.signalDefinitions
        .length ||
      !plan.releaseEntitlement
  )
) {
  throw new Error(
    "Every module needs users, decisions, ontology, sources, signals, and an entitlement release boundary."
  );
}

const medical =
  MODULE_IMPLEMENTATION_PLANS[0];
if (
  canActivateModuleAgents(
    medical
  ) ||
  evaluateModuleReleaseReadiness(
    medical
  ).ready ||
  medical.gates.activate_agents !==
    "blocked"
) {
  throw new Error(
    "Agents and release must remain blocked until reliable data, search, reports, and evaluations are complete."
  );
}

const releasable = {
  ...medical,
  gates: Object.fromEntries(
    MODULE_RELEASE_SEQUENCE.map(
      (gate) => [
        gate,
        "complete",
      ]
    )
  ) as typeof medical.gates,
};

if (
  !canActivateModuleAgents(
    releasable
  ) ||
  !evaluateModuleReleaseReadiness(
    releasable
  ).ready
) {
  throw new Error(
    "A fully evaluated, entitled module must pass the release gates."
  );
}

console.log(
  JSON.stringify(
    {
      phaseOne,
      phaseTwo:
        MODULE_IMPLEMENTATION_PLANS.filter(
          (plan) =>
            plan.phase === 2
        ).map(
          (plan) =>
            plan.moduleId
        ),
      phaseThree:
        MODULE_IMPLEMENTATION_PLANS.filter(
          (plan) =>
            plan.phase === 3
        ).map(
          (plan) =>
            plan.moduleId
        ),
      medicalBlockingGates:
        evaluateModuleReleaseReadiness(
          medical
        ).blockingGates,
    },
    null,
    2
  )
);
