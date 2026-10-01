import { displayField, importantMissingInformation } from "./case";
import { validateIcsrReview } from "./review";
import { EVENT_FIELDS, SERIOUSNESS_FIELDS } from "./types";
import type { CaseField, IcsrEmail, R3AlignedCase } from "./types";

export const ICSR_ASSESSMENT = "AskSocial identified this record as a potential safety case based on the available source evidence. The information above is intended to support pharmacovigilance review. Final case validity, seriousness, causality, expectedness, MedDRA coding, reportability, and regulatory submission decisions remain subject to review by qualified pharmacovigilance personnel. This email is R3-aligned intake information, not an E2B(R3) regulatory submission.";
export const fieldLabel = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase());
function lines(fields: Record<string, CaseField>): string {
  return Object.entries(fields).map(([key, field]) => `${fieldLabel(key)}: ${displayField(field)}${field.origin === "human_added" ? " [Human-reviewed addition/correction]" : ""}`).join("\n");
}
/** No transport side effects. Only current, explicitly approved snapshots can generate a preview. */
export function generateIcsrEmail(caseData: R3AlignedCase): IcsrEmail {
  if (!caseData.approval || validateIcsrReview(caseData).issues.length) throw new Error("Human review and approval are required before email generation.");
  const product = caseData.suspectProducts.map(item => item.brandName.value || item.genericName.value || item.activeIngredient.value).filter(Boolean).join(" / ");
  const event = caseData.events.map(item => item.normalizedEvent.value || item.verbatim.value).join(" / ");
  const source = caseData.sourceEvidence[0];
  const criteria = Object.entries(caseData.minimumCriteria).map(([key, criterion]) => `${{ patient: "Identifiable Patient", reporter: "Identifiable Reporter", product: "Suspect Product", event: "Adverse Event" }[key]}: ${criterion.present === "present" ? "Yes" : criterion.present === "potentially_present" ? "Requires Review" : "Not Identified"}${key === "product" ? ` — ${product}` : key === "event" ? ` — ${event}` : ""}`).join("\n");
  const events = caseData.events.map((item, index) => `Event ${index + 1}\n${lines(Object.fromEntries(EVENT_FIELDS.map(key => [key, item[key]])))}\nSeriousness evidence (classification requires PV assessment):\n${SERIOUSNESS_FIELDS.map(key => `${fieldLabel(key)}: ${item.seriousness[key].value.replaceAll("_", " ")}${item.seriousness[key].evidence ? ` — “${item.seriousness[key].evidence}”` : ""}`).join("\n")}`).join("\n\n");
  const sections = [
    ["Potential Safety Case Identified", `Case ID: ${caseData.id}\nReport Type: ${displayField(caseData.identification.reportType)}\nDetection Date: ${source.detectionTimestamp || "Not available from source"}\nSource: ${source.platform}\nSource URL: ${source.url}\nCountry: ${displayField(caseData.identification.country)}`],
    ["Minimum ICSR Criteria", criteria], ["Patient", lines(caseData.patient)], ["Reporter", lines(caseData.reporter)],
    ["Suspect Product", caseData.suspectProducts.map((item, index) => `Product ${index + 1}\n${lines(item)}`).join("\n\n")],
    ["Adverse Event(s)", events], ["Case Narrative", caseData.narrative.value],
    ["Concomitant Products", caseData.concomitantProducts.length ? caseData.concomitantProducts.map(lines).join("\n\n") : "Not reported."],
    ["Relevant Medical History", Object.values(caseData.medicalHistory).every(field => field.availability === "not_reported") ? "Not reported." : lines(caseData.medicalHistory)],
    ["Source Evidence", caseData.sourceEvidence.map(item => `Relevant source excerpt:\n“${item.excerpt}”\nOriginal source URL: ${item.url}\nPlatform: ${item.platform}\nPublication date/time: ${item.publicationTimestamp || "Not available from source"}\nDetection date/time: ${item.detectionTimestamp}\nInternal mention ID: ${item.mentionId}`).join("\n\n")],
    ["Information Not Available", importantMissingInformation(caseData).join("; ") || "No outstanding missing fields recorded."],
    ["AskSocial Assessment", ICSR_ASSESSMENT],
  ];
  // Header sanitization; source text is preserved in the plain-text body only.
  return { subject: `Potential ICSR – ${product} – ${event} – AskSocial Case ${caseData.id}`.replace(/[\r\n]+/g, " ").slice(0, 998), recipients: "", body: sections.map(([heading, content]) => `${heading}\n${content}`).join("\n\n") };
}

/** Internal notes and provisional PV judgments are never included in the external case export. */
export function exportIcsrSummary(caseData: R3AlignedCase, email: IcsrEmail) {
  const { internalNotes: _notes, pvAssessment: _assessment, ...summary } = caseData;
  return { representation: "R3-aligned human-reviewed intake; not a regulatory submission", case: summary, email };
}
