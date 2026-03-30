import { NextRequest, NextResponse } from "next/server";
import { loadHybridData } from "../../../lib/answers/loadHybridData";
import { composeHybridAnswer } from "../../../lib/answers/composeHybridAnswer";
import { getRelevantCuratedInsights } from "../../../lib/curated/getRelevantCuratedInsights";

export const dynamic = "force-dynamic";

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

    const {
      curatedThemes = [],
      liveThemes = [],
      matches = [],
    } = await loadHybridData({
      therapeuticArea,
      question,
    });

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