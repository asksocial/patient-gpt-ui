import { getCurrentEntitlements } from "../entitlements/server";
import { platformPrincipalFromEntitlements } from "../intelligence-platform";

export async function requirePvPrincipal() {
  const entitlements = await getCurrentEntitlements();
  if (!entitlements) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!entitlements.capabilities.agent_pharmacovigilance_assistant.granted) {
    throw Object.assign(new Error("PV Compliance entitlement required"), { status: 403 });
  }
  return platformPrincipalFromEntitlements(entitlements);
}

export function pvErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "PV operation failed";
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : 400;
  return { message, status: Number.isFinite(status) ? status : 400 };
}
