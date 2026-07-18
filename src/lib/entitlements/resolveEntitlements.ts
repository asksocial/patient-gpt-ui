import {
  ENTITLEMENT_CATALOG,
  ENTITLEMENT_KEYS,
  isEntitlementKey,
  type EntitlementKey,
} from "./catalog";
import type {
  EntitlementMetadata,
  EntitlementResolution,
  EntitlementSource,
} from "./types";

export const ENTITLEMENT_METADATA_KEY =
  "askSocialEntitlements";

export function normalizeEntitlementMetadata(
  value: unknown
): EntitlementMetadata {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return {};
  }

  const input = value as Record<
    string,
    unknown
  >;
  const grants = Array.isArray(
    input.grants
  )
    ? input.grants.filter(
        isEntitlementKey
      )
    : [];
  const denials = Array.isArray(
    input.denials
  )
    ? input.denials.filter(
        isEntitlementKey
      )
    : [];
  const attributes: EntitlementMetadata["attributes"] =
    {};

  if (
    input.attributes &&
    typeof input.attributes ===
      "object"
  ) {
    for (const [key, raw] of
      Object.entries(
        input.attributes as Record<
          string,
          unknown
        >
      )) {
      if (
        isEntitlementKey(key) &&
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw)
      ) {
        attributes[key] = {
          ...(raw as Record<
            string,
            unknown
          >),
        };
      }
    }
  }

  return {
    grants: Array.from(
      new Set(grants)
    ),
    denials: Array.from(
      new Set(denials)
    ),
    attributes,
  };
}

function applyMetadata(
  state: Map<
    EntitlementKey,
    {
      granted: boolean;
      source: EntitlementSource;
      attributes: Record<
        string,
        unknown
      >;
    }
  >,
  metadata: EntitlementMetadata,
  source: "organization" | "user"
) {
  for (const key of
    metadata.grants || []) {
    const existing = state.get(key);
    state.set(key, {
      granted: true,
      source,
      attributes: {
        ...(existing?.attributes || {}),
        ...(metadata.attributes?.[
          key
        ] || {}),
      },
    });
  }

  for (const key of
    metadata.denials || []) {
    const existing = state.get(key);
    state.set(key, {
      granted: false,
      source,
      attributes: {
        ...(existing?.attributes || {}),
        ...(metadata.attributes?.[
          key
        ] || {}),
      },
    });
  }

  for (const [key, attributes] of
    Object.entries(
      metadata.attributes || {}
    )) {
    if (!isEntitlementKey(key)) {
      continue;
    }

    const existing = state.get(key);
    if (existing) {
      existing.attributes = {
        ...existing.attributes,
        ...(attributes || {}),
      };
    }
  }
}

export function resolveEntitlements(params: {
  userId: string;
  organizationId?: string;
  isAdmin?: boolean;
  userMetadata?: unknown;
  organizationMetadata?: unknown;
  knowledgePersistenceEnabled?: boolean;
}): EntitlementResolution {
  const state = new Map<
    EntitlementKey,
    {
      granted: boolean;
      source: EntitlementSource;
      attributes: Record<
        string,
        unknown
      >;
      reason?: string;
    }
  >();

  for (const item of
    ENTITLEMENT_CATALOG) {
    state.set(item.key, {
      granted:
        item.defaultGranted,
      source: "default",
      attributes: {},
    });
  }

  applyMetadata(
    state,
    normalizeEntitlementMetadata(
      params.organizationMetadata
    ),
    "organization"
  );
  applyMetadata(
    state,
    normalizeEntitlementMetadata(
      params.userMetadata
    ),
    "user"
  );

  if (params.isAdmin) {
    for (const key of
      ENTITLEMENT_KEYS) {
      const existing =
        state.get(key);
      state.set(key, {
        granted: true,
        source: "admin",
        attributes:
          existing?.attributes || {},
      });
    }
  }

  if (
    !params.knowledgePersistenceEnabled
  ) {
    const existing = state.get(
      "knowledge_intelligence"
    );
    state.set(
      "knowledge_intelligence",
      {
        granted: false,
        source: "system",
        attributes:
          existing?.attributes || {},
        reason:
          "Knowledge persistence is disabled for this deployment.",
      }
    );
  }

  const capabilities =
    Object.fromEntries(
      ENTITLEMENT_KEYS.map((key) => [
        key,
        {
          key,
          ...state.get(key)!,
        },
      ])
    ) as EntitlementResolution["capabilities"];

  return {
    userId: params.userId,
    organizationId:
      params.organizationId,
    isAdmin: !!params.isAdmin,
    granted: ENTITLEMENT_KEYS.filter(
      (key) =>
        capabilities[key].granted
    ),
    capabilities,
  };
}
