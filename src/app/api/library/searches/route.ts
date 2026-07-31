import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { listSavedSearches, platformPrincipalFromEntitlements, saveSearch } from "../../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: true, searches: await listSavedSearches(platformPrincipalFromEntitlements(entitlements)) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const search = await saveSearch(platformPrincipalFromEntitlements(entitlements), {
      name: String(body?.name || ""), query: String(body?.query || ""), workspaceId: body?.workspaceId,
      filters: body?.filters, isShared: Boolean(body?.isShared),
    });
    return NextResponse.json({ ok: true, search }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
