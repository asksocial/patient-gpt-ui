import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { listPvReconciliations, runPvReconciliation } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ ok: true, runs: await listPvReconciliations(await requirePvPrincipal()) }); }
  catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ ok: true, ...(await runPvReconciliation(await requirePvPrincipal(), { periodStart: String(body?.periodStart || ""), periodEnd: String(body?.periodEnd || "") })) }, { status: 201 });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
