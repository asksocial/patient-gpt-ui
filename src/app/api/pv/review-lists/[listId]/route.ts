import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../lib/pv/auth";
import { getPvReviewList, updatePvReviewList } from "../../../../../lib/pv/service";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await context.params;
    return NextResponse.json({ ok: true, list: await getPvReviewList(await requirePvPrincipal(), listId) });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ listId: string }> }) {
  try {
    const body = await request.json();
    const { listId } = await context.params;
    return NextResponse.json({ ok: true, list: await updatePvReviewList(await requirePvPrincipal(), listId, {
      assignedTo: body?.assignedTo, sharedEmail: body?.sharedEmail, status: body?.status,
    }) });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
