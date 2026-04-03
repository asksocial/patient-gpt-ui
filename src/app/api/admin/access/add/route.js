import { createClient } from "@supabase/supabase-js";
import { withAdmin } from "@/lib/auth/isAdmin";

export const runtime = "nodejs";

export const POST = withAdmin(async (req) => {
  try {
    const body = await req.json();
    const { clerk_user_id, therapeutic_area } = body || {};

    if (!clerk_user_id || !therapeutic_area) {
      return Response.json(
        { error: "Missing clerk_user_id or therapeutic_area" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from("user_therapeutic_access")
      .insert({
        clerk_user_id,
        therapeutic_area: therapeutic_area.trim(),
      });

    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
});