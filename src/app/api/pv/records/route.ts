import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { appendPvAuditEvent, detectAndStorePvContent, listPvRecords } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";
function detectionInput(body: any, defaultLibraryId?: string) {
  return {
    libraryId: String(body?.libraryId || defaultLibraryId || ""), slaPolicyId: body?.slaPolicyId, externalId: String(body?.externalId || ""),
    sourceId: body?.sourceId, sourceType: String(body?.sourceType || ""), sourceUrl: String(body?.sourceUrl || ""),
    authorIdentifier: body?.authorIdentifier, verbatim: String(body?.verbatim || ""), language: body?.language,
    market: body?.market, postedAt: String(body?.postedAt || ""), ingestedAt: body?.ingestedAt,
    parentContext: body?.parentContext, threadContext: body?.threadContext, immutableCaptureUrl: body?.immutableCaptureUrl,
    dataOrigin: ["live", "curated"].includes(body?.dataOrigin) ? body.dataOrigin : "unknown" as const,
  };
}
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const therapeuticArea = request.nextUrl.searchParams.get("therapeuticArea") || undefined;
    return NextResponse.json({ ok: true, records: await listPvRecords(await requirePvPrincipal(), { status, therapeuticArea }) });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const principal = await requirePvPrincipal();
    if (Array.isArray(body?.items)) {
      const detections = [];
      for (const item of body.items.slice(0, 500)) {
        try {
          detections.push({ ok: true, externalId: String(item?.externalId || ""), ...(await detectAndStorePvContent(principal, detectionInput(item, body.libraryId))) });
        } catch (itemError) {
          const error = itemError instanceof Error ? itemError.message : "PV screening failed";
          await appendPvAuditEvent(principal, {
            action: "detection.evaluate",
            resourceType: "source_content",
            resourceId: String(item?.externalId || "unresolved"),
            outcome: "failed",
            metadata: { error, sourceUrl: item?.sourceUrl, dataOrigin: item?.dataOrigin || "unknown" },
          });
          detections.push({ ok: false, externalId: String(item?.externalId || ""), error });
        }
      }
      return NextResponse.json({
        ok: true,
        screened: detections.length,
        routed: detections.filter((item) => item.ok && item.record).length,
        duplicates: detections.filter((item) => item.ok && item.duplicate).length,
        failed: detections.filter((item) => !item.ok).length,
        detections,
      });
    }
    const detection = await detectAndStorePvContent(principal, detectionInput(body));
    return NextResponse.json({ ok: true, ...detection }, { status: detection.record ? 201 : 200 });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
