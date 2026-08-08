import { NextRequest, NextResponse } from "next/server";
import { loadCanonicalFindingsForAsk } from "../../../lib/answers/loadCanonicalFindingsForAsk";
import { getCurrentEntitlements } from "../../../lib/entitlements/server";
import {
  MODULE_ENTITLEMENTS,
  platformPrincipalFromEntitlements,
  saveIntelligenceWorkProduct,
} from "../../../lib/intelligence-platform";
import {
  buildModuleIntelligence,
  isGeneratableModuleId,
} from "../../../lib/module-intelligence/buildModuleIntelligence";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const moduleId = String(body?.moduleId || "").trim();
    const therapeuticArea = String(body?.therapeuticArea || "").trim();
    if (!isGeneratableModuleId(moduleId)) {
      return NextResponse.json(
        { ok: false, error: "A supported non-patient moduleId is required." },
        { status: 400 }
      );
    }
    if (!therapeuticArea) {
      return NextResponse.json(
        { ok: false, error: "therapeuticArea is required" },
        { status: 400 }
      );
    }

    const entitlementKey = MODULE_ENTITLEMENTS[moduleId];
    if (!entitlements.capabilities[entitlementKey]?.granted && !entitlements.isAdmin) {
      return NextResponse.json(
        {
          ok: false,
          code: "ENTITLEMENT_REQUIRED",
          error: `${MODULE_INTELLIGENCE_LABELS[moduleId]} Intelligence access is required.`,
        },
        { status: 403 }
      );
    }

    const corpus = loadCanonicalFindingsForAsk(therapeuticArea);
    if (corpus.status !== "available") {
      return NextResponse.json({ ok: false, error: corpus.reason }, { status: 422 });
    }

    const intelligence = buildModuleIntelligence(
      moduleId,
      therapeuticArea,
      corpus.findings
    );

    let workProductId: string | null = null;
    if (body?.workspaceId) {
      const product = await saveIntelligenceWorkProduct(
        platformPrincipalFromEntitlements(entitlements),
        {
          workspaceId: String(body.workspaceId),
          kind: "report",
          title: `${therapeuticArea} ${intelligence.moduleLabel} Intelligence`,
          therapeuticArea,
          moduleId,
          status: "ready",
          payload: intelligence,
          provenance: {
            schemaVersion: intelligence.schemaVersion,
            corpus: corpus.sourceLabel,
            generatedAt: intelligence.generatedAt,
          },
        }
      );
      workProductId = String(product.id);
    }

    return NextResponse.json({ ok: true, intelligence, workProductId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Module Intelligence failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const MODULE_INTELLIGENCE_LABELS = {
  medical_affairs: "Medical Affairs",
  clinical_trials: "Clinical Trials",
  corporate_affairs: "Corporate Affairs",
  commercial: "Commercial",
  competitive: "Competitive",
  advocacy: "Advocacy",
} as const;
