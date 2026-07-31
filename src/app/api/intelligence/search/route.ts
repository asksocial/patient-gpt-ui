import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import {
  configurationFromEntitlements,
  platformPrincipalFromEntitlements,
  resolveCustomerIntelligenceAccess,
  searchAcrossWorkspaces,
} from "../../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (!query) return NextResponse.json({ ok: false, error: "q is required" }, { status: 400 });
    const access = resolveCustomerIntelligenceAccess(configurationFromEntitlements(entitlements));
    const results = await searchAcrossWorkspaces(
      platformPrincipalFromEntitlements(entitlements),
      { query, moduleIds: access.modules.map((module) => module.id) }
    );
    return NextResponse.json({ ok: true, query, results });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Search failed" }, { status: 500 });
  }
}
