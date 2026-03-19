import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: activeRows, error: activeErr } = await supabase
      .from("therapeutic_areas")
      .select("name, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (activeErr) {
      return Response.json({ error: activeErr.message }, { status: 500 });
    }

    const { data: accessRows, error: accessErr } = await supabase
      .from("user_therapeutic_access")
      .select("therapeutic_area")
      .eq("clerk_user_id", userId);

    if (accessErr) {
      return Response.json({ error: accessErr.message }, { status: 500 });
    }

    const allowed = new Set(
      (accessRows || []).map((row) => row.therapeutic_area)
    );

    const therapeutic_areas = (activeRows || [])
      .map((row) => row.name)
      .filter((name) => allowed.has(name));

    return Response.json({ therapeutic_areas }, { status: 200 });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}