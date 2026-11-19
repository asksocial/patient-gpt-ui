import { getSupabaseServerClient } from "../../supabase/server";
import type { AccountRole, ManagedAccount } from "./model";

export class ProvisioningError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function findManagedAccount(column: "id" | "email" | "clerk_user_id", value: string) {
  const { data, error } = await getSupabaseServerClient().from("user_provisioning").select("*").eq(column, value).maybeSingle();
  if (error) throw new ProvisioningError("Account access could not be verified.", 503);
  return data as ManagedAccount | null;
}

export async function changeAccount(input: {
  action: "reserve" | "send" | "sent" | "delivery_failed" | "activate" | "update_access" | "suspend" | "restore";
  actor: string;
  account?: ManagedAccount;
  email?: string;
  organizationId?: string | null;
  role?: AccountRole;
  topics?: string[];
  userId?: string;
  invitationId?: string;
}) {
  const { data, error } = await getSupabaseServerClient().rpc("change_user_provisioning", {
    p_action: input.action,
    p_actor: input.actor,
    p_id: input.account?.id ?? null,
    p_revision: input.account?.revision ?? null,
    p_email: input.email ?? null,
    p_org: input.organizationId ?? null,
    p_role: input.role ?? null,
    p_topics: input.topics ?? null,
    p_user: input.userId ?? null,
    p_invitation: input.invitationId ?? null,
  });
  if (error?.code === "23505" || error?.code === "40001") {
    throw new ProvisioningError("An account already exists or changed. Reload before retrying.", 409);
  }
  if (error?.code === "42501") throw new ProvisioningError("Active Platform Admin access is required.", 403);
  if (error?.code === "P0001") throw new ProvisioningError(error.message, 409);
  if (error || !data) throw new ProvisioningError("The account change could not be saved.", 503);
  return data as ManagedAccount;
}
