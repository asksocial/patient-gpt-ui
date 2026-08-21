import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { listPvSponsorCases, recordPvSponsorReportActivity, transferPvRecord } from "../../../../lib/pv/service";
import { createPvSponsorReport, sponsorReportFileName } from "../../../../lib/pv/sponsorReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const therapeuticArea = request.nextUrl.searchParams.get("therapeuticArea") || undefined;
    return NextResponse.json({ ok: true, cases: await listPvSponsorCases(await requirePvPrincipal(), therapeuticArea) });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await requirePvPrincipal();
    const body = await request.json();
    const therapeuticArea = String(body?.therapeuticArea || "").trim() || undefined;
    const recipientEmail = String(body?.recipientEmail || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ ok: false, error: "Enter a valid sponsor email address." }, { status: 400 });
    }
    const cases = await listPvSponsorCases(principal, therapeuticArea);
    if (!cases.length) return NextResponse.json({ ok: false, error: "No escalated sponsor cases are available for this report." }, { status: 400 });
    const report = await createPvSponsorReport({ cases, therapeuticArea, generatedBy: principal.actorId });
    const fileName = sponsorReportFileName(therapeuticArea);
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.PV_SPONSOR_FROM_EMAIL;
    let delivery: "provider" | "client_email" = "client_email";
    if (resendKey && fromEmail) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipientEmail],
          subject: `AskSocial PV sponsor screening report - ${therapeuticArea || "All therapeutic areas"}`,
          html: `<p>Please find attached the governed AskSocial PV sponsor screening report containing ${cases.length} escalated mention${cases.length === 1 ? "" : "s"}.</p><p>This working document supports ICH E2D(R1) intake and does not replace qualified medical review or regional reporting requirements.</p>`,
          attachments: [{ filename: fileName, content: Buffer.from(report.bytes).toString("base64") }],
        }),
      });
      if (!response.ok) throw new Error(`Sponsor email delivery failed (${response.status}). The report was not marked as shared.`);
      delivery = "provider";
      for (const item of cases) {
        if (item.record.status === "ready_for_transfer") {
          await transferPvRecord(principal, item.record.id, { destination: recipientEmail, transferMethod: "secure_email" });
        }
      }
    }
    await recordPvSponsorReportActivity(principal, {
      action: "share",
      therapeuticArea,
      caseIds: cases.map((item: any) => item.id),
      recipientEmail,
      reportHash: report.hash,
    });
    return NextResponse.json({ ok: true, delivery, fileName, caseCount: cases.length });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
