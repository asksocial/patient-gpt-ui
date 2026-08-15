import { NextRequest, NextResponse } from "next/server";
import { loadCanonicalFindingsForModule } from "../../../../lib/answers/loadCanonicalFindingsForAsk";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { MODULE_ENTITLEMENTS } from "../../../../lib/intelligence-platform";
import {
  buildModuleEvidenceCatalog,
  isGeneratableModuleId,
} from "../../../../lib/module-intelligence/buildModuleIntelligence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const moduleId = String(request.nextUrl.searchParams.get("moduleId") || "").trim();
    const therapeuticArea = String(request.nextUrl.searchParams.get("therapeuticArea") || "").trim();
    if (!isGeneratableModuleId(moduleId) || !therapeuticArea) {
      return NextResponse.json(
        { ok: false, error: "A supported moduleId and therapeuticArea are required." },
        { status: 400 }
      );
    }

    const entitlementKey = MODULE_ENTITLEMENTS[moduleId];
    if (!entitlements.capabilities[entitlementKey]?.granted && !entitlements.isAdmin) {
      return NextResponse.json(
        { ok: false, code: "ENTITLEMENT_REQUIRED", error: "Module Intelligence access is required." },
        { status: 403 }
      );
    }

    const corpus = loadCanonicalFindingsForModule(therapeuticArea, moduleId);
    if (corpus.status !== "available") {
      return NextResponse.json({ ok: false, error: corpus.reason }, { status: 422 });
    }

    const evidence = buildModuleEvidenceCatalog(
      moduleId,
      therapeuticArea,
      corpus.findings,
      {
        query: request.nextUrl.searchParams.get("q") || "",
        qualityBand: request.nextUrl.searchParams.get("qualityBand") || "",
        evidenceClass: request.nextUrl.searchParams.get("evidenceClass") || "",
        page: Number(request.nextUrl.searchParams.get("page") || 1),
        pageSize: Number(request.nextUrl.searchParams.get("pageSize") || 12),
      },
      { relevancePolicy: corpus.relevancePolicy }
    );

    return NextResponse.json({ ok: true, evidence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Module evidence could not be loaded";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
