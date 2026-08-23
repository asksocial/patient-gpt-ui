import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../lib/pv/auth";
import { getPvRecord, reviewPvRecord, startPvRecordReview, transferPvRecord } from "../../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try { const { recordId } = await context.params; return NextResponse.json({ ok: true, ...(await getPvRecord(await requirePvPrincipal(), recordId)) }); }
  catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const principal = await requirePvPrincipal();
    const { recordId } = await context.params;
    const body = await request.json();
    if (body?.action === "start_review") {
      return NextResponse.json({ ok: true, ...(await startPvRecordReview(principal, recordId)) });
    }
    if (body?.action === "transfer") {
      return NextResponse.json({ ok: true, transfer: await transferPvRecord(principal, recordId, { destination: String(body.destination || ""), transferMethod: body.transferMethod || "manual_export" }) });
    }
    if (body?.action === "review") {
      return NextResponse.json({ ok: true, ...(await reviewPvRecord(principal, recordId, {
        productMention: body.productMention, healthExperience: body.healthExperience,
        classifications: Array.isArray(body.classifications) ? body.classifications : [], rationale: String(body.rationale || ""),
        action: body.decision, ontologyReview: body.ontologyReview,
      })) });
    }
    return NextResponse.json({ ok: false, error: "Unsupported PV record action" }, { status: 400 });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
