import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { activatePvDetectionLibrary, createPvDetectionConcept, createPvDetectionLibrary, listPvDetectionLibrary } from "../../../../lib/pv/service";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ ok: true, ...(await listPvDetectionLibrary(await requirePvPrincipal())) }); }
  catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function POST(request: NextRequest) {
  try {
    const principal = await requirePvPrincipal();
    const body = await request.json();
    if (body?.resource === "concept") {
      const concept = await createPvDetectionConcept(principal, {
        libraryId: String(body.libraryId || ""), category: body.category, canonicalTerm: String(body.canonicalTerm || ""),
        terms: Array.isArray(body.terms) ? body.terms : [], exclusions: Array.isArray(body.exclusions) ? body.exclusions : [],
        productId: body.productId, language: String(body.language || "en"), market: body.market,
        weight: Number(body.weight ?? 50), activeFrom: body.activeFrom, activeUntil: body.activeUntil, active: body.active !== false,
      });
      return NextResponse.json({ ok: true, concept }, { status: 201 });
    }
    const library = await createPvDetectionLibrary(principal, {
      name: String(body?.name || ""), sponsorName: body?.sponsorName, productId: body?.productId,
      market: body?.market, language: body?.language, detectionThreshold: Number(body?.detectionThreshold ?? 55),
    });
    return NextResponse.json({ ok: true, library }, { status: 201 });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (body?.action !== "activate") return NextResponse.json({ ok: false, error: "Unsupported library action" }, { status: 400 });
    return NextResponse.json({ ok: true, library: await activatePvDetectionLibrary(await requirePvPrincipal(), String(body.libraryId || "")) });
  } catch (error) { const failure = pvErrorResponse(error); return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status }); }
}
