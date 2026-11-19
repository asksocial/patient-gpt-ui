import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../lib/entitlements/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
import { permitsTopic } from "../../../lib/therapeuticAccess/scope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const access = await getCurrentEntitlements();
    if (!access) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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

    const topic = access.topicScope?.find(grant => permitsTopic([grant], therapeuticArea));
    if (access.topicScope && !topic) return NextResponse.json({ error: "Topic access is required." }, { status: 403 });

    let query = getSupabaseServerClient().from("curated_insights").select("*");
    query = topic ? query.eq("therapeutic_area", topic) : query.ilike("therapeutic_area", therapeuticArea);

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