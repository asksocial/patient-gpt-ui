import { NextRequest, NextResponse } from "next/server";
import { executeMonitoringProfile } from "../../../../lib/continuous-intelligence/execution";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const secret = process.env.ASKSOCIAL_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { data: profiles, error } = await getSupabaseServerClient().from("intelligence_monitoring_profiles").select("*")
    .eq("status", "active").lte("next_run_at", new Date().toISOString()).order("next_run_at").limit(10);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const results = [];
  for (const profile of profiles || []) {
    try { results.push({ profileId: profile.id, ok: true, ...(await executeMonitoringProfile(profile)) }); }
    catch (executionError: any) { results.push({ profileId: profile.id, ok: false, error: executionError.message }); }
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
