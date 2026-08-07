import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { detectAndStorePvContent, listPvRecords } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status") || undefined;
    return NextResponse.json({ ok: true, records: await listPvRecords(await requirePvPrincipal(), { status }) });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const detection = await detectAndStorePvContent(await requirePvPrincipal(), {
      libraryId: String(body?.libraryId || ""), slaPolicyId: body?.slaPolicyId, externalId: String(body?.externalId || ""),
      sourceId: body?.sourceId, sourceType: String(body?.sourceType || ""), sourceUrl: String(body?.sourceUrl || ""),
      authorIdentifier: body?.authorIdentifier, verbatim: String(body?.verbatim || ""), language: body?.language,
      market: body?.market, postedAt: String(body?.postedAt || ""), ingestedAt: body?.ingestedAt,
      parentContext: body?.parentContext, threadContext: body?.threadContext, immutableCaptureUrl: body?.immutableCaptureUrl,
    });
    return NextResponse.json({ ok: true, ...detection }, { status: detection.record ? 201 : 200 });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
