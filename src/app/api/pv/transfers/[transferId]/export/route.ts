import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../../lib/pv/auth";
import { getSupabaseServerClient } from "../../../../../../lib/supabase/server";
import { appendPvAuditEvent } from "../../../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, context: { params: Promise<{ transferId: string }> }) {
  try {
    const principal = await requirePvPrincipal(); const { transferId } = await context.params;
    const { data, error } = await getSupabaseServerClient().from("pv_transfers").select("id,record_id,payload,payload_hash").eq("id", transferId).eq("principal_id", principal.principalId).maybeSingle();
    if (error || !data) return NextResponse.json({ ok: false, error: "Transfer not found." }, { status: 404 });
    await appendPvAuditEvent(principal, { action: "transfer.export", resourceType: "pv_record", resourceId: data.record_id, outcome: "completed", metadata: { transferId: data.id, payloadHash: data.payload_hash, transmissionPerformed: false } });
    return new NextResponse(JSON.stringify({ payload: data.payload, payloadHash: data.payload_hash }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="asksocial-handoff-${data.id}.json"`, "Cache-Control": "no-store" } });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
