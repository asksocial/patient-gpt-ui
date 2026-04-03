import { createClient } from "@supabase/supabase-js";
import { withAdmin } from "../../../../lib/auth/isAdmin";

export const runtime = "nodejs";

export const GET = withAdmin(async () => {
  try {
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
});