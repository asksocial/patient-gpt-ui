import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { platformPrincipalFromEntitlements } from "../../../../lib/intelligence-platform";
import { createMonitoringProfile, listMonitoringProfiles } from "../../../../lib/continuous-intelligence/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: true, profiles: await listMonitoringProfiles(platformPrincipalFromEntitlements(entitlements)) });
  } catch (error: any) { return NextResponse.json({ ok: false, error: error.message }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const profile = await createMonitoringProfile(platformPrincipalFromEntitlements(entitlements), {
      workspaceId: body?.workspaceId, name: String(body?.name || ""), monitorType: body?.monitorType || "theme_shift",
      therapeuticArea: String(body?.therapeuticArea || ""), query: String(body?.query || ""), cadence: body?.cadence || "weekly",
      threshold: Number(body?.threshold ?? 5), deliveryChannels: body?.deliveryChannels,
    });
    return NextResponse.json({ ok: true, profile }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ ok: false, error: error.message }, { status: 400 }); }
}
