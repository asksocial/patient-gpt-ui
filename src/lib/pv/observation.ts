import { createHash } from "node:crypto";
import { getPvRecord, appendPvAuditEvent } from "./service";
import { getSupabaseServerClient } from "../supabase/server";
import type { PlatformPrincipal } from "../intelligence-platform/persistence";
export async function prepareObservationPackage(principal: PlatformPrincipal, recordId: string, destination: string) {
  if (!destination.trim()) throw new Error("An assessment destination reference is required.");
  const { record, reviews } = await getPvRecord(principal, recordId);
  const review = reviews[0];
  if (record.status !== "ready_for_transfer" || review?.decision !== "forward_observation") throw new Error("A current incomplete-observation review is required.");
  const payload = { type: "incomplete_observation", assessment: "Incomplete observation for sponsor assessment; not an approved ICSR. No transmission performed.", recordId, evidence: { verbatim: record.original_verbatim, sourceUrl: record.source_url, evidenceHash: record.evidence_hash }, review, followUp: { owner: record.follow_up_owner, dueAt: record.follow_up_due_at }, reportabilityIdentifiedAt: record.reportability_identified_at || null };
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const db = getSupabaseServerClient();
  const { data: existing, error: lookupError } = await db.from("pv_transfers").select("*").eq("record_id", recordId).eq("principal_id", principal.principalId).eq("destination", destination.trim()).eq("payload_hash", payloadHash).eq("transfer_method", "manual_export").maybeSingle();
  if (lookupError) throw new Error("Could not verify an existing observation package.");
  if (existing) return existing;
  const { data, error } = await db.from("pv_transfers").insert({ principal_id: principal.principalId, record_id: recordId, destination: destination.trim(), transfer_method: "manual_export", status: "queued", payload, payload_hash: payloadHash, transferred_by: principal.actorId }).select("*").single();
  if (error) throw new Error(`Could not prepare observation package: ${error.message}`);
  await appendPvAuditEvent(principal, { action: "observation.package", resourceType: "pv_record", resourceId: recordId, outcome: "completed", metadata: { transferId: data.id, payloadHash, transmissionPerformed: false } });
  return data;
}
