import { NextRequest, NextResponse } from "next/server";
import { loadCuratedInsights } from "../../../lib/curated/loadCuratedInsights";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const therapeuticArea =
      req.nextUrl.searchParams.get("therapeuticArea") || "";
    const insightType = req.nextUrl.searchParams.get("insightType") || "";
    const country = req.nextUrl.searchParams.get("country") || "";
    const persona = req.nextUrl.searchParams.get("persona") || "";
    const platform = req.nextUrl.searchParams.get("platform") || "";

    console.log("[curated-insights] params", {
      therapeuticArea,
      insightType,
      country,
      persona,
      platform,
    });

    if (!therapeuticArea) {
      return NextResponse.json(
        { ok: false, error: "therapeuticArea is required" },
        { status: 400 }
      );
    }

    const insights = await loadCuratedInsights({
      therapeuticArea,
      insightTypes: insightType ? [insightType] : undefined,
      country: country || undefined,
      persona: persona || undefined,
      platform: platform || undefined,
      limit: 100,
    });

    console.log("[curated-insights] loaded", insights?.length ?? 0);

    return NextResponse.json({
      ok: true,
      insights,
    });
  } catch (error: any) {
    console.error("[curated-insights] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load curated insights",
      },
      { status: 500 }
    );
  }
}