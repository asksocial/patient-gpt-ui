export const ENTITLEMENT_KEYS = [
  "platform_core",
  "theme_intelligence",
  "longitudinal_intelligence",
  "knowledge_intelligence",
  "executive_intelligence",
  "exports",
  "admin_console",
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
];

export function isEntitlementKey(
  value: unknown
): value is EntitlementKey {
  return ENTITLEMENT_KEYS.includes(
    value as EntitlementKey
  );
}
