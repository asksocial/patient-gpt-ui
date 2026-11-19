import {
  clerkClient,
} from "@clerk/nextjs/server";
import {
  getKnowledgePersistenceMode,
} from "../knowledge/mode";
import {
  resolveAdminStatus,
} from "../auth/isAdmin";
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
  const { getManagedTopicScope, getSessionAccess } = await import("../auth/provisioning/session");
  const access = await getSessionAccess();
  if (access?.access !== "allowed") return null;
  const { session: { userId, orgId, sessionClaims }, user, account } = access;
  const client = await clerkClient();
  const publicMetadata =
    objectValue(
      user.publicMetadata
    );
  let organizationMetadata:
    unknown = undefined;

  if (orgId) {
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

  const entitlements = resolveEntitlements({
    userId: user.id,
    organizationId:
      orgId || undefined,
    isAdmin: account ? account.account_role === "platform_admin" :
      await resolveAdminStatus({
        userId,
        sessionClaims,
        publicMetadata,
      }),
    requireExplicitPvGrant: !!account,
    accountRole: account?.account_role,
    userMetadata:
      publicMetadata[
        ENTITLEMENT_METADATA_KEY
      ],
    organizationMetadata,
    knowledgePersistenceEnabled:
      getKnowledgePersistenceMode() ===
      "persistent",
  });
  return { ...entitlements, topicScope: await getManagedTopicScope(access) };
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
