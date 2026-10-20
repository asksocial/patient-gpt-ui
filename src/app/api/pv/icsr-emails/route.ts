import { NextRequest, NextResponse } from "next/server";
import { requirePvPrincipal,pvErrorResponse } from "../../../../lib/pv/auth";
import { reviewedEmailQueue,prepareQueueEmail,sendQueueEmail,queueEmailBatch,markQueueEmailSent } from "../../../../lib/pv/icsr/emailQueue";
import { appendPvAuditEvent } from "../../../../lib/pv/service";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function GET(request:NextRequest){try{
 const principal=await requirePvPrincipal(),id=request.nextUrl.searchParams.get("batchId");
 if(id){const batch=await queueEmailBatch(principal,id),caseId=request.nextUrl.searchParams.get("caseId"),attachment=caseId?null:batch.payload.attachment;if(!attachment)throw Object.assign(new Error("Case attachment not found"),{status:404});await appendPvAuditEvent(principal,{action:"icsr_email.pdf_export",resourceType:"pv_icsr_email",resourceId:batch.id,outcome:"completed",metadata:{caseIds:batch.payload.caseIds,reportHash:attachment.hash,transmissionPerformed:false}});return new NextResponse(Buffer.from(attachment.content,"base64"),{headers:{...headers,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${attachment.fileName}"`}});}
 return NextResponse.json({ok:true,...await reviewedEmailQueue(principal,request.nextUrl.searchParams.get("therapeuticArea")||undefined,Number(request.nextUrl.searchParams.get("page")||1))},{headers});
}catch(error){const e=pvErrorResponse(error);return NextResponse.json({ok:false,error:e.message},{status:e.status,headers});}}
export async function POST(request:NextRequest){try{
 const principal=await requirePvPrincipal(),raw=await request.text();if(raw.length>1000000)throw new Error("Email request is too large.");const input=JSON.parse(raw);
 const result=input.action==="preview"?await prepareQueueEmail(principal,input):input.action==="send"?await sendQueueEmail(principal,input):input.action==="mark_sent"?await markQueueEmailSent(principal,input):null;if(!result)throw new Error("Unsupported email action.");
 return NextResponse.json({ok:true,...result},{headers});
}catch(error){const e=pvErrorResponse(error);return NextResponse.json({ok:false,error:e.message},{status:e.status,headers});}}
