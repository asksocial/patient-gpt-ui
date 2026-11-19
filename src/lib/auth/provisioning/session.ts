import "server-only";

import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getScopedSupabaseClient } from "../../supabase/server";
import { accountAccess, hasInvitationProof, PROVISIONING_MARKER } from "./model";
import { changeAccount, findManagedAccount, ProvisioningError } from "./store";

type Clerk = Awaited<ReturnType<typeof clerkClient>>;
type ClerkUser = Awaited<ReturnType<Clerk["users"]["getUser"]>>;

export function verifiedPrimaryEmail(user: ClerkUser) {
  const email = user.primaryEmailAddress;
  return email?.verification?.status === "verified" ? email.emailAddress.trim().toLowerCase() : undefined;
}

export async function readSessionAccess(userId: string, organizationId?: string | null) {
  const client = await clerkClient();
  const [user, boundAccount] = await Promise.all([
    client.users.getUser(userId),
    findManagedAccount("clerk_user_id", userId),
  ]);
  const email = verifiedPrimaryEmail(user);
  const marker = user.publicMetadata[PROVISIONING_MARKER];
  let account = boundAccount || (email ? await findManagedAccount("email", email) : null);
  // Membership metadata is authoritative even if the primary email changed
  // between accepting an invitation and the first AskSocial session.
  const membershipOrg = account?.organization_id || organizationId;
  const memberships = [];
  if (membershipOrg || !boundAccount) {
    for (let offset = 0; ; offset += 100) {
      const page = await client.users.getOrganizationMembershipList({ userId, limit: 100, offset });
      memberships.push(...page.data);
      if (!page.data.length || offset + page.data.length >= page.totalCount ||
        (boundAccount && page.data.some(item => item.organization.id === membershipOrg))) break;
    }
  }
  const membership = memberships.find(item => item.organization.id === membershipOrg);
  const membershipMarker = memberships.some(item => item.publicMetadata[PROVISIONING_MARKER]);
  if (!account) return { user, account: null, access: user.banned || marker || membershipMarker ? "blocked" : "allowed" };

  // Invitations for existing users leave their current access in place until
  // the recipient accepts, or an administrator adopts a verified member.
  if (!boundAccount) {
    const proof = hasInvitationProof(account, { id: userId, banned: user.banned, verifiedEmail: email, marker },
      membership ? { organizationId: membership.organization.id, marker: membership.publicMetadata[PROVISIONING_MARKER] } : undefined);
    if (!proof) {
      const hasProviderMarker = marker || membershipMarker;
      return { user, account: null, access: user.banned || hasProviderMarker || account.recipient_clerk_user_id !== userId ? "blocked" : "allowed" };
    }
    try {
      account = await changeAccount({ action: "activate", actor: userId, account, userId });
    } catch (error) {
      if (!(error instanceof ProvisioningError) || error.status !== 409) throw error;
      account = await findManagedAccount("clerk_user_id", userId);
      if (!account) return { user, account: null, access: "blocked" };
    }
  }

  return {
    user,
    account,
    access: user.banned ? "blocked" : accountAccess(account, organizationId || undefined, Boolean(membership)),
  };
}

export const getSessionAccess = cache(async () => {
  const session = await auth();
  if (!session.userId) return null;
  return { ...await readSessionAccess(session.userId, session.orgId), session };
});

export async function getManagedTopicScope(access: Awaited<ReturnType<typeof getSessionAccess>>) {
  if (access?.access !== "allowed") throw new ProvisioningError("Account access is unavailable.", 403);
  if (!access.account?.organization_id) return undefined;

  const token = await access.session.getToken();
  if (!token) throw new ProvisioningError("Account access is unavailable.", 403);
  const { data, error } = await getScopedSupabaseClient(token).from("user_therapeutic_access")
    .select("therapeutic_area")
    .eq("clerk_user_id", access.user.id)
    .eq("organization_id", access.account.organization_id);
  if (error) throw new ProvisioningError("Topic grants could not be verified.", 503);
  return data.map(row => String(row.therapeutic_area));
}
