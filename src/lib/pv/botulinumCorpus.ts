import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parsePvCsv } from "./csvImport";
import type { PvCsvImportRow } from "./csvImport";
import type { PvDetectionConcept } from "./types";
import { recognizeBotulinumToxinPvMention } from "./recognition";

export const BOTULINUM_PV_CORPUS_ID = "botulinum_toxin_pv_combined_2026_09_11";
export const BOTULINUM_PV_THERAPEUTIC_AREA = "Botulinum toxin";
export const BOTULINUM_PV_CORPUS_FILES = [
  "botulinum-toxin-pv-relevance.csv",
  "botulinum-toxin.csv",
] as const;
export const BOTULINUM_PV_CORPUS_FILE = BOTULINUM_PV_CORPUS_FILES.join(" + ");
export const BOTULINUM_PV_LIBRARY_NAME = "Botulinum toxin PV detection library";

const legacyProductExclusions = [
  "natural botox", "hair botox", "botox in a bottle", "botox-like", "needle-free botox",
  "nature's botox", "diy botox banana", "botox banana face mask",
];

function concept(id: string, category: PvDetectionConcept["category"], canonicalTerm: string, terms: string[], weight: number, conceptExclusions: string[] = []): PvDetectionConcept {
  return { id, category, canonicalTerm, terms, exclusions: conceptExclusions, language: "en", weight, version: 1, active: true };
}

export const BOTULINUM_PV_CONCEPTS: PvDetectionConcept[] = [
  concept("btx-product", "product", "Botulinum toxin", ["botulinum toxin", "botox", "onabotulinumtoxina", "onabotulinum toxin a", "bont-a", "dysport", "abobotulinumtoxina", "xeomin", "incobotulinumtoxina", "jeuveau", "prabotulinumtoxina", "daxxify", "daxibotulinumtoxina", "letybo", "letibotulinumtoxina", "nuceiva"], 100, legacyProductExclusions),
  concept("btx-ptosis", "adverse_experience", "Eyelid or brow ptosis", ["ptosis", "droopy eye", "drooping eye", "dropped my eyelid", "dropped her eyelid", "dropped his eyelid", "droopy eyelid", "drooping eyelid", "eyelid drooping", "eyelid started drooping", "heavy eyelid", "brow droop"], 100),
  concept("btx-dysphagia", "adverse_experience", "Dysphagia", ["dysphagia", "trouble swallowing", "difficulty swallowing", "can't swallow", "cannot swallow"], 100),
  concept("btx-breathing", "adverse_experience", "Breathing difficulty", ["shortness of breath", "difficulty breathing", "trouble breathing", "dyspnea", "breathless", "choking", "couldn't breathe", "cannot breathe"], 100),
  concept("btx-weakness", "adverse_experience", "Muscular weakness", ["generalized weakness", "muscle weakness", "neck weakness", "weak neck", "weakness all over"], 90),
  concept("btx-vision", "adverse_experience", "Visual disturbance", ["double vision", "diplopia", "blurred vision", "blurry vision"], 90),
  concept("btx-headache", "adverse_experience", "Headache or migraine", ["headache", "migraine"], 70),
  concept("btx-voice", "adverse_experience", "Voice change", ["voice change", "hoarse voice", "hoarseness", "dysphonia", "slurred speech"], 90),
  concept("btx-hypersensitivity", "adverse_experience", "Hypersensitivity reaction", ["allergic reaction", "bad reaction", "unexpected reaction", "negative reaction", "anaphylaxis", "hives", "rash", "swollen throat", "face swelled", "facial swelling"], 100),
  concept("btx-local", "adverse_experience", "Injection-site reaction", ["injection site pain", "painful bump", "painful lump", "bruising", "swelling", "redness", "tenderness"], 65),
  concept("btx-asymmetry", "adverse_experience", "Facial asymmetry", ["facial asymmetry", "uneven smile", "crooked smile", "uneven brow", "uneven eyebrow", "spock brow", "botox shelf"], 80),
  concept("btx-movement", "adverse_experience", "Facial movement impairment", ["frozen face", "face frozen", "stiff face", "facial stiffness", "can't move my face", "cannot move my face", "couldn't move my face", "unable to move my face", "can't smile", "cannot smile", "couldn't smile", "difficulty smiling"], 80),
  concept("btx-complication", "adverse_experience", "Reported reaction or complication", ["adverse reaction", "botched botox", "botched procedure", "botox went wrong", "treatment went wrong", "botox complication", "botox side effect"], 85),
  concept("btx-retention", "adverse_experience", "Urinary retention", ["urinary retention", "can't urinate", "cannot urinate", "trouble urinating"], 100),
  concept("btx-ineffective", "lack_of_efficacy", "Lack of effect", ["botox didn't work", "botox did not work", "no effect from botox", "botox didn't last", "botox did not last", "botox wore off immediately", "botox wore off early", "botox stopped working", "immune to botox", "botox resistance", "resistant to botox"], 85),
  concept("btx-dose", "medication_error", "Dose or administration concern", ["wrong dose", "too many units", "too much botox", "excessive dose", "excessive dosing", "injected in the wrong", "wrong injection site", "wrong placement", "incorrect depth", "poor injection technique"], 90),
  concept("btx-overdose", "overdose", "Potential overdose", ["overdose", "overdosed", "excessive dose"], 100),
  concept("btx-pregnancy", "pregnancy", "Pregnancy or breastfeeding exposure", ["pregnant", "pregnancy", "breastfeeding", "breast feeding", "trying to conceive", "embryo transfer"], 90),
  concept("btx-misuse", "misuse_abuse", "Potential misuse or unlicensed administration", ["diy botox", "self-injecting", "self injected botox", "injecting botox between your eyebrows yourself", "botox at home", "home botox", "botox party", "black market botox", "unlicensed botox"], 90),
  concept("btx-quality", "product_quality", "Potential counterfeit or product-quality concern", ["counterfeit botox", "fake botox", "counterfeit vial", "contaminated vial", "broken vial", "unlicensed botox"], 90, ["fake botox lips", "fake botox face", "fake botox faces", "overly fake botox"]),
  concept("btx-severe", "severity", "Severe", ["severe", "emergency room", "er visit", "hospitalized", "hospitalised", "permanent injury", "life threatening"], 90),
  concept("btx-change", "treatment_change", "Treatment change", ["stopped botox", "won't get botox again", "never getting botox again", "needed treatment", "went to the er"], 65),
];

export function isBotulinumPvCandidate(row: PvCsvImportRow) {
  const result = recognizeBotulinumToxinPvMention({
    original_mention: row.verbatim,
    source: "curated_csv",
    source_url: row.sourceUrl,
    source_id: row.externalId,
    original_timestamp: row.postedAt,
    collection_timestamp: row.postedAt,
    algorithm_timestamp: row.postedAt,
    author_identifier: row.authorIdentifier || null,
    language: "en",
  });
  return result.human_review_status === "PV review required";
}

export function loadBotulinumPvCorpus() {
  const parsedSources = BOTULINUM_PV_CORPUS_FILES.map((fileName) => parsePvCsv(
    new Uint8Array(fs.readFileSync(path.resolve(process.cwd(), "data", fileName))),
    fileName,
    {
      dateColumn: "Date",
      contentColumns: ["Headline", "Opening Text", "Hit Sentence"],
      sourceUrlColumn: "URL",
      externalIdColumn: "Document ID",
      authorIdentifierColumn: "Influencer",
    }
  ));
  const rowsBySourceIdentity = new Map<string, PvCsvImportRow>();
  for (const parsed of parsedSources) {
    for (const row of parsed.rows) {
      const identity = row.externalId || row.sourceUrl;
      const existing = rowsBySourceIdentity.get(identity);
      if (!existing || row.verbatim.length > existing.verbatim.length) {
        rowsBySourceIdentity.set(identity, {
          ...row,
          authorIdentifier: row.authorIdentifier || existing?.authorIdentifier,
        });
      } else if (!existing.authorIdentifier && row.authorIdentifier) {
        rowsBySourceIdentity.set(identity, { ...existing, authorIdentifier: row.authorIdentifier });
      }
    }
  }
  const rows = [...rowsBySourceIdentity.values()];
  const candidates = rows.filter(isBotulinumPvCandidate);
  const primary = parsedSources[0];
  const fileHash = createHash("sha256")
    .update(parsedSources.map((parsed) => `${parsed.fileName}:${parsed.fileHash}`).join("|"))
    .digest("hex");
  return {
    ...primary,
    fileName: BOTULINUM_PV_CORPUS_FILE,
    fileHash,
    rowCount: parsedSources.reduce((sum, parsed) => sum + parsed.rowCount, 0),
    rows,
    errors: parsedSources.flatMap((parsed) => parsed.errors.map((error) => ({
      ...error,
      error: `${parsed.fileName}: ${error.error}`,
    }))),
    sourceFiles: parsedSources.map((parsed) => ({
      fileName: parsed.fileName,
      fileHash: parsed.fileHash,
      rowCount: parsed.rowCount,
      screenableRowCount: parsed.rows.length,
      errorCount: parsed.errors.length,
    })),
    corpusId: BOTULINUM_PV_CORPUS_ID,
    therapeuticArea: BOTULINUM_PV_THERAPEUTIC_AREA,
    candidates,
  };
}
