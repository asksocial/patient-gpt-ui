import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (userId !== process.env.ADMIN_CLERK_USER_ID) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("therapeutic_areas")
      .select("name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      areas: (data || []).map((row) => row.name),
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}