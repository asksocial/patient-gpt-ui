import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../../../lib/pv/auth";
import { getPvReviewList, updatePvReviewList } from "../../../../../../lib/pv/service";

export const dynamic = "force-dynamic";

function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ listId: string }> }) {
  try {
    const principal = await requirePvPrincipal();
    const { listId } = await context.params;
    const list: any = await getPvReviewList(principal, listId);
    const header = ["Record ID","Product / procedure","Potential adverse event","Status","Detection score","Original post date","Reviewer identification date","Source type","Source URL","Full mention"];
    const rows = (list.items || []).map((item: any) => {
      const record = item.pv_records || {};
      return [record.id, record.product_name, record.potential_event, record.status, record.detection_score, record.posted_at, record.identified_at, record.source_type, record.source_url, record.original_verbatim];
    });
    const content = [header, ...rows].map((row) => row.map(csv).join(",")).join("\r\n");
    await updatePvReviewList(principal, listId, { status: "exported" });
    const fileName = `${String(list.name).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "pv-review-list"}.csv`;
    return new NextResponse(content, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
