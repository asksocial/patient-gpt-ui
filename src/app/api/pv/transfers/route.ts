import { NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { listPvTransfers } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ ok: true, transfers: await listPvTransfers(await requirePvPrincipal()) }); }
  catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
