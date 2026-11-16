import { NextRequest, NextResponse } from "next/server";
import { buildAskStarters } from "../../../../config/askStarters";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { hasTherapeuticAreaAccess } from "../../../../lib/therapeuticAccess/server";
import { loadCanonicalFindingsForAsk } from "../../../../lib/answers/loadCanonicalFindingsForAsk";
import { sourceCountryLabel } from "../../../../answering/search/geography";
import { listIntelligenceWorkProducts, platformPrincipalFromEntitlements } from "../../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const access = await getCurrentEntitlements();
    if (!access) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers });
    if (!access.capabilities.platform_core?.granted && !access.isAdmin) return NextResponse.json({ ok: false, error: "Platform access is required." }, { status: 403, headers });
    const topic = request.nextUrl.searchParams.get("therapeuticArea")?.trim() || "";
    if (!topic || topic.length > 200) return NextResponse.json({ ok: false, error: "A supported topic is required." }, { status: 400, headers });
    if (!await hasTherapeuticAreaAccess(access.userId, topic, access.isAdmin)) return NextResponse.json({ ok: false, error: "Topic access is required." }, { status: 403, headers });
    const corpus = loadCanonicalFindingsForAsk(topic);
    const counts = new Map<string, number>();
    for (const finding of corpus.findings) {
      const market = sourceCountryLabel(finding.rawMetadata?.fields?.Country || finding.countries?.[0]);
      if (market && !/unknown|unspecified|other/i.test(market)) counts.set(market, (counts.get(market) || 0) + 1);
    }
    const topMarkets = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2).map(([market]) => market);
    // Report lookup uses the same workspace authorization as saved intelligence.
    const reports = await listIntelligenceWorkProducts(platformPrincipalFromEntitlements(access), {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") || undefined,
      therapeuticArea: topic, kind: "report", limit: 1,
    });
    return NextResponse.json({ ok: true, therapeuticArea: topic, starters: buildAskStarters(topic, { topMarkets, hasPreviousReport: reports.length > 0 }) }, { headers });
  } catch {
    return NextResponse.json({ ok: false, error: "Starter questions could not be loaded." }, { status: 500, headers });
  }
}
