import type { PlatformPrincipal } from "../../intelligence-platform/persistence";
import { getSupabaseServerClient } from "../../supabase/server";
import { appendPvAuditEvent, getPvRecord } from "../service";
import { buildR3AlignedCase } from "./case";
import { exportIcsrSummary } from "./email";
import { changedPaths, validateIcsrReview } from "./review";
import { transitionIcsrSnapshot } from "./workflow";
import type { IcsrSnapshot } from "./types";

export async function getIcsrCase(principal: PlatformPrincipal, recordId: string) {
  const detail = await getPvRecord(principal, recordId);
  const db = getSupabaseServerClient();
  const [{ data: stored, error }, { data: history, error: historyError }] = await Promise.all([
    db.from("pv_icsr_cases").select("snapshot").eq("record_id", recordId).eq("principal_id", principal.principalId).maybeSingle(),
    db.from("pv_icsr_case_revisions").select("revision,action,changes,reviewer_id,reviewed_at,snapshot").eq("record_id", recordId).eq("principal_id", principal.principalId).order("revision", { ascending: false }).limit(100),
  ]);
  if (error || historyError) throw new Error(`ICSR review storage unavailable. Apply the ICSR migration. ${error?.message || historyError?.message}`);
  const extracted = stored ? null : buildR3AlignedCase(detail.record);
  const snapshot: IcsrSnapshot = stored?.snapshot || { revision: 0, originalExtraction: extracted, caseData: extracted, email: null };
  return { snapshot, history: history || [], validation: validateIcsrReview(snapshot.caseData) };
}

export async function updateIcsrCase(principal: PlatformPrincipal, recordId: string, input: any) {
  if (!Number.isInteger(input.revision) || input.revision < 0) throw new Error("Expected revision is required.");
  const current = await getIcsrCase(principal, recordId);
  if (input.revision !== current.snapshot.revision) throw Object.assign(new Error("Another reviewer changed this case. Reload before saving."), { status: 409 });
  const next = transitionIcsrSnapshot(current.snapshot, input, principal.actorId, new Date().toISOString());
  const changes = changedPaths(current.snapshot.revision ? current.snapshot : null, next);
  const { error } = await getSupabaseServerClient().rpc("save_pv_icsr_revision", {
    p_record_id: recordId, p_principal_id: principal.principalId, p_actor_id: principal.actorId,
    p_expected_revision: current.snapshot.revision, p_action: input.action, p_snapshot: next, p_changes: changes,
  });
  if (error) throw Object.assign(new Error(error.message.includes("revision conflict") ? "Another reviewer changed this case. Reload before saving." : `Failed to save ICSR revision: ${error.message}`), { status: error.message.includes("revision conflict") ? 409 : 400 });
  // Full source/clinical changes stay in the protected revision ledger; shared audit metadata is minimal.
  await appendPvAuditEvent(principal, { action: `icsr.${input.action}`, resourceType: "pv_record", resourceId: recordId, outcome: "completed", metadata: { revision: next.revision, changes, status: next.caseData.status, transmissionPerformed: false } });
  return { snapshot: next, validation: validateIcsrReview(next.caseData), ...(input.action === "export" ? { exportedSummary: exportIcsrSummary(next.caseData, next.email!) } : {}) };
}
