import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { getPvOperationsOverview } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, overview: await getPvOperationsOverview(await requirePvPrincipal(), request.nextUrl.searchParams.get("therapeuticArea") || undefined) });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
