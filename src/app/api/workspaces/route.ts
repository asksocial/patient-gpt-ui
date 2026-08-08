import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../lib/entitlements/server";
import {
  createIntelligenceWorkspace,
  deleteIntelligenceWorkspace,
  listIntelligenceWorkspaces,
  platformPrincipalFromEntitlements,
  updateIntelligenceWorkspace,
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

export async function PATCH(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    if (!body?.workspaceId) return NextResponse.json({ ok: false, error: "workspaceId is required" }, { status: 400 });
    const workspace = await updateIntelligenceWorkspace(
      platformPrincipalFromEntitlements(entitlements),
      {
        workspaceId: String(body.workspaceId),
        name: body.name,
        description: body.description,
        therapeuticArea: body.therapeuticArea,
        moduleIds: body.moduleIds,
        archived: body.archived,
      }
    );
    return NextResponse.json({ ok: true, workspace });
  } catch (error: any) {
    const message = error.message || "Failed to update workspace";
    const status = message.includes("access") || message.includes("denied") ? 403 : message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: "workspaceId is required" }, { status: 400 });
    const result = await deleteIntelligenceWorkspace(
      platformPrincipalFromEntitlements(entitlements),
      workspaceId
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    const message = error.message || "Failed to delete workspace";
    const status = message.includes("access") || message.includes("denied") ? 403 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
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
