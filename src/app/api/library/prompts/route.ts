import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import {
  configurationFromEntitlements, listSavedPrompts, platformPrincipalFromEntitlements,
  resolveCustomerIntelligenceAccess, savePrompt,
} from "../../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const access = resolveCustomerIntelligenceAccess(configurationFromEntitlements(entitlements));
    const prompts = await listSavedPrompts(platformPrincipalFromEntitlements(entitlements), access.modules.map((module) => module.id));
    return NextResponse.json({ ok: true, prompts });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const prompt = await savePrompt(platformPrincipalFromEntitlements(entitlements), {
      name: String(body?.name || ""), prompt: String(body?.prompt || ""), description: body?.description,
      workspaceId: body?.workspaceId, moduleId: body?.moduleId, tags: body?.tags, isShared: Boolean(body?.isShared),
    });
    return NextResponse.json({ ok: true, prompt }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
