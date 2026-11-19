import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "../../supabase/server";
import { getActiveTherapeuticAreas, validateTherapeuticAreaAssignments } from "../../therapeuticAccess/server";
import { isAccountRole, PROVISIONING_MARKER, type ManagedAccount } from "./model";
import { sendProviderInvitation } from "./invitations";
import { verifiedPrimaryEmail } from "./session";
import { changeAccount, findManagedAccount, ProvisioningError } from "./store";

type Clerk = Awaited<ReturnType<typeof clerkClient>>;
const PAGE_SIZE = 50;

function validEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ProvisioningError("Enter a valid email address.");
  }
  return email;
}

async function accessInput(input: Record<string, unknown>) {
  if (!isAccountRole(input.role)) throw new ProvisioningError("Select a valid role.");
  if (!Array.isArray(input.topics) || input.topics.some(topic => typeof topic !== "string")) {
    throw new ProvisioningError("Choose topics from the active catalog.");
  }
  const requested = [...new Set(input.topics)];
  if (input.role === "platform_admin" && requested.length) {
    throw new ProvisioningError("Platform administrators have platform-wide topic access.");
  }
  const catalog = await getActiveTherapeuticAreas();
  try {
    return { role: input.role, topics: validateTherapeuticAreaAssignments(requested, catalog) };
  } catch {
    throw new ProvisioningError("Choose topics from the active catalog.");
  }
}

async function existingRecipient(client: Clerk, email: string, organizationId: string | null) {
  const { data, totalCount } = await client.users.getUserList({ emailAddress: [email], limit: 2 });
  if (!data.length) return null;
  const user = data[0];
  if (totalCount !== 1 || verifiedPrimaryEmail(user) !== email || user.banned || !organizationId ||
    String(user.publicMetadata.role ?? "").trim().toLowerCase() === "admin") {
    throw new ProvisioningError("An existing account requires a separate identity review.", 409);
  }
  const memberships = await client.users.getOrganizationMembershipList({ userId: user.id, limit: 2 });
  const membership = memberships.data.find(item => item.organization.id === organizationId);
  if (memberships.totalCount > (membership ? 1 : 0) || (membership && membership.role !== "org:member")) {
    throw new ProvisioningError("Existing organization access requires a separate identity review.", 409);
  }
  return { user, membership };
}

async function sendInvitation(client: Clerk, actor: string, account: ManagedAccount, replace: boolean) {
  const sending = await changeAccount({ action: "send", actor, account });
  let invitationId: string;
  try {
    invitationId = await sendProviderInvitation(client, account, replace);
  } catch {
    await recordDelivery(actor, sending, "delivery_failed");
    throw new ProvisioningError("Clerk could not confirm invitation delivery. Check the account before retrying.", 502);
  }
  return recordDelivery(actor, sending, "sent", invitationId);
}

async function recordDelivery(actor: string, account: ManagedAccount, action: "sent" | "delivery_failed", invitationId?: string) {
  try {
    return await changeAccount({ action, actor, account, invitationId });
  } catch (error) {
    if (!(error instanceof ProvisioningError) || error.status !== 409) throw error;
    const latest = await findManagedAccount("id", account.id);
    // Acceptance or an access edit may race the external delivery call.
    if (!latest || latest.delivery_started_at !== account.delivery_started_at) throw error;
    return changeAccount({ action, actor, account: latest, invitationId });
  }
}

export async function listUserManagement(page: number) {
  const client = await clerkClient();
  const offset = page * PAGE_SIZE;
  const [accounts, organizations, topics] = await Promise.all([
    getSupabaseServerClient().from("user_provisioning").select("*", { count: "exact" })
      .order("updated_at", { ascending: false }).order("id").range(offset, offset + PAGE_SIZE - 1),
    client.organizations.getOrganizationList({ limit: PAGE_SIZE, offset }),
    getActiveTherapeuticAreas(),
  ]);
  if (accounts.error) throw new ProvisioningError("Accounts could not be loaded.", 503);
  return {
    accounts: accounts.data as ManagedAccount[],
    accountCount: accounts.count ?? 0,
    organizations: organizations.data.map(org => ({ id: org.id, name: org.name })),
    organizationCount: organizations.totalCount,
    pageSize: PAGE_SIZE,
    topics,
  };
}

export async function createManagedAccount(actor: string, input: Record<string, unknown>) {
  const email = validEmail(input.email);
  const { role, topics } = await accessInput(input);
  const organizationId = role === "platform_admin" ? null : typeof input.organizationId === "string" ? input.organizationId : "";
  if (organizationId !== null && !/^org_[a-zA-Z0-9]+$/.test(organizationId)) {
    throw new ProvisioningError("Select an existing organization.");
  }
  if (role === "platform_admin" && input.organizationId) throw new ProvisioningError("Platform administrators are assigned at the platform level.");
  const client = await clerkClient();
  const previous = await findManagedAccount("email", email);
  if (previous) {
    if (previous.organization_id !== organizationId || previous.account_role !== role ||
      previous.topics.length !== topics.length || !topics.every(topic => previous.topics.includes(topic))) {
      throw new ProvisioningError("This email is already managed. Edit its existing account.", 409);
    }
    return previous;
  }
  const [recipient] = await Promise.all([
    existingRecipient(client, email, organizationId),
    organizationId ? client.organizations.getOrganization({ organizationId }) : null,
  ]);
  if (recipient && await findManagedAccount("clerk_user_id", recipient.user.id)) {
    throw new ProvisioningError("This Clerk identity is already managed under a different email.", 409);
  }
  const account = await changeAccount({ action: "reserve", actor, email, organizationId, role, topics, userId: recipient?.user.id });
  if (recipient?.membership) {
    return changeAccount({ action: "activate", actor, account, userId: recipient.user.id });
  }
  return sendInvitation(client, actor, account, false);
}

export async function updateManagedAccount(actor: string, input: Record<string, unknown>) {
  if (typeof input.id !== "string" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(input.id)) {
    throw new ProvisioningError("Select a valid account.");
  }
  const account = await findManagedAccount("id", input.id);
  if (!account) throw new ProvisioningError("Account not found.", 404);
  if (account.revision !== input.revision) throw new ProvisioningError("Account changed. Reload before retrying.", 409);
  if (account.clerk_user_id === actor) throw new ProvisioningError("You cannot change your own account.", 403);
  if (input.action === "update_access") {
    return changeAccount({ action: "update_access", actor, account, ...await accessInput(input) });
  }
  if (input.action === "suspend" || input.action === "restore") {
    return changeAccount({ action: input.action, actor, account });
  }
  if (input.action === "resend" && account.state === "pending") {
    const client = await clerkClient();
    const recipient = await existingRecipient(client, account.email, account.organization_id);
    if (recipient?.membership && (recipient.user.id === account.recipient_clerk_user_id ||
      recipient.membership.publicMetadata[PROVISIONING_MARKER] === account.id)) {
      return changeAccount({ action: "activate", actor, account, userId: recipient.user.id });
    }
    // Failed or interrupted sends can be reconciled against Clerk before another
    // email is sent. Explicit resends replace an already confirmed invitation.
    return sendInvitation(client, actor, account, account.delivery_state === "sent");
  }
  throw new ProvisioningError("This account does not support the requested action.", 409);
}
