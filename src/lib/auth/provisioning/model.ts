export const ACCOUNT_ROLES = {
  platform_admin: "Platform Admin",
  client_admin: "Client Admin",
  client_analyst: "Client Analyst",
  viewer: "Read-Only Viewer",
} as const;

export const PROVISIONING_MARKER = "askSocialProvisioningId";
export type AccountRole = keyof typeof ACCOUNT_ROLES;
export type ManagedAccount = {
  id: string;
  email: string;
  clerk_user_id: string | null;
  recipient_clerk_user_id: string | null;
  organization_id: string | null;
  account_role: AccountRole;
  state: "pending" | "active" | "suspended";
  topics: string[];
  invitation_id: string | null;
  delivery_state: "unsent" | "sending" | "sent" | "failed";
  delivery_started_at: string | null;
  revision: number;
};

export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === "string" && Object.hasOwn(ACCOUNT_ROLES, value);
}

export function hasInvitationProof(
  account: ManagedAccount,
  user: { id: string; banned: boolean; verifiedEmail?: string; marker?: unknown },
  membership?: { organizationId: string; marker?: unknown },
) {
  if (account.state !== "pending" || user.banned || user.verifiedEmail !== account.email) return false;
  if (account.recipient_clerk_user_id && account.recipient_clerk_user_id !== user.id) return false;
  return account.organization_id
    ? membership?.organizationId === account.organization_id && membership.marker === account.id
    : user.marker === account.id;
}

export function accountAccess(account: ManagedAccount, organizationId?: string, member = false) {
  if (account.state !== "active") return account.state;
  if (account.organization_id && (!member || account.organization_id !== organizationId)) return "organization_required";
  if (!account.organization_id && organizationId && !member) return "organization_required";
  return "allowed";
}

export function permitsManagedRequest(role: AccountRole, pathname: string, method: string) {
  if (role === "platform_admin") return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) return false;
  if (pathname.startsWith("/api/themes/")) return false;
  if (pathname === "/api/workspaces/members" && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    return role === "client_admin";
  }
  if (role !== "viewer" || !pathname.startsWith("/api/")) return true;
  if (pathname.endsWith("/export")) return false;
  // These POST endpoints query existing intelligence without saving user content.
  return ["GET", "HEAD", "OPTIONS"].includes(method) ||
    (method === "POST" && ["/api/knowledge/compare", "/api/ask", "/api/executive/brief"].includes(pathname));
}
