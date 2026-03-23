import { NextRequest, NextResponse } from "next/server";
import { matchThemes } from "../../../../lib/themes/matchThemes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { curatedThemes, liveThemes } = body;

    if (!Array.isArray(curatedThemes) || !Array.isArray(liveThemes)) {
      return NextResponse.json(
        { error: "curatedThemes and liveThemes are required" },
        { status: 400 }
      );
    }

    const matches = await matchThemes({
      curatedThemes,
      liveThemes,
    });

    return NextResponse.json({
      ok: true,
      matches,
    });
  } catch (error) {
    console.error("POST /api/themes/compare error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to compare themes";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}