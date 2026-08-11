import fs from "node:fs";
import path from "node:path";
import {
  BOTULINUM_PV_CONCEPTS,
  BOTULINUM_PV_CORPUS_ID,
  BOTULINUM_PV_THERAPEUTIC_AREA,
  isBotulinumPvCandidate,
  loadBotulinumPvCorpus,
  parseCsvPostDate,
} from "../lib/pv";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const corpus = loadBotulinumPvCorpus();
assert(corpus.corpusId === BOTULINUM_PV_CORPUS_ID && corpus.therapeuticArea === BOTULINUM_PV_THERAPEUTIC_AREA, "Bundled PV corpus must retain its stable identity and therapeutic-area scope.");
assert(corpus.rowCount === 3716, "Botulinum toxin PV corpus row count changed unexpectedly.");
assert(corpus.rows.length === 1425 && corpus.errors.length === 2291, "Corpus must distinguish source verbatims from rows that contain only derived keyword metadata.");
assert(corpus.candidates.length >= 200 && corpus.candidates.length < 500, "Contextual PV rules must produce a bounded human-review candidate set.");
assert(corpus.contentColumns.join("|") === "Headline|Opening Text|Hit Sentence", "Keywords and key phrases must not be treated as original post verbatim.");
assert(parseCsvPostDate("11-Aug-2026 10:58AM") === "2026-08-11T10:58:00.000Z", "Meltwater post timestamps must normalize deterministically.");
assert(BOTULINUM_PV_CONCEPTS.some((item) => item.canonicalTerm === "Dysphagia") && BOTULINUM_PV_CONCEPTS.some((item) => item.canonicalTerm === "Eyelid or brow ptosis"), "Botulinum toxin detection concepts must cover benchmark safety events.");

function row(verbatim: string) {
  return { rowNumber: 2, externalId: `quality-${verbatim.length}`, verbatim, sourceUrl: "https://example.test/post", postedAt: "2026-08-11T10:58:00.000Z", postedAtRawValue: "11-Aug-2026 10:58AM" };
}
assert(isBotulinumPvCandidate(row("Two hours after Botox I developed trouble swallowing and shortness of breath.")), "A product-linked, temporally supported serious health experience must route to review.");
assert(isBotulinumPvCandidate(row("Following Dysport, my eyelid started drooping and it is still ongoing.")), "A brand-specific ptosis narrative must route to review.");
assert(!isBotulinumPvCandidate(row("Natural Botox face yoga is my favorite beauty routine.")), "Metaphorical beauty content must not route to PV review.");
assert(!isBotulinumPvCandidate(row("My migraine started this morning and I have a Botox appointment next week.")), "A pre-existing symptom plus future appointment must not imply product-event association.");
assert(!isBotulinumPvCandidate(row("Important safety information: Botox may cause headache and bruising.")), "Promotional label language must not be treated as a reporter experience.");

const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/202608110002_scope_pv_corpora.sql"), "utf8");
for (const field of ["therapeutic_area", "corpus_id", "pv_records_therapeutic_area_queue_idx", "pv_import_batches_principal_corpus_idx"]) assert(migration.includes(field), `Botulinum PV migration is missing ${field}.`);
const route = fs.readFileSync(path.resolve(process.cwd(), "src/app/api/pv/corpora/botulinum-toxin/route.ts"), "utf8");
assert(route.includes("importBundledBotulinumPvCorpus") && route.includes("maxDuration = 60"), "Bundled corpus route must use the governed bulk activation path.");
const workbench = fs.readFileSync(path.resolve(process.cwd(), "src/components/PvComplianceCenter.jsx"), "utf8");
for (const phrase of ["Botulinum toxin PV corpus", "Activate Botulinum toxin PV corpus", "Keywords are not used as original verbatim"]) assert(workbench.includes(phrase), `PV UX is missing ${phrase}.`);

console.log(JSON.stringify({ therapeuticArea: corpus.therapeuticArea, sourceRows: corpus.rowCount, screenableVerbatims: corpus.rows.length, candidateRecords: corpus.candidates.length, rowsWithoutVerbatim: corpus.errors.length }, null, 2));
