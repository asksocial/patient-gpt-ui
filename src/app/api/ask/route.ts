import { NextRequest, NextResponse } from "next/server";
import { loadHybridData } from "../../../lib/answers/loadHybridData";
import { composeHybridAnswer } from "../../../lib/answers/composeHybridAnswer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, therapeuticArea } = body;

    if (!question || !therapeuticArea) {
      return NextResponse.json(
        { ok: false, error: "Missing question or therapeuticArea" },
        { status: 400 }
      );
    }

    const { curatedThemes, liveThemes, matches } =
      await loadHybridData(therapeuticArea);

    const answer = await composeHybridAnswer({
      question,
      curatedThemes,
      liveThemes,
      matches,
    });

    return NextResponse.json({
      ok: true,
      answer,
    });
  } catch (error: any) {
    console.error("ASK API ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to generate answer",
      },
      { status: 500 }
    );
  }
}