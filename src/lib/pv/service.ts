import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "../supabase/server";
import type { PlatformPrincipal } from "../intelligence-platform/persistence";
import { calculatePvClock } from "./clock";
import { classifyPvContent } from "./detection";
import { reconcilePvOperations } from "./reconciliation";
import type {
  PvContentInput,
  PvDetectionConcept,
  PvReviewDecision,
  PvSlaPolicy,
} from "./types";

const DEFAULT_SLA: PvSlaPolicy = {
  reviewMinutes: 24 * 60,
  transferMinutes: 24 * 60,
  acknowledgmentMinutes: 48 * 60,
  clockStart: "posted_at",
  timezone: "UTC",
};

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertPrincipal(principal: PlatformPrincipal) {
  if (!principal.principalId.trim() || !principal.actorId.trim()) throw new Error("A PV principal and actor are required.");
}

export async function appendPvAuditEvent(
  principal: PlatformPrincipal,
  input: {
    action: string;
    resourceType: string;
    resourceId?: string;
    outcome: "allowed" | "denied" | "completed" | "failed";
    metadata?: Record<string, unknown>;
    occurredAt?: string;
  }
) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const { data: previous, error: previousError } = await supabase.from("pv_audit_events")
    .select("event_hash").eq("principal_id", principal.principalId).order("occurred_at", { ascending: false }).limit(1).maybeSingle();
  if (previousError) throw new Error(`Failed to read PV audit chain: ${previousError.message}`);
  const occurredAt = input.occurredAt || new Date().toISOString();
  const previousHash = previous?.event_hash || "GENESIS";
  const eventHash = hashPayload({ principalId: principal.principalId, actorId: principal.actorId, ...input, occurredAt, previousHash });
  const { data, error } = await supabase.from("pv_audit_events").insert({
    principal_id: principal.principalId,
    actor_id: principal.actorId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId || null,
    outcome: input.outcome,
    metadata: input.metadata || {},
    previous_hash: previousHash,
    event_hash: eventHash,
    occurred_at: occurredAt,
  }).select("*").single();
  if (error || !data) throw new Error(`Failed to append PV audit event: ${error?.message || "missing row"}`);
  return data;
}

export async function listPvDetectionLibrary(principal: PlatformPrincipal) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const [{ data: libraries, error: libraryError }, { data: concepts, error: conceptError }] = await Promise.all([
    supabase.from("pv_detection_libraries").select("*").eq("principal_id", principal.principalId).order("updated_at", { ascending: false }),
    supabase.from("pv_detection_concepts").select("*").eq("principal_id", principal.principalId).order("category").order("canonical_term"),
  ]);
  if (libraryError || conceptError) throw new Error(`Failed to load PV Detection Library: ${libraryError?.message || conceptError?.message}`);
  return { libraries: libraries || [], concepts: concepts || [] };
}

export async function createPvDetectionLibrary(
  principal: PlatformPrincipal,
  input: { name: string; sponsorName?: string; productId?: string; market?: string; language?: string; detectionThreshold?: number }
) {
  assertPrincipal(principal);
  if (!input.name.trim()) throw new Error("Library name is required.");
  const { data, error } = await getSupabaseServerClient().from("pv_detection_libraries").insert({
    principal_id: principal.principalId,
    name: input.name.trim(), sponsor_name: input.sponsorName?.trim() || null, product_id: input.productId?.trim() || null,
    market: input.market?.trim() || null, language: input.language?.trim() || "en",
    detection_threshold: Math.max(1, Math.min(100, input.detectionThreshold ?? 55)), created_by: principal.actorId,
  }).select("*").single();
  if (error || !data) throw new Error(`Failed to create PV Detection Library: ${error?.message || "missing row"}`);
  await appendPvAuditEvent(principal, { action: "detection_library.create", resourceType: "detection_library", resourceId: String(data.id), outcome: "completed", metadata: { version: 1 } });
  return data;
}

export async function activatePvDetectionLibrary(principal: PlatformPrincipal, libraryId: string) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const { count, error: conceptError } = await supabase.from("pv_detection_concepts").select("id", { count: "exact", head: true })
    .eq("library_id", libraryId).eq("principal_id", principal.principalId).eq("active", true);
  if (conceptError) throw new Error(`Failed to validate PV Detection Library: ${conceptError.message}`);
  if (!count) throw new Error("At least one active concept is required before library approval.");
  const approvedAt = new Date().toISOString();
  const { data, error } = await supabase.from("pv_detection_libraries").update({
    status: "active", approved_by: principal.actorId, approved_at: approvedAt, updated_at: approvedAt,
  }).eq("id", libraryId).eq("principal_id", principal.principalId).select("*").single();
  if (error || !data) throw new Error(`Failed to activate PV Detection Library: ${error?.message || "missing row"}`);
  await appendPvAuditEvent(principal, { action: "detection_library.approve", resourceType: "detection_library", resourceId: libraryId, outcome: "completed", metadata: { version: data.version, conceptCount: count } });
  return data;
}

export async function createPvDetectionConcept(
  principal: PlatformPrincipal,
  input: Omit<PvDetectionConcept, "id" | "version"> & { libraryId: string }
) {
  assertPrincipal(principal);
  if (!input.libraryId || !input.canonicalTerm.trim() || !input.terms.length) throw new Error("Library, canonical term, and at least one detection term are required.");
  const supabase = getSupabaseServerClient();
  const { data: library } = await supabase.from("pv_detection_libraries").select("id,version").eq("id", input.libraryId).eq("principal_id", principal.principalId).maybeSingle();
  if (!library) throw new Error("PV Detection Library not found.");
  const { data, error } = await supabase.from("pv_detection_concepts").insert({
    library_id: input.libraryId, principal_id: principal.principalId, category: input.category,
    canonical_term: input.canonicalTerm.trim(), terms: input.terms.map((term) => term.trim()).filter(Boolean),
    exclusions: (input.exclusions || []).map((term) => term.trim()).filter(Boolean), product_id: input.productId || null,
    language: input.language || "en", market: input.market || null, weight: Math.max(0, Math.min(100, input.weight)),
    active_from: input.activeFrom || null, active_until: input.activeUntil || null, version: Number(library.version), active: input.active,
    created_by: principal.actorId,
  }).select("*").single();
  if (error || !data) throw new Error(`Failed to create PV detection concept: ${error?.message || "missing row"}`);
  await appendPvAuditEvent(principal, { action: "detection_concept.create", resourceType: "detection_concept", resourceId: String(data.id), outcome: "completed", metadata: { libraryId: input.libraryId, category: input.category } });
  return data;
}

export async function listPvSources(principal: PlatformPrincipal) {
  assertPrincipal(principal);
  const { data, error } = await getSupabaseServerClient().from("pv_sources").select("*")
    .eq("principal_id", principal.principalId).order("active", { ascending: false }).order("name");
  if (error) throw new Error(`Failed to load PV sources: ${error.message}`);
  return data || [];
}

export async function listPvScreeningRuns(principal: PlatformPrincipal, limit = 100) {
  assertPrincipal(principal);
  const { data, error } = await getSupabaseServerClient().from("pv_screening_runs").select("*, pv_sources(name,source_type)")
    .eq("principal_id", principal.principalId).order("started_at", { ascending: false }).limit(Math.max(1, Math.min(200, limit)));
  if (error) throw new Error(`Failed to load PV screening runs: ${error.message}`);
  return data || [];
}

export async function recordPvScreeningRun(principal: PlatformPrincipal, input: {
  sourceId: string; screenedFrom: string; screenedUntil: string; itemsScreened: number; potentialRecords: number;
  nilReturn: boolean; querySnapshot?: Record<string, unknown>; status?: "completed" | "failed"; error?: string;
}) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const { data: source } = await supabase.from("pv_sources").select("id").eq("id", input.sourceId).eq("principal_id", principal.principalId).eq("active", true).maybeSingle();
  if (!source) throw new Error("Active PV source not found.");
  if (input.potentialRecords > 0 && input.nilReturn) throw new Error("A screening run with potential records cannot be a nil return.");
  const completedAt = new Date().toISOString();
  const status = input.status || "completed";
  const { data, error } = await supabase.from("pv_screening_runs").insert({
    principal_id: principal.principalId, source_id: input.sourceId, status, screened_from: input.screenedFrom,
    screened_until: input.screenedUntil, started_at: input.screenedUntil, completed_at: completedAt,
    items_screened: Math.max(0, input.itemsScreened), potential_records: Math.max(0, input.potentialRecords),
    nil_return: input.nilReturn, query_snapshot: input.querySnapshot || {}, error: input.error || null, created_by: principal.actorId,
  }).select("*").single();
  if (error || !data) throw new Error(`Failed to record PV screening run: ${error?.message || "missing row"}`);
  await appendPvAuditEvent(principal, { action: "screening.complete", resourceType: "pv_source", resourceId: input.sourceId, outcome: status === "failed" ? "failed" : "completed", metadata: { runId: data.id, itemsScreened: input.itemsScreened, potentialRecords: input.potentialRecords, nilReturn: input.nilReturn } });
  return data;
}

export async function createPvSource(principal: PlatformPrincipal, input: {
  name: string; sourceType: string; sourceUrl: string; ownershipClassification: "controlled" | "owned" | "discovered";
  sponsorName?: string; businessOwner?: string; products?: string[]; markets?: string[]; languages?: string[]; cadenceMinutes: number; effectiveAt?: string;
}) {
  assertPrincipal(principal);
  if (!input.name.trim() || !input.sourceUrl.trim() || !input.sourceType.trim()) throw new Error("Source name, type, and URL are required.");
  const { data, error } = await getSupabaseServerClient().from("pv_sources").insert({
    principal_id: principal.principalId, name: input.name.trim(), source_type: input.sourceType.trim(), source_url: input.sourceUrl.trim(),
    ownership_classification: input.ownershipClassification, sponsor_name: input.sponsorName?.trim() || null,
    business_owner: input.businessOwner?.trim() || null, products: input.products || [], markets: input.markets || [],
    languages: input.languages?.length ? input.languages : ["en"], cadence_minutes: Math.max(1, input.cadenceMinutes),
    effective_at: input.effectiveAt || new Date().toISOString(), created_by: principal.actorId,
  }).select("*").single();
  if (error || !data) throw new Error(`Failed to create PV source: ${error?.message || "missing row"}`);
  await appendPvAuditEvent(principal, { action: "source_registry.create", resourceType: "pv_source", resourceId: String(data.id), outcome: "completed" });
  return data;
}

function mapConcept(row: any): PvDetectionConcept {
  return {
    id: String(row.id), category: row.category, canonicalTerm: String(row.canonical_term), terms: row.terms || [], exclusions: row.exclusions || [],
    productId: row.product_id || undefined, language: row.language || "en", market: row.market || undefined, weight: Number(row.weight),
    activeFrom: row.active_from || undefined, activeUntil: row.active_until || undefined, version: Number(row.version), active: Boolean(row.active),
  };
}

export async function detectAndStorePvContent(principal: PlatformPrincipal, input: PvContentInput & { libraryId: string; slaPolicyId?: string }) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const { data: library, error: libraryError } = await supabase.from("pv_detection_libraries").select("*")
    .eq("id", input.libraryId).eq("principal_id", principal.principalId).eq("status", "active").maybeSingle();
  if (libraryError || !library) throw new Error("An active PV Detection Library is required.");
  const { data: conceptRows, error: conceptError } = await supabase.from("pv_detection_concepts").select("*")
    .eq("library_id", input.libraryId).eq("principal_id", principal.principalId).eq("active", true);
  if (conceptError) throw new Error(`Failed to load PV concepts: ${conceptError.message}`);
  const result = classifyPvContent(input, (conceptRows || []).map(mapConcept), { threshold: Number(library.detection_threshold), libraryVersion: Number(library.version) });
  const evidenceHash = hashPayload({ verbatim: input.verbatim, url: input.sourceUrl, postedAt: input.postedAt, parentContext: input.parentContext, threadContext: input.threadContext });

  if (!result.shouldCreateRecord) {
    await appendPvAuditEvent(principal, { action: "detection.evaluate", resourceType: "source_content", resourceId: input.externalId, outcome: "completed", metadata: { routed: false, score: result.score, evidenceHash, classifierVersion: result.classifierVersion } });
    return { result, record: null };
  }

  const productMatch = result.matches.find((match) => match.category === "product");
  const eventMatch = result.matches.find((match) => !["product", "severity", "treatment_change"].includes(match.category));
  const now = new Date().toISOString();
  const { data: record, error: recordError } = await supabase.from("pv_records").insert({
    principal_id: principal.principalId, external_id: input.externalId, source_id: input.sourceId || null, library_id: input.libraryId,
    sla_policy_id: input.slaPolicyId || null, status: "new", priority: result.contextConfidence >= 70 ? "critical" : result.score >= 80 ? "high" : "standard",
    product_name: productMatch?.canonicalTerm || null, potential_event: eventMatch?.canonicalTerm || null, source_type: input.sourceType,
    source_url: input.sourceUrl, author_identifier: input.authorIdentifier || null, original_verbatim: input.verbatim,
    original_language: input.language || "en", parent_context: input.parentContext || null, thread_context: input.threadContext || [],
    immutable_capture_url: input.immutableCaptureUrl || null, evidence_hash: evidenceHash, posted_at: input.postedAt,
    ingested_at: input.ingestedAt || now, identified_at: now, detection_score: result.score,
    product_confidence: result.productConfidence, health_experience_confidence: result.healthExperienceConfidence,
    context_confidence: result.contextConfidence, matched_concepts: result.matches, proposed_classifications: result.classifications,
    classifier_version: result.classifierVersion, library_version: result.detectionLibraryVersion, detection_rationale: result.rationale,
  }).select("*").single();
  if (recordError || !record) throw new Error(`Failed to create potential PV record: ${recordError?.message || "missing row"}`);
  await appendPvAuditEvent(principal, { action: "record.create_from_detection", resourceType: "pv_record", resourceId: String(record.id), outcome: "completed", metadata: { score: result.score, evidenceHash, humanReviewRequired: true } });
  return { result, record };
}

export async function listPvRecords(principal: PlatformPrincipal, input: { status?: string; limit?: number } = {}) {
  assertPrincipal(principal);
  let query = getSupabaseServerClient().from("pv_records").select("*").eq("principal_id", principal.principalId)
    .order("identified_at", { ascending: false }).limit(Math.max(1, Math.min(200, input.limit || 100)));
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load PV records: ${error.message}`);
  return data || [];
}

export async function getPvRecord(principal: PlatformPrincipal, recordId: string) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const { data: record, error } = await supabase.from("pv_records").select("*").eq("id", recordId).eq("principal_id", principal.principalId).maybeSingle();
  if (error || !record) throw new Error("PV record not found.");
  const [{ data: reviews }, { data: transfers }, { data: audit }, { data: policy }] = await Promise.all([
    supabase.from("pv_reviews").select("*").eq("record_id", recordId).eq("principal_id", principal.principalId).order("reviewed_at", { ascending: false }),
    supabase.from("pv_transfers").select("*").eq("record_id", recordId).eq("principal_id", principal.principalId).order("created_at", { ascending: false }),
    supabase.from("pv_audit_events").select("id,actor_id,action,outcome,metadata,occurred_at,event_hash,previous_hash").eq("principal_id", principal.principalId).eq("resource_id", recordId).order("occurred_at", { ascending: false }),
    record.sla_policy_id ? supabase.from("pv_sla_policies").select("*").eq("id", record.sla_policy_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const latestReview = reviews?.[0];
  const latestTransfer = transfers?.[0];
  const sla: PvSlaPolicy = policy ? {
    reviewMinutes: Number(policy.review_minutes), transferMinutes: Number(policy.transfer_minutes), acknowledgmentMinutes: Number(policy.acknowledgment_minutes),
    clockStart: policy.clock_start, timezone: policy.timezone,
  } : DEFAULT_SLA;
  const clock = calculatePvClock({
    status: record.status, postedAt: record.posted_at, ingestedAt: record.ingested_at, identifiedAt: record.identified_at,
    reviewedAt: latestReview?.reviewed_at, transferredAt: latestTransfer?.transferred_at, acknowledgedAt: latestTransfer?.acknowledged_at,
  }, sla);
  return { record, reviews: reviews || [], transfers: transfers || [], audit: audit || [], clock, sla };
}

export async function reviewPvRecord(principal: PlatformPrincipal, recordId: string, decision: PvReviewDecision) {
  assertPrincipal(principal);
  if (!decision.rationale.trim()) throw new Error("Reviewer rationale is required.");
  if (decision.action === "escalate" && (decision.productMention === "no" || decision.healthExperience === "no" || !decision.classifications.length)) {
    throw new Error("Escalation requires product relevance, a health experience or special situation, and at least one classification.");
  }
  const supabase = getSupabaseServerClient();
  const { data: record } = await supabase.from("pv_records").select("id,status").eq("id", recordId).eq("principal_id", principal.principalId).maybeSingle();
  if (!record) throw new Error("PV record not found.");
  if (["transferred", "acknowledged", "reconciled"].includes(record.status)) throw new Error("Transferred PV records cannot be reclassified without a governed correction workflow.");
  const reviewedAt = new Date().toISOString();
  const { data: review, error: reviewError } = await supabase.from("pv_reviews").insert({
    principal_id: principal.principalId, record_id: recordId, reviewer_id: principal.actorId,
    product_mention: decision.productMention, health_experience: decision.healthExperience, classifications: decision.classifications,
    rationale: decision.rationale.trim(), decision: decision.action, reviewed_at: reviewedAt,
  }).select("*").single();
  if (reviewError || !review) throw new Error(`Failed to save PV review: ${reviewError?.message || "missing row"}`);
  const nextStatus = decision.action === "escalate" ? "ready_for_transfer" : "not_relevant";
  const { error: updateError } = await supabase.from("pv_records").update({ status: nextStatus, assigned_reviewer_id: principal.actorId, updated_at: reviewedAt })
    .eq("id", recordId).eq("principal_id", principal.principalId);
  if (updateError) throw new Error(`Failed to update PV record status: ${updateError.message}`);
  await appendPvAuditEvent(principal, { action: `review.${decision.action}`, resourceType: "pv_record", resourceId: recordId, outcome: "completed", metadata: { reviewId: review.id, classifications: decision.classifications, retained: true } });
  return { review, status: nextStatus };
}

export async function transferPvRecord(principal: PlatformPrincipal, recordId: string, input: { destination: string; transferMethod: "secure_api" | "sftp" | "secure_email" | "manual_export" }) {
  assertPrincipal(principal);
  if (!input.destination.trim()) throw new Error("Sponsor transfer destination is required.");
  const supabase = getSupabaseServerClient();
  const { data: record } = await supabase.from("pv_records").select("*").eq("id", recordId).eq("principal_id", principal.principalId).maybeSingle();
  if (!record || record.status !== "ready_for_transfer") throw new Error("Only reviewed records marked ready for transfer can be transferred.");
  const { data: review } = await supabase.from("pv_reviews").select("*").eq("record_id", recordId).eq("principal_id", principal.principalId)
    .eq("decision", "escalate").order("reviewed_at", { ascending: false }).limit(1).maybeSingle();
  if (!review) throw new Error("An escalation review is required before transfer.");
  const payload = {
    recordId: record.id, product: record.product_name, originalVerbatim: record.original_verbatim, source: record.source_type,
    sourceUrl: record.source_url, originalPostTimestamp: record.posted_at, identificationTimestamp: record.identified_at,
    reviewer: review.reviewer_id, classifications: review.classifications, reviewerRationale: review.rationale,
    evidenceHash: record.evidence_hash, classifierVersion: record.classifier_version, libraryVersion: record.library_version,
  };
  const payloadHash = hashPayload(payload);
  const transferredAt = new Date().toISOString();
  const { data: transfer, error } = await supabase.from("pv_transfers").insert({
    principal_id: principal.principalId, record_id: recordId, destination: input.destination.trim(), transfer_method: input.transferMethod,
    payload, payload_hash: payloadHash, status: input.transferMethod === "manual_export" ? "queued" : "delivered",
    transferred_by: principal.actorId, transferred_at: transferredAt,
  }).select("*").single();
  if (error || !transfer) throw new Error(`Failed to create sponsor transfer: ${error?.message || "missing row"}`);
  const status = transfer.status === "delivered" ? "transferred" : "ready_for_transfer";
  await supabase.from("pv_records").update({ status, updated_at: transferredAt }).eq("id", recordId).eq("principal_id", principal.principalId);
  await appendPvAuditEvent(principal, { action: "transfer.create", resourceType: "pv_record", resourceId: recordId, outcome: "completed", metadata: { transferId: transfer.id, destination: input.destination, method: input.transferMethod, payloadHash } });
  return transfer;
}

export async function acknowledgePvTransfer(principal: PlatformPrincipal, transferId: string, acknowledgmentReference: string) {
  assertPrincipal(principal);
  if (!acknowledgmentReference.trim()) throw new Error("Sponsor acknowledgment reference is required.");
  const supabase = getSupabaseServerClient();
  const { data: transfer } = await supabase.from("pv_transfers").select("id,record_id,status").eq("id", transferId).eq("principal_id", principal.principalId).maybeSingle();
  if (!transfer || !["delivered", "acknowledged"].includes(transfer.status)) throw new Error("Delivered transfer not found.");
  const acknowledgedAt = new Date().toISOString();
  const { data, error } = await supabase.from("pv_transfers").update({ status: "acknowledged", acknowledgment_reference: acknowledgmentReference.trim(), acknowledged_at: acknowledgedAt, updated_at: acknowledgedAt })
    .eq("id", transferId).eq("principal_id", principal.principalId).select("*").single();
  if (error || !data) throw new Error(`Failed to acknowledge PV transfer: ${error?.message || "missing row"}`);
  await supabase.from("pv_records").update({ status: "acknowledged", updated_at: acknowledgedAt }).eq("id", transfer.record_id).eq("principal_id", principal.principalId);
  await appendPvAuditEvent(principal, { action: "transfer.acknowledge", resourceType: "pv_record", resourceId: String(transfer.record_id), outcome: "completed", metadata: { transferId, acknowledgmentReference } });
  return data;
}

export async function listPvTransfers(principal: PlatformPrincipal, limit = 100) {
  assertPrincipal(principal);
  const { data, error } = await getSupabaseServerClient().from("pv_transfers")
    .select("id,record_id,destination,transfer_method,package_version,payload_hash,status,transferred_by,transferred_at,acknowledgment_reference,acknowledged_at,error,created_at,pv_records(product_name,potential_event,source_type)")
    .eq("principal_id", principal.principalId).order("created_at", { ascending: false }).limit(Math.max(1, Math.min(200, limit)));
  if (error) throw new Error(`Failed to load PV transfers: ${error.message}`);
  return data || [];
}

export async function getPvOperationsOverview(principal: PlatformPrincipal) {
  assertPrincipal(principal);
  const [records, sources, screeningRuns] = await Promise.all([
    listPvRecords(principal), listPvSources(principal), listPvScreeningRuns(principal, 500),
  ]);
  const now = Date.now();
  const latestScreeningBySource = new Map<string, any>();
  for (const run of screeningRuns) if (run.status === "completed" && !latestScreeningBySource.has(run.source_id)) latestScreeningBySource.set(run.source_id, run);
  const dueSources = sources.filter((source: any) => {
    if (!source.active) return false;
    const lastScreenedAt = latestScreeningBySource.get(source.id)?.completed_at;
    return !lastScreenedAt || now - new Date(lastScreenedAt).getTime() >= Number(source.cadence_minutes) * 60_000;
  });
  const statusCounts = records.reduce((acc: Record<string, number>, record: any) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {});
  const approaching = records.filter((record: any) => {
    if (["not_relevant", "acknowledged", "reconciled"].includes(record.status)) return false;
    const elapsed = now - new Date(record.posted_at).getTime();
    return elapsed >= DEFAULT_SLA.reviewMinutes * 60_000 * 0.8;
  }).length;
  return {
    metrics: {
      screeningCompliance: sources.length ? Math.max(0, Math.round(((sources.length - dueSources.length) / sources.length) * 1000) / 10) : 100,
      sourcesDue: dueSources.length,
      awaitingReview: (statusCounts.new || 0) + (statusCounts.in_review || 0),
      approachingSla: approaching,
      transferred: statusCounts.transferred || 0,
      unacknowledged: statusCounts.transferred || 0,
      nilReturns: screeningRuns.filter((run: any) => run.status === "completed" && run.nil_return).length,
      reconciliationCompletion: records.length ? Math.round(((statusCounts.reconciled || 0) / records.length) * 100) : 100,
    },
    statusCounts,
    sources: sources.slice(0, 20).map((source: any) => ({ ...source, last_screened_at: latestScreeningBySource.get(source.id)?.completed_at || null })),
    records: records.slice(0, 50),
  };
}

export async function runPvReconciliation(principal: PlatformPrincipal, input: { periodStart: string; periodEnd: string }) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const [{ data: records, error: recordError }, { data: reviews, error: reviewError }, { data: transfers, error: transferError }, { data: sources, error: sourceError }, { data: screeningRuns }] = await Promise.all([
    supabase.from("pv_records").select("id,status,updated_at").eq("principal_id", principal.principalId).gte("identified_at", input.periodStart).lte("identified_at", input.periodEnd),
    supabase.from("pv_reviews").select("record_id,reviewed_at").eq("principal_id", principal.principalId).gte("reviewed_at", input.periodStart).lte("reviewed_at", input.periodEnd).order("reviewed_at", { ascending: false }),
    supabase.from("pv_transfers").select("id,record_id,status,transferred_at,acknowledged_at").eq("principal_id", principal.principalId).gte("created_at", input.periodStart).lte("created_at", input.periodEnd),
    supabase.from("pv_sources").select("id,active,cadence_minutes").eq("principal_id", principal.principalId),
    supabase.from("pv_screening_runs").select("source_id,completed_at,nil_return").eq("principal_id", principal.principalId).eq("status", "completed").lte("completed_at", input.periodEnd).order("completed_at", { ascending: false }),
  ]);
  if (recordError || reviewError || transferError || sourceError) throw new Error(`Failed to load reconciliation inputs: ${recordError?.message || reviewError?.message || transferError?.message || sourceError?.message}`);
  const latestScreening = new Map<string, any>();
  for (const run of screeningRuns || []) if (!latestScreening.has(run.source_id)) latestScreening.set(run.source_id, run);
  const latestReview = new Map<string, any>();
  for (const review of reviews || []) if (!latestReview.has(review.record_id)) latestReview.set(review.record_id, review);
  const result = reconcilePvOperations({
    records: (records || []).map((record: any) => ({ id: record.id, status: record.status, reviewedAt: latestReview.get(record.id)?.reviewed_at })),
    transfers: (transfers || []).map((transfer: any) => ({ id: transfer.id, recordId: transfer.record_id, status: transfer.status, transferredAt: transfer.transferred_at, acknowledgedAt: transfer.acknowledged_at })),
    sources: (sources || []).map((source: any) => ({ id: source.id, active: source.active, cadenceMinutes: source.cadence_minutes, lastScreenedAt: latestScreening.get(source.id)?.completed_at, lastNilReturnAt: latestScreening.get(source.id)?.nil_return ? latestScreening.get(source.id)?.completed_at : undefined })),
    periodEnd: input.periodEnd,
  });
  const { data: run, error } = await supabase.from("pv_reconciliation_runs").insert({
    principal_id: principal.principalId, period_start: input.periodStart, period_end: input.periodEnd, status: result.status,
    record_count: records?.length || 0, transfer_count: transfers?.length || 0,
    acknowledgment_count: (transfers || []).filter((transfer: any) => transfer.status === "acknowledged").length,
    issue_count: result.issueCount, critical_count: result.criticalCount, report_payload: result, prepared_by: principal.actorId,
  }).select("*").single();
  if (error || !run) throw new Error(`Failed to save reconciliation run: ${error?.message || "missing row"}`);
  if (result.issues.length) {
    const { error: issueError } = await supabase.from("pv_reconciliation_issues").insert(result.issues.map((issue) => ({
      principal_id: principal.principalId, reconciliation_run_id: run.id, issue_type: issue.type,
      record_id: issue.recordId || null, source_id: issue.sourceId || null, severity: issue.severity, detail: issue.detail,
    })));
    if (issueError) throw new Error(`Failed to save reconciliation exceptions: ${issueError.message}`);
  }
  await appendPvAuditEvent(principal, { action: "reconciliation.run", resourceType: "pv_reconciliation", resourceId: String(run.id), outcome: "completed", metadata: { issueCount: result.issueCount, criticalCount: result.criticalCount } });
  return { run, result };
}

export async function listPvReconciliations(principal: PlatformPrincipal) {
  assertPrincipal(principal);
  const { data, error } = await getSupabaseServerClient().from("pv_reconciliation_runs").select("*")
    .eq("principal_id", principal.principalId).order("period_end", { ascending: false }).limit(24);
  if (error) throw new Error(`Failed to load reconciliation history: ${error.message}`);
  return data || [];
}
