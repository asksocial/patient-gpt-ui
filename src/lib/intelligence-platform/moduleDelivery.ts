import {
  MODULE_ENTITLEMENTS,
} from "./catalog";
import type {
  IntelligenceModuleId,
} from "./ids";

export const MODULE_RELEASE_SEQUENCE = [
  "define_users_and_decisions",
  "define_domain_ontology",
  "approve_data_sources",
  "define_signals",
  "build_ingestion_and_resolution",
  "build_search_and_graph",
  "build_reports_and_alerts",
  "activate_agents",
  "domain_expert_evaluation",
  "tenant_entitlement_release",
] as const;

export type ModuleDeliveryGate =
  (typeof MODULE_RELEASE_SEQUENCE)[number];

export type ModuleDeliveryStatus =
  | "planned"
  | "in_progress"
  | "complete"
  | "blocked";

export type ModuleImplementationPlan = {
  moduleId:
    IntelligenceModuleId;
  phase: 1 | 2 | 3;
  primaryUsers: string[];
  decisionWorkflows: string[];
  domainOntology: string[];
  permissibleSourceTypes: string[];
  signalDefinitions: string[];
  gates: Record<
    ModuleDeliveryGate,
    ModuleDeliveryStatus
  >;
  releaseEntitlement: string;
};

function plannedGates(): Record<
  ModuleDeliveryGate,
  ModuleDeliveryStatus
> {
  return Object.fromEntries(
    MODULE_RELEASE_SEQUENCE.map(
      (gate) => [
        gate,
        "planned",
      ]
    )
  ) as Record<
    ModuleDeliveryGate,
    ModuleDeliveryStatus
  >;
}

function initialPlan(
  plan: Omit<
    ModuleImplementationPlan,
    "gates" | "releaseEntitlement"
  >,
  completedDiscovery = false
): ModuleImplementationPlan {
  const gates = plannedGates();
  if (completedDiscovery) {
    for (const gate of [
      "define_users_and_decisions",
      "define_domain_ontology",
      "approve_data_sources",
      "define_signals",
    ] as const) {
      gates[gate] = "complete";
    }
    gates.build_ingestion_and_resolution =
      "in_progress";
    gates.activate_agents =
      "blocked";
  }
  return {
    ...plan,
    gates,
    releaseEntitlement:
      MODULE_ENTITLEMENTS[
        plan.moduleId
      ],
  };
}

export const MODULE_IMPLEMENTATION_PLANS:
  ModuleImplementationPlan[] = [
  initialPlan(
    {
      moduleId:
        "medical_affairs",
      phase: 1,
      primaryUsers: [
        "medical affairs",
        "medical information",
        "pharmacovigilance",
      ],
      decisionWorkflows: [
        "scientific landscape monitoring",
        "evidence-gap analysis",
        "congress impact assessment",
      ],
      domainOntology: [
        "scientific_claim",
        "evidence_gap",
        "medical_inquiry",
        "safety_signal",
      ],
      permissibleSourceTypes: [
        "scientific_literature",
        "congress_content",
        "curated_research",
        "governed_social_intelligence",
      ],
      signalDefinitions: [
        "scientific_perception_shift",
        "unanswered_hcp_question",
        "misinformation_risk",
      ],
    },
    true
  ),
  initialPlan(
    {
      moduleId:
        "clinical_trials",
      phase: 1,
      primaryUsers: [
        "clinical operations",
        "trial strategy",
        "site engagement",
      ],
      decisionWorkflows: [
        "trial landscape review",
        "enrollment barrier analysis",
        "site intelligence",
      ],
      domainOntology: [
        "trial_site",
        "eligibility_criterion",
        "protocol_amendment",
        "enrollment_barrier",
      ],
      permissibleSourceTypes: [
        "trial_registry",
        "scientific_literature",
        "site_directory",
        "governed_social_intelligence",
      ],
      signalDefinitions: [
        "recruitment_risk",
        "protocol_burden",
        "retention_risk",
      ],
    },
    true
  ),
  initialPlan(
    {
      moduleId: "patient",
      phase: 1,
      primaryUsers: [
        "patient engagement",
        "patient services",
        "market access",
      ],
      decisionWorkflows: [
        "patient journey mapping",
        "unmet-need discovery",
        "access barrier analysis",
      ],
      domainOntology: [
        "journey_stage",
        "experience_barrier",
        "caregiver_need",
        "referral_pathway",
      ],
      permissibleSourceTypes: [
        "patient_research",
        "governed_social_intelligence",
        "provider_directory",
      ],
      signalDefinitions: [
        "unmet_need",
        "access_barrier",
        "experience_shift",
      ],
    },
    true
  ),
  initialPlan({
    moduleId:
      "corporate_affairs",
    phase: 2,
    primaryUsers: [
      "corporate affairs",
      "communications",
      "executive leadership",
    ],
    decisionWorkflows: [
      "narrative monitoring",
      "stakeholder analysis",
      "reputation risk review",
    ],
    domainOntology: [
      "stakeholder",
      "corporate_narrative",
      "reputation_risk",
    ],
    permissibleSourceTypes: [
      "news",
      "corporate_content",
      "governed_social_intelligence",
    ],
    signalDefinitions: [
      "narrative_risk",
      "stakeholder_shift",
    ],
  }),
  initialPlan({
    moduleId: "competitive",
    phase: 2,
    primaryUsers: [
      "competitive intelligence",
      "strategy",
    ],
    decisionWorkflows: [
      "landscape monitoring",
      "positioning analysis",
    ],
    domainOntology: [
      "competitor",
      "positioning_claim",
      "market_signal",
    ],
    permissibleSourceTypes: [
      "market_research",
      "news",
      "scientific_literature",
    ],
    signalDefinitions: [
      "competitive_signal",
      "positioning_shift",
    ],
  }),
  initialPlan({
    moduleId: "advocacy",
    phase: 2,
    primaryUsers: [
      "advocacy relations",
      "patient engagement",
    ],
    decisionWorkflows: [
      "organization landscape",
      "community signal monitoring",
    ],
    domainOntology: [
      "advocacy_program",
      "community_priority",
    ],
    permissibleSourceTypes: [
      "advocacy_content",
      "news",
      "governed_social_intelligence",
    ],
    signalDefinitions: [
      "community_priority_shift",
      "advocacy_activity",
    ],
  }),
  initialPlan({
    moduleId: "commercial",
    phase: 3,
    primaryUsers: [
      "commercial strategy",
      "brand teams",
    ],
    decisionWorkflows: [
      "market landscape review",
      "customer intelligence",
    ],
    domainOntology: [
      "market_segment",
      "customer_signal",
      "performance_indicator",
    ],
    permissibleSourceTypes: [
      "market_research",
      "commercial_analytics",
    ],
    signalDefinitions: [
      "market_shift",
      "customer_need",
    ],
  }),
];

export function evaluateModuleReleaseReadiness(
  plan: ModuleImplementationPlan
) {
  const blockingGates =
    MODULE_RELEASE_SEQUENCE.filter(
      (gate) =>
        plan.gates[gate] !==
        "complete"
    );
  return {
    ready:
      blockingGates.length === 0,
    blockingGates,
  };
}

export function canActivateModuleAgents(
  plan: ModuleImplementationPlan
) {
  const prerequisites:
    ModuleDeliveryGate[] = [
    "define_users_and_decisions",
    "define_domain_ontology",
    "approve_data_sources",
    "define_signals",
    "build_ingestion_and_resolution",
    "build_search_and_graph",
    "build_reports_and_alerts",
  ];
  return prerequisites.every(
    (gate) =>
      plan.gates[gate] ===
      "complete"
  );
}
