import { withAdmin } from "../../../../lib/auth/isAdmin";

export const runtime = "nodejs";

export const GET = withAdmin(async () => {
  return Response.json({ ok: true });
});