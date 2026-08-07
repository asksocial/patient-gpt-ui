import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../lib/pv/auth";
import { acknowledgePvTransfer } from "../../../../../lib/pv/service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ transferId: string }> }) {
  try {
    const { transferId } = await context.params;
    const body = await request.json();
    return NextResponse.json({ ok: true, transfer: await acknowledgePvTransfer(await requirePvPrincipal(), transferId, String(body?.acknowledgmentReference || "")) });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
