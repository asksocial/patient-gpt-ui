import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../../lib/pv/auth";
import { getCurrentEntitlements } from "../../../../../../lib/entitlements/server";
import { hasTherapeuticAreaAccess } from "../../../../../../lib/therapeuticAccess/server";
import { appendPvAuditEvent } from "../../../../../../lib/pv/service";
import { getGlp1HeldTriage, includeHeldGlp1Candidates } from "../../../../../../lib/pv/glp1/triageService";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function principal() {
  const identity = await requirePvPrincipal();
  const entitlement = await getCurrentEntitlements();
  if (!entitlement || !await hasTherapeuticAreaAccess(entitlement.userId, "GLP-1", entitlement.isAdmin)) throw Object.assign(new Error("GLP-1 topic access required."), { status: 403 });
  return identity;
}
export async function GET(request: NextRequest) {
  try {
    const identity = await principal();
    const { assessment } = await getGlp1HeldTriage(identity);
    const status = request.nextUrl.searchParams.get("status") || "all";
    const signalOnly = request.nextUrl.searchParams.get("signalOnly") === "true";
    const page = Math.max(1, Math.min(10000, Math.floor(Number(request.nextUrl.searchParams.get("page")) || 1)));
    const rows = assessment.rows.filter(row => (status === "all" || row.status === status) && (!signalOnly || row.priority === "high")).sort((a,b) => ({ high: 0, standard: 1, low: 2 }[a.priority] - { high: 0, standard: 1, low: 2 }[b.priority]) || a.rowNumber - b.rowNumber);
    const { rows: _allRows, ...summary } = assessment;
    return NextResponse.json({ ok: true, assessment: summary, rows: rows.slice((page-1)*25, page*25), page, pageSize: 25, matchedCount: rows.length });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function POST(request: NextRequest) {
  try {
    const identity = await principal();
    const body = await request.json();
    if (body.action === "assess") {
      const { assessment } = await getGlp1HeldTriage(identity);
      await appendPvAuditEvent(identity, { action: "held_triage.assessed", resourceType: "source_corpus", resourceId: assessment.assessmentHash, outcome: "completed", metadata: { assessmentHash: assessment.assessmentHash, triageVersion: assessment.triageVersion, sourceFileHash: assessment.sourceFileHash, assessedHeldCount: assessment.assessedHeldCount, statusCounts: assessment.statusCounts, prioritizedCount: assessment.prioritizedCount, ruleBasis: assessment.ruleBasis, libraryId: assessment.libraryId, libraryVersion: assessment.libraryVersion } });
      return NextResponse.json({ ok: true, message: `${assessment.assessedHeldCount.toLocaleString()} held rows assessed. ${assessment.statusCounts.eligible_english_candidate + assessment.statusCounts.eligible_source_candidate} English candidates meet active-rule or provisional source-episode triage criteria; ${assessment.prioritizedCount} rows have product/reaction cues prioritized for review.` });
    }
    if (body.action === "include") return NextResponse.json({ ok: true, import: await includeHeldGlp1Candidates(identity, body) });
    throw new Error("Choose assess or include.");
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
