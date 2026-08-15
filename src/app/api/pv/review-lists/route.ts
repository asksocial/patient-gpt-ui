import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { createPvReviewList, listPvReviewLists } from "../../../../lib/pv/service";
import { assertWorkspaceAccess, saveIntelligenceWorkProduct } from "../../../../lib/intelligence-platform";

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
    const principal = await requirePvPrincipal();
    const workspaceId = String(body?.workspaceId || "").trim();
    if (!workspaceId) return NextResponse.json({ ok: false, error: "Choose a workspace before saving the review list." }, { status: 400 });
    await assertWorkspaceAccess(principal, workspaceId, "editor");
    const list = await createPvReviewList(principal, {
      name: String(body?.name || ""), therapeuticArea: String(body?.therapeuticArea || ""),
      recordIds: Array.isArray(body?.recordIds) ? body.recordIds.map(String) : [],
      assignedTo: body?.assignedTo, description: body?.description,
    });
    const workProduct = await saveIntelligenceWorkProduct(principal, {
      workspaceId,
      kind: "export",
      title: list.name,
      therapeuticArea: list.therapeutic_area,
      status: "ready",
      payload: {
        type: "pv_review_list",
        reviewListId: list.id,
        itemCount: list.item_count,
        status: list.status,
      },
      provenance: {
        source: "pv_compliance",
        reviewListId: list.id,
      },
    });
    return NextResponse.json({ ok: true, list, workProduct }, { status: 201 });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
