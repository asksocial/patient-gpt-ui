import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { createPvReviewList, listPvReviewLists } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const therapeuticArea = request.nextUrl.searchParams.get("therapeuticArea") || undefined;
    return NextResponse.json({ ok: true, lists: await listPvReviewLists(await requirePvPrincipal(), therapeuticArea) });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const list = await createPvReviewList(await requirePvPrincipal(), {
      name: String(body?.name || ""), therapeuticArea: String(body?.therapeuticArea || ""),
      recordIds: Array.isArray(body?.recordIds) ? body.recordIds.map(String) : [],
      assignedTo: body?.assignedTo, description: body?.description,
    });
    return NextResponse.json({ ok: true, list }, { status: 201 });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
