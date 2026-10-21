import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { outwardStructuredAssessment } from "./structured";
import { generateIcsrEmail, fieldLabel, ICSR_ASSESSMENT } from "./email";
import { displayField, importantMissingInformation } from "./case";
import { SERIOUSNESS_FIELDS } from "./types";
import type { CaseField, R3AlignedCase } from "./types";

/** Case-sheet layout based on the supplied sample; complete content flows to labelled continuations. */
export async function createIcsrCasePdf(c: R3AlignedCase, review: Record<string, any>) {
 const email = generateIcsrEmail(c); // Enforce approval and minimum-criteria validation before rendering.
 const pdf = await PDFDocument.create();
 const regular = await pdf.embedFont(StandardFonts.Helvetica);
 const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.04,.17,.15), teal=rgb(0,.43,.37), muted=rgb(.43,.43,.43), rule=rgb(.81,.81,.8);
 const printable=(s:string)=>s.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^\x09\x0a\x0d\x20-\x7e]/gu,ch=>`[U+${ch.codePointAt(0)!.toString(16).toUpperCase()}]`);
 function wrap(value:string,width:number,size=7.2,font=regular){
  const result:string[]=[];
  for(const paragraph of printable(String(value)).split(/\r?\n/)){
   let line="";
   for(const word of paragraph.split(/\s+/)){
    if(font.widthOfTextAtSize(word,size)>width){if(line){result.push(line);line="";}for(const ch of word){if(font.widthOfTextAtSize(line+ch,size)>width){result.push(line);line="";}line+=ch;}continue;}
    if(line&&font.widthOfTextAtSize(`${line} ${word}`,size)>width){result.push(line);line="";}line=line?`${line} ${word}`:word;
   }
   result.push(line);
  }
  return result;
 }
 let page=pdf.addPage([612,792]),y=0;
 const line=(x1:number,x2:number,at:number,dark=false)=>page.drawLine({start:{x:x1,y:at},end:{x:x2,y:at},thickness:dark?1.2:.4,color:dark?ink:rule});
 const draw=(text:string,x:number,at:number,size=7.2,strong=false,color=ink)=>page.drawText(printable(text),{x,y:at,size,font:strong?bold:regular,color});
 function header(continued=false){
  draw("AskSocial",40,756,14,true);draw("PV COMPLIANCE",150,757,7,false,muted);
  draw("R3-ALIGNED CASE SUMMARY",150,746,6.5,false,muted);
  draw("HUMAN REVIEWED",465,755,6.5,true,teal);line(40,572,738,true);
  draw(continued?`Case ${c.id} - continued`:`Case ${c.id}`,40,727,6.5,false,muted);
  y=714;
 }
 function next(){page=pdf.addPage([612,792]);header(true);}
 function ensure(height:number){if(y-height<49)next();}
 function row(label:string,value:string){
  const lines=wrap(value,420),labels=wrap(label.toUpperCase(),91,6.3,bold);
  let offset=0;
  do{
   ensure(Math.max(24,(labels.length+1)*8));
   const capacity=Math.max(1,Math.floor((y-49-12)/9));
   const chunk=lines.slice(offset,offset+capacity),height=Math.max(chunk.length*9,labels.length*8)+10;
   line(40,572,y);labels.forEach((v,i)=>draw(v,40,y-11-i*8,6.3,true,teal));
   chunk.forEach((v,i)=>draw(v,152,y-11-i*9));
   page.drawLine({start:{x:141,y},end:{x:141,y:y-height},thickness:.4,color:rule});
   y-=height;offset+=chunk.length;if(offset<lines.length)next();
  }while(offset<lines.length);
 }
 // Identical missing-value states are grouped without conflating unknown with unreported.
 function fields(values:Record<string,CaseField>){
  const result:string[]=[],missing=new Map<string,string[]>();
  for(const [key,f] of Object.entries(values)){
   const label=fieldLabel(key),value=displayField(f);
   if(f.availability==="reported"||f.availability==="requires_review")result.push(`${label}: ${value}${f.origin==="human_added"?" [reviewed]":""}`);
   else missing.set(value,[...(missing.get(value)||[]),label]);
  }
  for(const [state,labels] of missing)result.push(`${state}: ${labels.join("; ")}.`);
  return result.join("\n");
 }
 header();
 row("Subject",email.subject);
 ensure(44);draw("Potential Safety Case Identified",40,y-23,19,true);y-=36;line(40,572,y,true);
 const source=c.sourceEvidence[0];
 const metadata=[
  [["CASE ID",c.id],["DETECTION DATE",source.detectionTimestamp||"Not available from source"],["SOURCE URL",source.url],["AUTHOR",source.authorIdentifier||"Not reported"]],
  [["REPORT TYPE",displayField(c.identification.reportType)],["SOURCE",source.platform],["COUNTRY",displayField(c.identification.country)],["CASE STATUS",c.status.replaceAll("_"," ")]],
 ];
 const metaLines=metadata.map(column=>column.flatMap(([label,value])=>wrap(`${label}: ${value}`,252,6.8)));
 let metaOffset=0;
 const metaLength=Math.max(...metaLines.map(v=>v.length));
 while(metaOffset<metaLength){
  ensure(25);const count=Math.min(metaLength-metaOffset,Math.floor((y-49-14)/9));
  metaLines.forEach((column,i)=>column.slice(metaOffset,metaOffset+count).forEach((v,j)=>draw(v,40+i*272,y-12-j*9,6.8)));
  y-=count*9+14;metaOffset+=count;if(metaOffset<metaLength)next();
 }
 ensure(45);draw("MINIMUM ICSR CRITERIA",40,y-8,6.7,true,teal);y-=17;
 const names={patient:"IDENTIFIABLE PATIENT",reporter:"IDENTIFIABLE REPORTER",product:"SUSPECT PRODUCT",event:"ADVERSE EVENT"};
 const criteria=Object.entries(c.minimumCriteria).map(([key,v])=>[names[key as keyof typeof names],v.present==="present"?"Yes":v.present==="potentially_present"?"Requires Review":"Not Identified"]);
 line(40,572,y,true);criteria.forEach(([label,state],i)=>{const x=40+i*133;draw(label,x+5,y-12,5.8,false,muted);draw(state,x+5,y-25,8,true);});y-=35;line(40,572,y);y-=12;
 const products=c.suspectProducts.map((p,i)=>`Product ${i+1}\n${fields(p)}`).join("\n\n");
 const events=c.events.map((e,i)=>{
  const {seriousness,...detail}=e;
  const evidence=SERIOUSNESS_FIELDS.filter(k=>seriousness[k].value!=="evidence_absent_from_source").map(k=>`${fieldLabel(k)}: ${seriousness[k].value.replaceAll("_"," ")}${seriousness[k].evidence?` - "${seriousness[k].evidence}"`:""}`);
  const absent=SERIOUSNESS_FIELDS.filter(k=>seriousness[k].value==="evidence_absent_from_source").map(fieldLabel);
  return `Event ${i+1}\n${fields(detail)}\nSeriousness evidence (requires PV assessment):\n${evidence.join("\n")}${absent.length?`\nEvidence absent from source: ${absent.join("; ")}.`:""}`;
 }).join("\n\n");
 const columns=[fields(c.patient),products||"Not reported",events||"Not reported"].map(v=>wrap(v,164,7));
 let positions=[0,0,0];
 do{
  ensure(55);line(40,572,y,true);
  ["PATIENT","SUSPECT PRODUCT","ADVERSE EVENT(S)"].forEach((v,i)=>draw(v,40+i*179,y-12,6.7,true,teal));y-=23;
  const count=Math.min(Math.max(...columns.map((v,i)=>v.length-positions[i])),Math.floor((y-49-12)/8.5));
  const bottom=y-count*8.5-8;
  columns.forEach((v,i)=>{v.slice(positions[i],positions[i]+count).forEach((t,j)=>draw(t,40+i*179,y-j*8.5,7));positions[i]+=Math.min(count,v.length-positions[i]);if(i)page.drawLine({start:{x:30+i*179,y:y+23},end:{x:30+i*179,y:bottom},thickness:.4,color:rule});});
  y=bottom;line(40,572,y,true);
  if(columns.some((v,i)=>positions[i]<v.length))next();
 }while(columns.some((v,i)=>positions[i]<v.length));
 row("Case Narrative",`${c.narrative.value}${c.narrative.origin==="human_added"?" [reviewed]":""}`);
 row("Reporter",fields(c.reporter));
 row("Concomitant Products",c.concomitantProducts.length?c.concomitantProducts.map(fields).join("\n\n"):"Not reported.");
 row("Relevant Medical History",Object.values(c.medicalHistory).every(f=>f.availability==="not_reported")?"Not reported.":fields(c.medicalHistory));
 row("Source Evidence",c.sourceEvidence.map(s=>`"${s.excerpt}"\nORIGINAL SOURCE: ${s.url}\nPOSTED: ${s.publicationTimestamp||"Not available from source"} | PLATFORM: ${s.platform}\nDETECTED: ${s.detectionTimestamp} | MENTION: ${s.mentionId}`).join("\n\n"));
 const missingGroups=new Map<string,string[]>();
 for(const item of importantMissingInformation(c)){
  const split=item.lastIndexOf(": "),label=split<0?item:fieldLabel(item.slice(0,split)),state=split<0?"Not reported":item.slice(split+2);
  missingGroups.set(state,[...(missingGroups.get(state)||[]),label]);
 }
 row("Information Not Available",[...missingGroups].map(([state,labels])=>`${state}: ${labels.join("; ")}.`).join("\n")||"No outstanding missing fields recorded.");
 const narrative=review.validated_ae_ontology?.icsrAssessment?.clinicalNarrative||{};
 const details=Object.entries(narrative).filter(([k,v])=>!!String(v||"").trim()&&(k!=="clinicalCourse"||v!==c.narrative.value)).map(([k,v])=>`${fieldLabel(k)}: ${v}`).join("\n");
 if(details)row("Reviewed Clinical Details",details);
 row("PV Assessment",outwardStructuredAssessment(review.validated_ae_ontology,review.classifications).replaceAll("\n"," | "));
 row("AskSocial Assessment",ICSR_ASSESSMENT);
 row("Review Provenance",`Review ID: ${review.id} | Reviewer: ${review.reviewer_id} | Reviewed at: ${review.reviewed_at}\n[reviewed] identifies human additions/corrections; PV interpretations are separate from source facts. Unsupported glyphs are retained as [U+CODEPOINT].`);
 line(40,572,y,true);
 pdf.getPages().forEach((p,i)=>{p.drawLine({start:{x:40,y:35},end:{x:572,y:35},thickness:.8,color:ink});p.drawText(`CONFIDENTIAL PV REVIEW - NOT A REGULATORY SUBMISSION | Case page ${i+1}/${pdf.getPageCount()}`,{x:40,y:24,size:6,font:regular,color:muted});});
 const bytes=await pdf.save();return {bytes,hash:createHash("sha256").update(bytes).digest("hex"),fileName:`asksocial-case-${c.id}.pdf`};
}

/** Each case begins on a fresh page; continuation pages preserve long evidence in full. */
export async function combineIcsrCasePdfs(cases: Array<{recordId:string;content:string}>) {
 const report=await PDFDocument.create();const ranges=[];
 for(const item of cases){const source=await PDFDocument.load(Buffer.from(item.content,"base64"));const firstPage=report.getPageCount()+1;for(const page of await report.copyPages(source,source.getPageIndices()))report.addPage(page);ranges.push({recordId:item.recordId,firstPage,lastPage:report.getPageCount()});}
 const footerFont=await report.embedFont(StandardFonts.Helvetica);report.getPages().forEach((p,i)=>p.drawText(`Report page ${i+1}/${report.getPageCount()}`,{x:440,y:18,size:6.5,font:footerFont}));
 const bytes=await report.save();return {bytes,ranges,hash:createHash("sha256").update(bytes).digest("hex"),fileName:"asksocial-reviewed-icsr-cases.pdf"};
}
