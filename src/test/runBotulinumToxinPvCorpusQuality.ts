import fs from "node:fs";
import path from "node:path";
import {
  BOTULINUM_PV_CONCEPTS,
  BOTULINUM_PV_CORPUS_ID,
  BOTULINUM_PV_CORPUS_FILES,
  BOTULINUM_PV_THERAPEUTIC_AREA,
  isBotulinumPvCandidate,
  loadBotulinumPvCorpus,
  parseCsvPostDate,
  recognizeBotulinumToxinPvMention,
} from "../lib/pv";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const corpus = loadBotulinumPvCorpus();
assert(corpus.corpusId === BOTULINUM_PV_CORPUS_ID && corpus.therapeuticArea === BOTULINUM_PV_THERAPEUTIC_AREA, "Bundled PV corpus must retain its stable identity and therapeutic-area scope.");
assert(corpus.rowCount === 8716, "The combined Botulinum toxin PV corpus must include both governed source exports.");
assert(corpus.rows.length === 6248 && corpus.errors.length === 2447, "Corpus must deduplicate screenable source verbatims and retain row-level parsing limitations.");
assert(corpus.sourceFiles.map((source) => source.fileName).join("|") === BOTULINUM_PV_CORPUS_FILES.join("|"), "PV synchronization must inspect the dedicated PV export and the enriched core social export.");
assert(corpus.candidates.length >= 1_000 && corpus.candidates.length < 2_500, "The production pipeline must retain a bounded, false-negative-sensitive review population.");
const candidateSegments = corpus.candidates.map((candidate) => {
  const recognition = recognizeBotulinumToxinPvMention({
    original_mention: candidate.verbatim,
    source: "curated_csv",
    source_url: candidate.sourceUrl,
    source_id: candidate.externalId,
    original_timestamp: candidate.postedAt,
    collection_timestamp: candidate.postedAt,
    algorithm_timestamp: candidate.postedAt,
    author_identifier: candidate.authorIdentifier || null,
  });
  return recognition.observed_event_detection.events.some((event) => ["OBSERVED", "POSSIBLE_OBSERVED"].includes(event.observation_status)) ? "ae_adr" : "health_experience";
});
assert(candidateSegments.filter((segment) => segment === "ae_adr").length >= 300, "Potential case-level AE/ADR mentions must populate the governed Review Queue.");
assert(candidateSegments.filter((segment) => segment === "health_experience").length >= 800, "Non-AE special situations must populate Health Experience Detection separately.");
assert(corpus.contentColumns.join("|") === "Headline|Opening Text|Hit Sentence", "Keywords and key phrases must not be treated as original post verbatim.");
assert(parseCsvPostDate("11-Aug-2026 10:58AM") === "2026-08-11T10:58:00.000Z", "Meltwater post timestamps must normalize deterministically.");
assert(BOTULINUM_PV_CONCEPTS.some((item) => item.canonicalTerm === "Dysphagia") && BOTULINUM_PV_CONCEPTS.some((item) => item.canonicalTerm === "Eyelid or brow ptosis"), "Botulinum toxin detection concepts must cover benchmark safety events.");
for (const category of ["pregnancy", "misuse_abuse", "product_quality", "medication_error", "overdose"]) {
  assert(BOTULINUM_PV_CONCEPTS.some((item) => item.category === category), `Botulinum toxin health-experience detection must cover ${category}.`);
}

function row(verbatim: string) {
  return { rowNumber: 2, externalId: `quality-${verbatim.length}`, verbatim, sourceUrl: "https://example.test/post", postedAt: "2026-08-11T10:58:00.000Z", postedAtRawValue: "11-Aug-2026 10:58AM" };
}
assert(isBotulinumPvCandidate(row("Two hours after Botox I developed trouble swallowing and shortness of breath.")), "A product-linked, temporally supported serious health experience must route to review.");
assert(isBotulinumPvCandidate(row("Following Dysport, my eyelid started drooping and it is still ongoing.")), "A brand-specific ptosis narrative must route to review.");
assert(!isBotulinumPvCandidate(row("Natural Botox face yoga is my favorite beauty routine.")), "Metaphorical beauty content must not route to PV review.");
assert(!isBotulinumPvCandidate(row("My migraine started this morning and I have a Botox appointment next week.")), "A pre-existing symptom plus future appointment must not imply product-event association.");
assert(!isBotulinumPvCandidate(row("Important safety information: Botox may cause headache and bruising.")), "Promotional label language must not be treated as a reporter experience.");
assert(!isBotulinumPvCandidate(row("Adverse reactions following Botox injection were headache and eyelid ptosis.")), "Aggregate label-style adverse-reaction language must not enter the individual AE/ADR Review Queue.");
assert(!isBotulinumPvCandidate(row("I receive Botox every three months for migraine and it helps my headaches.")), "A treated indication and beneficial outcome must not be mistaken for an adverse event.");
assert(isBotulinumPvCandidate(row("I stopped Botox because it gave me a severe headache for three days.")), "A headache explicitly attributed to Botulinum toxin must remain eligible for AE/ADR review.");
assert(!isBotulinumPvCandidate(row("Ptosis can happen after Botox; follow for more educational content.")), "Generic safety education without an asserted individual case must not enter the AE/ADR Review Queue.");
assert(isBotulinumPvCandidate(row("My migraine Botox left a painful bump between my eyebrows.")), "Colloquial first-person injection-site experiences must route to AE/ADR review.");
assert(isBotulinumPvCandidate(row("After Botox, I had a frozen face and could not smile for weeks.")), "Colloquial facial-movement experiences must route to AE/ADR review.");
assert(isBotulinumPvCandidate(row("I found out I was pregnant after receiving Botox.")), "Pregnancy exposure must be retained as a health-experience special situation.");
assert(isBotulinumPvCandidate(row("I tried DIY Botox and injected it myself.")), "Potential misuse must be retained as a health-experience special situation.");

const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608110002_scope_pv_corpora.sql"), "utf8");
for (const field of ["therapeutic_area", "corpus_id", "pv_records_therapeutic_area_queue_idx", "pv_import_batches_principal_corpus_idx"]) assert(migration.includes(field), `Botulinum PV migration is missing ${field}.`);
const route = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/corpora/botulinum-toxin/route.ts"), "utf8");
assert(route.includes("importBundledBotulinumPvCorpus") && route.includes("maxDuration = 60"), "Bundled corpus route must use the governed bulk activation path.");
const service = fs.readFileSync(path.resolve(process.cwd(), "src/lib/pv/service.ts"), "utf8");
assert(service.includes("recognizeBotulinumToxinPvMention") && service.includes("botulinumRecognitionToLegacyDetection"), "Production persistence must use the versioned Botulinum toxin recognition pipeline.");
const workbench = fs.readFileSync(path.resolve(process.cwd(), "src/components/PvComplianceCenter.jsx"), "utf8");
assert(!workbench.includes("Botulinum toxin PV corpus"), "The corpus activation section must remain removed from Screening Status after ingestion.");
for (const contract of ["automaticCorpusSync", "initializeBotulinumPvCorpus", 'therapeuticArea !== "Botulinum toxin"', 'fetch("/api/pv/corpora/botulinum-toxin"', "await loadAll()"] as const) {
  assert(workbench.includes(contract), `An empty authorized production tenant must automatically initialize and refresh the governed Botulinum toxin PV corpus: ${contract}.`);
}

console.log(JSON.stringify({ therapeuticArea: corpus.therapeuticArea, sourceRows: corpus.rowCount, screenableVerbatims: corpus.rows.length, candidateRecords: corpus.candidates.length, aeAdrReviewCandidates: candidateSegments.filter((segment) => segment === "ae_adr").length, healthExperienceDetections: candidateSegments.filter((segment) => segment === "health_experience").length, rowsWithoutVerbatim: corpus.errors.length }, null, 2));
