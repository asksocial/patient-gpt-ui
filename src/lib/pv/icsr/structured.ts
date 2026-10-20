import { createHash } from "node:crypto";
import { buildR3AlignedCase, blankProduct, blankEvent, caseFields, emptyField, blankConcomitant, generateCaseNarrative } from "./case";
import { approveIcsr, applyCaseReview } from "./review";
import { generateIcsrEmail, ICSR_ASSESSMENT } from "./email";
import type { CaseField, IcsrSnapshot } from "./types";

/** Canonical Structured Review supplies human interpretations; source extraction is never overwritten. */
export function structuredIcsr(record: Record<string, any>, ontology: any, reportType: string, actor: string, at: string, previous?: IcsrSnapshot, reviewedFields: Record<string, any> = {}) {
  if (!["Initial", "Follow-up"].includes(reportType)) throw new Error("Select Initial or Follow-up in Structured Review.");
  const original = previous?.originalExtraction || buildR3AlignedCase(record);
  let c = structuredClone(previous?.caseData || original);
  const ref = c.sourceEvidence[0].id;
  const human = (value: unknown, evidence = "Confirmed in Structured Review"): CaseField => {
    const text = String(value || "").trim();
    return text ? { value: text, evidence, availability: "reported", source_reference: String(record.original_verbatim||"").includes(evidence)?ref:null, origin: "human_added", confidence: null, confirmed: true } : { ...emptyField(), confirmed: true };
  };
  const a = ontology?.icsrAssessment || {}, m = a.minimumCriteria || {};
  const keys = { patient: "identifiablePatient", reporter: "identifiableReporter", product: "suspectProduct", event: "adverseEventOrObservation" };
  for (const [key, mapped] of Object.entries(keys)) {
    const evidence = m[mapped]?.evidence || (key === "reporter" ? a.reporterAssessment?.verificationEvidence : "");
    if (m[mapped]?.status !== "yes" || !String(evidence || "").trim()) throw new Error("Minimum ICSR criteria require supporting evidence in Structured Review.");
    c.minimumCriteria[key] = { present: "present", evidence, confirmed: true, source_reference: String(record.original_verbatim||"").includes(evidence)?ref:null, confidence: null };
  }
  c.identification.reportType = human(reportType);
  c.patient.identifier = human(a.patientAssessment?.identifierBasis || m.identifiablePatient?.evidence);
  c.reporter.identifier = human(a.reporterAssessment?.identifierBasis || m.identifiableReporter?.evidence || a.reporterAssessment?.verificationEvidence);
  c.reporter.type = human(a.primarySourceType === "unknown" ? "" : a.primarySourceType);
  // Retain separate product/event arrays and any source-backed optional clinical data.
  const priorProducts=c.suspectProducts,priorEvents=c.events;
  c.suspectProducts=(ontology.productProcedures||[]).map((p:any)=>{
    const previous=priorProducts.find(v=>[v.brandName.value,v.genericName.value].some(name=>name.toLowerCase()===String(p.value).toLowerCase())) || (priorProducts.length===1&&ontology.productProcedures.length===1?priorProducts[0]:blankProduct());
    return {...previous,brandName:human(p.value,p.evidence||"Reviewed product statement")};
  });
  c.events=(ontology.adverseEvents||[]).map((e:any)=>{
    const previous=priorEvents.find(v=>v.normalizedEvent.value.toLowerCase()===String(e.value).toLowerCase()||v.verbatim.value===e.evidence) || (priorEvents.length===1&&ontology.adverseEvents.length===1?priorEvents[0]:blankEvent());
    return {...previous,normalizedEvent:human(e.value,e.evidence||"Reviewed event statement"),verbatim:previous.verbatim.value?previous.verbatim:human(record.original_verbatim,"Retained original source; event normalization is a human interpretation")};
  });
  if (c.events.length === 1) {
    if(ontology.timeToOnset?.value)c.events[0].onset = human(ontology.timeToOnset.value);
    if(ontology.outcomes?.[0]?.value)c.events[0].outcome = human(ontology.outcomes[0].value);
  }
  if(a.clinicalNarrative?.medicalHistory?.trim()) c.medicalHistory.conditions = human(a.clinicalNarrative.medicalHistory);
  const context=[a.clinicalNarrative?.concurrentConditions,a.clinicalNarrative?.diagnosisAndLaboratoryEvidence,a.clinicalNarrative?.alternativeCausesAndConfounders].filter(Boolean).join("; ");
  if(context)c.medicalHistory.otherContext=human(context);
  c.pvAssessment.seriousness = human(ontology.seriousness?.value);
  c.pvAssessment.expectedness = human(ontology.unexpectedness?.value);
  c.pvAssessment.causality = human((ontology.causality || []).map((v: any) => `Reporter wording: ${v.phrase}; reviewer classification: ${v.value}`).join("; "));
  c.narrative = human(a.clinicalNarrative?.clinicalCourse || (c.narrative.origin==="human_added"?c.narrative.value:generateCaseNarrative(c)), "Narrative explicitly reviewed during Structured Review completion");
  const allowed=/^(patient\.(age|ageGroup|sex|weight|medicalHistory|pregnancyStatus)|reporter\.(qualification|country)|identification\.country|suspectProducts\.\d+\.(genericName|activeIngredient|indication|dose|frequency|route|therapyStartDate|therapyEndDate|batchLot)|events\.\d+\.(onset|end|outcome|medicalIntervention|meddraTerm|meddraVersion|seriousness\.(death|lifeThreatening|hospitalization|disability|congenitalAnomaly|otherMedicallyImportant))|concomitantProducts\.\d+\.[^.]+|medicalHistory\.[^.]+|pvAssessment\.meddraCoding)$/;
  if(Object.keys(reviewedFields).some(path=>!allowed.test(path)))throw new Error("Use the canonical Structured Review controls for product, event and minimum criteria.");
  if(c.events.length>50||c.suspectProducts.length>50)throw new Error("Maximum 50 products/events per case.");
  for(const path of Object.keys(reviewedFields)){if(path.startsWith("concomitantProducts.")){const index=Number(path.split(".")[1]);if(index>=50)throw new Error("Maximum 50 concomitant products.");while(c.concomitantProducts.length<=index)c.concomitantProducts.push(blankConcomitant());}}
  c=applyCaseReview(c,{fields:Object.fromEntries(Object.entries(reviewedFields).map(([path,field])=>[path,{...field,confirmed:true}]))});
  c.approval = null;
  // Completion attests to the exact rendered preview, including explicit missing fields.
  for (const [, field] of caseFields(c)) field.confirmed = true;
  c.approval = null;
  const approved = approveIcsr(c, actor, at);
  return { revision: (previous?.revision || 0) + 1, originalExtraction: original, caseData: approved, email: null } satisfies IcsrSnapshot;
}
export function structuredPreviewHash(record: any, decision: any, revision: number) {
  const { previewHash: _hash, completionAttested: _attest, ...content } = decision;
  return createHash("sha256").update(JSON.stringify({ recordId: record.id, updatedAt: record.updated_at, revision, content })).digest("hex");
}
export function externalStructuredText(snapshot: IcsrSnapshot, ontology?: any, classifications?: string[]) {
  return generateIcsrEmail(snapshot.caseData).body + "\n\n" + outwardStructuredAssessment(ontology,classifications);
}
export function validatedQueueEmail(input: any) {
  if (!input || typeof input.subject !== "string" || typeof input.body !== "string" || typeof input.recipients !== "string") throw new Error("Complete the email preview.");
  if (!input.body.includes(ICSR_ASSESSMENT)) throw new Error("Retain the AskSocial assessment disclaimer.");
  return input;
}

/** Approved structured interpretations are explicitly labelled; internal notes never enter the document. */
export function outwardStructuredAssessment(o: any = {}, classifications: string[] = []) {
 const a=o?.icsrAssessment||{};
 return ["Human-reviewed assessment - separate from source facts",`Classifications: ${classifications.join("; ")||"Not reported"}`,`Reviewer seriousness assessment: ${o.seriousness?.value||"Not assessed"}`,`Reviewer seriousness criteria: ${(a.seriousnessCriteria||[]).join("; ")||"Not reported"}`,`Severity: ${o.severity?.value||"Not assessed"}`,`Expectedness assessment: ${o.unexpectedness?.value||"Not assessed"}; basis: ${o.unexpectedness?.basis||"Not reported"}`,`Reporter causality wording / reviewer language classification: ${(o.causality||[]).map((c:any)=>`${c.phrase} / ${c.value}`).join("; ")||"Not reported"}`,`Follow-up needed: ${a.followUp?.needed||"Not assessed"}`,`Follow-up questions: ${a.followUp?.questions||"Not reported"}`,`Duplicate assessment: ${a.duplicateAssessment?.status||"Not assessed"}`].join("\n");
}
