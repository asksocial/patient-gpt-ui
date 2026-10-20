import { getSupabaseServerClient } from "../../supabase/server";
import type { PlatformPrincipal } from "../../intelligence-platform/persistence";
import { validateEmail } from "./review";
import { ICSR_ASSESSMENT, generateIcsrEmail } from "./email";
import { createIcsrCasePdf, combineIcsrCasePdfs } from "./casePdf";

export function selectedCaseIds(value: unknown): string[] {
 if (!Array.isArray(value) || value.length<1 || value.length>10 || value.some(v=>typeof v!=="string" || !/^[0-9a-f-]{36}$/i.test(v)) || new Set(value).size!==value.length) throw new Error("Select 1 to 10 distinct reviewed cases.");
 return value;
}
export async function reviewedEmailQueue(principal: PlatformPrincipal, topic?: string, requestedPage = 1) {
 const db=getSupabaseServerClient();
 const page=Math.max(1,Math.min(100000,Math.floor(Number(requestedPage)||1))),pageSize=50;
 let query=db.from("pv_records").select("id,product_name,potential_event,status,therapeutic_area,updated_at,reviewed:pv_reviews!inner(id)",{count:"exact"}).eq("principal_id",principal.principalId).eq("reviewed.principal_id",principal.principalId).in("status",["ready_for_transfer","not_relevant","health_experience","transferred","acknowledged","reconciled"]).order("updated_at",{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
 if(topic)query=query.eq("therapeutic_area",topic);
 const {data:records,error,count}=await query;
 if(error)throw new Error("Failed to load reviewed-case email queue.");
 if(!records?.length)return {cases:[],page,pageSize,total:count||0};
 const ids=records.map(r=>r.id);
 const [{data:reviews,error:re},{data:heads,error:he},{data:batches,error:be}]=await Promise.all([
  db.from("pv_reviews").select("id,record_id,decision,reviewer_id,reviewed_at").eq("principal_id",principal.principalId).in("record_id",ids).order("reviewed_at",{ascending:false}),
  db.from("pv_icsr_cases").select("record_id,revision,snapshot").eq("principal_id",principal.principalId).in("record_id",ids),
  db.from("pv_icsr_email_batches").select("id,status,caseIds:payload->caseIds,updated_at").eq("principal_id",principal.principalId).in("status",["sending","needs_reconciliation"]).order("updated_at",{ascending:false}).limit(200)
 ]);
 if(re||he||be)throw new Error("Email queue storage unavailable; apply the Structured Review email migration.");
 const cases=records.flatMap(record=>{
  const review=reviews?.find(r=>r.record_id===record.id);if(!review)return [];
  const head=heads?.find(h=>h.record_id===record.id);
  const pending=batches?.find(batch=>Array.isArray(batch.caseIds)&&batch.caseIds.includes(record.id)&&["sending","needs_reconciliation"].includes(batch.status));
  const approved=head?.snapshot?.caseData?.approval && head.snapshot.caseData.structuredReviewId===review.id;
  const eligible=record.status==="ready_for_transfer" && review.decision==="escalate" && !!approved && !pending;
  return [{...record,product_name:head?.snapshot?.caseData?.suspectProducts?.map(p=>p.brandName.value||p.genericName.value).filter(Boolean).join(" / ")||record.product_name,potential_event:head?.snapshot?.caseData?.events?.map(e=>e.normalizedEvent.value||e.verbatim.value).filter(Boolean).join(" / ")||record.potential_event,reviewId:review.id,reviewer:review.reviewer_id,reviewedAt:review.reviewed_at,revision:head?.revision||0,eligible,emailStatus:pending?.status || (["transferred","acknowledged","reconciled"].includes(record.status)?"transferred":"not_sent"),reason:eligible?"Ready to compose":pending?"Reconcile pending delivery":record.status==="ready_for_transfer"?"Complete Structured Review to approve the current case":record.status==="not_relevant"||record.status==="health_experience"?"Retained review; not eligible as a complete ICSR":"Previously transferred"}];
 });
 return {cases,page,pageSize,total:count||0};
}
export async function prepareQueueEmail(principal: PlatformPrincipal, input: any) {
 const ids=selectedCaseIds(input.caseIds), db=getSupabaseServerClient();
 const [{data:heads,error:he},{data:records,error:re},{data:reviews,error:ve}]=await Promise.all([
 db.from("pv_icsr_cases").select("record_id,revision,snapshot").eq("principal_id",principal.principalId).in("record_id",ids),
 db.from("pv_records").select("id,status").eq("principal_id",principal.principalId).in("id",ids),
 db.from("pv_reviews").select("*").eq("principal_id",principal.principalId).in("record_id",ids).order("reviewed_at",{ascending:false})]);
 if(he||re||ve || records?.length!==ids.length)throw new Error("A selected case is unavailable in your tenant.");
 const cases=[];
 for(const id of ids){
  const head=heads?.find(h=>h.record_id===id), review=reviews?.find(r=>r.record_id===id), record=records.find(r=>r.id===id);
  if(record.status!=="ready_for_transfer" || review?.decision!=="escalate" || !head?.snapshot.caseData.approval || head.snapshot.caseData.structuredReviewId!==review.id)throw new Error("Complete the current Structured Review for every selected case before composing.");
  const pdf=await createIcsrCasePdf(head.snapshot.caseData,review);
  cases.push({recordId:id,reviewId:review.id,revision:head.revision,pdfHash:pdf.hash,fileName:pdf.fileName,content:Buffer.from(pdf.bytes).toString("base64")});
 }
 if(cases.reduce((n,c)=>n+c.content.length,0)>12000000)throw new Error("Attachments are too large; select fewer cases.");
 const report=await combineIcsrCasePdfs(cases);
 const attachment={fileName:report.fileName,content:Buffer.from(report.bytes).toString("base64"),hash:report.hash,ranges:report.ranges};
 const caseManifest=cases.map(({content:_content,...item})=>({...item,reportHash:report.hash,...report.ranges.find(r=>r.recordId===item.recordId)}));
 const email=validateEmail(input.email || {subject:ids.length===1?generateIcsrEmail(heads.find(h=>h.record_id===ids[0]).snapshot.caseData).subject:`Potential ICSRs - ${ids.length} reviewed AskSocial cases`,recipients:"",body:`Please review the attached R3-aligned case summaries. Each selected case starts on its own page in the attached PDF. Long cases retain clearly labeled continuation pages.\n\nCase IDs:\n${ids.join("\n")}\n\n${ICSR_ASSESSMENT}`});
 if(!email.body.includes(ICSR_ASSESSMENT))throw new Error("Retain the AskSocial assessment disclaimer.");
 const {data:id,error}=await db.rpc("prepare_pv_icsr_email",{p_principal:principal.principalId,p_actor:principal.actorId,p_payload:{caseIds:ids,email,cases:caseManifest,attachment}});
 if(error)throw new Error(error.message);
 return {id,email,attachment:{fileName:attachment.fileName,hash:attachment.hash,ranges:attachment.ranges},deliveryConfigured:Boolean(process.env.RESEND_API_KEY&&process.env.PV_SPONSOR_FROM_EMAIL)};
}
export async function queueEmailBatch(principal: PlatformPrincipal,id:string) {
 const {data,error}=await getSupabaseServerClient().from("pv_icsr_email_batches").select("*").eq("id",id).eq("principal_id",principal.principalId).eq("created_by",principal.actorId).maybeSingle();
 if(error||!data)throw Object.assign(new Error("Email preview not found."),{status:404});return data;
}
export async function sendQueueEmail(principal: PlatformPrincipal,input:any) {
 if(input.confirmSend!==true)throw new Error("Explicitly confirm sending this preview and its attachments.");
 const key=process.env.RESEND_API_KEY,from=process.env.PV_SPONSOR_FROM_EMAIL;
 if(!key||!from)throw new Error("Email delivery is not configured. Download the combined case PDF and send through your approved channel.");
 const db=getSupabaseServerClient(),batch=await queueEmailBatch(principal,input.batchId);
 const email=validateEmail(batch.payload.email);if(!email.recipients)throw new Error("Enter recipients and prepare a new preview before sending.");
 const {data:payload,error}=await db.rpc("claim_pv_icsr_email",{p_id:batch.id,p_principal:principal.principalId,p_actor:principal.actorId});
 if(error)throw Object.assign(new Error(error.message),{status:409});
 let status="needs_reconciliation", reference="", responseStatus=0;
 try {
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`icsr-email-${batch.id}`},signal:AbortSignal.timeout(20000),body:JSON.stringify({from,to:email.recipients.split(/[;,]/).map(v=>v.trim()),subject:email.subject,text:email.body,attachments:[{filename:payload.attachment.fileName,content:payload.attachment.content}]})});
  responseStatus=response.status;
  if(response.ok){ const result=await response.json();reference=typeof result.id==="string"?result.id:"";if(reference)status="provider_accepted"; }
  else if(response.status>=400&&response.status<500&&response.status!==408&&response.status!==409)status="failed";
 } catch { /* Ambiguous delivery is retained, never automatically resent. */ }
 const {error:finishError}=await db.rpc("finish_pv_icsr_email",{p_id:batch.id,p_principal:principal.principalId,p_actor:principal.actorId,p_status:status,p_reference:reference||`HTTP ${responseStatus||"unknown"}`});
 if(finishError)throw new Error("The provider request was attempted but its audit finalization failed. Do not resend; reconcile this batch with the provider.");
 if(status!=="provider_accepted")throw new Error(status==="failed"?"The provider rejected this request. No case was marked dispatched.":"Delivery outcome is uncertain. Do not resend; reconcile the retained batch with the provider.");
 return {status,providerReference:reference,message:"Email accepted by the provider. Sponsor receipt is not yet confirmed."};
}

/** Records a user's completed external send; performs no network transmission. */
export async function markQueueEmailSent(principal: PlatformPrincipal,input:any) {
 if(input.manualConfirmation!==true || typeof input.deliveryReference!=="string" || !input.deliveryReference.trim() || input.deliveryReference.length>1000)throw new Error("Attest that this exact email/PDF was already sent and provide the external delivery reference.");
 const db=getSupabaseServerClient(),batch=await queueEmailBatch(principal,input.batchId);
 const email=validateEmail(batch.payload.email);if(!email.recipients)throw new Error("Record recipients in a prepared preview first.");
 const {error}=await db.rpc("claim_pv_icsr_email",{p_id:batch.id,p_principal:principal.principalId,p_actor:principal.actorId});if(error)throw Object.assign(new Error(error.message),{status:409});
 const {error:finishError}=await db.rpc("finish_pv_icsr_email",{p_id:batch.id,p_principal:principal.principalId,p_actor:principal.actorId,p_status:"manual_sent",p_reference:input.deliveryReference.trim()});
 if(finishError)throw new Error("External-send attestation could not be finalized. Do not send again; reconcile the retained batch.");
 return {status:"manual_sent",message:"External send recorded from your attestation. AskSocial did not transmit this email; sponsor receipt remains unconfirmed."};
}
