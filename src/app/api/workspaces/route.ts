import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../lib/entitlements/server";
import {
  createIntelligenceWorkspace,
  listIntelligenceWorkspaces,
  platformPrincipalFromEntitlements,
} from "../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const workspaces = await listIntelligenceWorkspaces(
      platformPrincipalFromEntitlements(entitlements)
    );
    return NextResponse.json({ ok: true, workspaces });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to load workspaces" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const workspace = await createIntelligenceWorkspace(
      platformPrincipalFromEntitlements(entitlements),
      {
        name: String(body?.name || ""),
        description: body?.description,
        therapeuticArea: body?.therapeuticArea,
        moduleIds: Array.isArray(body?.moduleIds) ? body.moduleIds : [],
      }
    );
    return NextResponse.json({ ok: true, workspace }, { status: 201 });
  } catch (error: any) {
    const status = error.message === "Workspace name is required." ? 400 : 500;
    return NextResponse.json({ ok: false, error: error.message || "Failed to create workspace" }, { status });
  }
}
