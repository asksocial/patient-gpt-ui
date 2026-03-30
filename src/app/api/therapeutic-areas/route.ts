import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const areas = new Set<string>();

    const [curatedThemesRes, liveThemesRes, curatedInsightsRes] =
      await Promise.all([
        supabase.from("curated_themes").select("therapeutic_area"),
        supabase.from("live_themes").select("therapeutic_area"),
        supabase.from("curated_insights").select("therapeutic_area"),
      ]);

    if (curatedThemesRes.error) {
      console.warn(
        "[/api/therapeutic-areas] curated_themes warning:",
        curatedThemesRes.error.message
      );
    } else {
      (curatedThemesRes.data || []).forEach((row) => {
        if (row?.therapeutic_area) {
          areas.add(row.therapeutic_area);
        }
      });
    }

    if (liveThemesRes.error) {
      console.warn(
        "[/api/therapeutic-areas] live_themes warning:",
        liveThemesRes.error.message
      );
    } else {
      (liveThemesRes.data || []).forEach((row) => {
        if (row?.therapeutic_area) {
          areas.add(row.therapeutic_area);
        }
      });
    }

    if (curatedInsightsRes.error) {
      console.warn(
        "[/api/therapeutic-areas] curated_insights warning:",
        curatedInsightsRes.error.message
      );
    } else {
      (curatedInsightsRes.data || []).forEach((row) => {
        if (row?.therapeutic_area) {
          areas.add(row.therapeutic_area);
        }
      });
    }

    const therapeuticAreas = Array.from(areas).sort((a, b) =>
      a.localeCompare(b)
    );

    return NextResponse.json({
      ok: true,
      therapeuticAreas,
    });
  } catch (error: any) {
    console.error("[/api/therapeutic-areas] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load therapeutic areas",
      },
      { status: 500 }
    );
  }
}