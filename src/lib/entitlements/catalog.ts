export const ENTITLEMENT_KEYS = [
  "platform_core",
  "theme_intelligence",
  "longitudinal_intelligence",
  "knowledge_intelligence",
  "executive_intelligence",
  "exports",
  "admin_console",
  "module_medical_affairs",
  "module_patient",
  "module_clinical_trials",
  "module_corporate_affairs",
  "module_commercial",
  "module_competitive",
  "module_advocacy",
  "agent_scientific_intelligence_advisor",
  "agent_clinical_trial_companion",
  "agent_patient_journey_advisor",
  "agent_congress_intelligence_advisor",
  "agent_corporate_reputation_advisor",
  "agent_referral_navigator",
  "agent_medical_information_assistant",
  "agent_pharmacovigilance_assistant",
  "data_package_scientific",
  "data_package_social",
  "data_package_market",
  "governance_enterprise",
] as const;

export type EntitlementKey =
  (typeof ENTITLEMENT_KEYS)[number];

export type EntitlementDefinition = {
  key: EntitlementKey;
  label: string;
  description: string;
  defaultGranted: boolean;
};

export const ENTITLEMENT_CATALOG: EntitlementDefinition[] = [
  {
    key: "platform_core",
    label: "Enterprise Platform",
    description:
      "Conversational intelligence, curated insights, and core workspace access.",
    defaultGranted: true,
  },
  {
    key: "theme_intelligence",
    label: "Theme Intelligence",
    description:
      "Theme prevalence, source aggregation, evidence quality, and relationships.",
    defaultGranted: true,
  },
  {
    key:
      "longitudinal_intelligence",
    label:
      "Longitudinal Intelligence",
    description:
      "Theme trajectory, momentum, persistence, and time-window comparisons.",
    defaultGranted: true,
  },
  {
    key: "knowledge_intelligence",
    label: "Knowledge Intelligence",
    description:
      "Persistent snapshots, historical comparison, and organizational memory.",
    defaultGranted: false,
  },
  {
    key: "executive_intelligence",
    label: "Executive Intelligence",
    description:
      "Leadership briefs, decision signals, risks, actions, and watchlists.",
    defaultGranted: true,
  },
  {
    key: "exports",
    label: "Exports",
    description:
      "Download and export intelligence artifacts.",
    defaultGranted: false,
  },
  {
    key: "admin_console",
    label: "Admin Console",
    description:
      "Therapeutic-area and entitlement administration.",
    defaultGranted: false,
  },
  {
    key: "module_medical_affairs",
    label: "Medical Affairs Module",
    description:
      "Medical Affairs domain intelligence, workflows, and authorized agents.",
    defaultGranted: false,
  },
  {
    key: "module_patient",
    label: "Patient Module",
    description:
      "Patient journey, experience, access, and referral intelligence.",
    defaultGranted: false,
  },
  {
    key: "module_clinical_trials",
    label: "Clinical Trials Module",
    description:
      "Clinical trial, site, investigator, and enrollment intelligence.",
    defaultGranted: false,
  },
  {
    key: "module_corporate_affairs",
    label: "Corporate Affairs Module",
    description:
      "Corporate narrative, stakeholder, and reputation intelligence.",
    defaultGranted: false,
  },
  {
    key: "module_commercial",
    label: "Commercial Module",
    description:
      "Commercial market, customer, and performance intelligence.",
    defaultGranted: false,
  },
  {
    key: "module_competitive",
    label: "Competitive Module",
    description:
      "Competitive landscape, signal, and positioning intelligence.",
    defaultGranted: false,
  },
  {
    key: "module_advocacy",
    label: "Advocacy Module",
    description:
      "Advocacy organization, community, and stakeholder intelligence.",
    defaultGranted: false,
  },
  {
    key:
      "agent_scientific_intelligence_advisor",
    label:
      "Scientific Intelligence Advisor",
    description:
      "Evidence synthesis and scientific landscape workflows.",
    defaultGranted: false,
  },
  {
    key:
      "agent_clinical_trial_companion",
    label:
      "Clinical Trial Companion",
    description:
      "Trial discovery, eligibility, site, and enrollment workflows.",
    defaultGranted: false,
  },
  {
    key:
      "agent_patient_journey_advisor",
    label:
      "Patient Journey Advisor",
    description:
      "Patient journey mapping and unmet-need workflows.",
    defaultGranted: false,
  },
  {
    key:
      "agent_congress_intelligence_advisor",
    label:
      "Congress Intelligence Advisor",
    description:
      "Congress monitoring, planning, and synthesis workflows.",
    defaultGranted: false,
  },
  {
    key:
      "agent_corporate_reputation_advisor",
    label:
      "Corporate Reputation Advisor",
    description:
      "Narrative, stakeholder, and reputation-risk workflows.",
    defaultGranted: false,
  },
  {
    key: "agent_referral_navigator",
    label: "Referral Navigator",
    description:
      "Referral pathway and access-barrier workflows.",
    defaultGranted: false,
  },
  {
    key:
      "agent_medical_information_assistant",
    label:
      "Medical Information Assistant",
    description:
      "Governed medical-information retrieval and response workflows.",
    defaultGranted: false,
  },
  {
    key:
      "agent_pharmacovigilance_assistant",
    label:
      "Pharmacovigilance Assistant",
    description:
      "Potential safety-event detection, triage, and escalation workflows.",
    defaultGranted: false,
  },
  {
    key: "data_package_scientific",
    label:
      "Scientific Data Package",
    description:
      "Licensed scientific literature, trial-registry, and congress data sources.",
    defaultGranted: false,
  },
  {
    key: "data_package_social",
    label:
      "Social Intelligence Data Package",
    description:
      "Licensed social and public-conversation intelligence sources.",
    defaultGranted: false,
  },
  {
    key: "data_package_market",
    label:
      "Market Intelligence Data Package",
    description:
      "Licensed market-research and commercial analytics sources.",
    defaultGranted: false,
  },
  {
    key: "governance_enterprise",
    label:
      "Enterprise Governance",
    description:
      "Advanced governance policy, evaluation, incident, and compliance controls.",
    defaultGranted: false,
  },
];

export function isEntitlementKey(
  value: unknown
): value is EntitlementKey {
  return ENTITLEMENT_KEYS.includes(
    value as EntitlementKey
  );
}
