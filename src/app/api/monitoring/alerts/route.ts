import { NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { platformPrincipalFromEntitlements } from "../../../../lib/intelligence-platform";
import { listDeliveryOutbox, listIntelligenceAlerts } from "../../../../lib/continuous-intelligence/monitoring";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const entitlements = await getCurrentEntitlements();
    if (!entitlements) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const principal = platformPrincipalFromEntitlements(entitlements);
    const [alerts, deliveries] = await Promise.all([listIntelligenceAlerts(principal), listDeliveryOutbox(principal)]);
    return NextResponse.json({ ok: true, alerts, deliveries });
  } catch (error: any) { return NextResponse.json({ ok: false, error: error.message }, { status: 500 }); }
}
