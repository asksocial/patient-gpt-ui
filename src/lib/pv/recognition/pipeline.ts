import { assessIcsrIdentifiability } from "../identifiability";
import { evaluateIcsrCandidate } from "../icsrEvaluator";
import { extractPvAdverseEventOntology } from "../ontology";
import type { PvClassification, PvConceptMatch, PvContentInput, PvDetectionResult } from "../types";
import { getBotulinumPvRecognitionConfiguration } from "./config";
import type {
  BotulinumEvidenceSpan,
  BotulinumObservationStatus,
  BotulinumPvPipelineOutput,
  BotulinumPvRecognitionInput,
  BotulinumPvRelevance,
  BotulinumRecognizedEvent,
  BotulinumRecognizedProduct,
} from "./types";

const configuration = getBotulinumPvRecognitionConfiguration();
export const BOTULINUM_PV_RECOGNITION_VERSION = configuration.manifest.pipelineVersion;

type SpanSource = BotulinumEvidenceSpan["source"];

function normalizeForSearch(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[\u2018\u2019]/g, "'");
}

function isWordCharacter(value: string | undefined) {
  return Boolean(value && /[\p{L}\p{N}]/u.test(value));
}

function literalRanges(text: string, term: string) {
  const searchable = normalizeForSearch(text);
  const needle = normalizeForSearch(term);
  const ranges: Array<{ start: number; end: number }> = [];
  let start = searchable.indexOf(needle);
  while (start >= 0) {
    const end = start + needle.length;
    const leftValid = !isWordCharacter(needle[0]) || !isWordCharacter(searchable[start - 1]);
    const rightValid = !isWordCharacter(needle[needle.length - 1]) || !isWordCharacter(searchable[end]);
    if (leftValid && rightValid) ranges.push({ start, end });
    start = searchable.indexOf(needle, start + 1);
  }
  return ranges;
}

function span(
  text: string,
  range: { start: number; end: number },
  kind: BotulinumEvidenceSpan["kind"],
  normalizedConcept: string,
  spanConfidence: number,
  source: SpanSource,
): BotulinumEvidenceSpan {
  return {
    kind,
    start: range.start,
    end: range.end,
    text: text.slice(range.start, range.end),
    normalized_concept: normalizedConcept,
    confidence: Math.max(0, Math.min(1, spanConfidence)),
    source,
  };
}

function regexpSpans(
  text: string,
  pattern: RegExp,
  kind: BotulinumEvidenceSpan["kind"],
  normalizedConcept: string,
  spanConfidence: number,
  source: SpanSource,
) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  const spans: BotulinumEvidenceSpan[] = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    spans.push(span(text, { start: match.index, end: match.index + match[0].length }, kind, normalizedConcept, spanConfidence, source));
    if (!match[0].length) matcher.lastIndex += 1;
  }
  return spans;
}

function dedupeSpans(spans: BotulinumEvidenceSpan[]) {
  const unique = new Map<string, BotulinumEvidenceSpan>();
  for (const item of spans) {
    const key = `${item.kind}:${item.start}:${item.end}:${item.normalized_concept}`;
    const existing = unique.get(key);
    if (!existing || existing.confidence < item.confidence) unique.set(key, item);
  }
  return [...unique.values()].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
}

function validateInput(input: BotulinumPvRecognitionInput) {
  if (!input.original_mention.trim()) throw new Error("Original mention is required.");
  if (!input.source.trim() || !input.source_url.trim() || !input.source_id.trim()) throw new Error("Source, source URL, and source ID are required.");
  for (const [field, value] of [["original_timestamp", input.original_timestamp], ["collection_timestamp", input.collection_timestamp], ["algorithm_timestamp", input.algorithm_timestamp]] as const) {
    if (field !== "algorithm_timestamp" && !value) throw new Error(`${field} is required.`);
    if (value && Number.isNaN(new Date(value).getTime())) throw new Error(`${field} must be a valid timestamp.`);
  }
}

function recognizeProducts(text: string): BotulinumRecognizedProduct[] {
  const excludedRanges = ["natural botox", "hair botox", "botox in a bottle", "botox-like", "needle-free botox", "nature's botox"]
    .flatMap((term) => literalRanges(text, term));
  const candidates: Array<BotulinumRecognizedProduct & { longest: number }> = [];
  for (const family of configuration.products.families) {
    const ingredient = family.activeIngredients[0] || "";
    const names = [
      ...family.brands.map((value) => ({ value, matchType: "BRAND" as const, confidence: 0.99, source: "PRODUCT_REGISTRY" as const })),
      ...family.activeIngredients.map((value) => ({ value, matchType: "ACTIVE_INGREDIENT" as const, confidence: 0.99, source: "PRODUCT_REGISTRY" as const })),
      ...configuration.productAliases.aliases
        .filter((alias) => alias.familyId === family.familyId)
        .map((alias) => ({ value: alias.term, matchType: "ACTIVE_INGREDIENT" as const, confidence: 0.96, source: "PRODUCT_ALIAS_CONFIG" as const })),
    ];
    for (const name of names) {
      const ranges = literalRanges(text, name.value).filter((range) => !excludedRanges.some((excluded) => range.start >= excluded.start && range.end <= excluded.end));
      if (!ranges.length) continue;
      const evidence = ranges.map((range) => span(text, range, "product", name.value, name.confidence, name.source));
      candidates.push({ family_id: family.familyId, product: name.matchType === "BRAND" ? name.value : family.brands[0], active_ingredient: ingredient, match_type: name.matchType, confidence: name.confidence, evidence_spans: evidence, longest: name.value.length });
    }
  }
  for (const term of configuration.productAliases.classAliases) {
    const ranges = literalRanges(text, term);
    if (ranges.length) candidates.push({ family_id: "botulinum_toxin_class", product: "BOTULINUM TOXIN", active_ingredient: "", match_type: "CLASS", confidence: 0.85, evidence_spans: ranges.map((range) => span(text, range, "product", "BOTULINUM TOXIN", 0.85, "PRODUCT_REGISTRY")), longest: term.length });
  }
  const occupied: Array<{ start: number; end: number }> = [];
  const selected: BotulinumRecognizedProduct[] = [];
  for (const candidate of candidates.sort((a, b) => b.longest - a.longest || b.confidence - a.confidence)) {
    const retained = candidate.evidence_spans.filter((item) => !occupied.some((range) => item.start >= range.start && item.end <= range.end));
    if (!retained.length) continue;
    occupied.push(...retained.map((item) => ({ start: item.start, end: item.end })));
    const { longest: _longest, ...product } = candidate;
    selected.push({ ...product, evidence_spans: retained });
  }
  return selected.sort((a, b) => a.evidence_spans[0].start - b.evidence_spans[0].start);
}

const NEGATION = /\b(?:thankfully\s+no|no|not|never|without|didn't|did not|doesn't|does not|none)\b/gi;
const POST_EVENT_NEGATION = /\b(?:was|were)?\s*(?:not present|absent|did not occur|never occurred)\b/gi;
const HYPOTHETICAL = /\b(?:can|could|would|will|might|is it possible|does|has anyone|anyone else)\b[^?.!]{0,100}\b(?:cause|make|lead to|result in|give)\b|\bwhat if\b/gi;
const INFORMATIONAL = /\b(?:label|warning|warned|side effects? include|adverse reactions?(?: following| (?:were|include))?|may cause|can cause|can happen|possible side effect|risks? include|studies? (?:show|say)|important safety information|patient education|my (?:doctor|injector|provider) said)\b/gi;
const ANTICIPATED = /\b(?:scared|afraid|worried|fear|hope (?:i|it) (?:don't|doesn't)|will i|might i)\b/gi;
const HISTORICAL = /\b(?:years?|months?|weeks?)\s+before\b|\blong before\b|\bbefore i (?:ever )?(?:received|got|used|had)\b/gi;
const UNRELATED_OR_BENEFICIAL = /\b(?:appointment|consultation)\s+(?:is\s+)?next\s+(?:week|month|year)\b|\b(?:helps?|helped|works?|worked|treats?|treated|relieves?|relieved)\s+(?:my|her|his|their)\s+(?:headaches?|migraines?|pain|symptoms?)\b/gi;
const THIRD_PARTY = /\b(?:my|our)\s+(?:wife|husband|partner|mother|mom|father|dad|daughter|son|sister|brother|child|patient|client|friend)\b|\b(?:she|he|they|patient|client)\s+(?:developed|experienced|had|got|suffered|noticed|felt|was given|received)\b/gi;
const SPECIFIC_THIRD_PARTY = /\b(?:my|our)\s+(?:wife|husband|partner|mother|mom|father|dad|daughter|son|sister|brother|child|patient|client|friend)\b|\b(?:she|he|patient|client)\s+(?:developed|experienced|had|got|suffered|noticed|felt|was given|received)\b/gi;
const SECOND_HAND = /\b(?:someone (?:said|posted|told me)|i (?:heard|read|saw) (?:that|online)|according to|people say|reports? online)\b/gi;
const SELF_EXPERIENCE = /\b(?:i|i'm|i've|my|me)\b/gi;
const FIRST_HAND_OTHER = /\b(?:i|we)\s+(?:saw|observed|treated|cared for|administered|witnessed)\b|\b(?:and|because)\s+i\s+saw\s+it\s+happen\b/gi;
const MULTIPLE_PATIENTS = /\b(?:\d+|two|three|four|five|several|multiple|many|a few|some)\s+(?:patients?|clients?|people)\b/gi;
const AMBIGUOUS_PRONOUN = /\bthey\b/gi;
const PATIENT_CHARACTERISTIC = /\b(?:\d{1,3}[-\s](?:year|yr)s?[-\s]old|\d{1,3}\s*y\/?o|adult|adolescent|teenager|elderly|male|female|woman|man|boy|girl|pregnant|initials?\s+[A-Z](?:\.[A-Z])?\.?|patient\s+(?:id|number)\s*[:#-]?\s*[A-Z0-9_-]+)\b/gi;
const OBSERVED_ASSERTION = /\b(?:developed|experienced|started|got|had|suffered|noticed|felt|ended up with|left me with|gave me|made my|caused me|happened to me|went wrong)\b/gi;
const FRAGMENTED_OBSERVED = /\b(?:yesterday|today|tonight|this morning|this evening|now|still|ugh|help)\b|[😢😭😫😰😱🤕]/gu;
const VAGUE_HARM = /\b(?:ruined me|wrecked me|botched|went wrong|bad reaction|awful reaction|side effect|something happened)\b/gi;
const TEMPORAL_AFTER = /\b(?:immediately|minutes?|hours?|days?|weeks?|months?)?\s*(?:after|following)\b|\blater that (?:day|evening|night)\b/gi;
const TEMPORAL_SINCE = /\b(?:ever )?since\b/gi;
const ONSET_INTERVAL = /\b(?:within|about|around)?\s*\d+\s*(?:minutes?|hours?|days?|weeks?|months?)\s*(?:later|after)?\b/gi;
const CAUSAL_REPORTED = /\b(?:caused|made (?:me|my|her|his)|gave (?:me|her|him)|because of|due to|from the injections?|botox did this|dysport did this|xeomin did this)\b/gi;
const CAUSAL_POSSIBLE = /\b(?:not sure if|maybe|possibly|could be|might be|i think)\b[^.!?]{0,80}\b(?:related|from|due to|caused)\b|\b(?:possibly|maybe)\s+(?:related to|from)\b/gi;
const SERIOUSNESS = /\b(?:hospitali[sz]ed|hospitali[sz]ation|emergency room|emergency department|went to (?:the )?er|life[- ]threatening|permanent (?:injury|damage)|disab(?:led|ility)|birth defect|died|death|fatal)\b/gi;

function localNegated(text: string, eventSpan: BotulinumEvidenceSpan) {
  const localStart = Math.max(0, eventSpan.start - 55);
  const localEnd = Math.min(text.length, eventSpan.end + 30);
  const local = text.slice(localStart, localEnd);
  const preceding = regexpSpans(local, NEGATION, "negation", "negated event", 0.98, "CONTRAST_CONTEXT_RULE")
    .map((item) => ({ ...item, start: item.start + localStart, end: item.end + localStart, text: text.slice(item.start + localStart, item.end + localStart) }))
    .filter((item) => item.start < eventSpan.start && !/^not\s+(?:sure|certain)\b/i.test(text.slice(item.start, item.start + 18)));
  const following = regexpSpans(text.slice(eventSpan.end, localEnd), POST_EVENT_NEGATION, "negation", "negated event", 0.96, "CONTRAST_CONTEXT_RULE")
    .map((item) => ({ ...item, start: item.start + eventSpan.end, end: item.end + eventSpan.end, text: text.slice(item.start + eventSpan.end, item.end + eventSpan.end) }));
  return dedupeSpans([...preceding, ...following]);
}

function recognizeEvents(text: string, globalContext: { hypothetical: boolean; informational: boolean; anticipated: boolean; historical: boolean }) {
  const events: BotulinumRecognizedEvent[] = [];
  for (const event of configuration.lexicon.events) {
    const matches = event.terms.flatMap((term) => literalRanges(text, term).map((range) => ({ term, range })));
    if (!matches.length) continue;
    const longestByRange = new Map<string, { term: string; range: { start: number; end: number } }>();
    for (const match of matches.sort((a, b) => b.term.length - a.term.length)) {
      if (![...longestByRange.values()].some((other) => match.range.start >= other.range.start && match.range.end <= other.range.end)) longestByRange.set(`${match.range.start}:${match.range.end}`, match);
    }
    for (const match of longestByRange.values()) {
      const source: SpanSource = normalizeForSearch(match.term) === normalizeForSearch(event.meddraPt)
        ? "FAERS_TAXONOMY"
        : "SOCIAL_EXPRESSION_LIBRARY";
      const eventSpan = span(text, match.range, "event", event.normalizedConcept, event.seriousPotential ? 0.94 : 0.88, source);
      const negationSpans = localNegated(text, eventSpan);
      const nearby = text.slice(Math.max(0, eventSpan.start - configuration.manifest.contextWindowCharacters), Math.min(text.length, eventSpan.end + configuration.manifest.contextWindowCharacters));
      const directAssertion = OBSERVED_ASSERTION.test(nearby);
      const experienceSubject = SELF_EXPERIENCE.test(nearby) || THIRD_PARTY.test(nearby);
      const temporalAssertion = TEMPORAL_AFTER.test(nearby) || TEMPORAL_SINCE.test(nearby);
      const fragmentedAssertion = FRAGMENTED_OBSERVED.test(nearby);
      const asserted = directAssertion || temporalAssertion || fragmentedAssertion;
      const personalObserved = experienceSubject && directAssertion;
      OBSERVED_ASSERTION.lastIndex = SELF_EXPERIENCE.lastIndex = THIRD_PARTY.lastIndex = TEMPORAL_AFTER.lastIndex = TEMPORAL_SINCE.lastIndex = FRAGMENTED_OBSERVED.lastIndex = 0;
      let observationStatus: BotulinumObservationStatus = asserted ? "OBSERVED" : "POSSIBLE_OBSERVED";
      if (negationSpans.length) observationStatus = "NEGATED";
      else if (globalContext.historical) observationStatus = "HISTORICAL_UNRELATED";
      else if (globalContext.hypothetical) observationStatus = "HYPOTHETICAL";
      else if (globalContext.anticipated) observationStatus = "ANTICIPATED";
      else if (globalContext.informational && !personalObserved) observationStatus = "INFORMATIONAL";
      events.push({
        raw_expression: eventSpan.text,
        normalized_event: event.normalizedConcept,
        meddra_pt_candidate: event.meddraPt,
        taxonomy_concept_id: event.conceptId,
        confidence: observationStatus === "OBSERVED" ? eventSpan.confidence : Math.max(0.55, eventSpan.confidence - 0.18),
        serious_potential: event.seriousPotential,
        observation_status: observationStatus,
        human_validation_required: true,
        evidence_spans: [eventSpan, ...negationSpans],
      });
    }
  }
  return events.sort((a, b) => a.evidence_spans[0].start - b.evidence_spans[0].start);
}

const SPECIAL_PATTERNS: Array<{ type: string; pattern: RegExp; confidence: number }> = [
  { type: "OVERDOSE", pattern: /\b(?:overdose|overdosed|too much|more .{0,25} than intended|excessive dose)\b/gi, confidence: 0.95 },
  { type: "EXTRA_DOSE", pattern: /\b(?:extra dose|additional dose|double dose)\b/gi, confidence: 0.95 },
  { type: "WRONG_PRODUCT", pattern: /\b(?:wrong product|wrong vial|used .{0,25} instead of)\b/gi, confidence: 0.95 },
  { type: "MISUSE", pattern: /\b(?:diy botox|self[- ]inject|botox at home|home botox|black market|unlicensed injector|misuse)\b/gi, confidence: 0.9 },
  { type: "OFF_LABEL_USE", pattern: /\b(?:off[- ]label|outside (?:the|its) approved indication|unapproved indication)\b/gi, confidence: 0.88 },
  { type: "ACCIDENTAL_EXPOSURE", pattern: /\b(?:accidentally exposed|accidental exposure)\b/gi, confidence: 0.92 },
  { type: "OCCUPATIONAL_EXPOSURE", pattern: /\b(?:occupational exposure|exposed .{0,35} while working|work(?:ing)? at the clinic)\b/gi, confidence: 0.9 },
  { type: "PREGNANCY_EXPOSURE", pattern: /\b(?:pregnan\w*|embryo transfer|trying to conceive)\b/gi, confidence: 0.9 },
  { type: "BREASTFEEDING_EXPOSURE", pattern: /\b(?:breast ?feeding|nursing my baby)\b/gi, confidence: 0.9 },
  { type: "LACK_OF_EFFICACY", pattern: /\b(?:didn't work|did not work|no effect|wore off (?:early|immediately)|stopped working|resistant to|immune to)\b/gi, confidence: 0.9 },
  { type: "PRODUCT_QUALITY_CONCERN", pattern: /\b(?:counterfeit|fake botox|contaminated vial|damaged vial|broken vial|seal (?:was |looked )?broken|product quality)\b/gi, confidence: 0.92 },
];

function specialSituations(text: string, productPresent: boolean) {
  if (!productPresent) return [];
  return SPECIAL_PATTERNS.flatMap((definition) => {
    const evidence = regexpSpans(text, definition.pattern, "special_situation", definition.type, definition.confidence, "SPECIAL_SITUATION_LIBRARY");
    return evidence.length ? [{ type: definition.type, confidence: definition.confidence, evidence_spans: evidence, human_review_required: true as const }] : [];
  });
}

function levelFor(score: number): BotulinumPvRelevance {
  if (score >= configuration.manifest.thresholds.high) return "HIGH";
  if (score >= configuration.manifest.thresholds.medium) return "MEDIUM";
  if (score >= configuration.manifest.thresholds.low) return "LOW";
  return "NONE";
}

function classificationsFor(output: BotulinumPvPipelineOutput): PvClassification[] {
  const values: PvClassification[] = [];
  if (output.observed_event_detection.events.some((event) => ["OBSERVED", "POSSIBLE_OBSERVED"].includes(event.observation_status))) values.push("adverse_event");
  const mapping: Record<string, PvClassification> = {
    OVERDOSE: "overdose", EXTRA_DOSE: "medication_error", WRONG_PRODUCT: "medication_error", MISUSE: "misuse_abuse",
    PREGNANCY_EXPOSURE: "pregnancy", BREASTFEEDING_EXPOSURE: "pregnancy", LACK_OF_EFFICACY: "lack_of_efficacy",
    PRODUCT_QUALITY_CONCERN: "product_quality_complaint", OFF_LABEL_USE: "other", ACCIDENTAL_EXPOSURE: "other", OCCUPATIONAL_EXPOSURE: "other",
  };
  for (const situation of output.special_situations) values.push(mapping[situation.type] || "other");
  return [...new Set(values)];
}

export function recognizeBotulinumToxinPvMention(input: BotulinumPvRecognitionInput): BotulinumPvPipelineOutput {
  validateInput(input);
  const text = input.original_mention;
  const algorithmTimestamp = input.algorithm_timestamp || new Date().toISOString();
  const products = recognizeProducts(text);
  const hypotheticalSpans = regexpSpans(text, HYPOTHETICAL, "hypothetical", "hypothetical causal question", 0.96, "CONTRAST_CONTEXT_RULE");
  const informationalSpans = regexpSpans(text, INFORMATIONAL, "hypothetical", "informational or provider-warning context", 0.9, "CONTRAST_CONTEXT_RULE");
  const anticipatedSpans = regexpSpans(text, ANTICIPATED, "hypothetical", "anticipated or feared event", 0.92, "CONTRAST_CONTEXT_RULE");
  const historicalSpans = dedupeSpans([
    ...regexpSpans(text, HISTORICAL, "temporal", "event predates product", 0.96, "CONTRAST_CONTEXT_RULE"),
    ...regexpSpans(text, UNRELATED_OR_BENEFICIAL, "temporal", "future product use or beneficial indication context", 0.92, "CONTRAST_CONTEXT_RULE"),
  ]);
  const thirdPartySpans = regexpSpans(text, THIRD_PARTY, "third_party", "third-party patient", 0.86, "CONTRAST_CONTEXT_RULE");
  const specificThirdPartySpans = regexpSpans(text, SPECIFIC_THIRD_PARTY, "third_party", "specific third-party patient", 0.9, "CONTRAST_CONTEXT_RULE");
  const secondHandSpans = regexpSpans(text, SECOND_HAND, "third_party", "second-hand report", 0.94, "CONTRAST_CONTEXT_RULE");
  const globalContext = { hypothetical: hypotheticalSpans.length > 0, informational: informationalSpans.length > 0, anticipated: anticipatedSpans.length > 0, historical: historicalSpans.length > 0 };
  const events = recognizeEvents(text, globalContext);
  const temporalAfter = regexpSpans(text, TEMPORAL_AFTER, "temporal", "after product", 0.9, "CONTRAST_CONTEXT_RULE");
  const temporalSince = regexpSpans(text, TEMPORAL_SINCE, "temporal", "since product", 0.9, "CONTRAST_CONTEXT_RULE");
  const onsetIntervals = regexpSpans(text, ONSET_INTERVAL, "temporal", "onset interval", 0.82, "CONTRAST_CONTEXT_RULE");
  const causalReported = regexpSpans(text, CAUSAL_REPORTED, "causality", "reported attribution", 0.9, "CONTRAST_CONTEXT_RULE");
  const causalPossible = regexpSpans(text, CAUSAL_POSSIBLE, "causality", "possible attribution", 0.82, "CONTRAST_CONTEXT_RULE");
  const seriousnessSpans = regexpSpans(text, SERIOUSNESS, "seriousness", "potential seriousness criterion", 0.94, "CONTRAST_CONTEXT_RULE");
  const negationSpans = dedupeSpans(events.flatMap((event) => event.evidence_spans.filter((item) => item.kind === "negation")));
  const patientCharacteristicSpans = regexpSpans(text, PATIENT_CHARACTERISTIC, "patient", "ICH qualifying patient characteristic", 0.92, "ICH_IDENTIFIABILITY_RULE");
  const selfSpans = regexpSpans(text, SELF_EXPERIENCE, "reporter", "self report", 0.78, "ICH_IDENTIFIABILITY_RULE");
  const firstHandOtherSpans = regexpSpans(text, FIRST_HAND_OTHER, "reporter", "first-hand report about another patient", 0.88, "ICH_IDENTIFIABILITY_RULE");
  const multiplePatientSpans = regexpSpans(text, MULTIPLE_PATIENTS, "patient", "multiple patients", 0.95, "ICH_IDENTIFIABILITY_RULE");
  const ambiguousPronounSpans = regexpSpans(text, AMBIGUOUS_PRONOUN, "patient", "ambiguous pronoun", 0.55, "ICH_IDENTIFIABILITY_RULE");
  const identifiability = assessIcsrIdentifiability({ original_verbatim: text, author_identifier: input.author_identifier });
  const reporterSpans = dedupeSpans([...selfSpans, ...firstHandOtherSpans, ...thirdPartySpans, ...secondHandSpans]);
  const patientSpans = dedupeSpans([...patientCharacteristicSpans, ...selfSpans.map((item) => ({ ...item, kind: "patient" as const, normalized_concept: "self-reported patient" })), ...thirdPartySpans, ...multiplePatientSpans, ...ambiguousPronounSpans]);
  const situations = specialSituations(text, products.length > 0);
  const observedEvents = events.filter((event) => event.observation_status === "OBSERVED");
  const possibleEvents = events.filter((event) => event.observation_status === "POSSIBLE_OBSERVED");
  const nonObservedContext = events.length > 0 && events.every((event) => ["NEGATED", "HYPOTHETICAL", "INFORMATIONAL", "ANTICIPATED", "HISTORICAL_UNRELATED"].includes(event.observation_status));
  const seriousSafetyPriority = events.some((event) => event.serious_potential && ["OBSERVED", "POSSIBLE_OBSERVED"].includes(event.observation_status))
    || Boolean(seriousnessSpans.length && (observedEvents.length || possibleEvents.length || situations.length));
  const vagueHarmSpans = regexpSpans(text, VAGUE_HARM, "event", "unspecified adverse experience", 0.42, "CONTRAST_CONTEXT_RULE");

  let score = 0;
  if (products.length) score += 0.2;
  if (observedEvents.length) score += 0.35;
  else if (possibleEvents.length) score += 0.25;
  else if (vagueHarmSpans.length) score += 0.15;
  if (identifiability.relationship === "self_report" || identifiability.relationship === "first_hand_other") score += 0.15;
  if (temporalAfter.length || temporalSince.length || onsetIntervals.length) score += 0.1;
  if (causalReported.length) score += 0.1;
  else if (causalPossible.length) score += 0.05;
  if (patientCharacteristicSpans.length) score += 0.05;
  if (input.author_identifier?.trim()) score += 0.03;
  if (seriousSafetyPriority) score += 0.07;
  if (situations.length) score = Math.max(score, 0.55);
  if (!products.length) score = 0;
  if (nonObservedContext && !situations.length) score = 0;
  score = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  let relevance = levelFor(score);
  if (seriousSafetyPriority && relevance === "LOW") relevance = "MEDIUM";
  if (nonObservedContext && !situations.length) relevance = "NONE";

  const rationale = [
    products.length ? `${products.length} target product occurrence(s) matched the versioned product registry.` : "No target botulinum toxin product was recognized.",
    observedEvents.length ? `${observedEvents.length} event expression(s) were supported by observed-experience context.`
      : possibleEvents.length ? `${possibleEvents.length} event expression(s) were retained as ambiguous or possible observed experiences.`
        : events.length ? "Event terminology was detected only in non-observed context." : vagueHarmSpans.length ? "Nonspecific harm language was retained without inventing an event term." : "No supported event expression was detected.",
    nonObservedContext ? "Negated, hypothetical, informational, anticipated, or temporally unrelated context prevents observed-event classification." : "No definitive non-case context overrode the observed-event assessment.",
    seriousSafetyPriority ? "Potentially serious safety language receives at least medium-priority human review to reduce false negatives." : "No serious-event priority override was applied.",
    situations.length ? `${situations.length} governed special situation(s) require separate PV assessment.` : "No configured special situation was detected.",
    "The classifier identifies potential PV relevance only; it does not determine final regulatory reportability or medical causality.",
  ];

  const relevant = relevance !== "NONE";
  const primaryProduct = products[0];
  const primaryEvent = [...observedEvents, ...possibleEvents][0];
  const observationContext = situations.length ? "SPECIAL_SITUATION" as const : observedEvents.length ? "OBSERVED" as const : "POSSIBLE_OBSERVED" as const;
  const icsr = relevant ? evaluateIcsrCandidate({
    mention: text,
    pv_relevance_detected: true,
    observation_context: observationContext,
    special_situation: situations[0]?.type || null,
    source: {
      username: input.author_identifier || null,
      source_platform: input.source,
      source_url: input.source_url,
      post_id: input.source_id,
      original_post_timestamp: input.original_timestamp,
      collection_timestamp: input.collection_timestamp,
      algorithm_timestamp: algorithmTimestamp,
      human_review_timestamp: null,
      escalation_timestamp: null,
    },
    drug_candidates: products.map((product) => ({ product: product.product, active_ingredient: product.active_ingredient, evidence: product.evidence_spans[0].text, confidence: product.confidence, suspect: true })),
    event_candidates: [...observedEvents, ...possibleEvents].map((event) => ({ raw_expression: event.raw_expression, normalized_event: event.normalized_event, meddra_pt_candidate: event.meddra_pt_candidate, evidence: event.evidence_spans[0].text, confidence: event.confidence, suspected: true })),
  }) : { evaluated: false as const, icsr_status: "NOT_EVALUATED_NO_PV_RELEVANCE" as const, missing_elements: ["P", "R", "D", "E"] as ["P", "R", "D", "E"], pv_review_required: false as const };

  const route = relevant
    ? situations.length ? "SPECIAL_SITUATION_REVIEW" as const
      : "review_route" in icsr && icsr.review_route === "POTENTIAL_ICSR_REVIEW" ? "POTENTIAL_ICSR_REVIEW" as const
        : relevance === "LOW" ? "PV_TRIAGE_REVIEW" as const : "POTENTIAL_ICSR_MISSING_ELEMENT" as const
    : "NO_ESCALATION_RETAIN_AUDIT" as const;
  const priority = relevant ? seriousSafetyPriority ? "critical" as const : relevance === "HIGH" ? "high" as const : "standard" as const : "audit_only" as const;
  const contextSpans = dedupeSpans([...negationSpans, ...hypotheticalSpans, ...informationalSpans, ...anticipatedSpans, ...historicalSpans, ...thirdPartySpans, ...secondHandSpans]);
  const allEvidence = dedupeSpans([
    ...products.flatMap((product) => product.evidence_spans),
    ...patientSpans,
    ...reporterSpans,
    ...events.flatMap((event) => event.evidence_spans),
    ...temporalAfter, ...temporalSince, ...onsetIntervals,
    ...causalReported, ...causalPossible,
    ...seriousnessSpans,
    ...situations.flatMap((situation) => situation.evidence_spans),
    ...vagueHarmSpans,
  ]);

  return {
    original_mention: text,
    source: { name: input.source, url: input.source_url, id: input.source_id, author_identifier: input.author_identifier || null, original_timestamp: input.original_timestamp, collection_timestamp: input.collection_timestamp, algorithm_timestamp: algorithmTimestamp },
    versions: {
      classifier_version: configuration.manifest.pipelineVersion,
      taxonomy_version: configuration.manifest.taxonomyVersion,
      expression_library_version: configuration.manifest.expressionLibraryVersion,
      product_registry_version: configuration.manifest.productRegistryVersion,
      product_alias_version: configuration.manifest.productAliasVersion,
      contrast_templates_version: configuration.manifest.contrastTemplatesVersion,
      special_situations_version: configuration.manifest.specialSituationsVersion,
    },
    product_recognition: products,
    patient_reporter_evidence: {
      patient_present: identifiability.patient.criterionStatus === "yes" || (identifiability.relationship === "self_report" && products.length > 0),
      reporter_present: identifiability.reporter.status !== "not_established" || Boolean(input.author_identifier && ["self_report", "first_hand_other"].includes(identifiability.relationship)),
      relationship: identifiability.relationship,
      multiple_patients: multiplePatientSpans.length > 0,
      ambiguous_pronouns: ambiguousPronounSpans.length > 0 && !specificThirdPartySpans.length,
      patient_evidence_spans: patientSpans,
      reporter_evidence_spans: reporterSpans,
      assessment: identifiability,
    },
    observed_event_detection: { observed: observedEvents.length > 0, possible_observed: possibleEvents.length > 0 || vagueHarmSpans.length > 0, events },
    event_normalization: events.map((event) => ({ raw_expression: event.raw_expression, normalized_concept: event.normalized_event, confidence: event.confidence })),
    meddra_candidate_mapping: events.map((event) => ({ normalized_concept: event.normalized_event, meddra_pt_candidate: event.meddra_pt_candidate, taxonomy_concept_id: event.taxonomy_concept_id, confidence: event.confidence, human_validation_required: true })),
    temporal_relationships: [
      ...temporalAfter.map((evidence_span) => ({ type: "AFTER_PRODUCT" as const, confidence: evidence_span.confidence, evidence_span })),
      ...temporalSince.map((evidence_span) => ({ type: "SINCE_PRODUCT" as const, confidence: evidence_span.confidence, evidence_span })),
      ...historicalSpans.map((evidence_span) => ({ type: "BEFORE_PRODUCT" as const, confidence: evidence_span.confidence, evidence_span })),
      ...onsetIntervals.map((evidence_span) => ({ type: "ONSET_INTERVAL" as const, confidence: evidence_span.confidence, evidence_span })),
    ],
    causality_language: [
      ...causalReported.map((evidence_span) => ({ type: "REPORTED_ATTRIBUTION" as const, confidence: evidence_span.confidence, evidence_span })),
      ...causalPossible.map((evidence_span) => ({ type: "POSSIBLE_ATTRIBUTION" as const, confidence: evidence_span.confidence, evidence_span })),
      ...temporalAfter.filter(() => !causalReported.length && !causalPossible.length).map((evidence_span) => ({ type: "TEMPORAL_ONLY" as const, confidence: 0.75, evidence_span })),
      ...negationSpans.map((evidence_span) => ({ type: "DENIED" as const, confidence: evidence_span.confidence, evidence_span })),
    ],
    negation_detection: {
      detected: negationSpans.length > 0,
      applies_to_event: events.some((event) => event.observation_status === "NEGATED"),
      confidence: Math.max(0, ...negationSpans.map((item) => item.confidence)),
      evidence_spans: negationSpans,
    },
    hypothetical_detection: {
      detected: globalContext.hypothetical,
      informational: globalContext.informational,
      anticipated_or_feared: globalContext.anticipated,
      historical_or_unrelated: globalContext.historical,
      confidence: Math.max(0, ...hypotheticalSpans.map((item) => item.confidence), ...informationalSpans.map((item) => item.confidence), ...anticipatedSpans.map((item) => item.confidence), ...historicalSpans.map((item) => item.confidence)),
      evidence_spans: dedupeSpans([...hypotheticalSpans, ...informationalSpans, ...anticipatedSpans, ...historicalSpans]),
    },
    third_party_detection: {
      detected: thirdPartySpans.length > 0 || secondHandSpans.length > 0,
      relationship: secondHandSpans.length ? "second_hand" : ambiguousPronounSpans.length && !specificThirdPartySpans.length ? "ambiguous_pronoun" : thirdPartySpans.length ? "first_hand_other" : "none",
      confidence: Math.max(0, ...thirdPartySpans.map((item) => item.confidence), ...secondHandSpans.map((item) => item.confidence)),
      evidence_spans: dedupeSpans([...thirdPartySpans, ...secondHandSpans, ...ambiguousPronounSpans]),
    },
    context: {
      negated: events.some((event) => event.observation_status === "NEGATED"),
      hypothetical: globalContext.hypothetical,
      informational: globalContext.informational,
      anticipated_or_feared: globalContext.anticipated,
      historical_or_unrelated: globalContext.historical,
      third_party: thirdPartySpans.length > 0 || secondHandSpans.length > 0,
      evidence_spans: contextSpans,
    },
    special_situations: situations,
    pv_relevance: { level: relevance, score, confidence: score, serious_safety_priority: seriousSafetyPriority, rationale },
    icsr_element_assessment: icsr,
    human_review_routing: {
      status: relevant ? "PV review required" : "NO_ESCALATION_RETAIN_AUDIT",
      route,
      priority,
      final_regulatory_determination_made: false,
      statement: relevant ? "PV review required" : "No observed potential case was identified; retain the classification and evidence for audit.",
    },
    confidence: score,
    evidence_spans: allEvidence,
    normalized_concepts: [...new Set([...products.map((product) => product.product), ...events.map((event) => event.normalized_event), ...situations.map((situation) => situation.type)])],
    human_review_status: relevant ? "PV review required" : "NO_ESCALATION_RETAIN_AUDIT",
  };
}

export function botulinumRecognitionToLegacyDetection(
  input: PvContentInput,
  output: BotulinumPvPipelineOutput,
  detectionLibraryVersion = 1,
): PvDetectionResult {
  const matches: PvConceptMatch[] = [
    ...output.product_recognition.map((product) => ({ conceptId: product.family_id, category: "product" as const, canonicalTerm: product.product, matchedTerm: product.evidence_spans[0].text, weight: Math.round(product.confidence * 100) })),
    ...output.observed_event_detection.events.map((event) => ({ conceptId: event.taxonomy_concept_id, category: "adverse_experience" as const, canonicalTerm: event.normalized_event, matchedTerm: event.raw_expression, weight: Math.round(event.confidence * 100) })),
  ];
  const classifications = classificationsFor(output);
  const healthTags = [...new Set(output.special_situations.map((situation) => {
    if (["EXTRA_DOSE", "WRONG_PRODUCT"].includes(situation.type)) return "medication_error";
    if (situation.type === "OVERDOSE") return "overdose";
    if (situation.type === "MISUSE") return "misuse_abuse";
    if (["PREGNANCY_EXPOSURE", "BREASTFEEDING_EXPOSURE"].includes(situation.type)) return "pregnancy_exposure";
    if (situation.type === "LACK_OF_EFFICACY") return "lack_of_efficacy";
    if (situation.type === "PRODUCT_QUALITY_CONCERN") return "product_quality_complaint";
    return "other_observation";
  }))] as PvDetectionResult["healthExperienceTags"];
  const detectedEvents = output.observed_event_detection.events.filter((event) => ["OBSERVED", "POSSIBLE_OBSERVED"].includes(event.observation_status));
  const detectionSegment: PvDetectionResult["detectionSegment"] = detectedEvents.length ? "ae_adr" : "health_experience";
  const baseOntology = extractPvAdverseEventOntology(input, matches);
  const ontologyExtraction = {
    ...baseOntology,
    productProcedures: output.product_recognition.map((product) => ({ value: product.product, evidence: product.evidence_spans[0].text, confidence: product.confidence })),
    adverseEvents: detectedEvents.map((event) => ({ value: event.raw_expression, evidence: event.evidence_spans[0].text, confidence: event.confidence, meddraSuggestion: event.meddra_pt_candidate, meddraValidated: false })),
    recognitionPipeline: output,
  };
  const score = Math.round(output.pv_relevance.score * 100);
  return {
    shouldCreateRecord: output.human_review_routing.status === "PV review required",
    detectionSegment,
    healthExperienceTags: healthTags,
    score,
    productConfidence: Math.round(Math.max(0, ...output.product_recognition.map((product) => product.confidence)) * 100),
    healthExperienceConfidence: Math.round(Math.max(0, ...detectedEvents.map((event) => event.confidence), ...output.special_situations.map((situation) => situation.confidence)) * 100),
    contextConfidence: output.pv_relevance.serious_safety_priority ? 100 : Math.round(output.pv_relevance.confidence * 100),
    classifications,
    matches,
    exclusions: [],
    rationale: output.pv_relevance.rationale,
    classifierVersion: output.versions.classifier_version,
    detectionLibraryVersion,
    ontologyExtraction: ontologyExtraction as typeof baseOntology,
  };
}
