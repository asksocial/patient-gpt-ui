import { generateIcsrEmail, ICSR_ASSESSMENT } from "./email";
import { applyCaseReview, approveIcsr, validateEmail, validateIcsrReview } from "./review";
import type { IcsrSnapshot } from "./types";

/** Pure, testable workflow; all persistence and authenticated identity stay in the service. */
export function transitionIcsrSnapshot(previous: IcsrSnapshot, input: any, actor: string, timestamp: string): IcsrSnapshot {
  const next: IcsrSnapshot = structuredClone(previous);
  switch (input.action) {
    case "save_review":
      next.caseData = applyCaseReview(next.caseData, input.review || {});
      next.email = null;
      break;
    case "approve":
      next.caseData = approveIcsr(next.caseData, actor, timestamp);
      next.email = null;
      break;
    case "generate":
      next.email = generateIcsrEmail(next.caseData);
      next.caseData.status = "email_ready";
      break;
    case "save_email":
    case "sent":
    case "export":
      if (!next.caseData.approval || !next.email || validateIcsrReview(next.caseData).issues.length) throw new Error("Generate a preview from an approved case first.");
      next.email = validateEmail(input.email);
      // The assessment remains visible even when email content is edited.
      if (!next.email.body.includes(ICSR_ASSESSMENT)) throw new Error("Retain the AskSocial assessment and regulatory-submission disclaimer.");
      next.caseData.status = input.action === "sent" ? "sent" : input.action === "export" ? "exported" : "email_ready";
      if (input.action === "sent" && (!next.email.recipients || input.sentConfirmation !== true)) throw new Error("Confirm the notification was sent externally and record recipients.");
      break;
    default: throw new Error("Unsupported ICSR action.");
  }
  next.revision += 1;
  return next;
}
