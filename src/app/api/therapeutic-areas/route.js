import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("therapeutic_area")
      .not("therapeutic_area", "is", null);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const therapeutic_areas = [...new Set((data || []).map((row) => row.therapeutic_area))]
      .filter(Boolean)
      .sort();

    return Response.json({ therapeutic_areas }, { status: 200 });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}