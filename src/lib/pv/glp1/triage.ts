import { createHash } from "node:crypto";
import { parseMeltwaterCsv } from "../../../ingestion/adapters/meltwaterAdapter";
import { classifyGlp1Audience } from "../../../ingestion/glp1Audience";
import { parseCsvPostDate } from "../csvImport";
import type { PvDetectionConcept } from "../types";
import { loadGlp1PvCorpus, glp1PvSourceText, type Glp1PvRow } from "./corpus";
import { GLP1_PV_CONCEPTS, classifyGlp1PvContent } from "./detection";
import reference from "../../../../config/pv/glp-1/faers-reference-2026-10-20.json";
import { GLP1_TRIAGE_VERSION, TRIAGE_LANGUAGE_CODES, TRIAGE_REACTION_ALIASES, TRIAGE_PRODUCT_ALIASES, TRIAGE_VOCABULARY_SOURCES } from "./triageVocabulary";

export type TriageStatus = "eligible_english_candidate" | "eligible_source_candidate" | "related_source_excerpt" | "language_review_required" | "context_review_required" | "source_repair_required" | "excluded_content" | "no_rule_signal" | "library_approval_required";
export type ReactionCue = { sourceTerm: string; matchedText: string; basis: "source_reaction_term" | "localized_triage_cue"; referenceOnly: boolean };
export type HeldTriageRow = {
  rowNumber: number; externalId: string; holdReason: string; language: string; languageCode?: string;
  sourceType: string; sourceUrl: string; sourceTitle: string; verbatim: string; authorIdentifier?: string;
  postedAt?: string; postedAtRawValue: string; audience: string; designation: string;
  productCues: string[]; reactionCues: ReactionCue[]; status: TriageStatus; blockers: string[];
  priority: "high" | "standard" | "low"; sourceEpisode?: { sourceTerm: string; evidence: string; patientCue: string }; relatedToRow?: number; relatedSourceRows?: number[]; detectionSegment?: "ae_adr" | "health_experience";
};
export type TriageOptions = { threshold?: number; libraryVersion?: number; approved?: boolean; libraryId?: string; expectedEvents?: string[] };
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const neutral = new Set(["no adverse event", "weight decreased", "obesity", "diabetes mellitus", "type 2 diabetes mellitus", "menopause", "insulin resistance", "surgery"]);
const terms = new Map(reference.reactions.map(reaction => [reaction.term.toLowerCase(), reaction.term]));
const sourcePattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...terms.keys()].sort((a,b) => b.length-a.length).map(escape).join("|")})(?![\\p{L}\\p{N}])`, "giu");
const matchesTerm = (text: string, term: string) => /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(term) ? text.includes(term) : new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, "iu").test(text);
export function findGlp1ReactionCues(text: string, languageCode?: string): ReactionCue[] {
  const cues: ReactionCue[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(sourcePattern)) {
    const key = match[0].toLowerCase();
    if (!seen.has(key)) cues.push({ sourceTerm: terms.get(key)!, matchedText: match[0], basis: "source_reaction_term", referenceOnly: neutral.has(key) });
    seen.add(key);
  }
  if (languageCode && languageCode !== "en") for (const [sourceTerm, languages] of Object.entries(TRIAGE_REACTION_ALIASES)) {
    if (!terms.has(sourceTerm.toLowerCase())) throw new Error(`Triage source reaction missing from snapshot: ${sourceTerm}`);
    const cue = (languages[languageCode] || []).find(alias => matchesTerm(text, alias));
    if (cue && !seen.has(sourceTerm.toLowerCase())) cues.push({ sourceTerm, matchedText: cue, basis: "localized_triage_cue", referenceOnly: false });
  }
  return cues;
}

/** Conservative English source-episode retrieval, separate from the active
 * concept library. A specific patient + asserted event + same-sentence
 * temporal product exposure is required. No causality or seriousness inferred. */
export function findEnglishSourceEpisode(text: string, productCues: string[]) {
  if (/\b(?:buy now|promo code|discount code|dm to order|shop now|mock patient|hypothetical patient)\b/i.test(text)) return undefined;
  const patientCue = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+,\s*\d{1,3}\b|\b(?:woman|man|patient|grandmother|grandfather)\s*(?:aged\s*)?\d{1,3}\b|\b(?:my mother|my father|my wife|my husband|I started|I took)\b/)?.[0];
  if (!patientCue) return undefined;
  for (const sentence of text.split(/[.!?。！？;\n]/u)) {
    if (!productCues.some(term => matchesTerm(sentence, term)) || !/\b(?:following|after|since)\b.{0,100}\b(?:dose|shot|injection|taking|starting)\b/i.test(sentence)) continue;
    if (/\b(?:may|could|risk of|can cause|might|prevent|reduced risk|lower risk|animal|mice|rat|hypothetical|mock)\b/i.test(sentence)) continue;
    for (const cue of findGlp1ReactionCues(sentence, "en")) {
      if (cue.referenceOnly) continue;
      const at = sentence.toLowerCase().indexOf(cue.matchedText.toLowerCase());
      if (/\b(?:no|not|without|denied|denies|never)\b[^,;]{0,60}$/i.test(sentence.slice(Math.max(0, at-70), at))) continue;
      return { sourceTerm: cue.sourceTerm, evidence: sentence.trim(), patientCue };
    }
  }
  return undefined;
}

export function assessHeldGlp1Row(source: Record<string, any>, rowNumber: number, holdReason: string, concepts: PvDetectionConcept[] = GLP1_PV_CONCEPTS, options: TriageOptions = {}): HeldTriageRow {
  const verbatim = glp1PvSourceText(source);
  const language = String(source.Language || "unknown");
  const languageCode = TRIAGE_LANGUAGE_CODES[language.trim().toLowerCase()];
  const audience = classifyGlp1Audience(source);
  const productTerms = [...concepts.filter(c => c.active && c.category === "product").flatMap(c => c.terms), ...TRIAGE_PRODUCT_ALIASES];
  const productCues = [...new Set(productTerms.filter(term => matchesTerm(verbatim, term)))];
  const reactionCues = findGlp1ReactionCues(verbatim, languageCode);
  const postedAtRawValue = [source.Date, source.Time].filter(Boolean).join(" ");
  const externalId = `glp1:social:${String(source["Document ID"] || "").replace(/^"+|"+$/g, "")}`;
  const sourceUrl = String(source.URL || "");
  const blockers: string[] = [];
  let postedAt: string | undefined;
  try { postedAt = parseCsvPostDate(postedAtRawValue); } catch { blockers.push("invalid_source_timestamp"); }
  try { const parsed = new URL(sourceUrl); if (!["https:", "http:"].includes(parsed.protocol) || !parsed.hostname) throw new Error(); } catch { blockers.push("source_url_required"); }
  if (!verbatim.trim() || externalId === "glp1:social:") blockers.push("source_text_or_identifier_required");
  if (languageCode !== "en") blockers.push("qualified_language_review_required");
  if (holdReason === "source_requires_separate_screening_scope") blockers.push("source_scope_confirmation_required");
  const hasSignal = productCues.length > 0 && reactionCues.some(c => !c.referenceOnly);
  let status: TriageStatus = "no_rule_signal";
  let detectionSegment: HeldTriageRow["detectionSegment"];
  let sourceEpisode: HeldTriageRow["sourceEpisode"];
  if (blockers.some(b => /invalid_source|source_url|source_text/.test(b))) status = "source_repair_required";
  else if (/automotive_name_collision|spam|commercial_or_promotional/.test(audience.designation) || /\b(?:buy now|promo code|discount code|dm to order|shop now)\b/i.test(verbatim)) status = "excluded_content";
  else if (languageCode !== "en") status = "language_review_required";
  else if (audience.audience === "off_topic" && !productCues.length) status = "excluded_content";
  else if (hasSignal) {
    const detection = classifyGlp1PvContent({ externalId, sourceUrl, sourceType: String(source["Source Type"] || ""), verbatim, postedAt: postedAt!, language: "en", market: String(source.Country || "") || undefined }, concepts, options);
    detectionSegment = detection.detectionSegment;
    sourceEpisode = detection.shouldCreateRecord ? undefined : findEnglishSourceEpisode(verbatim, productCues);
    status = detection.shouldCreateRecord ? options.approved ? "eligible_english_candidate" : "library_approval_required" : sourceEpisode ? options.approved ? "eligible_source_candidate" : "library_approval_required" : "context_review_required";
    if (sourceEpisode) detectionSegment = "ae_adr";
  }
  return { rowNumber, externalId, holdReason, language, languageCode, sourceType: String(source["Source Type"] || "unknown"), sourceUrl, sourceTitle: String(source.Title || ""), verbatim, authorIdentifier: String(source["Author Handle"] || source["Author Name"] || "").trim() || undefined, postedAt, postedAtRawValue, audience: audience.audience, designation: audience.designation, productCues, reactionCues, status, blockers, sourceEpisode, priority: hasSignal && !["excluded_content", "source_repair_required"].includes(status) ? "high" : status === "language_review_required" ? "standard" : "low", detectionSegment };
}
const cache = new Map<string, ReturnType<typeof buildTriage>>();
export function loadHeldGlp1Triage(concepts = GLP1_PV_CONCEPTS, options: TriageOptions = {}) {
  const corpus = loadGlp1PvCorpus();
  const fingerprint = createHash("sha256").update(JSON.stringify([GLP1_TRIAGE_VERSION, corpus.sourceFileHash, reference.rawSnapshotManifestSha256, reference.retrievedAt, TRIAGE_REACTION_ALIASES, TRIAGE_PRODUCT_ALIASES, TRIAGE_LANGUAGE_CODES, concepts, options])).digest("hex");
  const cached = cache.get(fingerprint);
  if (cached) return cached;
  const result = buildTriage(corpus, concepts, options, fingerprint);
  if (cache.size >= 4) cache.delete(cache.keys().next().value!);
  cache.set(fingerprint, result);
  return result;
}
function buildTriage(corpus: ReturnType<typeof loadGlp1PvCorpus>, concepts: PvDetectionConcept[], options: TriageOptions, fingerprint: string) {
  const raw = parseMeltwaterCsv("data/glp-1.csv");
  const rows = corpus.held.map(held => assessHeldGlp1Row(raw[held.rowNumber - 2], held.rowNumber, held.reason, concepts, options));
  // Identical published excerpts remain traceable but do not become separate
  // case candidates merely because several publishers carry the same story.
  const sourceExcerpts = new Map<string, HeldTriageRow>();
  for (const row of rows.filter(row => row.status === "eligible_source_candidate")) {
    const identity = /\b[A-Z][a-z]+\s+[A-Z][a-z]+,\s*\d{1,3}\b/.test(row.sourceEpisode!.patientCue) ? row.sourceEpisode!.patientCue : row.externalId;
    const key = `${identity}:` + row.sourceEpisode!.evidence.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
    const prior = sourceExcerpts.get(key);
    if (prior) { row.status = "related_source_excerpt"; row.relatedToRow = prior.rowNumber; (prior.relatedSourceRows ||= []).push(row.rowNumber); }
    else sourceExcerpts.set(key, row);
  }
  const statusCounts = Object.fromEntries(["eligible_english_candidate", "eligible_source_candidate", "related_source_excerpt", "language_review_required", "context_review_required", "source_repair_required", "excluded_content", "no_rule_signal", "library_approval_required"].map(status => [status, rows.filter(row => row.status === status).length]));
  return { assessmentHash: fingerprint, triageVersion: GLP1_TRIAGE_VERSION, sourceFileHash: corpus.sourceFileHash, ruleBasis: options.approved ? "approved_library" : "bundled_preview", libraryId: options.libraryId, libraryVersion: options.libraryVersion, faersRetrievedAt: reference.retrievedAt, vocabularySources: TRIAGE_VOCABULARY_SOURCES, sourceCount: corpus.rowCount, assessedHeldCount: rows.length, statusCounts, prioritizedCount: rows.filter(row => row.priority === "high").length, reactionCueCount: rows.filter(row => row.reactionCues.some(cue => !cue.referenceOnly)).length, rows };
}
export function heldTriageRowAsEnglishInput(row: HeldTriageRow): Glp1PvRow {
  if (row.languageCode !== "en" || row.status !== "eligible_english_candidate" || !row.postedAt) throw new Error("This row requires source/language/context review before inclusion.");
  return { rowNumber: row.rowNumber, externalId: row.externalId, sourceUrl: row.sourceUrl, sourceType: row.sourceType, sourceTitle: row.sourceTitle, verbatim: row.verbatim, language: "en", postedAt: row.postedAt, postedAtRawValue: row.postedAtRawValue, authorIdentifier: row.authorIdentifier };
}
