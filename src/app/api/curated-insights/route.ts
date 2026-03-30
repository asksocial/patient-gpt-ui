import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const therapeuticArea = searchParams.get("therapeuticArea");
    const persona = searchParams.get("persona");
    const country = searchParams.get("country");
    const insightType = searchParams.get("insightType");

    if (!therapeuticArea) {
      return NextResponse.json(
        { ok: false, error: "therapeuticArea is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from("curated_insights")
      .select("*")
      .ilike("therapeutic_area", therapeuticArea);

    if (persona) {
      query = query.ilike("persona", `%${persona}%`);
    }

    if (country) {
      query = query.ilike("country", `%${country}%`);
    }

    if (insightType) {
      query = query.ilike("insight_type", `%${insightType}%`);
    }

    const { data, error } = await query.limit(50);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      insights: data || [],
    });
  } catch (error: any) {
    console.error("[curated-insights] error", error);

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}