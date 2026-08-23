import fs from "node:fs";
import path from "node:path";
import { classifyPvContent } from "./detection";
import { parsePvCsv } from "./csvImport";
import type { PvCsvImportRow } from "./csvImport";
import type { PvDetectionConcept } from "./types";

export const BOTULINUM_PV_CORPUS_ID = "botulinum_toxin_pv_relevance_2026_08_11";
export const BOTULINUM_PV_THERAPEUTIC_AREA = "Botulinum toxin";
export const BOTULINUM_PV_CORPUS_FILE = "botulinum-toxin-pv-relevance.csv";
export const BOTULINUM_PV_LIBRARY_NAME = "Botulinum toxin PV detection library";

const exclusions = [
  "natural botox", "hair botox", "botox in a bottle", "botox-like", "needle-free botox",
  "may cause", "can cause", "side effects include", "important safety information",
];

function concept(id: string, category: PvDetectionConcept["category"], canonicalTerm: string, terms: string[], weight: number, conceptExclusions: string[] = []): PvDetectionConcept {
  return { id, category, canonicalTerm, terms, exclusions: conceptExclusions, language: "en", weight, version: 1, active: true };
}

export const BOTULINUM_PV_CONCEPTS: PvDetectionConcept[] = [
  concept("btx-product", "product", "Botulinum toxin", ["botulinum toxin", "botox", "onabotulinumtoxina", "onabotulinum toxin a", "bont-a", "dysport", "abobotulinumtoxina", "xeomin", "incobotulinumtoxina", "jeuveau", "prabotulinumtoxina", "daxxify", "daxibotulinumtoxina", "letybo", "letibotulinumtoxina", "nuceiva"], 100, exclusions),
  concept("btx-ptosis", "adverse_experience", "Eyelid or brow ptosis", ["ptosis", "droopy eyelid", "drooping eyelid", "eyelid drooping", "eyelid started drooping", "heavy eyelid", "brow droop"], 100),
  concept("btx-dysphagia", "adverse_experience", "Dysphagia", ["dysphagia", "trouble swallowing", "difficulty swallowing", "can't swallow", "cannot swallow"], 100),
  concept("btx-breathing", "adverse_experience", "Breathing difficulty", ["shortness of breath", "difficulty breathing", "trouble breathing", "dyspnea", "couldn't breathe", "cannot breathe"], 100),
  concept("btx-weakness", "adverse_experience", "Muscular weakness", ["generalized weakness", "muscle weakness", "neck weakness", "weak neck", "weakness all over"], 90),
  concept("btx-vision", "adverse_experience", "Visual disturbance", ["double vision", "diplopia", "blurred vision", "blurry vision"], 90),
  concept("btx-headache", "adverse_experience", "Headache or migraine", ["headache", "migraine"], 70),
  concept("btx-voice", "adverse_experience", "Voice change", ["voice change", "hoarse voice", "hoarseness", "dysphonia", "slurred speech"], 90),
  concept("btx-hypersensitivity", "adverse_experience", "Hypersensitivity reaction", ["allergic reaction", "anaphylaxis", "hives", "rash", "swollen throat"], 100),
  concept("btx-local", "adverse_experience", "Injection-site reaction", ["injection site pain", "bruising", "swelling", "redness", "tenderness"], 65),
  concept("btx-asymmetry", "adverse_experience", "Facial asymmetry", ["facial asymmetry", "uneven smile", "crooked smile", "frozen face"], 80),
  concept("btx-retention", "adverse_experience", "Urinary retention", ["urinary retention", "can't urinate", "cannot urinate", "trouble urinating"], 100),
  concept("btx-ineffective", "lack_of_efficacy", "Lack of effect", ["didn't work", "did not work", "no effect", "wore off immediately", "stopped working", "immune to botox", "botox resistance"], 85),
  concept("btx-dose", "medication_error", "Dose or administration concern", ["wrong dose", "too many units", "too much botox", "injected in the wrong", "wrong injection site"], 90),
  concept("btx-overdose", "overdose", "Potential overdose", ["overdose", "overdosed", "excessive dose"], 100),
  concept("btx-severe", "severity", "Severe", ["severe", "emergency room", "er visit", "hospitalized", "hospitalised", "permanent injury", "life threatening"], 90),
  concept("btx-change", "treatment_change", "Treatment change", ["stopped botox", "won't get botox again", "never getting botox again", "needed treatment", "went to the er"], 65),
];

const ASSOCIATION_LANGUAGE = /\b(after|following|since|from|due to|because of|caused|gave me|developed|experienced|reaction to|side effect|hours? later|days? later|weeks? later|immediately after)\b/i;
const DIRECT_SAFETY_LANGUAGE = /\b(dysphagia|ptosis|anaphylaxis|overdose|urinary retention|trouble swallowing|difficulty swallowing|difficulty breathing|shortness of breath|generalized weakness|double vision)\b/i;

export function isBotulinumPvCandidate(row: PvCsvImportRow) {
  const result = classifyPvContent({
    externalId: row.externalId,
    sourceType: "curated_csv",
    sourceUrl: row.sourceUrl,
    verbatim: row.verbatim,
    postedAt: row.postedAt,
    dataOrigin: "curated",
  }, BOTULINUM_PV_CONCEPTS, { threshold: 55, libraryVersion: 1 });
  const text = row.verbatim.toLowerCase();
  const promotionalOrMetaphorical = exclusions.some((phrase) => text.includes(phrase));
  const associationSupported = ASSOCIATION_LANGUAGE.test(row.verbatim) || DIRECT_SAFETY_LANGUAGE.test(row.verbatim)
    || result.classifications.some((classification) => classification !== "adverse_event");
  return result.shouldCreateRecord && associationSupported && !promotionalOrMetaphorical;
}

export function loadBotulinumPvCorpus() {
  const filePath = path.resolve(process.cwd(), "data", BOTULINUM_PV_CORPUS_FILE);
  const parsed = parsePvCsv(new Uint8Array(fs.readFileSync(filePath)), BOTULINUM_PV_CORPUS_FILE, {
    dateColumn: "Date",
    contentColumns: ["Headline", "Opening Text", "Hit Sentence"],
    sourceUrlColumn: "URL",
    externalIdColumn: "Document ID",
    authorIdentifierColumn: "Influencer",
  });
  const candidates = parsed.rows.filter(isBotulinumPvCandidate);
  return { ...parsed, corpusId: BOTULINUM_PV_CORPUS_ID, therapeuticArea: BOTULINUM_PV_THERAPEUTIC_AREA, candidates };
}
