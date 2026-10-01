import { blankConcomitant, blankEvent, blankProduct, caseFields } from "./case";
import type { Availability, CaseField, IcsrEmail, IcsrSnapshot, MinimumCriterion, R3AlignedCase } from "./types";

const AVAILABILITY: Availability[] = ["reported", "not_reported", "unknown", "not_available_from_source", "requires_review"];
function limitedString(value: unknown, max = 20000): string {
  if (typeof value !== "string" || value.length > max) throw new Error("Invalid or oversized review value.");
  return value.trim();
}
export type ReviewInput = {
  fields?: Record<string, Pick<CaseField, "value" | "availability" | "evidence" | "source_reference" | "confirmed">>;
  criteria?: Record<string, Pick<MinimumCriterion, "present" | "evidence" | "source_reference" | "confirmed">>;
  internalNotes?: string;
  add?: "product" | "event" | "concomitant";
};
/** Apply allowlisted field edits to a server-owned snapshot, not an arbitrary client case. */
export function applyCaseReview(previous: R3AlignedCase, input: ReviewInput): R3AlignedCase {
  const next: R3AlignedCase = structuredClone(previous);
  if (input.add) {
    if (input.add === "product") next.suspectProducts.push(blankProduct());
    else if (input.add === "event") next.events.push(blankEvent());
    else if (input.add === "concomitant") next.concomitantProducts.push(blankConcomitant());
    else throw new Error("Unsupported case section.");
    if (Math.max(next.suspectProducts.length, next.events.length, next.concomitantProducts.length) > 50) throw new Error("Maximum 50 entries per section.");
  }
  const fields = new Map(caseFields(next));
  for (const [path, edit] of Object.entries(input.fields || {})) {
    const existing = fields.get(path);
    if (!existing || !edit || !AVAILABILITY.includes(edit.availability) || typeof edit.confirmed !== "boolean") throw new Error(`Invalid case field: ${path}`);
    const value = limitedString(edit.value);
    const evidence = limitedString(edit.evidence);
    const reference = edit.source_reference === null ? null : limitedString(edit.source_reference, 500);
    if (reference && !next.sourceEvidence.some(source => source.id === reference)) throw new Error("Unknown source reference.");
    if (edit.availability === "reported" && !value) throw new Error(`${path}: reported values must not be empty.`);
    if (["not_reported", "not_available_from_source"].includes(edit.availability) && value && !path.includes(".seriousness.")) throw new Error(`${path}: clear the value when marking information missing.`);
    if (path.includes(".seriousness.") && !["evidence_present", "evidence_absent_from_source", "requires_pv_review"].includes(value)) throw new Error("Invalid seriousness evidence state.");
    if (path === "identification.reportType" && !["Initial", "Follow-up"].includes(value)) throw new Error("Report type must be Initial or Follow-up.");
    const changed = value !== existing.value || evidence !== existing.evidence || reference !== existing.source_reference || edit.availability !== existing.availability;
    Object.assign(existing, { value, evidence, source_reference: reference, availability: edit.availability, confirmed: edit.confirmed, ...(changed ? { origin: "human_added", confidence: null } : {}) });
  }
  for (const [key, edit] of Object.entries(input.criteria || {})) {
    if (!Object.hasOwn(next.minimumCriteria, key) || !edit || !["present", "potentially_present", "not_identified"].includes(edit.present) || typeof edit.confirmed !== "boolean") throw new Error("Invalid minimum criterion.");
    const existing = next.minimumCriteria[key as keyof typeof next.minimumCriteria];
    const evidence = limitedString(edit.evidence);
    const reference = edit.source_reference === null ? null : limitedString(edit.source_reference, 500);
    if (reference && !next.sourceEvidence.some(source => source.id === reference)) throw new Error("Unknown criterion source reference.");
    Object.assign(existing, { present: edit.present, evidence, source_reference: reference, confirmed: edit.confirmed, confidence: edit.present === existing.present && evidence === existing.evidence ? existing.confidence : null });
  }
  if (input.internalNotes !== undefined) next.internalNotes = limitedString(input.internalNotes);
  // Every edit requires renewed approval and regeneration; previous email remains in the revision ledger.
  next.status = "requires_review";
  next.approval = null;
  return next;
}

export function validateIcsrReview(caseData: R3AlignedCase): { completePotentialIcsr: boolean; label: string; issues: string[] } {
  const issues: string[] = [];
  const completePotentialIcsr = Object.values(caseData.minimumCriteria).every(criterion => criterion.present === "present" && criterion.evidence.trim() && (criterion.source_reference || criterion.confirmed));
  if (!completePotentialIcsr) issues.push("Minimum ICSR criteria require evidence and human review.");
  for (const [key, criterion] of Object.entries(caseData.minimumCriteria)) {
    if (!criterion.confirmed) issues.push(`Confirm minimum criterion: ${key}.`);
    if (criterion.present === "present" && !criterion.evidence.trim()) issues.push(`Evidence required for minimum criterion: ${key}.`);
  }
  if (!caseData.suspectProducts.some(product => [product.brandName, product.genericName, product.activeIngredient].some(field => field.availability === "reported" && field.value.trim()))) issues.push("At least one suspect medicinal product is required.");
  if (!caseData.events.some(event => event.verbatim.availability === "reported" && event.verbatim.value.trim())) issues.push("At least one reported adverse event is required.");
  for (const [path, field] of caseFields(caseData)) {
    if (!field.confirmed) issues.push(`Confirm field: ${path}.`);
    if (field.availability === "reported" && !field.value.trim()) issues.push(`Reported field is empty: ${path}.`);
    if (field.availability === "reported" && !field.evidence.trim() && !path.startsWith("pvAssessment.")) issues.push(`Document supporting evidence: ${path}.`);
    if (field.availability === "unknown" && !field.evidence.trim()) issues.push(`Document the explicit unknown statement: ${path}.`);
    if (field.source_reference && !caseData.sourceEvidence.some(source => source.id === field.source_reference)) issues.push(`Invalid provenance: ${path}.`);
  }
  if (!caseData.narrative.value.trim()) issues.push("Review a factual case narrative.");
  if (caseData.identification.reportType.availability !== "reported") issues.push("Confirm Initial or Follow-up report type.");
  caseData.events.forEach((event, index) => {
    if (event.meddraTerm.value && (!event.meddraVersion.value || !caseData.pvAssessment.meddraCoding.value)) issues.push(`Event ${index + 1}: MedDRA requires an approved coding process, version, and human coding assessment.`);
  });
  return { completePotentialIcsr, label: completePotentialIcsr ? "Complete potential ICSR — subject to PV review" : "Potential Safety Signal — Minimum ICSR Criteria Require Review", issues };
}

export function approveIcsr(caseData: R3AlignedCase, actor: string, timestamp: string): R3AlignedCase {
  const validation = validateIcsrReview(caseData);
  if (validation.issues.length) throw new Error(validation.issues.join("\n"));
  return { ...caseData, approval: { reviewer: actor, timestamp }, status: "reviewed" };
}

export function validateEmail(input: unknown): IcsrEmail {
  if (!input || typeof input !== "object") throw new Error("Email preview is required.");
  const email = input as IcsrEmail;
  const subject = limitedString(email.subject, 998);
  const recipients = limitedString(email.recipients, 2000);
  const body = limitedString(email.body, 150000);
  if (!subject || !body || /[\r\n]/.test(subject + recipients)) throw new Error("Email subject/content is required; header newlines are not allowed.");
  if (recipients && recipients.split(/[;,]/).some(value => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim()))) throw new Error("Enter email addresses separated by commas or semicolons.");
  return { subject, recipients, body };
}

export function changedPaths(before: IcsrSnapshot | null, after: IcsrSnapshot): string[] {
  const changes: string[] = [];
  const walk = (oldValue: any, newValue: any, path: string) => {
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;
    if (newValue && typeof newValue === "object") {
      for (const key of new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue)])) walk(oldValue?.[key], newValue[key], path ? `${path}.${key}` : key);
    } else changes.push(path);
  };
  walk(before, after, "");
  return changes;
}
