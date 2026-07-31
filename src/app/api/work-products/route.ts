import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../lib/entitlements/server";
import {
  listIntelligenceWorkProducts,
  platformPrincipalFromEntitlements,
  saveIntelligenceWorkProduct,
} from "../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const workspaceId = request.nextUrl.searchParams.get("workspaceId") || undefined;
    const kind = request.nextUrl.searchParams.get("kind") || undefined;
    const products = await listIntelligenceWorkProducts(
      platformPrincipalFromEntitlements(entitlements),
      { workspaceId, kind: kind as any }
    );
    return NextResponse.json({ ok: true, products });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to load work products" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    if (!body?.workspaceId || !body?.kind || !body?.payload) {
      return NextResponse.json(
        { ok: false, error: "workspaceId, kind, and payload are required" },
        { status: 400 }
      );
    }
    const product = await saveIntelligenceWorkProduct(
      platformPrincipalFromEntitlements(entitlements),
      {
        workspaceId: body.workspaceId,
        kind: body.kind,
        title: body.title || "Untitled intelligence",
        therapeuticArea: body.therapeuticArea,
        moduleId: body.moduleId,
        status: body.status,
        payload: body.payload,
        provenance: body.provenance,
      }
    );
    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (error: any) {
    const status = error.message === "Workspace not found." ? 404 : 500;
    return NextResponse.json({ ok: false, error: error.message || "Failed to save work product" }, { status });
  }
}
