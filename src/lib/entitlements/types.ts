import type {
  EntitlementKey,
} from "./catalog";

export type EntitlementMetadata = {
  grants?: EntitlementKey[];
  denials?: EntitlementKey[];
  attributes?: Partial<
    Record<
      EntitlementKey,
      Record<string, unknown>
    >
  >;
};

export type EntitlementSource =
  | "default"
  | "organization"
  | "user"
  | "admin"
  | "system";

export type ResolvedCapability = {
  key: EntitlementKey;
  granted: boolean;
  source: EntitlementSource;
  attributes: Record<
    string,
    unknown
  >;
  reason?: string;
};

export type EntitlementResolution = {
  userId: string;
  organizationId?: string;
  isAdmin: boolean;
  granted: EntitlementKey[];
  capabilities: Record<
    EntitlementKey,
    ResolvedCapability
  >;
};
