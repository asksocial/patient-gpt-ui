import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { createPvSource, listPvSources } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ ok: true, sources: await listPvSources(await requirePvPrincipal()) }); }
  catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const source = await createPvSource(await requirePvPrincipal(), {
      name: String(body?.name || ""), sourceType: String(body?.sourceType || ""), sourceUrl: String(body?.sourceUrl || ""),
      ownershipClassification: body?.ownershipClassification || "controlled", sponsorName: body?.sponsorName,
      businessOwner: body?.businessOwner, products: body?.products, markets: body?.markets, languages: body?.languages,
      cadenceMinutes: Number(body?.cadenceMinutes || 1440), effectiveAt: body?.effectiveAt,
    });
    return NextResponse.json({ ok: true, source }, { status: 201 });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
