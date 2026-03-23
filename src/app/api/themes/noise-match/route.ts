import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { matchThemes } from "../../../../lib/themes/matchThemes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { therapeuticArea } = body;

    if (!therapeuticArea) {
      return NextResponse.json(
        { error: "therapeuticArea is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: curatedThemes, error: curatedError } = await supabase
      .from("curated_themes")
      .select("theme_name, theme_description")
      .eq("therapeutic_area", therapeuticArea);

    if (curatedError) {
      throw new Error(curatedError.message);
    }

    const { data: liveThemes, error: liveError } = await supabase
      .from("live_themes")
      .select("theme_name, theme_description, source_type, mention_count, engagement_sum, confidence")
      .eq("therapeutic_area", therapeuticArea)
      .eq("source_type", "noise_llm");

    if (liveError) {
      throw new Error(liveError.message);
    }

    const matches = await matchThemes({
      curatedThemes: curatedThemes ?? [],
      liveThemes: liveThemes ?? [],
    });

    const rows = matches.map((m) => ({
      therapeutic_area: therapeuticArea,
      live_theme_name: m.live_theme_name,
      curated_theme_name: m.curated_theme_name,
      relationship: m.relationship,
      similarity_score: m.similarity_score,
      rationale: m.rationale,
      confidence: m.confidence,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("theme_matches")
      .insert(rows)
      .select();

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      ok: true,
      matches: inserted,
    });
  } catch (error) {
    console.error("POST /api/themes/noise-match error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to match noise themes";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}