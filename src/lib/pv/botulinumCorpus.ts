import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { classifyPvContent } from "./detection";
import { parsePvCsv } from "./csvImport";
import type { PvCsvImportRow } from "./csvImport";
import type { PvDetectionConcept } from "./types";

export const BOTULINUM_PV_CORPUS_ID = "botulinum_toxin_pv_combined_2026_09_11";
export const BOTULINUM_PV_THERAPEUTIC_AREA = "Botulinum toxin";
export const BOTULINUM_PV_CORPUS_FILES = [
  "botulinum-toxin-pv-relevance.csv",
  "botulinum-toxin.csv",
] as const;
export const BOTULINUM_PV_CORPUS_FILE = BOTULINUM_PV_CORPUS_FILES.join(" + ");
export const BOTULINUM_PV_LIBRARY_NAME = "Botulinum toxin PV detection library";

const exclusions = [
  "natural botox", "hair botox", "botox in a bottle", "botox-like", "needle-free botox",
  "nature's botox", "diy botox banana", "botox banana face mask",
  "may cause", "can cause", "side effects include", "important safety information",
];

function concept(id: string, category: PvDetectionConcept["category"], canonicalTerm: string, terms: string[], weight: number, conceptExclusions: string[] = []): PvDetectionConcept {
  return { id, category, canonicalTerm, terms, exclusions: conceptExclusions, language: "en", weight, version: 1, active: true };
}

export const BOTULINUM_PV_CONCEPTS: PvDetectionConcept[] = [
  concept("btx-product", "product", "Botulinum toxin", ["botulinum toxin", "botox", "onabotulinumtoxina", "onabotulinum toxin a", "bont-a", "dysport", "abobotulinumtoxina", "xeomin", "incobotulinumtoxina", "jeuveau", "prabotulinumtoxina", "daxxify", "daxibotulinumtoxina", "letybo", "letibotulinumtoxina", "nuceiva"], 100, exclusions),
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

const ASSOCIATION_LANGUAGE = /\b(after|following|due to|because of|caused|gave me|left|developed|suffered|reaction to|side effects? (?:of|from)|repercussions?|both times|each time|whenever|hours? later|days? later|weeks? later|immediately after|post[- ]botox)\b/i;
const DIRECT_SAFETY_LANGUAGE = /\b(dysphagia|ptosis|anaphylaxis|overdose|urinary retention|trouble swallowing|difficulty swallowing|difficulty breathing|shortness of breath|generalized weakness|double vision)\b/i;
const CASE_SUBJECT_LANGUAGE = /\b(i|i'm|i've|me|my|mine|we|we're|we've|our|he|he's|his|she|she's|her|patient|client|friend|mother|mom|father|dad|sister|brother|husband|wife|partner)\b/i;
const STRONG_CASE_ASSERTION = /\b(developed|suffered|was hospitalized|was hospitalised|ended up in (?:the )?(?:er|emergency room|hospital)|reaction to|gave me|left me|left her|left him|caused (?:me|her|him|their))\b/i;
const HYPOTHETICAL_OR_GENERAL = /\b(have you|could cause|may cause|can cause|might cause|possible side effect|potential side effect|risks? include)\b/i;
const GENERIC_SAFETY_EDUCATION = /\b(adverse reactions? following|side effects? explained|what you need to know|risks? and safety|risks? include|most common questions?|every patient|how i inject|before you book|follow for more|patient education|real complications like|treatment options?)\b/i;
const PRODUCT_LANGUAGE = "(?:botox|botulinum(?: toxin)?|dysport|xeomin|jeuveau|daxxify|letybo|nuceiva)";
const PRODUCT_CAUSED_HEADACHE = new RegExp([
  `${PRODUCT_LANGUAGE}.{0,120}(?:caused|gave (?:me|her|him)|triggered|ended up (?:with|having)|developed|started).{0,80}(?:headache|migraine)`,
  `(?:headache|migraine).{0,100}(?:caused by|due to|from).{0,60}${PRODUCT_LANGUAGE}`,
].join("|"), "i");
const PREGNANCY_EXPOSURE_LANGUAGE = new RegExp([
  `${PRODUCT_LANGUAGE}.{0,80}(?:while|during|after|before).{0,30}(?:pregnan|breastfeed)`,
  `(?:pregnan|breastfeed).{0,80}(?:while|during|after|before).{0,30}${PRODUCT_LANGUAGE}`,
  `(?:got|getting|had|received|receiving|using|used|injected).{0,40}${PRODUCT_LANGUAGE}.{0,100}(?:pregnan|breastfeed)`,
  `(?:pregnan|breastfeed).{0,100}(?:got|getting|had|received|receiving|using|used|injected).{0,40}${PRODUCT_LANGUAGE}`,
  `${PRODUCT_LANGUAGE}.{0,100}(?:take|taking|took|had to take).{0,20}(?:a )?break.{0,30}(?:because|bc|due to).{0,20}(?:pregnan|breastfeed)`,
  `(?:stopped|paused|postponed|avoided).{0,40}${PRODUCT_LANGUAGE}.{0,40}(?:because|bc|due to).{0,20}(?:pregnan|breastfeed)`,
  `(?:breastfeeding and ${PRODUCT_LANGUAGE}|${PRODUCT_LANGUAGE} and breastfeeding)`,
].join("|"), "i");

function termIndexes(text: string, term: string) {
  const indexes: number[] = [];
  const normalizedTerm = term.toLowerCase();
  let index = text.indexOf(normalizedTerm);
  while (index >= 0) {
    indexes.push(index);
    index = text.indexOf(normalizedTerm, index + 1);
  }
  return indexes;
}

function hasNearbyProductAndCategory(result: ReturnType<typeof classifyPvContent>, text: string, category: PvDetectionConcept["category"], maxDistance = 240) {
  const productIndexes = result.matches
    .filter((match) => match.category === "product")
    .flatMap((match) => termIndexes(text, match.matchedTerm));
  const categoryIndexes = result.matches
    .filter((match) => match.category === category)
    .flatMap((match) => termIndexes(text, match.matchedTerm));
  return productIndexes.some((productIndex) => categoryIndexes.some((categoryIndex) => Math.abs(productIndex - categoryIndex) <= maxDistance));
}

function hasContextualNonAeSafetySituation(result: ReturnType<typeof classifyPvContent>, text: string) {
  if (result.classifications.includes("pregnancy") && PREGNANCY_EXPOSURE_LANGUAGE.test(text)) return true;
  const categories: PvDetectionConcept["category"][] = ["medication_error", "overdose", "misuse_abuse", "lack_of_efficacy", "product_quality"];
  return categories.some((category) => hasNearbyProductAndCategory(result, text, category));
}

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
  const nonAeSafetySituation = hasContextualNonAeSafetySituation(result, text);
  const caseSubjectSupported = CASE_SUBJECT_LANGUAGE.test(row.verbatim);
  const adverseMatches = result.matches.filter((match) => match.category === "adverse_experience");
  const ambiguousIndicationOnly = adverseMatches.length > 0 && adverseMatches.every((match) => match.canonicalTerm === "Headache or migraine");
  const adverseConceptLinked = hasNearbyProductAndCategory(result, text, "adverse_experience", 360);
  const adverseCaseSupported = adverseConceptLinked && (
    (ASSOCIATION_LANGUAGE.test(row.verbatim) && caseSubjectSupported) ||
    STRONG_CASE_ASSERTION.test(row.verbatim) ||
    (DIRECT_SAFETY_LANGUAGE.test(row.verbatim) && caseSubjectSupported)
  ) &&
    !(ambiguousIndicationOnly && !PRODUCT_CAUSED_HEADACHE.test(row.verbatim)) &&
    !(GENERIC_SAFETY_EDUCATION.test(row.verbatim) && !STRONG_CASE_ASSERTION.test(row.verbatim)) &&
    !(HYPOTHETICAL_OR_GENERAL.test(row.verbatim) && !STRONG_CASE_ASSERTION.test(row.verbatim));
  const associationSupported = result.detectionSegment === "health_experience"
    ? nonAeSafetySituation
    : adverseCaseSupported;
  return result.shouldCreateRecord && associationSupported && !promotionalOrMetaphorical;
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
