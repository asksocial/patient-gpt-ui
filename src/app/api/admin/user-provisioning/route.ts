import { getSessionAccess } from "../../../../lib/auth/provisioning/session";
import { createManagedAccount, listUserManagement, updateManagedAccount } from "../../../../lib/auth/provisioning/admin";
import { ProvisioningError } from "../../../../lib/auth/provisioning/store";
import { resolveAdminStatus } from "../../../../lib/auth/isAdmin";

const headers = { "Cache-Control": "private, no-store" };

async function handle(request: Request) {
  try {
    const access = await getSessionAccess();
    const allowed = access?.access === "allowed" && (access.account
      ? access.account.account_role === "platform_admin"
      : await resolveAdminStatus({ userId: access.user.id, publicMetadata: access.user.publicMetadata }));
    if (!allowed) return Response.json({ error: "Platform Admin access is required." }, { status: 403, headers });

    if (request.method === "GET") {
      const page = Number(new URL(request.url).searchParams.get("page") || 0);
      if (!Number.isSafeInteger(page) || page < 0 || page > 10_000) throw new ProvisioningError("Invalid page.");
      return Response.json(await listUserManagement(page), { headers });
    }

    if (!process.env.ASKSOCIAL_APP_ORIGIN ||
      request.headers.get("origin") !== process.env.ASKSOCIAL_APP_ORIGIN ||
      request.headers.get("content-type")?.split(";")[0] !== "application/json") {
      return Response.json({ error: "Invalid request origin or content type." }, { status: 403, headers });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProvisioningError("Invalid request body.");
    const account = request.method === "POST"
      ? await createManagedAccount(access.user.id, body)
      : await updateManagedAccount(access.user.id, body);
    return Response.json({ account }, { headers });
  } catch (error) {
    if (error instanceof ProvisioningError) {
      return Response.json({ error: error.message }, { status: error.status, headers });
    }
    console.error("User provisioning failed", { name: error instanceof Error ? error.name : "Unknown" });
    return Response.json({ error: "User management is temporarily unavailable." }, { status: 503, headers });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
