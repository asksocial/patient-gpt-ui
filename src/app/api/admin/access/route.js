import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (userId !== process.env.ADMIN_CLERK_USER_ID) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { clerk_user_id } = body || {};

    if (!clerk_user_id) {
      return Response.json({ error: "Missing clerk_user_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("user_therapeutic_access")
      .select("therapeutic_area")
      .eq("clerk_user_id", clerk_user_id)
      .order("therapeutic_area", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      clerk_user_id,
      therapeutic_areas: (data || []).map((row) => row.therapeutic_area),
    });
  } catch (err) {
    console.error("admin/access error:", err);
    return Response.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}