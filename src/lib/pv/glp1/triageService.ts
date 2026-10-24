import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "../../supabase/server";
import type { PlatformPrincipal } from "../../intelligence-platform/persistence";
import { appendPvAuditEvent, listPvDetectionLibrary } from "../service";
import type { PvDetectionConcept } from "../types";
import { pvLanguageCode, samePvLanguage } from "../language";
import { GLP1_PV_LIBRARY_NAME } from "./config";
import { buildGlp1PvRecord } from "./service";
import { GLP1_TRIAGE_VERSION } from "./triageVocabulary";
import { GLP1_PV_CONCEPTS } from "./detection";
import { loadHeldGlp1Triage, heldTriageRowAsEnglishInput, findGlp1ReactionCues, findEnglishSourceEpisode, type HeldTriageRow } from "./triage";

export async function getGlp1HeldTriage(principal: PlatformPrincipal) {
  const current = await listPvDetectionLibrary(principal);
  const library = current.libraries.find(item => item.therapeutic_area === "GLP-1" && item.name === GLP1_PV_LIBRARY_NAME && item.status === "active" && samePvLanguage(item.language, "en"));
  const concepts: PvDetectionConcept[] = library ? current.concepts.filter(item => item.library_id === library.id).sort((a,b) => String(a.id).localeCompare(String(b.id))).map(item => ({ id: item.id, category: item.category, canonicalTerm: item.canonical_term, terms: item.terms, exclusions: item.exclusions || [], language: item.language, market: item.market || undefined, weight: Number(item.weight), active: item.active, version: Number(item.version), activeFrom: item.active_from || undefined, activeUntil: item.active_until || undefined })) : GLP1_PV_CONCEPTS;
  const usable = !!library && concepts.some(c => c.active && c.category === "product") && concepts.some(c => c.active && !["product", "severity", "treatment_change"].includes(c.category));
  return { library: usable ? library : null, concepts, assessment: loadHeldGlp1Triage(concepts, { approved: usable, threshold: library ? Number(library.detection_threshold) : 55, libraryId: library?.id, libraryVersion: library ? Number(library.version) : undefined, expectedEvents: library?.expected_event_terms || [] }) };
}
export type HeldInclusion = { assessmentHash: string; rowNumbers: number[]; sourceScopeConfirmed: boolean; rationale: string; translation?: { text: string; languageCode: string; verifiedByQualifiedReviewer: boolean } };
export function buildHeldGlp1Record(principal: PlatformPrincipal, row: HeldTriageRow, library: Parameters<typeof buildGlp1PvRecord>[2], concepts: PvDetectionConcept[], batchId: string, availableAt: string, input: HeldInclusion) {
  if (input.sourceScopeConfirmed !== true || typeof input.rationale !== "string" || input.rationale.trim().length < 10 || input.rationale.length > 4000) throw new Error("Confirm source eligibility and provide a review rationale (at least 10 characters).");
  if (row.blockers.some(b => /invalid_source|source_url|source_text/.test(b))) throw new Error("Source evidence must be repaired before inclusion; missing links are never fabricated.");
  if (row.status === "excluded_content") throw new Error("Excluded content requires a corrected evidence assessment before inclusion.");
  let text = row.verbatim;
  let translated = false;
  if (row.languageCode !== "en") {
    const translation = input.translation;
    if (translation?.verifiedByQualifiedReviewer !== true || typeof translation.text !== "string" || !translation.text.trim() || translation.text.length > 50000 || !pvLanguageCode(translation.languageCode)) throw new Error("A qualified reviewer must identify the source language and verify an English translation against the original.");
    if (row.languageCode && pvLanguageCode(row.languageCode) !== pvLanguageCode(translation.languageCode)) throw new Error("Verified translation language does not match source metadata.");
    text = translation.text.trim();
    translated = true;
  } else if (!["eligible_english_candidate", "eligible_source_candidate"].includes(row.status)) throw new Error("The active rules did not establish inclusion eligibility for this English row.");
  if (!findGlp1ReactionCues(text, "en").some(c => !c.referenceOnly)) throw new Error("The assessed text needs an observed source reaction term; reference-only vocabulary cannot create a case.");
  const english = row.languageCode === "en" && row.status === "eligible_english_candidate" ? heldTriageRowAsEnglishInput(row) : { rowNumber: row.rowNumber, externalId: row.externalId, sourceUrl: row.sourceUrl, sourceType: row.sourceType, sourceTitle: row.sourceTitle, verbatim: text, postedAt: row.postedAt!, postedAtRawValue: row.postedAtRawValue, authorIdentifier: row.authorIdentifier, language: "en" as const };
  let record = buildGlp1PvRecord(principal, english, library, batchId, availableAt, concepts);
  const episodeProducts = [...row.productCues, ...concepts.filter(c => c.active && c.category === "product").flatMap(c => c.terms).filter(term => text.toLowerCase().includes(term.toLowerCase()))];
  const episode = findEnglishSourceEpisode(text, episodeProducts);
  if (!record && episode) {
    const product = episodeProducts.find(term => text.toLowerCase().includes(term.toLowerCase()))!;
    const match = (category: "product" | "adverse_experience", term: string) => ({ conceptId: `source-reaction-triage:${createHash("sha256").update(term).digest("hex").slice(0,16)}`, category, canonicalTerm: term, matchedTerm: term, weight: 0 });
    record = {
      principal_id: principal.principalId, external_id: row.externalId, therapeutic_area: "GLP-1", library_id: null, status: "new", priority: "standard",
      product_name: product, potential_event: episode.sourceTerm, source_type: row.sourceType, source_url: row.sourceUrl, author_identifier: row.authorIdentifier || null,
      original_verbatim: row.verbatim, original_language: "en", thread_context: [], evidence_hash: "pending", posted_at: row.postedAt!, ingested_at: availableAt, identified_at: availableAt, algorithm_assessed_at: availableAt,
      detection_score: 0, product_confidence: 0, health_experience_confidence: 0, context_confidence: 0, matched_concepts: [match("product",product),match("adverse_experience",episode.sourceTerm)], proposed_classifications: ["adverse_event"], classifier_version: GLP1_TRIAGE_VERSION, library_version: 0,
      detection_rationale: ["Source-reaction triage candidate: specific-patient evidence and an asserted event temporally associated with exposure were retrieved from the same source excerpt. This is a separate provisional triage path, not a match to the approved concept library. No calibrated detection score is assigned.", `Source evidence: ${episode.evidence}`, ...(row.relatedSourceRows?.length ? [`Related identical source excerpts retained in held triage: rows ${row.relatedSourceRows.join(", ")}. These are not additional unique patients or cases.`] : [])],
      data_origin: "curated", ae_ontology: { productProcedures: [{ value: product, evidence: product, confidence: 0 }], adverseEvents: [{ value: episode.sourceTerm, evidence: episode.evidence, confidence: 0 }], seriousness: { value: "unclear", criteria: [], evidence: [], confidence: 0 }, outcomes: [], timeToOnset: { category: "unknown", confidence: 0 }, severity: { value: "unclear", confidence: 0 }, unexpectedness: { value: "unclear", basis: "insufficient_reference", confidence: 0 }, causality: [], limitations: ["Published excerpt requires source and clinical validation. Patient/reporter identifiability, causality, seriousness, expectedness and final reportability have not been established."], ontologyVersion: GLP1_TRIAGE_VERSION }, ontology_version: GLP1_TRIAGE_VERSION,
      import_batch_id: batchId, source_row_number: row.rowNumber, posted_at_source_column: "Date + Time (UTC assumed)", posted_at_raw_value: row.postedAtRawValue, day_zero_basis: "reportability_identified_at", day_zero_reason: "Qualified human review must confirm minimum ICSR criteria; triage does not start Day Zero.",
    } as ReturnType<typeof buildGlp1PvRecord>;
  }
  if (!record) throw new Error("The active English rules did not support a potential PV record from the assessed text.");
  return { ...record, original_verbatim: row.verbatim, original_language: row.languageCode || "und", translated_text: translated ? text : null,
    evidence_hash: createHash("sha256").update(JSON.stringify({ original: row.verbatim, url: row.sourceUrl, postedAt: row.postedAt, ...(translated ? { verifiedTranslation: text, verifiedSourceLanguage: input.translation!.languageCode } : {}) })).digest("hex"),
    detection_rationale: [...record.detection_rationale, `Held-source triage ${input.assessmentHash}; original hold: ${row.holdReason}.`, `Source eligibility reviewed by ${principal.actorId}: ${input.rationale.trim()}`, ...(translated ? [`English translation from ${input.translation!.languageCode} verified against the original by qualified reviewer ${principal.actorId}. Rules were applied to this verified translation, not to unqualified native-language text.`] : [])],
    ae_ontology: { ...record.ae_ontology, limitations: [...record.ae_ontology.limitations, "Source reaction co-occurrence is not causality, expectedness or final reportability.", ...(translated ? ["Extraction uses a human-verified English translation; original-language evidence is retained separately."] : [])] },
  };
}
export async function includeHeldGlp1Candidates(principal: PlatformPrincipal, input: HeldInclusion) {
  if (process.env.ASKSOCIAL_REQUIRE_ODCS_SCOPE === "true") throw new Error("Held-source inclusion cannot bypass an approved client ODCS scope. Use the client-scoped import workflow.");
  const { assessment, library, concepts } = await getGlp1HeldTriage(principal);
  if (!library) throw new Error("An approved active English GLP-1 detection library is required.");
  if (input.assessmentHash !== assessment.assessmentHash) throw new Error("Triage evidence or library configuration changed. Reload the assessment before inclusion.");
  if (!Array.isArray(input.rowNumbers) || !input.rowNumbers.length || input.rowNumbers.length > 100 || input.rowNumbers.some(n => !Number.isInteger(n))) throw new Error("Select 1–100 assessed source rows.");
  if (input.translation && input.rowNumbers.length !== 1) throw new Error("A verified translation must apply to one source row at a time.");
  const selected = [...new Set(input.rowNumbers)].map(number => assessment.rows.find(row => row.rowNumber === number));
  if (selected.some(row => !row)) throw new Error("Every selected row must belong to the assessed held set.");
  const now = new Date().toISOString();
  // Validate all rows before writing a batch or a record.
  const provisional = selected.map(row => buildHeldGlp1Record(principal, row!, library, concepts, "pending", now, input));
  const fileHash = createHash("sha256").update(JSON.stringify([assessment.assessmentHash, provisional.map(r => [r.external_id, r.evidence_hash])])).digest("hex");
  const db = getSupabaseServerClient();
  const existing = await db.from("pv_import_batches").select("*").eq("principal_id", principal.principalId).eq("file_hash", fileHash).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  let batch = existing.data;
  if (!batch) {
    const created = await db.from("pv_import_batches").upsert({ principal_id: principal.principalId, library_id: library.id, file_name: "glp-1-held-triage", file_hash: fileHash, corpus_id: `glp1:held:${fileHash}`, therapeutic_area: "GLP-1", data_origin: "curated", uploaded_by: principal.actorId, uploaded_at: now, available_at: now, day_zero_basis: "reportability_identified_at", row_count: selected.length, status: "processing", content_columns: ["Original source text", ...(input.translation ? ["Qualified reviewer verified English translation"] : [])], date_column: "Date + Time (UTC assumed)", source_url_column: "URL", external_id_column: "Document ID" }, { onConflict: "principal_id,file_hash", ignoreDuplicates: true }).select("*").maybeSingle();
    if (created.error) throw new Error(created.error.message);
    batch = created.data;
    if (!batch) {
      const concurrent = await db.from("pv_import_batches").select("*").eq("principal_id", principal.principalId).eq("file_hash", fileHash).single();
      if (concurrent.error) throw new Error(concurrent.error.message);
      batch = concurrent.data;
    }
    await appendPvAuditEvent(principal, { action: "held_triage.inclusion_started", resourceType: "pv_import_batch", resourceId: batch.id, outcome: "completed", metadata: { assessmentHash: assessment.assessmentHash, triageVersion: assessment.triageVersion, sourceFileHash: assessment.sourceFileHash, rowNumbers: input.rowNumbers, sourceScopeConfirmed: true, rationale: input.rationale, verifiedTranslation: !!input.translation, verifiedSourceLanguage: input.translation?.languageCode, libraryVersion: library.version } });
  }
  const records = selected.map(row => buildHeldGlp1Record(principal, row!, library, concepts, batch.id, batch.available_at, input));
  const inserted = await db.from("pv_records").upsert(records, { onConflict: "principal_id,external_id", ignoreDuplicates: true }).select("id");
  if (inserted.error) throw new Error(`Held inclusion remains resumable: ${inserted.error.message}`);
  const completed = await db.from("pv_import_batches").update({ status: "completed", screened_count: records.length, routed_count: records.length, duplicate_count: records.length - (inserted.data?.length || 0), failed_count: 0, updated_at: new Date().toISOString() }).eq("id", batch.id).eq("principal_id", principal.principalId).select("*").single();
  if (completed.error) throw new Error(completed.error.message);
  await appendPvAuditEvent(principal, { action: "held_triage.included", resourceType: "pv_import_batch", resourceId: batch.id, outcome: "completed", metadata: { assessmentHash: assessment.assessmentHash, rowNumbers: input.rowNumbers, newlyInserted: inserted.data?.length || 0, routedCount: records.length, existingReviewsPreserved: true, dayZeroBasis: "reportability_identified_at" } });
  return { ...completed.data, newlyInserted: inserted.data?.length || 0, message: `Held-source assessment completed: ${records.length} eligible candidate(s), ${inserted.data?.length || 0} newly included. Existing records and decisions were preserved.` };
}
