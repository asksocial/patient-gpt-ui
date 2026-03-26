import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("curated_themes")
      .select("therapeutic_area");

    if (error) {
      throw new Error(error.message);
    }

    const uniqueAreas = Array.from(
      new Set((data ?? []).map((row) => row.therapeutic_area).filter(Boolean))
    ).sort();

    return NextResponse.json({
      ok: true,
      therapeuticAreas: uniqueAreas,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to load therapeutic areas",
      },
      { status: 500 }
    );
  }
}