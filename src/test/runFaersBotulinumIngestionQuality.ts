import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pageOne from "./fixtures/openfda/botulinum-page-1.json";
import pageTwo from "./fixtures/openfda/botulinum-page-2.json";
import malformedRecord from "./fixtures/openfda/malformed-record.json";
import {
  buildBotulinumOpenFdaQueries,
  createOpenFdaRegulatoryCorpusWriter,
  faersDeduplicationKey,
  getBotulinumProductRegistry,
  getBotulinumRegulatoryCorpusManifest,
  getOpenFdaRegulatoryMapping,
  ingestBotulinumOpenFda,
  normalizeOpenFdaDate,
  normalizeOpenFdaRegulatoryCase,
  redactOpenFdaApiKey,
  validateOpenFdaPageUrl,
  withOpenFdaApiKey,
  writeOpenFdaRegulatoryCorpus,
} from "../lib/pv/training/regulatory";

async function main() {

const observation = {
  queryId: "fixture-query",
  queryKind: "brand" as const,
  productSearched: "BOTOX",
  field: "patient.drug.medicinalproduct.exact",
  suspectOnly: false,
  sourceApiQuery: "https://api.fda.gov/drug/event.json?search=BOTOX",
  retrievedAt: "2026-09-15T12:00:00.000Z",
  sourceProductValues: ["BOTOX COSMETIC", "ASPIRIN"],
  sourceReactionValues: ["Eyelid ptosis", "Headache"],
};

const firstRecord = pageOne.results[0];
const normalized = normalizeOpenFdaRegulatoryCase(firstRecord, [observation]);
assert.equal(getBotulinumRegulatoryCorpusManifest().status, "active", "The corpus manifest must select an active configuration.");
assert.equal(getBotulinumProductRegistry().families.length, 6, "Six configured botulinum toxin product families are required.");
assert.equal(getOpenFdaRegulatoryMapping().paging.strategy, "search_after_link", "Large result sets must use search-after pagination.");

const allQueries = buildBotulinumOpenFdaQueries();
assert.equal(allQueries.length, 38, "All brand and active-ingredient fields must be queried from versioned configuration.");
for (const target of ["BOTOX", "BOTOX COSMETIC", "ONABOTULINUMTOXINA", "DYSPORT", "ABOBOTULINUMTOXINA", "XEOMIN", "INCOBOTULINUMTOXINA", "JEUVEAU", "PRABOTULINUMTOXINA", "DAXXIFY", "DAXIBOTULINUMTOXINA", "LETYBO", "LETIBOTULINUMTOXINA"]) {
  assert(allQueries.some((query) => query.productSearched === target), `Missing configured openFDA query for ${target}.`);
}
assert(buildBotulinumOpenFdaQueries({ suspectOnly: true, products: ["BOTOX"] }).every((query) => query.searchExpression.includes("drugcharacterization:1")), "Suspect-only requests must include the configured source designation.");
assert.throws(() => buildBotulinumOpenFdaQueries({ products: ["NOT CONFIGURED"] }), /Unknown botulinum product/);

assert.equal(normalized.normalized.drugs.length, 2, "Multiple drugs must remain nested under the case.");
assert.equal(normalized.normalized.reactions.length, 2, "Multiple reactions must remain nested under the case.");
assert.equal(normalized.normalized.outcomes.length, 2, "Reaction outcomes must be preserved as a separate collection.");
assert.equal(normalized.normalized.drugs[0].matched_target_product, "BOTOX COSMETIC", "The longest exact configured brand must win.");
assert.equal(normalized.normalized.drugs[0].matched_active_ingredient, "ONABOTULINUMTOXINA");
assert.equal(normalized.normalized.drugs[0].suspect_role_if_available, "suspect");
assert.deepEqual(normalized.normalized.concomitant_products, ["ASPIRIN"]);
assert.equal(normalized.normalized.causality_status, "NOT_ESTABLISHED", "FAERS co-occurrence and suspect designation must not establish causality.");
assert(!("drug_reaction_relationships" in normalized.normalized), "Normalization must not manufacture drug-to-reaction relationships.");
assert.equal(normalized.normalized.reactions[0].meddra_preferred_term, "Eyelid ptosis", "Source-provided MedDRA PT must remain unchanged.");
assert.equal(normalized.raw.rawSourceRecord, firstRecord, "The complete raw source object must be retained.");
assert.equal(normalized.normalized.provenance.raw_source_record_sha256, normalized.raw.rawSourceRecordSha256);
assert.equal(normalized.normalized.provenance.raw_source_record_storage, `raw-records.jsonl#${normalized.raw.deduplicationKey}`);
assert.equal(normalized.normalized.faers_case_id, firstRecord.safetyreportid, "The openFDA safety report ID is preserved as the FAERS case identifier documented by FDA.");
assert.equal(normalizeOpenFdaDate("20260229")?.iso, undefined, "Invalid calendar dates must remain raw without a fabricated normalized date.");
assert.equal(normalizeOpenFdaDate("20260228")?.iso, "2026-02-28T00:00:00.000Z");
assert.throws(() => faersDeduplicationKey(malformedRecord), /safetyreportid is required/);
assert.equal(redactOpenFdaApiKey(withOpenFdaApiKey("https://api.fda.gov/drug/event.json?limit=1", "secret")), "https://api.fda.gov/drug/event.json?limit=1", "API keys must never enter stored provenance.");
assert.throws(() => validateOpenFdaPageUrl("https://example.com/drug/event.json"), /unexpected endpoint/);

function tickingClock() {
  let time = Date.parse("2026-09-15T12:00:00.000Z");
  return () => new Date(time += 1000);
}

let pageCalls = 0;
const pagedFetch = async (input: string | URL | Request) => {
  pageCalls += 1;
  const url = String(input);
  if (url.includes("search_after=")) return new Response(JSON.stringify(pageTwo), { status: 200, headers: { "content-type": "application/json" } });
  const next = "https://api.fda.gov/drug/event.json?search=fixture&limit=1000&sort=receivedate%3Aasc&search_after=cursor";
  return new Response(JSON.stringify(pageOne), { status: 200, headers: { "content-type": "application/json", link: `<${next}>; rel=\"next\"` } });
};
const paged = await ingestBotulinumOpenFda({ products: ["BOTOX"], fetchImpl: pagedFetch, sleep: async () => {}, now: tickingClock() });
assert.equal(pageCalls, 4, "Each configured BOTOX query must follow its search-after page.");
assert.equal(paged.normalizedRecords.length, 2, "Overlapping queries and pages must deduplicate by safety report ID and version.");
assert.equal(paged.duplicateCount, 4, "Duplicate query observations must be counted without duplicating cases.");
assert(paged.malformedRecords.some((item) => item.error.includes("Conflicting payloads")), "Conflicting payloads with one identifier must be quarantined while the first is retained.");
assert.equal(paged.rawRecords[0].observations.some((item) => item.sourceReactionValues.includes("Eyelid ptosis")), true, "Query provenance must retain source reactions.");
assert.notEqual(
  faersDeduplicationKey(firstRecord),
  faersDeduplicationKey({ ...firstRecord, safetyreportversion: "3" }),
  "Distinct source report versions must not be collapsed.",
);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asksocial-faers-ingestion-"));
try {
  const outputDirectory = path.join(temporaryRoot, "corpus");
  const written = writeOpenFdaRegulatoryCorpus(paged, outputDirectory);
  assert(fs.existsSync(path.join(written.outputDirectory, "raw-records.jsonl")), "Raw source JSONL must be stored.");
  assert(fs.existsSync(path.join(written.outputDirectory, "query-observations.jsonl")), "Query-level provenance JSONL must be stored.");
  assert(fs.existsSync(path.join(written.outputDirectory, "normalized-records.jsonl")), "Normalized JSONL must be stored separately.");
  const storedManifest = JSON.parse(fs.readFileSync(path.join(written.outputDirectory, "manifest.json"), "utf8"));
  assert.equal(storedManifest.recordCounts.rawUnique, paged.rawRecords.length);
  assert.equal(storedManifest.recordCounts.normalized, paged.normalizedRecords.length);
  assert.equal(storedManifest.recordCounts.queryObservations, paged.rawRecords.reduce((count, record) => count + record.observations.length, 0));
  assert.throws(() => writeOpenFdaRegulatoryCorpus(paged, outputDirectory), /already exists/, "Immutable snapshots must not be overwritten.");

  const streamedDirectory = path.join(temporaryRoot, "streamed-corpus");
  const streamedWriter = createOpenFdaRegulatoryCorpusWriter(streamedDirectory);
  const streamed = await ingestBotulinumOpenFda({
    products: ["BOTOX"],
    fetchImpl: pagedFetch,
    sleep: async () => {},
    now: tickingClock(),
    retainRawRecords: false,
    onUniqueRawRecord: (record) => streamedWriter.appendRaw(record),
    onQueryObservation: (item) => streamedWriter.appendObservation(item),
  });
  const streamedOutput = streamedWriter.finalize(streamed);
  assert.equal(streamed.rawRecords.length, 0, "Streaming mode must not retain complete raw payloads in memory.");
  assert.equal(streamedOutput.manifest.recordCounts.rawUnique, streamed.normalizedRecords.length, "Streaming output must retain one raw payload per normalized case.");
  assert.equal(fs.readFileSync(path.join(streamedDirectory, "raw-records.jsonl"), "utf8").trim().split("\n").length, streamed.normalizedRecords.length);
  assert.equal(streamedOutput.manifest.recordCounts.queryObservations, 6, "Streaming output must preserve every overlapping query observation.");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

let retryCalls = 0;
const retryDelays: number[] = [];
const retryFetch = async () => {
  retryCalls += 1;
  if (retryCalls === 1) return new Response(JSON.stringify({ error: { code: "RATE_LIMIT", message: "slow down" } }), { status: 429, headers: { "retry-after": "2" } });
  return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "No matches found!" } }), { status: 404 });
};
const retried = await ingestBotulinumOpenFda({ products: ["BOTOX"], fetchImpl: retryFetch, sleep: async (delay) => { retryDelays.push(delay); }, now: tickingClock() });
assert.equal(retried.status, "complete", "No-match queries after a successful retry are complete, not failures.");
assert(retryCalls >= 3 && retryDelays.includes(2000), "HTTP 429 must honor Retry-After before continuing.");

let failedCalls = 0;
const failed = await ingestBotulinumOpenFda({
  products: ["BOTOX"],
  fetchImpl: async () => { failedCalls += 1; return new Response("failure", { status: 503 }); },
  sleep: async () => {},
  now: tickingClock(),
});
assert.equal(failed.status, "partial");
assert.equal(failedCalls, getOpenFdaRegulatoryMapping().retry.maxAttempts, "Retryable API failures must stop after the configured attempt limit.");
assert(failed.queryRuns[0].error?.includes("malformed JSON") || failed.queryRuns[0].error?.includes("503"));

const suspectFiltered = await ingestBotulinumOpenFda({
  products: ["BOTOX"], suspectOnly: true,
  fetchImpl: async () => new Response(JSON.stringify({ meta: { results: { total: 1 } }, results: [pageTwo.results[1]] }), { status: 200 }),
  sleep: async () => {}, now: tickingClock(),
});
assert.equal(suspectFiltered.normalizedRecords.length, 0, "Suspect-only mode must post-filter the matching drug object rather than trust cross-array query matching.");
assert(suspectFiltered.queryRuns.every((run) => run.recordsRejectedBySuspectPostFilter === 1));

const malformed = await ingestBotulinumOpenFda({
  products: ["BOTOX"],
  fetchImpl: async () => new Response(JSON.stringify({ meta: { results: { total: 1 } }, results: [malformedRecord] }), { status: 200 }),
  sleep: async () => {}, now: tickingClock(),
});
assert.equal(malformed.normalizedRecords.length, 0);
assert.equal(malformed.malformedRecords.length, 2, "The malformed fixture is retained once for each configured BOTOX query.");

await assert.rejects(
  () => ingestBotulinumOpenFda({
    products: ["BOTOX"],
    maxRecords: 1,
    fetchImpl: async () => new Response(JSON.stringify(pageOne), { status: 200 }),
    sleep: async () => {},
    now: tickingClock(),
    onUniqueRawRecord: () => { throw new Error("disk full"); },
  }),
  /persistence hook failed/,
  "Persistence failures must stop ingestion instead of being mislabeled as malformed source reports.",
);

console.log(JSON.stringify({
  configuredQueries: allQueries.length,
  fixtureCases: paged.normalizedRecords.length,
  duplicateObservations: paged.duplicateCount,
  malformedRecordsRetained: malformed.malformedRecords.length,
  retryAttemptsValidated: failedCalls,
}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
