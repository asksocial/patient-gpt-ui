import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing Supabase environment variables",
          therapeuticAreas: [],
        },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("therapeutic_areas")
      .select("name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[/api/therapeutic-areas] supabase error", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load therapeutic areas",
          therapeuticAreas: [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      therapeuticAreas: (data || [])
        .map((row) => row.name)
        .filter(Boolean),
    });
  } catch (error) {
    console.error("[/api/therapeutic-areas] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load therapeutic areas",
        therapeuticAreas: [],
      },
      { status: 500 }
    );
  }
}