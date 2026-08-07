import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { listPvScreeningRuns, recordPvScreeningRun } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ ok: true, runs: await listPvScreeningRuns(await requirePvPrincipal()) }); }
  catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const run = await recordPvScreeningRun(await requirePvPrincipal(), {
      sourceId: String(body?.sourceId || ""), screenedFrom: String(body?.screenedFrom || ""), screenedUntil: String(body?.screenedUntil || ""),
      itemsScreened: Number(body?.itemsScreened || 0), potentialRecords: Number(body?.potentialRecords || 0),
      nilReturn: Boolean(body?.nilReturn), querySnapshot: body?.querySnapshot, status: body?.status, error: body?.error,
    });
    return NextResponse.json({ ok: true, run }, { status: 201 });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
