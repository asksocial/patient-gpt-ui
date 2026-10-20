import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildOpenFdaQueries, ingestOpenFda, normalizeOpenFdaRegulatoryCase } from "../lib/pv/training/regulatory";
import { glp1RegulatoryConfiguration, GLP1_PV_LIBRARY_NAME } from "../lib/pv/glp1/config";
import { GLP1_PV_CONCEPTS, classifyGlp1PvContent } from "../lib/pv/glp1/detection";
import { loadGlp1PvCorpus } from "../lib/pv/glp1/corpus";
import { getGlp1FaersReference } from "../lib/pv/glp1/reference";
import { buildGlp1PvRecord, setupGlp1PvLibrary, screenGlp1PvCorpus } from "../lib/pv/glp1/service";
import { activatePvDetectionLibrary } from "../lib/pv/service";
import { calculatePvClock } from "../lib/pv/clock";
import { DEFAULT_PV_SLA } from "../lib/pv/overview";
import { buildPvE2bAlignedCase } from "../lib/pv/e2b/case";
import type { PvContentInput } from "../lib/pv/types";

function input(verbatim: string): PvContentInput {
  return { externalId: "fixture", sourceType: "forum", sourceUrl: "https://example.test/post/1", verbatim, postedAt: "2026-10-01T12:30:00Z", language: "en" };
}

async function main() {
  for (const [text, segment] of [
    ["I started Wegovy and developed severe nausea and vomiting.", "ae_adr"],
    ["Ozempic made me nauseous after my first injection.", "ae_adr"],
    ["I am taking Mounjaro and accidentally injected the wrong dose.", "health_experience"],
    ["I am taking Saxenda and I am pregnant.", "health_experience"],
    ["I have been taking Trulicity but it stopped working.", "health_experience"],
    ["I took Byetta and I was hospitalized for pancreatitis.", "ae_adr"],
    ["I am taking Soliqua and had low blood sugar.", "ae_adr"],
    ["I started Wegovy and developed depression and panic attacks.", "ae_adr"],
    ["I started Victoza and my device malfunction caused a missed dose.", "health_experience"],
  ]) {
    const result = classifyGlp1PvContent(input(text));
    assert(result.shouldCreateRecord, text);
    assert.equal(result.detectionSegment, segment, text);
  }
  for (const text of [
    "I started Wegovy and have no nausea or vomiting.",
    "I will pick up Ozempic tomorrow. Hopefully I won't be throwing up.",
    "Wegovy may cause nausea. Read the prescribing information.",
    "I started Ozempic and I am worried about nausea.",
    "Buy now Wegovy promo code. I am taking it and have nausea.",
    "I started Botox and developed nausea.",
    "I started Wegovy and feel great with no side effects.",
    "I started Wegovy and the dizzying amount of information confused me.",
  ]) assert(!classifyGlp1PvContent(input(text)).shouldCreateRecord, text);
  const mixed = classifyGlp1PvContent(input("I started Wegovy and have no nausea, but I am vomiting."));
  assert(mixed.shouldCreateRecord);
  assert(!mixed.matches.some((match) => match.canonicalTerm === "Nausea"));
  assert(mixed.matches.some((match) => match.canonicalTerm === "Vomiting"));
  assert(classifyGlp1PvContent(input("I started Wegovy. No nausea yesterday. Nausea developed today.")).shouldCreateRecord);
  assert.throws(() => classifyGlp1PvContent({ ...input("I started Ozempic and developed nausea."), language: "ko" }), /English/);
  assert.throws(() => classifyGlp1PvContent({ ...input("I started Ozempic and developed nausea."), language: undefined }), /English/);
  assert.equal(classifyGlp1PvContent(input("I started Wegovy and developed nausea.")).ontologyExtraction.unexpectedness.value, "unclear");
  assert(!GLP1_PV_CONCEPTS.some((concept) => concept.category === "adverse_experience" && concept.terms.includes("No adverse event")));

  const queries = buildOpenFdaQueries({ suspectOnly: true }, glp1RegulatoryConfiguration);
  assert.equal(queries.length, 60);
  assert(!JSON.stringify(queries).toLowerCase().includes("botox"));
  assert.throws(() => buildOpenFdaQueries({ products: ["BOTOX"] }, glp1RegulatoryConfiguration), /Unknown/);
  const record = (id: string, targetRole: string) => ({ safetyreportid: id, safetyreportversion: "1", receivedate: "20260101", patient: { drug: [{ medicinalproduct: "OZEMPIC", drugcharacterization: targetRole }, { medicinalproduct: "ASPIRIN", drugcharacterization: "1" }], reaction: [{ reactionmeddrapt: "Nausea", reactionoutcome: "2" }] } });
  const normalized = normalizeOpenFdaRegulatoryCase(record("test-1", "1"), [], glp1RegulatoryConfiguration).normalized;
  assert(normalized.is_target_product);
  assert(!("is_target_botulinum_product" in normalized));
  assert(normalized.drugs[0].is_target_product && !normalized.drugs[1].is_target_product);
  assert.equal(normalized.causality_status, "NOT_ESTABLISHED");
  assert.equal(normalized.reactions[0].meddra_preferred_term, "Nausea");
  const result = await ingestOpenFda({ configuration: glp1RegulatoryConfiguration, products: ["OZEMPIC"], apiKey: "test-secret", suspectOnly: true, sleep: async () => {}, fetchImpl: async () => new Response(JSON.stringify({ meta: { results: { total: 2 } }, results: [record("test-1", "1"), record("test-2", "2")] }), { status: 200 }) });
  assert.equal(result.status, "complete");
  assert.equal(result.normalizedRecords.length, 1, "A suspect aspirin must not make concomitant Ozempic a suspect drug.");
  assert(result.queryRuns.every((run) => run.recordsRejectedBySuspectPostFilter === 1));
  assert(!JSON.stringify(result).includes("test-secret"));

  const reference = getGlp1FaersReference();
  assert.equal(reference.uniqueReports, 1638);
  assert.equal(reference.status, "partial");
  assert(reference.truncated && reference.queryRuns.every((query) => !query.error));
  assert(reference.reactions.every((reaction) => reaction.reportCount <= reference.uniqueReports && reaction.sampleReportIds.length > 0));
  const corpus = loadGlp1PvCorpus();
  assert.equal(corpus.rowCount, 5000);
  assert.equal(corpus.rows.length + corpus.held.length + corpus.errors.length, 5000);
  assert.equal(corpus.holdCounts.unsupported_or_unknown_language, 2865);
  assert.equal(corpus.errors.length, 0);
  assert(corpus.candidates.length > 0);
  assert(corpus.rows.every((row) => row.language === "en" && /^https?:\/\//.test(row.sourceUrl) && row.externalId.startsWith("glp1:social:")));
  const principal = { principalId: "glp-test-principal", actorId: "test-reviewer", principalType: "user" as const };
  const sample = buildGlp1PvRecord(principal, { ...input("I started Wegovy and developed nausea."), rowNumber: 2, postedAtRawValue: "2026-10-01 12:30", language: "en" }, { id: randomUUID(), version: 1, detection_threshold: 55 }, randomUUID(), "2026-10-20T12:00:00Z")!;
  assert.equal(sample.status, "new");
  assert.equal(sample.day_zero_basis, "reportability_identified_at");
  assert.equal(calculatePvClock({ status: "new", postedAt: sample.posted_at, ingestedAt: sample.ingested_at, identifiedAt: sample.identified_at }, { ...DEFAULT_PV_SLA, clockStart: "reportability_identified_at" }).state, "not_started");
  assert.equal(buildPvE2bAlignedCase({ record: { id: randomUUID(), ...sample } }).drugs[0].productNameReported, "SEMAGLUTIDE");

  // Exercise actual service calls through the Supabase REST transport in memory.
  // No credentials, database, or sponsor delivery are used by these checks.
  const realFetch = globalThis.fetch;
  const originalEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, scope: process.env.ASKSOCIAL_REQUIRE_ODCS_SCOPE };
  const tables: Record<string, any[]> = { pv_detection_libraries: [], pv_detection_concepts: [], pv_import_batches: [], pv_records: [], pv_audit_events: [], audit: [] };
  process.env.SUPABASE_URL = "https://glp1-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-only";
  process.env.ASKSOCIAL_REQUIRE_ODCS_SCOPE = "false";
  globalThis.fetch = async (urlLike, init) => {
    const url = new URL(String(urlLike));
    assert.equal(url.hostname, "glp1-test.supabase.co", "Tests must not reach an external environment.");
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const table = url.pathname.split("/").pop()!;
    if (url.pathname.includes("/rpc/")) { tables.audit.push(body); return Response.json({ id: randomUUID() }); }
    assert(tables[table], `Unexpected table ${table}`);
    const matches = (row: any) => [...url.searchParams].filter(([, value]) => value.startsWith("eq.")).every(([key, value]) => String(row[key]) === value.slice(3));
    let selected: any[] = [];
    const method = init?.method || "GET";
    if (method === "POST") {
      for (const item of Array.isArray(body) ? body : [body]) {
        const conflicts = (url.searchParams.get("on_conflict") || "").split(",").filter(Boolean);
        if (conflicts.length && tables[table].some((row) => conflicts.every((key) => row[key] === item[key]))) continue;
        const inserted = { id: randomUUID(), version: 1, status: "draft", ...item };
        tables[table].push(inserted); selected.push(inserted);
        if (table === "pv_audit_events") tables.audit.push(inserted);
      }
    } else if (method === "PATCH") {
      selected = tables[table].filter(matches);
      selected.forEach((row) => Object.assign(row, body));
    } else {
      selected = tables[table].filter(matches);
      if (url.searchParams.has("limit")) selected = selected.slice(0, Number(url.searchParams.get("limit")));
    }
    const responseHeaders = { "content-range": `0-${Math.max(0, selected.length - 1)}/${selected.length}` };
    if (method === "HEAD") return new Response(null, { headers: responseHeaders });
    if (headers.get("accept")?.includes("vnd.pgrst.object+json")) return selected.length === 1 ? Response.json(selected[0], { headers: responseHeaders }) : new Response(JSON.stringify({ code: "PGRST116", details: "The result contains 0 rows" }), { status: 406, headers: responseHeaders });
    return Response.json(selected, { headers: responseHeaders });
  };
  try {
    const library = await setupGlp1PvLibrary(principal);
    assert.equal(library.name, GLP1_PV_LIBRARY_NAME);
    assert.equal(library.status, "draft");
    assert.deepEqual(library.expected_event_terms, []);
    assert.equal(tables.pv_detection_concepts.length, GLP1_PV_CONCEPTS.length);
    await setupGlp1PvLibrary(principal);
    assert.equal(tables.pv_detection_libraries.length, 1);
    assert.equal(tables.pv_detection_concepts.length, GLP1_PV_CONCEPTS.length);
    await assert.rejects(screenGlp1PvCorpus(principal), /approve/);
    await activatePvDetectionLibrary(principal, library.id);
    const imported = await screenGlp1PvCorpus(principal);
    assert(imported.newlyInserted > 0);
    const count = tables.pv_records.length;
    assert(tables.pv_records.every((row) => row.therapeutic_area === "GLP-1" && row.external_id.startsWith("glp1:social:") && row.day_zero_basis === "reportability_identified_at"));
    tables.pv_records[0].status = "in_review";
    tables.pv_records[0].assigned_reviewer_id = "existing-reviewer";
    const again = await screenGlp1PvCorpus(principal);
    assert.equal(again.newlyInserted, 0);
    assert.equal(tables.pv_records.length, count);
    assert.equal(tables.pv_import_batches.length, 1);
    assert.equal(tables.pv_records[0].assigned_reviewer_id, "existing-reviewer");
    assert.equal(tables.pv_records[0].status, "in_review");
    assert(tables.audit.some((event) => (event.p_action || event.action) === "csv_import.glp1_complete"));
    process.env.ASKSOCIAL_REQUIRE_ODCS_SCOPE = "true";
    await assert.rejects(screenGlp1PvCorpus(principal), /ODCS/);
    process.env.ASKSOCIAL_REQUIRE_ODCS_SCOPE = "false";
    await assert.rejects(screenGlp1PvCorpus({ ...principal, principalId: "another-tenant" }), /approve/);
    console.log(JSON.stringify({ faersReferenceReports: reference.uniqueReports, queryCount: queries.length, sourceRows: corpus.rowCount, eligibleSocialRows: corpus.rows.length, heldRows: corpus.held.length, persistedReviewCandidates: count, duplicateSafeRescreen: true, reviewPreservation: true, approvalGate: true, tenantIsolation: true, odcsScopeEnforced: true, dayZeroPendingHumanReview: true }, null, 2));
  } finally {
    globalThis.fetch = realFetch;
    for (const [key, value] of Object.entries({ SUPABASE_URL: originalEnv.url, SUPABASE_SERVICE_ROLE_KEY: originalEnv.key, ASKSOCIAL_REQUIRE_ODCS_SCOPE: originalEnv.scope })) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
