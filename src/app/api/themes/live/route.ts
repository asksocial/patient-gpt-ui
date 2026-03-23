import { NextRequest, NextResponse } from "next/server";
import { extractLiveThemes } from "../../../../lib/themes/extractLiveThemes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "rows are required" },
        { status: 400 }
      );
    }

    const themes = await extractLiveThemes({ rows });

    return NextResponse.json({
      ok: true,
      themes,
    });
  } catch (error) {
    console.error("POST /api/themes/live error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to extract live themes";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}