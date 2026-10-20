import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal, pvErrorResponse } from "../../../../lib/pv/auth";
import { listPvQaNotRelevantCases, listPvSponsorCases, recordPvSponsorReportActivity } from "../../../../lib/pv/service";
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
    return NextResponse.json({
      ok: true,
      cases,
      qaCases,
      emailDelivery: {
        configured: Boolean(process.env.RESEND_API_KEY && process.env.PV_SPONSOR_FROM_EMAIL),
      },
    });
  } catch (error) {
    const failure = pvErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
}

export async function POST(request: NextRequest) {
 try {
  const principal=await requirePvPrincipal(),body=await request.json();
  if(body?.mode!=="qa_not_relevant")return NextResponse.json({ok:false,error:"Select reviewed cases and compose their notification in Reviewed Cases & Email."},{status:409,headers:{"Cache-Control":"private, no-store"}});
  const therapeuticArea=String(body?.therapeuticArea||"").trim()||undefined,recipientEmail=String(body?.recipientEmail||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))throw new Error("Enter a valid QA recipient email address.");
  const cases=await listPvQaNotRelevantCases(principal,therapeuticArea);if(!cases.length)throw new Error("No closed Not Reportable reviews are available for QA export.");
  const report=await createPvSponsorReport({cases,therapeuticArea,generatedBy:principal.actorId,mode:"qa_not_relevant"}),fileName=sponsorReportFileName(therapeuticArea,"qa_not_relevant");
  const resendKey=process.env.RESEND_API_KEY,fromEmail=process.env.PV_SPONSOR_FROM_EMAIL;
  let delivery:"provider"|"client_email"="client_email";
  if(resendKey&&fromEmail){const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(20000),body:JSON.stringify({from:fromEmail,to:[recipientEmail],subject:`[QA TEST - NOT FOR SUBMISSION] AskSocial PV export - ${therapeuticArea||"All topics"}`,text:"QA TEST ONLY - NOT FOR SPONSOR SUBMISSION OR REGULATORY REPORTING. These records were closed as Not Reportable and are included only to validate export and handoff mechanics.",attachments:[{filename:fileName,content:Buffer.from(report.bytes).toString("base64")}]})});if(!response.ok)throw new Error("QA email was not confirmed by the provider. Verify its outcome before retrying.");delivery="provider";}
  await recordPvSponsorReportActivity(principal,{action:delivery==="provider"?"qa_share":"qa_prepare",therapeuticArea,caseIds:cases.map(item=>item.id),recipientEmail,reportHash:report.hash});
  return NextResponse.json({ok:true,delivery,fileName,caseCount:cases.length,qaMode:true,message:delivery==="provider"?"QA email accepted by the provider; recipient receipt remains unconfirmed.":"No email was sent by AskSocial. Download the QA PDF and attach it to your approved email draft."},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){const failure=pvErrorResponse(error);return NextResponse.json({ok:false,error:failure.message},{status:failure.status,headers:{"Cache-Control":"private, no-store"}});}
}
