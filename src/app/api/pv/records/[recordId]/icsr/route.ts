import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../../lib/pv/auth";
import { getIcsrCase, updateIcsrCase } from "../../../../../../lib/pv/icsr/service";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(_request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const principal = await requirePvPrincipal();
    const { recordId } = await context.params;
    return NextResponse.json({ ok: true, ...await getIcsrCase(principal, recordId) }, { headers });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status, headers }); }
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const principal = await requirePvPrincipal();
    const { recordId } = await context.params;
    const raw = await request.text();
    if (raw.length > 1000000) throw new Error("ICSR review payload is too large.");
    return NextResponse.json({ ok: true, ...await updateIcsrCase(principal, recordId, JSON.parse(raw)) }, { headers });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status, headers }); }
}
