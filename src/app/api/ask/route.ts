import { NextRequest, NextResponse } from "next/server";
import { loadHybridData } from "../../../lib/answers/loadHybridData";
import { composeHybridAnswer } from "../../../lib/answers/composeHybridAnswer";
import { getRelevantCuratedInsights } from "../../../lib/curated/getRelevantCuratedInsights";

export const dynamic = "force-dynamic";

function normalizeCuratedThemes(items: any[] = []) {
  return items.map((item) => ({
    name: item?.name ?? item?.theme_name ?? "Unnamed theme",
    description:
      item?.description ??
      item?.theme_description ??
      item?.report_excerpt ??
      "",
  }));
}

function normalizeLiveThemes(items: any[] = []) {
  return items.map((item) => ({
    name: item?.name ?? item?.theme_name ?? "Unnamed live theme",
    description:
      item?.description ??
      item?.theme_description ??
      item?.summary ??
      "",
    sourceType: item?.sourceType ?? item?.source_type ?? undefined,
    relationship: item?.relationship ?? undefined,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = body?.question?.trim();
    const therapeuticArea = body?.therapeuticArea?.trim();

    if (!question) {
      return NextResponse.json(
        { ok: false, error: "question is required" },
        { status: 400 }
      );
    }

    if (!therapeuticArea) {
      return NextResponse.json(
        { ok: false, error: "therapeuticArea is required" },
        { status: 400 }
      );
    }

    const hybridData = await loadHybridData(therapeuticArea);

    const curatedThemes = normalizeCuratedThemes(hybridData?.curatedThemes || []);
    const liveThemes = normalizeLiveThemes(hybridData?.liveThemes || []);
    const matches = hybridData?.matches || [];

    const curatedInsights = await getRelevantCuratedInsights({
      therapeuticArea,
      question,
    });

    const answer = await composeHybridAnswer({
      question,
      therapeuticArea,
      curatedThemes,
      liveThemes,
      matches,
      curatedInsights,
    });

    return NextResponse.json({
      ok: true,
      answer,
      relevantCuratedInsights: curatedInsights,
      debug: {
        curatedThemesCount: curatedThemes.length,
        liveThemesCount: liveThemes.length,
        matchesCount: matches.length,
        curatedInsightsCount: curatedInsights.length,
      },
    });
  } catch (error: any) {
    console.error("[/api/ask] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate AskSocial answer",
      },
      { status: 500 }
    );
  }
}