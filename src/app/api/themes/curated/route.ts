import { NextRequest, NextResponse } from "next/server";
import { extractCuratedThemes } from "../../../../lib/themes/extractCuratedThemes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { therapeuticArea, quarter, reportText } = body;

    if (!therapeuticArea || !reportText) {
      return NextResponse.json(
        { error: "therapeuticArea and reportText are required" },
        { status: 400 }
      );
    }

    const themes = await extractCuratedThemes({
      therapeuticArea,
      quarter,
      reportText,
    });

    return NextResponse.json({
      ok: true,
      themes,
    });
    } catch (error) {
    console.error("POST /api/themes/curated error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to extract curated themes";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}