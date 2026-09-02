import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { listPvQaNotRelevantCases, listPvSponsorCases, recordPvSponsorReportActivity, transferPvRecord } from "../../../../lib/pv/service";
import { createPvSponsorReport, sponsorReportFileName } from "../../../../lib/pv/sponsorReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const therapeuticArea = request.nextUrl.searchParams.get("therapeuticArea") || undefined;
    const principal = await requirePvPrincipal();
    const [cases, qaCases] = await Promise.all([
      listPvSponsorCases(principal, therapeuticArea),
      listPvQaNotRelevantCases(principal, therapeuticArea),
    ]);
    return NextResponse.json({ ok: true, cases, qaCases });
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
    const mode = body?.mode === "qa_not_relevant" ? "qa_not_relevant" : "sponsor_handoff";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ ok: false, error: "Enter a valid sponsor email address." }, { status: 400 });
    }
    const cases = mode === "qa_not_relevant"
      ? await listPvQaNotRelevantCases(principal, therapeuticArea)
      : await listPvSponsorCases(principal, therapeuticArea);
    if (!cases.length) return NextResponse.json({ ok: false, error: mode === "qa_not_relevant" ? "No closed Not Relevant reviews are available for QA handoff testing." : "No escalated sponsor cases are available for this report." }, { status: 400 });
    const report = await createPvSponsorReport({ cases, therapeuticArea, generatedBy: principal.actorId, mode });
    const fileName = sponsorReportFileName(therapeuticArea, mode);
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
          subject: mode === "qa_not_relevant" ? `[QA TEST - NOT FOR SUBMISSION] AskSocial PV export - ${therapeuticArea || "All therapeutic areas"}` : `AskSocial PV sponsor screening report - ${therapeuticArea || "All therapeutic areas"}`,
          html: mode === "qa_not_relevant"
            ? `<p><strong>QA TEST ONLY - NOT FOR SPONSOR SUBMISSION OR REGULATORY REPORTING.</strong></p><p>The attached AskSocial PDF contains ${cases.length} mention${cases.length === 1 ? "" : "s"} closed as Not Relevant and is provided only to validate export and handoff mechanics.</p>`
            : `<p>Please find attached the governed AskSocial PV sponsor screening report containing ${cases.length} escalated mention${cases.length === 1 ? "" : "s"}.</p><p>This working document supports ICH E2D(R1) intake and does not replace qualified medical review or regional reporting requirements.</p>`,
          attachments: [{ filename: fileName, content: Buffer.from(report.bytes).toString("base64") }],
        }),
      });
      if (!response.ok) throw new Error(`Sponsor email delivery failed (${response.status}). The report was not marked as shared.`);
      delivery = "provider";
      if (mode === "sponsor_handoff") {
        for (const item of cases) {
          if (item.record.status === "ready_for_transfer") {
            await transferPvRecord(principal, item.record.id, { destination: recipientEmail, transferMethod: "secure_email" });
          }
        }
      }
    }
    await recordPvSponsorReportActivity(principal, {
      action: mode === "qa_not_relevant"
        ? delivery === "provider" ? "qa_share" : "qa_prepare"
        : delivery === "provider" ? "share" : "prepare",
      therapeuticArea,
      caseIds: cases.map((item: any) => item.id),
      recipientEmail,
      reportHash: report.hash,
    });
    return NextResponse.json({ ok: true, delivery, fileName, caseCount: cases.length, qaMode: mode === "qa_not_relevant" });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}
