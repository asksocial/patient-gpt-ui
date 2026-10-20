import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { outwardStructuredAssessment } from "./structured";
import { generateIcsrEmail } from "./email";
import type { R3AlignedCase } from "./types";

/** Paginated, unabridged external representation. Internal notes/assessment never enter it. */
export async function createIcsrCasePdf(c: R3AlignedCase, review: Record<string, any>) {
 const pdf = await PDFDocument.create();
 const regular = await pdf.embedFont(StandardFonts.Helvetica);
 const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
 // Preserve unsupported glyphs visibly as code points, never silently omit source characters.
 const printable = (s: string) => s.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^\x09\x0a\x0d\x20-\x7e]/gu, ch => `[U+${ch.codePointAt(0)!.toString(16).toUpperCase()}]`);
 const narrative = review.validated_ae_ontology?.icsrAssessment?.clinicalNarrative || {};
 const body=generateIcsrEmail(c).body.replaceAll(" [Human-reviewed addition/correction]"," [reviewed]").replace(/Information Not Available\n[\s\S]*?\n\nAskSocial Assessment\n/,"Information Not Available\nMissing and explicitly unknown values are identified in their respective sections above.\n\nAskSocial Assessment\n");
 const text = `${body}\n\nStructured Review clinical details\n${Object.entries(narrative).filter(([k,v])=>!!String(v||"").trim()&&(k!=="clinicalCourse"||v!==c.narrative.value)).map(([k,v])=>`${k}: ${v || "Not reported"}`).join("\n")}\n\n${outwardStructuredAssessment(review.validated_ae_ontology,review.classifications)}\n\nReview provenance\nReview ID: ${review.id}\nReviewer: ${review.reviewer_id}\nReviewed at: ${review.reviewed_at}\nUnsupported source glyphs, if any, are retained as [U+CODEPOINT].`;
 let page: any, y=0, column=0;
 const headings=new Set(["Potential Safety Case Identified","Minimum ICSR Criteria","Patient","Reporter","Suspect Product","Adverse Event(s)","Case Narrative","Concomitant Products","Relevant Medical History","Source Evidence","Information Not Available","AskSocial Assessment","Structured Review clinical details","Review provenance","Human-reviewed assessment - separate from source facts"]);
 function next(){page=pdf.addPage([612,792]);y=718;column=0;page.drawText("AskSocial | R3-aligned safety case",{x:40,y:758,size:13,font:bold,color:rgb(.06,.25,.24)});page.drawText(`Case ${c.id}${pdf.getPageCount()>1?" (continued)":""}`,{x:40,y:742,size:8,font:regular});page.drawText("Source statements and reviewer additions are distinguished; [reviewed] indicates human input.",{x:40,y:729,size:7,font:regular});page.drawLine({start:{x:306,y:716},end:{x:306,y:52},thickness:.5,color:rgb(.85,.88,.88)});}
 function space(height=12){if(y-height<52){if(column===0){column=1;y=718;}else next();}}
 next();
 for(const paragraph of printable(text).split(/\r?\n/)){
  if(!paragraph){space(6);y-=6;continue;}
  const heading=headings.has(paragraph),font=heading?bold:regular,size=heading?9:8;
  space(heading?30:12);
  let line="";
  const flush=()=>{space();page.drawText(line,{x:column===0?40:320,y,size,font,color:heading?rgb(.06,.25,.24):rgb(.1,.13,.14)});y-=11;line="";};
  for(const word of paragraph.split(/\s+/)){
   if(font.widthOfTextAtSize(word,size)>252){if(line)flush();for(const ch of word){if(font.widthOfTextAtSize(line+ch,size)>252)flush();line+=ch;}continue;}
   const candidate=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(candidate,size)>252)flush();line=line?`${line} ${word}`:word;
  }
  if(line)flush();if(heading)y-=3;
 }
 pdf.getPages().forEach((p,i)=>p.drawText(`Confidential PV review | Not a regulatory submission | Case page ${i+1}/${pdf.getPageCount()}`,{x:46,y:31,size:7,font:regular}));
 const bytes=await pdf.save();
 return { bytes, hash:createHash("sha256").update(bytes).digest("hex"), fileName:`asksocial-case-${c.id}.pdf` };
}

/** Each case begins on a fresh page; continuation pages preserve long evidence in full. */
export async function combineIcsrCasePdfs(cases: Array<{recordId:string;content:string}>) {
 const report=await PDFDocument.create();const ranges=[];
 for(const item of cases){const source=await PDFDocument.load(Buffer.from(item.content,"base64"));const firstPage=report.getPageCount()+1;for(const page of await report.copyPages(source,source.getPageIndices()))report.addPage(page);ranges.push({recordId:item.recordId,firstPage,lastPage:report.getPageCount()});}
 const footerFont=await report.embedFont(StandardFonts.Helvetica);report.getPages().forEach((p,i)=>p.drawText(`Report page ${i+1}/${report.getPageCount()}`,{x:440,y:18,size:6.5,font:footerFont}));
 const bytes=await report.save();return {bytes,ranges,hash:createHash("sha256").update(bytes).digest("hex"),fileName:"asksocial-reviewed-icsr-cases.pdf"};
}
