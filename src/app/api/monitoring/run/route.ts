import { NextRequest, NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { platformPrincipalFromEntitlements } from "../../../../lib/intelligence-platform";
import { executeMonitoringProfile } from "../../../../lib/continuous-intelligence/execution";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const principal = platformPrincipalFromEntitlements(entitlements);
    const { data: profile, error } = await getSupabaseServerClient().from("intelligence_monitoring_profiles").select("*")
      .eq("id", body?.profileId).eq("principal_id", principal.principalId).maybeSingle();
    if (error || !profile) return NextResponse.json({ ok: false, error: "Monitoring profile not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...(await executeMonitoringProfile(profile)) });
  } catch (error: any) { return NextResponse.json({ ok: false, error: error.message || "Monitor execution failed" }, { status: 500 }); }
}
