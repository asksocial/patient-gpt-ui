import { NextRequest, NextResponse } from "next/server";
import { extractNoiseThemes } from "../../../../lib/themes/extractNoiseThemes";
import { saveNoiseThemes } from "../../../../lib/themes/saveNoiseThemes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { therapeuticArea, quarter, mentions } = body;

    if (!therapeuticArea || !Array.isArray(mentions)) {
      return NextResponse.json(
        { error: "therapeuticArea and mentions are required" },
        { status: 400 }
      );
    }

    const extracted = await extractNoiseThemes(mentions);
    const saved = await saveNoiseThemes({
      therapeuticArea,
      quarter,
      themes: extracted,
    });

    return NextResponse.json({
      ok: true,
      extractedCount: extracted.length,
      savedCount: saved.length,
      themes: saved,
    });
  } catch (error) {
    console.error("POST /api/themes/noise error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to extract noise themes";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}