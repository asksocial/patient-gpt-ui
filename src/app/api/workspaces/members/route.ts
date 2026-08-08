import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import {
  listWorkspaceMembers,
  platformPrincipalFromEntitlements,
  removeWorkspaceMember,
  upsertWorkspaceMember,
} from "../../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: "workspaceId is required" }, { status: 400 });
    const members = await listWorkspaceMembers(platformPrincipalFromEntitlements(entitlements), workspaceId);
    return NextResponse.json({ ok: true, members });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to load workspace members" }, { status: error.message?.includes("access") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const requestedUserId = String(body?.userId || "");
    if (entitlements.organizationId) {
      const client = await clerkClient();
      const organizationUsers = await client.users.getUserList({
        userId: [requestedUserId],
        organizationId: [entitlements.organizationId],
        limit: 1,
      });
      if (!organizationUsers.data.length) {
        return NextResponse.json({ ok: false, error: "The selected user is not a member of this organization." }, { status: 400 });
      }
    } else if (requestedUserId !== entitlements.userId) {
      return NextResponse.json({ ok: false, error: "Personal workspaces cannot add other users." }, { status: 400 });
    }
    const member = await upsertWorkspaceMember(platformPrincipalFromEntitlements(entitlements), {
      workspaceId: String(body?.workspaceId || ""),
      userId: requestedUserId,
      role: body?.role,
    });
    return NextResponse.json({ ok: true, member });
  } catch (error: any) {
    const message = error.message || "Failed to save workspace member";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("access") ? 403 : 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
    const userId = request.nextUrl.searchParams.get("userId") || "";
    const result = await removeWorkspaceMember(platformPrincipalFromEntitlements(entitlements), { workspaceId, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    const message = error.message || "Failed to remove workspace member";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("access") ? 403 : 400 });
  }
}
