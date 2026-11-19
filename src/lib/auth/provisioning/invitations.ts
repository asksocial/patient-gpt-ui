import type { clerkClient } from "@clerk/nextjs/server";
import { PROVISIONING_MARKER, type ManagedAccount } from "./model";

type Clerk = Awaited<ReturnType<typeof clerkClient>>;
export type InvitationProvider = {
  organizations: Pick<Clerk["organizations"], "getOrganizationInvitationList" | "revokeOrganizationInvitation" | "createOrganizationInvitation">;
  invitations: Pick<Clerk["invitations"], "getInvitationList" | "revokeInvitation" | "createInvitation">;
};
const INVITATION_DAYS = 7;

async function pendingOrganizationInvitations(client: InvitationProvider, organizationId: string, account: ManagedAccount) {
  const matches = [];
  for (let offset = 0; ; offset += 100) {
    const { data, totalCount } = await client.organizations.getOrganizationInvitationList({
      organizationId, status: ["pending"], limit: 100, offset,
    });
    matches.push(...data.filter(invitation => invitation.publicMetadata?.[PROVISIONING_MARKER] === account.id));
    if (!data.length || offset + data.length >= totalCount) return matches;
  }
}

export async function sendProviderInvitation(client: InvitationProvider, account: ManagedAccount, replace: boolean) {
  const metadata = { [PROVISIONING_MARKER]: account.id };
  if (account.organization_id) {
    const organizationId = account.organization_id;
    const previous = await pendingOrganizationInvitations(client, organizationId, account);
    if (replace) {
      for (const invitation of previous) {
        await client.organizations.revokeOrganizationInvitation({ organizationId, invitationId: invitation.id });
      }
    }
    const invitation = (!replace && previous[0]) || await client.organizations.createOrganizationInvitation({
      organizationId, emailAddress: account.email, role: "org:member", publicMetadata: metadata,
      expiresInDays: INVITATION_DAYS,
    });
    return invitation.id;
  }
  const { data } = await client.invitations.getInvitationList({ query: account.email, status: "pending", limit: 100 });
  const previous = data.filter(invitation => invitation.publicMetadata?.[PROVISIONING_MARKER] === account.id);
  if (replace) {
    for (const invitation of previous) await client.invitations.revokeInvitation(invitation.id);
  }
  const invitation = (!replace && previous[0]) || await client.invitations.createInvitation({
    emailAddress: account.email, publicMetadata: metadata, expiresInDays: INVITATION_DAYS,
  });
  return invitation.id;
}
