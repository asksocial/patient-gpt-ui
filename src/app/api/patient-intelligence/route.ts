import { NextRequest, NextResponse } from "next/server";
import { loadCanonicalFindingsForAsk } from "../../../lib/answers/loadCanonicalFindingsForAsk";
import { getCurrentEntitlements } from "../../../lib/entitlements/server";
import { platformPrincipalFromEntitlements, saveIntelligenceWorkProduct } from "../../../lib/intelligence-platform";
import {
  buildPatientEvidenceCatalog,
  buildPatientIntelligence,
  isPatientEvidenceDimension,
} from "../../../lib/patient-intelligence/buildPatientIntelligence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!entitlements.capabilities.module_patient.granted && !entitlements.isAdmin) {
      return NextResponse.json({ ok: false, code: "ENTITLEMENT_REQUIRED", error: "Patient Intelligence access is required." }, { status: 403 });
    }
    const therapeuticArea = String(request.nextUrl.searchParams.get("therapeuticArea") || "").trim();
    const dimension = request.nextUrl.searchParams.get("dimension");
    if (!therapeuticArea || !isPatientEvidenceDimension(dimension)) {
      return NextResponse.json({ ok: false, error: "A therapeuticArea and supported patient evidence dimension are required." }, { status: 400 });
    }
    const corpus = loadCanonicalFindingsForAsk(therapeuticArea);
    if (corpus.status !== "available") return NextResponse.json({ ok: false, error: corpus.reason }, { status: 422 });
    const evidence = buildPatientEvidenceCatalog(
      therapeuticArea,
      corpus.findings,
      dimension,
      {
        query: request.nextUrl.searchParams.get("q") || "",
        page: Number(request.nextUrl.searchParams.get("page") || 1),
        pageSize: Number(request.nextUrl.searchParams.get("pageSize") || 20),
      }
    );
    return NextResponse.json({ ok: true, evidence });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Patient evidence could not be loaded" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!entitlements.capabilities.module_patient.granted && !entitlements.isAdmin) {
      return NextResponse.json({ ok: false, code: "ENTITLEMENT_REQUIRED", error: "Patient Intelligence access is required." }, { status: 403 });
    }
    const body = await request.json();
    const therapeuticArea = String(body?.therapeuticArea || "").trim();
    if (!therapeuticArea) return NextResponse.json({ ok: false, error: "therapeuticArea is required" }, { status: 400 });
    const corpus = loadCanonicalFindingsForAsk(therapeuticArea);
    if (corpus.status !== "available") return NextResponse.json({ ok: false, error: corpus.reason }, { status: 422 });
    const intelligence = buildPatientIntelligence(therapeuticArea, corpus.findings);

    let workProductId: string | null = null;
    if (body?.workspaceId) {
      const product = await saveIntelligenceWorkProduct(platformPrincipalFromEntitlements(entitlements), {
        workspaceId: body.workspaceId,
        kind: "patient_intelligence",
        title: `${therapeuticArea} Patient Intelligence`,
        therapeuticArea,
        moduleId: "patient",
        status: "ready",
        payload: intelligence,
        provenance: { corpus: corpus.sourceLabel, generatedAt: intelligence.generatedAt },
      });
      workProductId = String(product.id);
    }

    return NextResponse.json({ ok: true, intelligence, workProductId });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Patient Intelligence failed" }, { status: 500 });
  }
}
