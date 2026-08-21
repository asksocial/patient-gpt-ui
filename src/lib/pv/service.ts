import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "../supabase/server";
import type { PlatformPrincipal } from "../intelligence-platform/persistence";
import { calculatePvClock } from "./clock";
import { classifyPvContent } from "./detection";
import { DEFAULT_PV_SLA, derivePvOverviewMetrics } from "./overview";
import { reconcilePvOperations } from "./reconciliation";
import type {
  PvContentInput,
  PvDetectionConcept,
  PvReviewDecision,
  PvSlaPolicy,
} from "./types";
import type { PvCsvImportError, PvCsvImportRow } from "./csvImport";
import {
  BOTULINUM_PV_CONCEPTS,
  BOTULINUM_PV_CORPUS_ID,
  BOTULINUM_PV_LIBRARY_NAME,
  BOTULINUM_PV_THERAPEUTIC_AREA,
  loadBotulinumPvCorpus,
} from "./botulinumCorpus";

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
  input: { name: string; sponsorName?: string; productId?: string; market?: string; language?: string; detectionThreshold?: number; expectedEventTerms?: string[] }
) {
  assertPrincipal(principal);
  if (!input.name.trim()) throw new Error("Library name is required.");
  const { data, error } = await getSupabaseServerClient().from("pv_detection_libraries").insert({
    principal_id: principal.principalId,
    name: input.name.trim(), sponsor_name: input.sponsorName?.trim() || null, product_id: input.productId?.trim() || null,
    market: input.market?.trim() || null, language: input.language?.trim() || "en",
    detection_threshold: Math.max(1, Math.min(100, input.detectionThreshold ?? 55)),
    expected_event_terms: (input.expectedEventTerms || []).map((term) => term.trim()).filter(Boolean), created_by: principal.actorId,
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
  const result = classifyPvContent(input, (conceptRows || []).map(mapConcept), {
    threshold: Number(library.detection_threshold),
    libraryVersion: Number(library.version),
    expectedEvents: library.expected_event_terms || [],
  });
  const evidenceHash = hashPayload({ verbatim: input.verbatim, url: input.sourceUrl, postedAt: input.postedAt, parentContext: input.parentContext, threadContext: input.threadContext });
  const identificationTimestamp = input.identifiedAt || new Date().toISOString();

  if (!result.shouldCreateRecord) {
    await appendPvAuditEvent(principal, { action: "detection.evaluate", resourceType: "source_content", resourceId: input.externalId, outcome: "completed", metadata: { routed: false, score: result.score, evidenceHash, classifierVersion: result.classifierVersion, postDate: input.postedAt, reviewerIdentificationDate: identificationTimestamp, dayZeroBasis: input.dayZeroBasis || "posted_at", importBatchId: input.importBatchId, sourceRowNumber: input.sourceRowNumber, postedAtSourceColumn: input.postedAtSourceColumn, postedAtRawValue: input.postedAtRawValue } });
    return { result, record: null };
  }

  const { data: existingRecord, error: duplicateLookupError } = await supabase.from("pv_records").select("*")
    .eq("principal_id", principal.principalId).eq("external_id", input.externalId).maybeSingle();
  if (duplicateLookupError) throw new Error(`Failed to check for an existing PV record: ${duplicateLookupError.message}`);
  if (existingRecord) {
    await appendPvAuditEvent(principal, {
      action: "detection.duplicate",
      resourceType: "pv_record",
      resourceId: String(existingRecord.id),
      outcome: "completed",
      metadata: { externalId: input.externalId, evidenceHash, retainedExistingRecord: true, postDate: input.postedAt, reviewerIdentificationDate: identificationTimestamp, dayZeroBasis: input.dayZeroBasis || "posted_at", importBatchId: input.importBatchId, sourceRowNumber: input.sourceRowNumber },
    });
    return { result, record: existingRecord, duplicate: true };
  }

  const productMatch = result.matches.find((match) => match.category === "product");
  const eventMatch = result.matches.find((match) => !["product", "severity", "treatment_change"].includes(match.category));
  const now = new Date().toISOString();
  const { data: record, error: recordError } = await supabase.from("pv_records").insert({
    principal_id: principal.principalId, external_id: input.externalId, therapeutic_area: input.therapeuticArea || null, source_id: input.sourceId || null, library_id: input.libraryId,
    sla_policy_id: input.slaPolicyId || null, status: "new", priority: result.contextConfidence >= 70 ? "critical" : result.score >= 80 ? "high" : "standard",
    product_name: productMatch?.canonicalTerm || null, potential_event: eventMatch?.canonicalTerm || null, source_type: input.sourceType,
    source_url: input.sourceUrl, author_identifier: input.authorIdentifier || null, original_verbatim: input.verbatim,
    original_language: input.language || "en", parent_context: input.parentContext || null, thread_context: input.threadContext || [],
    immutable_capture_url: input.immutableCaptureUrl || null, evidence_hash: evidenceHash, posted_at: input.postedAt,
    ingested_at: input.ingestedAt || now, identified_at: identificationTimestamp, detection_score: result.score,
    product_confidence: result.productConfidence, health_experience_confidence: result.healthExperienceConfidence,
    context_confidence: result.contextConfidence, matched_concepts: result.matches, proposed_classifications: result.classifications,
    classifier_version: result.classifierVersion, library_version: result.detectionLibraryVersion, detection_rationale: result.rationale,
    data_origin: input.dataOrigin || "unknown", ae_ontology: result.ontologyExtraction,
    ontology_version: result.ontologyExtraction.ontologyVersion,
    import_batch_id: input.importBatchId || null, source_row_number: input.sourceRowNumber || null,
    posted_at_source_column: input.postedAtSourceColumn || null, posted_at_raw_value: input.postedAtRawValue || null,
    day_zero_basis: input.dayZeroBasis || "posted_at", day_zero_reason: input.dayZeroReason || null,
  }).select("*").single();
  if (recordError || !record) throw new Error(`Failed to create potential PV record: ${recordError?.message || "missing row"}`);
  await appendPvAuditEvent(principal, { action: "record.create_from_detection", resourceType: "pv_record", resourceId: String(record.id), outcome: "completed", metadata: { score: result.score, evidenceHash, humanReviewRequired: true, postDate: input.postedAt, reviewerIdentificationDate: identificationTimestamp, dayZeroBasis: input.dayZeroBasis || "posted_at", importBatchId: input.importBatchId, sourceRowNumber: input.sourceRowNumber } });
  return { result, record, duplicate: false };
}

export async function listPvImportBatches(principal: PlatformPrincipal, limit = 50, therapeuticArea?: string) {
  assertPrincipal(principal);
  let query = getSupabaseServerClient().from("pv_import_batches").select("*")
    .eq("principal_id", principal.principalId).order("available_at", { ascending: false }).limit(Math.max(1, Math.min(100, limit)));
  if (therapeuticArea) query = query.eq("therapeutic_area", therapeuticArea);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load PV CSV imports: ${error.message}`);
  return data || [];
}

export async function importPvCsvBatch(principal: PlatformPrincipal, input: {
  libraryId: string;
  sourceId?: string;
  fileName: string;
  fileHash: string;
  dataOrigin: "live" | "curated";
  dateColumn: string;
  contentColumns: string[];
  sourceUrlColumn?: string;
  externalIdColumn?: string;
  rowCount: number;
  rows: PvCsvImportRow[];
  parseErrors?: PvCsvImportError[];
}) {
  assertPrincipal(principal);
  if (!input.libraryId || !input.fileName || !input.rows.length) throw new Error("Library, CSV file, and at least one row are required.");
  const supabase = getSupabaseServerClient();
  const { data: library, error: libraryError } = await supabase.from("pv_detection_libraries").select("id")
    .eq("id", input.libraryId).eq("principal_id", principal.principalId).eq("status", "active").maybeSingle();
  if (libraryError || !library) throw new Error("Select an active PV Detection Library owned by this tenant.");
  if (input.sourceId) {
    const { data: source, error: sourceError } = await supabase.from("pv_sources").select("id")
      .eq("id", input.sourceId).eq("principal_id", principal.principalId).maybeSingle();
    if (sourceError || !source) throw new Error("Select a governed PV source owned by this tenant.");
  }
  const { data: existing } = await supabase.from("pv_import_batches").select("id,status,available_at")
    .eq("principal_id", principal.principalId).eq("file_hash", input.fileHash).maybeSingle();
  if (existing) throw new Error(`This CSV was already made available on ${new Date(existing.available_at).toLocaleString()}.`);
  const availableAt = new Date().toISOString();
  const { data: batch, error: batchError } = await supabase.from("pv_import_batches").insert({
    principal_id: principal.principalId, library_id: input.libraryId, source_id: input.sourceId || null,
    file_name: input.fileName, file_hash: input.fileHash, data_origin: input.dataOrigin,
    date_column: input.dateColumn, content_columns: input.contentColumns,
    source_url_column: input.sourceUrlColumn || null, external_id_column: input.externalIdColumn || null,
    uploaded_by: principal.actorId, uploaded_at: availableAt, available_at: availableAt,
    day_zero_basis: "identified_at", row_count: input.rowCount, status: "processing",
  }).select("*").single();
  if (batchError || !batch) throw new Error(`Failed to register PV CSV import: ${batchError?.message || "missing batch"}`);
  await appendPvAuditEvent(principal, {
    action: "csv_import.available", resourceType: "pv_import_batch", resourceId: String(batch.id), outcome: "completed",
    metadata: { fileName: input.fileName, fileHash: input.fileHash, availableAt, reviewerIdentificationDate: availableAt, dayZeroBasis: "identified_at", dateColumn: input.dateColumn, rowCount: input.rowCount, parseFailureCount: input.parseErrors?.length || 0 },
  });

  let screenedCount = 0;
  let routedCount = 0;
  let duplicateCount = 0;
  const errors: Array<{ rowNumber: number; error: string }> = [...(input.parseErrors || [])];
  for (const row of input.rows) {
    try {
      const detection = await detectAndStorePvContent(principal, {
        libraryId: input.libraryId, sourceId: input.sourceId, sourceType: "csv", sourceUrl: row.sourceUrl,
        externalId: row.externalId, verbatim: row.verbatim, postedAt: row.postedAt,
        ingestedAt: availableAt, identifiedAt: availableAt, dataOrigin: input.dataOrigin,
        importBatchId: String(batch.id), sourceRowNumber: row.rowNumber,
        postedAtSourceColumn: input.dateColumn, postedAtRawValue: row.postedAtRawValue,
        dayZeroBasis: "identified_at",
        dayZeroReason: "Reviewer identification began when the uploaded CSV became available to the AskSocial tenant.",
      });
      screenedCount += 1;
      if (detection.record && !detection.duplicate) routedCount += 1;
      if (detection.duplicate) duplicateCount += 1;
    } catch (rowError) {
      errors.push({ rowNumber: row.rowNumber, error: rowError instanceof Error ? rowError.message : "PV row screening failed" });
    }
  }
  const status = errors.length ? (screenedCount ? "completed_with_errors" : "failed") : "completed";
  const { data: completed, error: updateError } = await supabase.from("pv_import_batches").update({
    screened_count: screenedCount, routed_count: routedCount, duplicate_count: duplicateCount,
    failed_count: errors.length, status, error_summary: errors.slice(0, 100), updated_at: new Date().toISOString(),
  }).eq("id", batch.id).eq("principal_id", principal.principalId).select("*").single();
  if (updateError || !completed) throw new Error(`Failed to finalize PV CSV import: ${updateError?.message || "missing batch"}`);
  await appendPvAuditEvent(principal, {
    action: "csv_import.complete", resourceType: "pv_import_batch", resourceId: String(batch.id), outcome: status === "failed" ? "failed" : "completed",
    metadata: { screenedCount, routedCount, duplicateCount, failedCount: errors.length, availableAt, dayZeroBasis: "identified_at" },
  });
  return completed;
}

async function ensureBotulinumPvLibrary(principal: PlatformPrincipal) {
  const supabase = getSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase.from("pv_detection_libraries").select("*")
    .eq("principal_id", principal.principalId).eq("name", BOTULINUM_PV_LIBRARY_NAME).maybeSingle();
  if (existingError) throw new Error(`Failed to load the Botulinum toxin PV library: ${existingError.message}`);
  let library = existing;
  if (!library) {
    const { data, error } = await supabase.from("pv_detection_libraries").insert({
      principal_id: principal.principalId, name: BOTULINUM_PV_LIBRARY_NAME, product_id: "botulinum_toxin",
      therapeutic_area: BOTULINUM_PV_THERAPEUTIC_AREA, language: "en", detection_threshold: 55,
      expected_event_terms: ["headache", "eyelid ptosis", "injection-site pain", "bruising", "swelling"],
      status: "draft", created_by: principal.actorId,
    }).select("*").single();
    if (error || !data) throw new Error(`Failed to create the Botulinum toxin PV library: ${error?.message || "missing row"}`);
    library = data;
  }
  const { data: existingConcepts, error: conceptsError } = await supabase.from("pv_detection_concepts").select("canonical_term")
    .eq("principal_id", principal.principalId).eq("library_id", library.id);
  if (conceptsError) throw new Error(`Failed to inspect Botulinum toxin concepts: ${conceptsError.message}`);
  const configured = new Set((existingConcepts || []).map((item: any) => item.canonical_term));
  const missing = BOTULINUM_PV_CONCEPTS.filter((item) => !configured.has(item.canonicalTerm));
  if (missing.length) {
    const { error } = await supabase.from("pv_detection_concepts").insert(missing.map((item) => ({
      library_id: library.id, principal_id: principal.principalId, category: item.category,
      canonical_term: item.canonicalTerm, terms: item.terms, exclusions: item.exclusions || [],
      product_id: item.productId || null, language: item.language, market: item.market || null,
      weight: item.weight, version: Number(library.version), active: true, created_by: principal.actorId,
    })));
    if (error) throw new Error(`Failed to configure Botulinum toxin concepts: ${error.message}`);
  }
  if (library.status !== "active") {
    const approvedAt = new Date().toISOString();
    const { data, error } = await supabase.from("pv_detection_libraries").update({
      status: "active", approved_by: principal.actorId, approved_at: approvedAt, updated_at: approvedAt,
    }).eq("id", library.id).eq("principal_id", principal.principalId).select("*").single();
    if (error || !data) throw new Error(`Failed to activate the Botulinum toxin PV library: ${error?.message || "missing row"}`);
    library = data;
    await appendPvAuditEvent(principal, { action: "detection_library.bootstrap", resourceType: "detection_library", resourceId: String(library.id), outcome: "completed", metadata: { corpusId: BOTULINUM_PV_CORPUS_ID, therapeuticArea: BOTULINUM_PV_THERAPEUTIC_AREA, conceptCount: BOTULINUM_PV_CONCEPTS.length } });
  }
  return library;
}

export async function importBundledBotulinumPvCorpus(principal: PlatformPrincipal) {
  assertPrincipal(principal);
  const corpus = loadBotulinumPvCorpus();
  const supabase = getSupabaseServerClient();
  const library = await ensureBotulinumPvLibrary(principal);
  const { data: existingBatch, error: existingBatchError } = await supabase.from("pv_import_batches").select("*")
    .eq("principal_id", principal.principalId).eq("file_hash", corpus.fileHash).maybeSingle();
  if (existingBatchError) throw new Error(`Failed to check the bundled PV corpus: ${existingBatchError.message}`);
  if (existingBatch) return { ...existingBatch, alreadyImported: true };

  const availableAt = new Date().toISOString();
  const { data: batch, error: batchError } = await supabase.from("pv_import_batches").insert({
    principal_id: principal.principalId, library_id: library.id, file_name: corpus.fileName,
    file_hash: corpus.fileHash, corpus_id: corpus.corpusId, therapeutic_area: corpus.therapeuticArea,
    data_origin: "curated", date_column: corpus.dateColumn, content_columns: corpus.contentColumns,
    source_url_column: corpus.sourceUrlColumn || null, external_id_column: corpus.externalIdColumn || null,
    uploaded_by: principal.actorId, uploaded_at: availableAt, available_at: availableAt,
    day_zero_basis: "identified_at", row_count: corpus.rowCount, status: "processing",
  }).select("*").single();
  if (batchError || !batch) throw new Error(`Failed to register the bundled PV corpus: ${batchError?.message || "missing batch"}`);
  await appendPvAuditEvent(principal, { action: "csv_import.available", resourceType: "pv_import_batch", resourceId: String(batch.id), outcome: "completed", metadata: { corpusId: corpus.corpusId, therapeuticArea: corpus.therapeuticArea, fileHash: corpus.fileHash, availableAt, reviewerIdentificationDate: availableAt, dayZeroBasis: "identified_at", rowCount: corpus.rowCount } });

  const candidateIds = corpus.candidates.map((row) => row.externalId);
  const existingIds = new Set<string>();
  for (let index = 0; index < candidateIds.length; index += 200) {
    const { data, error } = await supabase.from("pv_records").select("external_id")
      .eq("principal_id", principal.principalId).in("external_id", candidateIds.slice(index, index + 200));
    if (error) throw new Error(`Failed to deduplicate the bundled PV corpus: ${error.message}`);
    for (const item of data || []) existingIds.add(String(item.external_id));
  }
  const records = corpus.candidates.filter((row) => !existingIds.has(row.externalId)).map((row) => {
    const result = classifyPvContent({ externalId: row.externalId, sourceType: "curated_csv", sourceUrl: row.sourceUrl, verbatim: row.verbatim, postedAt: row.postedAt, dataOrigin: "curated" }, BOTULINUM_PV_CONCEPTS, { threshold: 55, libraryVersion: Number(library.version), expectedEvents: library.expected_event_terms || [] });
    const productMatch = result.matches.find((match) => match.category === "product");
    const eventMatch = result.matches.find((match) => !["product", "severity", "treatment_change"].includes(match.category));
    return {
      principal_id: principal.principalId, external_id: row.externalId, therapeutic_area: corpus.therapeuticArea,
      library_id: library.id, status: "new", priority: result.contextConfidence >= 70 ? "critical" : result.score >= 80 ? "high" : "standard",
      product_name: productMatch?.canonicalTerm || null, potential_event: eventMatch?.canonicalTerm || null,
      source_type: "curated_csv", source_url: row.sourceUrl, original_verbatim: row.verbatim, original_language: "en",
      thread_context: [], evidence_hash: hashPayload({ verbatim: row.verbatim, url: row.sourceUrl, postedAt: row.postedAt }),
      posted_at: row.postedAt, ingested_at: availableAt, identified_at: availableAt,
      detection_score: result.score, product_confidence: result.productConfidence,
      health_experience_confidence: result.healthExperienceConfidence, context_confidence: result.contextConfidence,
      matched_concepts: result.matches, proposed_classifications: result.classifications,
      classifier_version: result.classifierVersion, library_version: result.detectionLibraryVersion,
      detection_rationale: result.rationale, data_origin: "curated", ae_ontology: result.ontologyExtraction,
      ontology_version: result.ontologyExtraction.ontologyVersion, import_batch_id: batch.id,
      source_row_number: row.rowNumber, posted_at_source_column: corpus.dateColumn,
      posted_at_raw_value: row.postedAtRawValue, day_zero_basis: "identified_at",
      day_zero_reason: "Reviewer identification began when the bundled Botulinum toxin corpus became available to the AskSocial tenant.",
    };
  });
  let routedCount = 0;
  for (let index = 0; index < records.length; index += 100) {
    const chunk = records.slice(index, index + 100);
    const { error } = await supabase.from("pv_records").insert(chunk);
    if (error) throw new Error(`Failed to populate the Botulinum toxin PV review queue: ${error.message}`);
    routedCount += chunk.length;
  }
  const failedCount = corpus.errors.length;
  const status = failedCount ? "completed_with_errors" : "completed";
  const { data: completed, error: updateError } = await supabase.from("pv_import_batches").update({
    screened_count: corpus.rows.length, routed_count: routedCount, duplicate_count: existingIds.size,
    failed_count: failedCount, status, error_summary: corpus.errors.slice(0, 100), updated_at: new Date().toISOString(),
  }).eq("id", batch.id).eq("principal_id", principal.principalId).select("*").single();
  if (updateError || !completed) throw new Error(`Failed to finalize the bundled PV corpus: ${updateError?.message || "missing batch"}`);
  await appendPvAuditEvent(principal, { action: "csv_import.complete", resourceType: "pv_import_batch", resourceId: String(batch.id), outcome: "completed", metadata: { corpusId: corpus.corpusId, therapeuticArea: corpus.therapeuticArea, screenedCount: corpus.rows.length, candidateCount: corpus.candidates.length, routedCount, duplicateCount: existingIds.size, failedCount, availableAt, dayZeroBasis: "identified_at", screeningMethod: "botulinum-pv-context-rules" } });
  return completed;
}

export async function listPvRecords(principal: PlatformPrincipal, input: { status?: string; limit?: number; therapeuticArea?: string } = {}) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  let query = supabase.from("pv_records").select("*").eq("principal_id", principal.principalId)
    .order("identified_at", { ascending: false }).limit(Math.max(1, Math.min(1000, input.limit || 500)));
  if (input.status) query = query.eq("status", input.status);
  if (input.therapeuticArea) query = query.eq("therapeutic_area", input.therapeuticArea);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load PV records: ${error.message}`);
  const records = data || [];
  const recordIds = records.map((record: any) => record.id);
  const idChunks = Array.from(
    { length: Math.ceil(recordIds.length / 200) },
    (_, index) => recordIds.slice(index * 200, (index + 1) * 200)
  );
  const escalationResults = await Promise.all(
    idChunks.map((ids) => supabase.from("pv_reviews")
      .select("record_id,reviewed_at")
      .eq("principal_id", principal.principalId)
      .eq("decision", "escalate")
      .in("record_id", ids))
  );
  const escalationError = escalationResults.find((result) => result.error)?.error;
  if (escalationError) throw new Error(`Failed to load PV escalation timestamps: ${escalationError.message}`);
  const escalationByRecord = new Map<string, string>();
  for (const review of escalationResults.flatMap((result) => result.data || [])) {
    const current = escalationByRecord.get(review.record_id);
    if (!current || new Date(review.reviewed_at).getTime() < new Date(current).getTime()) {
      escalationByRecord.set(review.record_id, review.reviewed_at);
    }
  }
  return records.map((record: any) => ({
    ...record,
    publication_timestamp: record.posted_at,
    collection_timestamp: record.ingested_at,
    algorithm_timestamp: record.created_at || record.identified_at,
    review_timestamp: record.identified_at,
    escalation_timestamp: escalationByRecord.get(record.id) || null,
  }));
}

export async function listPvSponsorCases(principal: PlatformPrincipal, therapeuticArea?: string) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const { data: reviews, error: reviewError } = await supabase.from("pv_reviews").select("*")
    .eq("principal_id", principal.principalId).eq("decision", "escalate")
    .order("reviewed_at", { ascending: false }).limit(1000);
  if (reviewError) throw new Error(`Failed to load sponsor escalation reviews: ${reviewError.message}`);
  const recordIds = [...new Set((reviews || []).map((review: any) => String(review.record_id)))];
  if (!recordIds.length) return [];
  const idChunks = Array.from({ length: Math.ceil(recordIds.length / 200) }, (_, index) => recordIds.slice(index * 200, (index + 1) * 200));
  const [recordResults, transferResults] = await Promise.all([
    Promise.all(idChunks.map((ids) => {
      let query = supabase.from("pv_records").select("*").eq("principal_id", principal.principalId).in("id", ids);
      if (therapeuticArea) query = query.eq("therapeutic_area", therapeuticArea);
      return query;
    })),
    Promise.all(idChunks.map((ids) => supabase.from("pv_transfers").select("*")
      .eq("principal_id", principal.principalId).in("record_id", ids).order("created_at", { ascending: false }))),
  ]);
  const relatedError = [...recordResults, ...transferResults].find((result) => result.error)?.error;
  if (relatedError) throw new Error(`Failed to assemble sponsor escalation cases: ${relatedError.message}`);
  const recordById = new Map(recordResults.flatMap((result) => result.data || []).map((record: any) => [String(record.id), record]));
  const latestTransferByRecord = new Map<string, any>();
  for (const transfer of transferResults.flatMap((result) => result.data || [])) {
    const recordId = String(transfer.record_id);
    if (!latestTransferByRecord.has(recordId)) latestTransferByRecord.set(recordId, transfer);
  }
  return (reviews || []).flatMap((review: any) => {
    const record: any = recordById.get(String(review.record_id));
    if (!record) return [];
    return [{
      id: review.id,
      record: {
        ...record,
        publication_timestamp: record.posted_at,
        collection_timestamp: record.ingested_at,
        algorithm_timestamp: record.created_at || record.identified_at,
        review_timestamp: record.identified_at,
        escalation_timestamp: review.reviewed_at,
      },
      review,
      transfer: latestTransferByRecord.get(String(record.id)) || null,
    }];
  });
}

export async function recordPvSponsorReportActivity(
  principal: PlatformPrincipal,
  input: { action: "export" | "share"; therapeuticArea?: string; caseIds: string[]; recipientEmail?: string; reportHash?: string }
) {
  assertPrincipal(principal);
  const recipientEmail = input.recipientEmail?.trim().toLowerCase();
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error("Enter a valid sponsor email address.");
  return appendPvAuditEvent(principal, {
    action: `sponsor_report.${input.action}`,
    resourceType: "pv_sponsor_report",
    resourceId: hashPayload({ therapeuticArea: input.therapeuticArea || "all", caseIds: input.caseIds }),
    outcome: "completed",
    metadata: {
      therapeuticArea: input.therapeuticArea || null,
      caseCount: input.caseIds.length,
      caseIds: input.caseIds,
      recipientEmail: recipientEmail || null,
      reportHash: input.reportHash || null,
      standard: "ICH E2D(R1)",
    },
  });
}

async function listAllPvRecordsForOverview(principal: PlatformPrincipal, therapeuticArea?: string) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = getSupabaseServerClient().from("pv_records").select("*")
      .eq("principal_id", principal.principalId).order("identified_at", { ascending: false }).range(from, from + pageSize - 1);
    if (therapeuticArea) query = query.eq("therapeutic_area", therapeuticArea);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load the complete PV overview record ledger: ${error.message}`);
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }
  return rows;
}

export async function listPvReviewLists(principal: PlatformPrincipal, therapeuticArea?: string) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  let listQuery = supabase.from("pv_review_lists").select("*").eq("principal_id", principal.principalId)
    .order("updated_at", { ascending: false });
  if (therapeuticArea) listQuery = listQuery.eq("therapeutic_area", therapeuticArea);
  const { data: lists, error: listError } = await listQuery;
  if (listError) throw new Error(`Failed to load PV review lists: ${listError.message}`);
  const listIds = (lists || []).map((list: any) => list.id);
  if (!listIds.length) return [];
  const { data: items, error: itemError } = await supabase.from("pv_review_list_items")
    .select("id,list_id,record_id,note,added_by,added_at,pv_records(id,product_name,potential_event,source_type,source_url,original_verbatim,posted_at,identified_at,detection_score,status)")
    .eq("principal_id", principal.principalId).in("list_id", listIds).order("added_at", { ascending: true });
  if (itemError) throw new Error(`Failed to load PV review-list mentions: ${itemError.message}`);
  return (lists || []).map((list: any) => ({ ...list, items: (items || []).filter((item: any) => item.list_id === list.id) }));
}

export async function createPvReviewList(principal: PlatformPrincipal, input: {
  name: string; therapeuticArea: string; recordIds: string[]; assignedTo?: string; description?: string;
}) {
  assertPrincipal(principal);
  const name = input.name.trim();
  const therapeuticArea = input.therapeuticArea.trim();
  const recordIds = [...new Set(input.recordIds.map((id) => id.trim()).filter(Boolean))];
  if (!name || !therapeuticArea || !recordIds.length) throw new Error("List name, therapeutic area, and at least one PV mention are required.");
  if (recordIds.length > 1000) throw new Error("A PV review list can contain at most 1,000 mentions.");
  const supabase = getSupabaseServerClient();
  const { data: records, error: recordError } = await supabase.from("pv_records").select("id")
    .eq("principal_id", principal.principalId).eq("therapeutic_area", therapeuticArea).in("id", recordIds);
  if (recordError) throw new Error(`Failed to validate selected PV mentions: ${recordError.message}`);
  if ((records || []).length !== recordIds.length) throw new Error("One or more selected PV mentions are outside the permitted tenant or therapeutic area.");
  const now = new Date().toISOString();
  const { data: list, error: listError } = await supabase.from("pv_review_lists").insert({
    principal_id: principal.principalId, therapeutic_area: therapeuticArea, name,
    description: input.description?.trim() || null, assigned_to: input.assignedTo?.trim() || null,
    created_by: principal.actorId, updated_by: principal.actorId, created_at: now, updated_at: now,
  }).select("*").single();
  if (listError || !list) throw new Error(`Failed to create PV review list: ${listError?.message || "missing list"}`);
  const { error: itemError } = await supabase.from("pv_review_list_items").insert(recordIds.map((recordId) => ({
    principal_id: principal.principalId, list_id: list.id, record_id: recordId, added_by: principal.actorId,
  })));
  if (itemError) {
    await supabase.from("pv_review_lists").delete().eq("id", list.id).eq("principal_id", principal.principalId);
    throw new Error(`Failed to add mentions to the PV review list: ${itemError.message}`);
  }
  await appendPvAuditEvent(principal, { action: "review_list.create", resourceType: "pv_review_list", resourceId: String(list.id), outcome: "completed", metadata: { therapeuticArea, recordCount: recordIds.length, assignedTo: input.assignedTo?.trim() || null } });
  return { ...list, item_count: recordIds.length };
}

export async function updatePvReviewList(principal: PlatformPrincipal, listId: string, input: {
  assignedTo?: string; sharedEmail?: string; status?: "active" | "exported" | "archived";
}) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase.from("pv_review_lists").select("*")
    .eq("id", listId).eq("principal_id", principal.principalId).maybeSingle();
  if (existingError || !existing) throw new Error("PV review list not found.");
  const sharedEmail = input.sharedEmail?.trim().toLowerCase();
  if (sharedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sharedEmail)) throw new Error("Enter a valid email address.");
  const sharedEmails = sharedEmail ? [...new Set([...(existing.shared_emails || []), sharedEmail])] : existing.shared_emails || [];
  const updates: Record<string, unknown> = {
    assigned_to: input.assignedTo !== undefined ? input.assignedTo.trim() || null : existing.assigned_to,
    shared_emails: sharedEmails, status: input.status || existing.status,
    updated_by: principal.actorId, updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("pv_review_lists").update(updates)
    .eq("id", listId).eq("principal_id", principal.principalId).select("*").single();
  if (error || !data) throw new Error(`Failed to update PV review list: ${error?.message || "missing list"}`);
  const action = sharedEmail ? "review_list.share_email" : input.status === "exported" ? "review_list.export" : "review_list.assign";
  await appendPvAuditEvent(principal, { action, resourceType: "pv_review_list", resourceId: listId, outcome: "completed", metadata: { assignedTo: data.assigned_to, sharedEmail: sharedEmail || null, status: data.status } });
  return data;
}

export async function getPvReviewList(principal: PlatformPrincipal, listId: string) {
  const lists = await listPvReviewLists(principal);
  const list = lists.find((item: any) => item.id === listId);
  if (!list) throw new Error("PV review list not found.");
  return list;
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
  } : DEFAULT_PV_SLA;
  const effectiveSla: PvSlaPolicy = {
    ...sla,
    clockStart: record.day_zero_basis === "identified_at" ? "identified_at" : sla.clockStart,
  };
  const clock = calculatePvClock({
    status: record.status, postedAt: record.posted_at, ingestedAt: record.ingested_at, identifiedAt: record.identified_at,
    reviewedAt: latestReview?.reviewed_at, transferredAt: latestTransfer?.transferred_at, acknowledgedAt: latestTransfer?.acknowledged_at,
  }, effectiveSla);
  return { record, reviews: reviews || [], transfers: transfers || [], audit: audit || [], clock, sla: effectiveSla };
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
    validated_ae_ontology: decision.ontologyReview || {},
  }).select("*").single();
  if (reviewError || !review) throw new Error(`Failed to save PV review: ${reviewError?.message || "missing row"}`);
  const nextStatus = decision.action === "escalate" ? "ready_for_transfer" : "not_relevant";
  const { error: updateError } = await supabase.from("pv_records").update({ status: nextStatus, assigned_reviewer_id: principal.actorId, updated_at: reviewedAt })
    .eq("id", recordId).eq("principal_id", principal.principalId);
  if (updateError) throw new Error(`Failed to update PV record status: ${updateError.message}`);
  await appendPvAuditEvent(principal, { action: `review.${decision.action}`, resourceType: "pv_record", resourceId: recordId, outcome: "completed", metadata: { reviewId: review.id, classifications: decision.classifications, ontologyReviewed: Boolean(decision.ontologyReview), retained: true } });
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
    dayZeroBasis: record.day_zero_basis, dayZeroReason: record.day_zero_reason,
    importBatchId: record.import_batch_id, sourceRowNumber: record.source_row_number,
    reviewer: review.reviewer_id, classifications: review.classifications, reviewerRationale: review.rationale,
    adverseEventOntology: review.validated_ae_ontology, ontologyStatus: "reviewer_validated",
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

export async function getPvOperationsOverview(principal: PlatformPrincipal, therapeuticArea?: string) {
  assertPrincipal(principal);
  const [records, sources, screeningRuns, reviewLists] = await Promise.all([
    listAllPvRecordsForOverview(principal, therapeuticArea), listPvSources(principal), listPvScreeningRuns(principal, 500), listPvReviewLists(principal, therapeuticArea),
  ]);
  const latestScreeningBySource = new Map<string, any>();
  for (const run of screeningRuns) if (run.status === "completed" && !latestScreeningBySource.has(run.source_id)) latestScreeningBySource.set(run.source_id, run);
  const recordIds = records.map((record: any) => record.id);
  const idChunks = Array.from({ length: Math.ceil(recordIds.length / 200) }, (_, index) => recordIds.slice(index * 200, (index + 1) * 200));
  const supabase = getSupabaseServerClient();
  const [reviewResults, transferResults, policyResult] = await Promise.all([
    Promise.all(idChunks.map((ids) => supabase.from("pv_reviews").select("record_id,reviewed_at").eq("principal_id", principal.principalId).in("record_id", ids))),
    Promise.all(idChunks.map((ids) => supabase.from("pv_transfers").select("record_id,status,transferred_at,acknowledged_at,created_at").eq("principal_id", principal.principalId).in("record_id", ids))),
    supabase.from("pv_sla_policies").select("id,review_minutes,transfer_minutes,acknowledgment_minutes,clock_start,timezone").eq("principal_id", principal.principalId),
  ]);
  const relatedError = [...reviewResults, ...transferResults, policyResult].find((result) => result.error)?.error;
  if (relatedError) throw new Error(`Failed to derive PV overview workflow metrics: ${relatedError.message}`);
  const reviews = reviewResults.flatMap((result) => result.data || []);
  const transfers = transferResults.flatMap((result) => result.data || []);
  const derived = derivePvOverviewMetrics({ records, reviews, transfers, reviewLists, policies: policyResult.data || [], screeningRuns });
  return {
    metrics: derived.metrics,
    statusCounts: derived.statusCounts,
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
