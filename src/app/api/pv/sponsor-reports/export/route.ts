import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../lib/pv/auth";
import { listPvQaNotRelevantCases, listPvSponsorCases, recordPvSponsorReportActivity } from "../../../../../lib/pv/service";
import { createPvSponsorReport, sponsorReportFileName } from "../../../../../lib/pv/sponsorReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const principal = await requirePvPrincipal();
    const therapeuticArea = request.nextUrl.searchParams.get("therapeuticArea") || undefined;
    const mode = request.nextUrl.searchParams.get("mode") === "qa_not_relevant" ? "qa_not_relevant" : "sponsor_handoff";
    const cases = mode === "qa_not_relevant"
      ? await listPvQaNotRelevantCases(principal, therapeuticArea)
      : await listPvSponsorCases(principal, therapeuticArea);
    if (!cases.length) return NextResponse.json({ ok: false, error: mode === "qa_not_relevant" ? "No closed Not Relevant reviews are available for QA export." : "No escalated sponsor cases are available for this report." }, { status: 404 });
    const report = await createPvSponsorReport({ cases, therapeuticArea, generatedBy: principal.actorId, mode });
    await recordPvSponsorReportActivity(principal, {
      action: mode === "qa_not_relevant" ? "qa_export" : "export",
      therapeuticArea,
      caseIds: cases.map((item: any) => item.id),
      reportHash: report.hash,
    });
    return new NextResponse(Buffer.from(report.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sponsorReportFileName(therapeuticArea, mode)}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
