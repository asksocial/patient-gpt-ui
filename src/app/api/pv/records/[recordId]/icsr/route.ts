import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../../lib/pv/auth";
import { getIcsrCase } from "../../../../../../lib/pv/icsr/service";
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
    await requirePvPrincipal();
    await context.params;
    return NextResponse.json({ ok: false, error: "Review and approval now take place in Structured Review. Use the reviewed-case email queue to compose notifications." }, { status: 409, headers });

  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status, headers }); }
}
