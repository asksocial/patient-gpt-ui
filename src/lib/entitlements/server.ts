import {
  auth,
  clerkClient,
} from "@clerk/nextjs/server";
import {
  getKnowledgePersistenceMode,
} from "../knowledge/mode";
import {
  ENTITLEMENT_METADATA_KEY,
  resolveEntitlements,
} from "./resolveEntitlements";
import type {
  EntitlementKey,
} from "./catalog";

function objectValue(
  value: unknown
): Record<string, unknown> {
  return value &&
    typeof value === "object"
    ? (value as Record<
        string,
        unknown
      >)
    : {};
}

export async function getCurrentEntitlements() {
  const {
    userId,
    orgId,
    sessionClaims,
  } = await auth();

  if (!userId) {
    return null;
  }

  const publicMetadata = objectValue(
    objectValue(sessionClaims)
      .publicMetadata
  );
  let organizationMetadata:
    unknown = undefined;

  if (orgId) {
    const client =
      await clerkClient();
    const organization =
      await client.organizations.getOrganization(
        {
          organizationId: orgId,
        }
      );
    organizationMetadata =
      objectValue(
        organization.publicMetadata
      )[ENTITLEMENT_METADATA_KEY];
  }

  return resolveEntitlements({
    userId,
    organizationId:
      orgId || undefined,
    isAdmin:
      publicMetadata.role ===
      "admin",
    userMetadata:
      publicMetadata[
        ENTITLEMENT_METADATA_KEY
      ],
    organizationMetadata,
    knowledgePersistenceEnabled:
      getKnowledgePersistenceMode() ===
      "persistent",
  });
}

export async function hasCurrentEntitlement(
  entitlement: EntitlementKey
) {
  const resolved =
    await getCurrentEntitlements();

  return !!resolved?.capabilities[
    entitlement
  ].granted;
}
