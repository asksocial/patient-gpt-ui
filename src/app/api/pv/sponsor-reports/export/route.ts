import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../lib/pv/auth";
import { listPvSponsorCases, recordPvSponsorReportActivity } from "../../../../../lib/pv/service";
import { createPvSponsorReport, sponsorReportFileName } from "../../../../../lib/pv/sponsorReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const principal = await requirePvPrincipal();
    const therapeuticArea = request.nextUrl.searchParams.get("therapeuticArea") || undefined;
    const cases = await listPvSponsorCases(principal, therapeuticArea);
    if (!cases.length) return NextResponse.json({ ok: false, error: "No escalated sponsor cases are available for this report." }, { status: 404 });
    const report = await createPvSponsorReport({ cases, therapeuticArea, generatedBy: principal.actorId });
    await recordPvSponsorReportActivity(principal, {
      action: "export",
      therapeuticArea,
      caseIds: cases.map((item: any) => item.id),
      reportHash: report.hash,
    });
    return new NextResponse(Buffer.from(report.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sponsorReportFileName(therapeuticArea)}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
