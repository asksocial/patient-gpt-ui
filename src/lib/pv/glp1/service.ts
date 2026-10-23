import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "../../supabase/server";
import type { PlatformPrincipal } from "../../intelligence-platform/persistence";
import { appendPvAuditEvent, createPvDetectionLibrary, createPvDetectionConcept, listPvDetectionLibrary } from "../service";
import { GLP1_PV_LIBRARY_NAME, GLP1_PV_VERSION } from "./config";
import { GLP1_PV_CONCEPTS, classifyGlp1PvContent } from "./detection";
import { loadGlp1PvCorpus, type Glp1PvRow } from "./corpus";
import { getGlp1FaersReference } from "./reference";
import type { PvDetectionConcept } from "../types";

export async function setupGlp1PvLibrary(principal: PlatformPrincipal) {
  const current = await listPvDetectionLibrary(principal);
  let library = current.libraries.find((item) => item.therapeutic_area === "GLP-1" && item.name === GLP1_PV_LIBRARY_NAME && item.status !== "retired");
  if (!library) library = await createPvDetectionLibrary(principal, { name: GLP1_PV_LIBRARY_NAME, therapeuticArea: "GLP-1", productId: "glp_1", language: "en", detectionThreshold: 55, expectedEventTerms: [] });
  const existing = current.concepts.filter((item) => item.library_id === library.id);
  const missing = GLP1_PV_CONCEPTS.filter((concept) => !existing.some((item) => item.canonical_term === concept.canonicalTerm && item.category === concept.category));
  if (missing.length && library.status === "active") throw new Error("The active GLP-1 library is missing configured concepts. Create and approve a new library version before changing active rules.");
  for (const concept of missing) await createPvDetectionConcept(principal, { ...concept, libraryId: library.id });
  await appendPvAuditEvent(principal, { action: "detection_library.glp1_setup", resourceType: "detection_library", resourceId: library.id, outcome: "completed", metadata: { configurationVersion: GLP1_PV_VERSION, faersReferenceRetrievedAt: getGlp1FaersReference().retrievedAt, expectednessFromFaers: false, requiresHumanApproval: library.status !== "active", conceptsAdded: missing.length } });
  return library;
}

export function buildGlp1PvRecord(principal: PlatformPrincipal, row: Glp1PvRow, library: { id: string; version: number; detection_threshold: number; expected_event_terms?: string[] }, batchId: string, availableAt: string, concepts = GLP1_PV_CONCEPTS) {
  const result = classifyGlp1PvContent({ ...row, dataOrigin: "curated" }, concepts, { threshold: Number(library.detection_threshold), libraryVersion: Number(library.version), expectedEvents: library.expected_event_terms || [] });
  if (!result.shouldCreateRecord) return null;
  const product = result.matches.find((match) => match.category === "product");
  const event = result.matches.find((match) => !["product", "severity", "treatment_change"].includes(match.category));
  return {
    principal_id: principal.principalId, external_id: row.externalId, therapeutic_area: "GLP-1",
    library_id: library.id, status: "new", priority: result.contextConfidence >= 70 ? "critical" : result.score >= 80 ? "high" : "standard",
    product_name: product?.canonicalTerm || null, potential_event: event?.canonicalTerm || null,
    source_type: row.sourceType, source_url: row.sourceUrl, author_identifier: row.authorIdentifier || null,
    original_verbatim: row.verbatim, original_language: row.language, thread_context: row.sourceTitle && row.sourceTitle !== row.verbatim ? [`Source title (context only; not attributed to the author): ${row.sourceTitle}`] : [],
    evidence_hash: createHash("sha256").update(JSON.stringify({ verbatim: row.verbatim, url: row.sourceUrl, postedAt: row.postedAt })).digest("hex"),
    posted_at: row.postedAt, ingested_at: availableAt, identified_at: availableAt, algorithm_assessed_at: availableAt,
    detection_score: result.score, product_confidence: result.productConfidence, health_experience_confidence: result.healthExperienceConfidence,
    context_confidence: result.contextConfidence, matched_concepts: result.matches, proposed_classifications: result.classifications,
    classifier_version: result.classifierVersion, library_version: result.detectionLibraryVersion, detection_rationale: [...result.rationale, ...(row.audienceClassification ? [`Source audience (${row.audienceClassification.version}): ${row.audienceClassification.audience}; ${row.audienceClassification.designation}. Audience classification is provisional and does not determine PV reportability.`] : [])],
    data_origin: "curated", ae_ontology: result.ontologyExtraction, ontology_version: result.ontologyExtraction.ontologyVersion,
    import_batch_id: batchId, source_row_number: row.rowNumber, posted_at_source_column: "Date + Time (UTC assumed)",
    posted_at_raw_value: row.postedAtRawValue, day_zero_basis: "reportability_identified_at",
    day_zero_reason: "Day Zero starts when a qualified reviewer confirms the minimum ICSR criteria. FAERS reference retrieval does not start a social case clock.",
  };
}

export async function screenGlp1PvCorpus(principal: PlatformPrincipal) {
  if (process.env.ASKSOCIAL_REQUIRE_ODCS_SCOPE === "true") throw new Error("Bundled screening cannot bypass approved ODCS scope. Use the GLP-1 library in a client-scoped import.");
  const current = await listPvDetectionLibrary(principal);
  const library = current.libraries.find((item) => item.therapeutic_area === "GLP-1" && item.name === GLP1_PV_LIBRARY_NAME && item.status === "active");
  if (!library) throw new Error("Set up and approve the GLP-1 detection library before screening.");
  const concepts: PvDetectionConcept[] = current.concepts.filter((item) => item.library_id === library.id).sort((a, b) => String(a.id).localeCompare(String(b.id))).map((item) => ({ id: item.id, category: item.category, canonicalTerm: item.canonical_term, terms: item.terms, exclusions: item.exclusions, weight: Number(item.weight), language: item.language, market: item.market || undefined, active: item.active, version: Number(item.version), activeFrom: item.active_from || undefined, activeUntil: item.active_until || undefined }));
  if (!concepts.some((concept) => concept.active && concept.category === "product") || !concepts.some((concept) => concept.active && !["product", "severity", "treatment_change"].includes(concept.category))) throw new Error("GLP-1 library needs active product and health-experience concepts.");
  const corpus = loadGlp1PvCorpus();
  const db = getSupabaseServerClient();
  // The library configuration hash provides a new audited batch when rules change.
  const fileHash = createHash("sha256").update(JSON.stringify([corpus.fileHash, library.id, library.version, library.detection_threshold, concepts])).digest("hex");
  const existing = await db.from("pv_import_batches").select("*").eq("principal_id", principal.principalId).eq("file_hash", fileHash).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  let batch = existing.data;
  const availableAt = batch?.available_at || new Date().toISOString();
  if (!batch) {
    const created = await db.from("pv_import_batches").upsert({ principal_id: principal.principalId, library_id: library.id, file_name: corpus.fileName, file_hash: fileHash, corpus_id: corpus.corpusId, therapeutic_area: "GLP-1", data_origin: "curated", date_column: "Date + Time (UTC assumed)", content_columns: corpus.contentColumns, source_url_column: "URL", external_id_column: "Document ID", author_identifier_column: "Author Handle / Author Name", uploaded_by: principal.actorId, uploaded_at: availableAt, available_at: availableAt, day_zero_basis: "reportability_identified_at", row_count: corpus.rowCount, status: "processing" }, { onConflict: "principal_id,file_hash", ignoreDuplicates: true }).select("*").maybeSingle();
    if (created.error) throw new Error(created.error.message);
    batch = created.data || (await db.from("pv_import_batches").select("*").eq("principal_id", principal.principalId).eq("file_hash", fileHash).single()).data;
    if (!batch) throw new Error("Could not reconcile concurrent GLP-1 import.");
    await appendPvAuditEvent(principal, { action: "csv_import.available", resourceType: "pv_import_batch", resourceId: batch.id, outcome: "completed", metadata: { corpusId: corpus.corpusId, sourceFileHash: corpus.sourceFileHash, corpusVersion: corpus.corpusVersion, audienceVersion: corpus.audienceVersion, audienceCounts: corpus.audienceCounts, configurationVersion: GLP1_PV_VERSION, sourceRows: corpus.rowCount, faersReferenceRetrievedAt: getGlp1FaersReference().retrievedAt, sourceTimestampPolicy: corpus.sourceTimestampPolicy } });
  }
  // Recompute against the approved database rules, never the bundled defaults.
  const records = corpus.rows.map((row) => buildGlp1PvRecord(principal, row, library, batch.id, batch.available_at, concepts)).filter(Boolean);
  let inserted = 0;
  for (let index = 0; index < records.length; index += 100) {
    const result = await db.from("pv_records").upsert(records.slice(index, index + 100), { onConflict: "principal_id,external_id", ignoreDuplicates: true }).select("id");
    if (result.error) throw new Error(`GLP-1 import remains resumable: ${result.error.message}`);
    inserted += result.data?.length || 0;
  }
  const completed = await db.from("pv_import_batches").update({ screened_count: corpus.rows.length, routed_count: records.length, duplicate_count: records.length - inserted, failed_count: corpus.errors.length + corpus.held.length, status: corpus.errors.length || corpus.held.length ? "completed_with_errors" : "completed", error_summary: [...corpus.errors, ...corpus.held.map((row) => ({ rowNumber: row.rowNumber, error: `Held: ${row.reason}` }))].slice(0, 100), updated_at: new Date().toISOString() }).eq("id", batch.id).eq("principal_id", principal.principalId).select("*").single();
  if (completed.error) throw new Error(completed.error.message);
  await appendPvAuditEvent(principal, { action: "csv_import.glp1_complete", resourceType: "pv_import_batch", resourceId: batch.id, outcome: "completed", metadata: { screenedCount: corpus.rows.length, routedCount: records.length, newlyInserted: inserted, holdCounts: corpus.holdCounts, parseFailureCount: corpus.errors.length, classifierVersion: GLP1_PV_VERSION, libraryVersion: library.version, faersReportsImportedAsCases: 0, dayZeroBasis: "reportability_identified_at" } });
  return { ...completed.data, newlyInserted: inserted, holdCounts: corpus.holdCounts };
}
