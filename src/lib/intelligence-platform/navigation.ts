import type {
  CustomerIntelligenceAccess,
} from "./types";
import type {
  IntelligenceModuleId,
} from "./ids";

export type EcosystemNavigationItem = {
  id: string;
  label: string;
  description?: string;
  kind:
    | "destination"
    | "module";
};

export type EcosystemNavigationGroup = {
  id: string;
  label?: string;
  items: EcosystemNavigationItem[];
};

type NavigationAccess = Pick<
  CustomerIntelligenceAccess,
  "modules" | "agents"
>;

const INTELLIGENCE_MODE_PRESENTATION:
  Record<
    string,
    {
      label: string;
      description: string;
    }
  > = {
  scientific_intelligence_advisor: {
    label: "Scientific Intelligence",
    description:
      "Synthesize evidence and explore scientific landscapes.",
  },
  clinical_trial_companion: {
    label: "Clinical Trials Intelligence",
    description:
      "Focus on trials, eligibility, sites, and enrollment barriers.",
  },
  patient_journey_advisor: {
    label: "Patient Journey",
    description:
      "Map patient experiences, barriers, and unmet needs.",
  },
  congress_intelligence_advisor: {
    label: "Congress Intelligence",
    description:
      "Analyze congress activity and its implications.",
  },
  corporate_reputation_advisor: {
    label: "Corporate Reputation",
    description:
      "Assess narratives, stakeholders, and reputation risk.",
  },
  referral_navigator: {
    label: "Referral Intelligence",
    description:
      "Explore referral pathways, centers, and access barriers.",
  },
  medical_information_assistant: {
    label: "Medical Information",
    description:
      "Retrieve governed medical information and supporting evidence.",
  },
  pharmacovigilance_assistant: {
    label: "Safety Intelligence",
    description:
      "Review potential safety signals with required human oversight.",
  },
};

export function buildEcosystemNavigation(
  access: NavigationAccess,
  options: {
    isAdmin?: boolean;
  } = {}
): EcosystemNavigationGroup[] {
  const pvEnabled = access.agents.some(
    (agent) =>
      agent.id ===
      "pharmacovigilance_assistant"
  );
  const groups:
    EcosystemNavigationGroup[] = [
    {
      id: "primary",
      items: [
        {
          id: "home",
          label: "Home",
          kind: "destination",
        },
        {
          id: "ask",
          label: "Ask AskSocial",
          kind: "destination",
        },
      ],
    },
    {
      id: "intelligence",
      label: "Intelligence",
      items: [
        {
          id: "intelligence_search",
          label: "Search",
          kind: "destination",
        },
        {
          id: "intelligence_graph",
          label: "Knowledge Graph",
          kind: "destination",
        },
        {
          id: "intelligence_reports",
          label: "Reports",
          kind: "destination",
        },
      ],
    },
    {
      id: "modules",
      label: "Modules",
      items: access.modules.map(
        (module) => ({
          id: `module_${module.id}`,
          label: module.name,
          description:
            module.description,
          kind: "module",
        })
      ),
    },
    {
      id: "modes",
      label: "Intelligence Modes",
      items: [
        {
          id: "modes_mine",
          label: "My Modes",
          kind: "destination",
        },
        {
          id: "modes_library",
          label: "Mode Library",
          kind: "destination",
        },
      ],
    },
    {
      id: "workflows",
      label: "Workflows",
      items: [
        {
          id: "workflows_active",
          label: "Active",
          kind: "destination",
        },
        {
          id: "workflows_scheduled",
          label: "Scheduled",
          kind: "destination",
        },
        {
          id: "workflows_approvals",
          label: "Approvals",
          kind: "destination",
        },
      ],
    },
    ...(pvEnabled
      ? [
          {
            id: "pv_compliance",
            label: "PV Compliance",
            items: [
              {
                id: "pv_overview",
                label: "Compliance Overview",
                kind: "destination" as const,
              },
              {
                id: "pv_queue",
                label: "Review Queue",
                kind: "destination" as const,
              },
              {
                id: "pv_screening",
                label: "Screening Status",
                kind: "destination" as const,
              },
              {
                id: "pv_transfers",
                label: "Transfers",
                kind: "destination" as const,
              },
              {
                id: "pv_reconciliation",
                label: "Reconciliation",
                kind: "destination" as const,
              },
              {
                id: "pv_sources",
                label: "Source Registry",
                kind: "destination" as const,
              },
              {
                id: "pv_configuration",
                label: "PV Configuration",
                kind: "destination" as const,
              },
            ],
          },
        ]
      : []),
    {
      id: "resources",
      items: [
        {
          id: "library",
          label: "Library",
          kind: "destination",
        },
        {
          id: "governance",
          label: "Governance",
          kind: "destination",
        },
      ],
    },
  ];

  if (options.isAdmin) {
    groups[groups.length - 1].items.push(
      {
        id: "administration",
        label: "Administration",
        kind: "destination",
      }
    );
  }

  return groups;
}

export function getModuleSwitcherOptions(
  access: NavigationAccess
) {
  return access.modules.map(
    (module) => ({
      value: module.id,
      label: module.name,
    })
  );
}

export function getIntelligenceModeOptions(
  access: NavigationAccess,
  activeModuleId?: string
) {
  const licensedModes =
    access.agents
      .filter(
        (agent) =>
          !activeModuleId ||
          agent.moduleIds.includes(
            activeModuleId as IntelligenceModuleId
          )
      )
      .map((agent) => {
        const presentation =
          INTELLIGENCE_MODE_PRESENTATION[
            agent.id
          ];
        return {
          value: agent.id,
          label:
            presentation?.label ||
            agent.name,
          description:
            presentation?.description ||
            agent.description,
        };
      });

  return [
    {
      value: "general",
      label: "General Intelligence",
      description:
        "Let AskSocial route the request across permitted capabilities.",
    },
    ...licensedModes,
  ];
}
