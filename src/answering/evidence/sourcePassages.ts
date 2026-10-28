import type { CanonicalFinding, EvidenceRef } from "../models/finding";

export type SourcePassage = { text: string; url?: string; evidence?: EvidenceRef };
export type SupportingPassage = SourcePassage & { excerpt: string; matchedTerms: string[] };
const compact = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();
const safeUrl = (value: unknown) => /^https?:\/\//i.test(compact(value)) ? compact(value) : undefined;

/** Original source fields and evidence excerpts only; generated claims are never quotes. */
export function sourcePassages(finding: CanonicalFinding): SourcePassage[] {
  const fields = finding.rawMetadata?.fields || {};
  const normalized = finding.rawMetadata?.normalizedFields || {};
  const rawUrl = safeUrl(fields.URL || normalized.url);
  const evidence = finding.evidence || [];
  const sourceEvidence = evidence.length === 1 ? evidence[0] : undefined;
  const passages: SourcePassage[] = [];
  for (const value of [fields["Opening Text"], fields["Hit Sentence"], normalized.full_text, normalized.document_text, normalized.article_body, normalized.body, normalized.content, normalized.opening_text, normalized.hit_sentence, normalized.fulltext, normalized.text]) {
    const text = compact(value);
    const sameSource = evidence.find(item => compact(item.excerpt) && text.includes(compact(item.excerpt))) || sourceEvidence;
    if (text) passages.push({ text, url: rawUrl || safeUrl(sameSource?.url), evidence: sameSource });
  }
  for (const item of evidence) {
    const text = compact(item.excerpt);
    if (text) passages.push({ text, url: safeUrl(item.url), evidence: item });
  }
  const raw = finding as CanonicalFinding & { text?: string; excerpt?: string; description?: string; url?: string };
  if (!passages.length) {
    for (const value of [raw.text, raw.excerpt, raw.description]) {
      const text = compact(value);
      if (text) passages.push({ text, url: safeUrl(raw.url) });
    }
  }
  // A source title can supply context, but never borrow a different source's URL.
  const title = compact(fields.Title || normalized.title || normalized.headline);
  const comment = /comment/i.test(String(fields["Content Type"] || "")) || /^comment on\b/i.test(String(fields["Author Name"] || ""));
  if (title && !comment) passages.push({ text: title, url: rawUrl || safeUrl(sourceEvidence?.url), evidence: sourceEvidence });
  return passages.filter((item, index) => passages.findIndex(other => other.text === item.text && other.url === item.url) === index);
}

/** Select a readable original passage around an actual topic match, retaining its own URL. */
export function supportingPassage(
  passages: SourcePassage[],
  pattern: RegExp,
  options: { context?: RegExp; maximumLength?: number; minimumLength?: number; accept?: (text: string, match: string, index: number) => boolean } = {}
): SupportingPassage | undefined {
  const maximumLength = options.maximumLength || 480;
  for (const passage of passages) {
    const text = passage.text;
    const hits = [...text.matchAll(new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "") + "g"))];
    const contexts = options.context ? [...text.matchAll(new RegExp(options.context.source, options.context.flags.replace(/[gy]/g, "") + "g"))] : [];
    for (const hit of hits) {
      const footer = text.search(/(?:위고비\/마운자로\/삭센다 카페는|카페는 위고비 효과|추천검색|\b(?:posting guidelines|tags to include|keywords to include)\b)/i);
      if (footer >= 0 && hit.index >= footer) continue;
      const templateStart = text.search(/💙 제목에/);
      if (templateStart >= 0 && hit.index >= templateStart) {
        const templateEnd = text.indexOf("---", templateStart);
        if (templateEnd < 0 || hit.index < templateEnd) continue;
      }
      if (!hit[0] || options.accept && !options.accept(text, hit[0], hit.index)) continue;
      const context = contexts.length ? contexts.reduce((best, candidate) => Math.abs(candidate.index - hit.index) < Math.abs(best.index - hit.index) ? candidate : best) : undefined;
      if (options.context && (!context || Math.abs(context.index - hit.index) > 180)) continue;
      const first = Math.min(hit.index, context?.index ?? hit.index);
      const last = Math.max(hit.index + hit[0].length, context ? context.index + context[0].length : 0);
      if (last - first > maximumLength) continue;
      let start = Math.max(0, first - Math.min(100, Math.floor((maximumLength - (last - first)) / 2)));
      if (start > 0) { const space = text.lastIndexOf(" ", start); if (space >= start - 25) start = space + 1; }
      let end = Math.min(text.length, start + maximumLength);
      if (end < text.length) { const space = text.lastIndexOf(" ", end); if (space > last) end = space; }
      const excerpt = (start ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
      const matchedTerms = [...new Set(hits.filter(candidate => candidate.index >= start && candidate.index + candidate[0].length <= end && (!options.accept || options.accept(text, candidate[0], candidate.index))).map(candidate => candidate[0]).filter(Boolean))];
      if (excerpt.length >= (options.minimumLength ?? 35) && matchedTerms.length) return { ...passage, excerpt, matchedTerms };
    }
  }
  return undefined;
}

/** Avoid generic non-treatment supply/access and rhetorical political 'side effects'. */
export function acceptsTopicMatch(topicId: string, text: string, match: string, index: number): boolean {
  const around = text.slice(Math.max(0, index - 70), index + match.length + 90);
  if (topicId.endsWith(":availability") || topicId === "availability") {
    if (/\b(?:food|soybean|oil|energy|water|electricity|power|blood|money|protein|spike|oxygen)\s+(?:\w+\s+){0,2}supply\b/i.test(around)) return false;
    if (/^supply$/i.test(match) && !/\b(?:drug|medicines?|medications?|prescriptions?|pharmac\w*|doses?|injections?|treatment|months?|weeks?|days?)\b.{0,40}\bsupply\b|\bsupply\b.{0,40}\b(?:drug|medicines?|medications?|prescriptions?|pharmac\w*|doses?|injections?|treatment|shortage|chain)\b/i.test(around)) return false;
    if (/^access$/i.test(match) && /\baccess\s+(?:to\s+)?(?:(?:this|the|our|an?|affordable|quality|online)\s+)*(?:article|website|webpage|video|internet|data|report|account|portal|housing|education|jobs?|employment|food|water|electricity)\b/i.test(around)) return false;
  }
  if (topicId.endsWith(":prices") || topicId === "prices") {
    if (/\b(?:maybe|perhaps|probably|i doubt|i assume)\b/i.test(around) && /\b(?:he|she|they|guy|someone)\b/i.test(around) && !/\b(?:my insurance|my prescription|i paid|i pay|i cannot afford|i can.t afford)\b/i.test(text)) return false;
    if (/\b(?:requirement|mandatory|require|make)\b.{0,55}\bfood stamps\b/i.test(text)) return false;
    if (/\$(?:LLY|NVO)\b|stock prices?|share prices?|price targets?|investseekers|earnings|shareholders?/i.test(text) && !/\b(?:copay|out.of.pocket|insurance|prescription cost|i paid|i pay|can.t afford|cannot afford)\b/i.test(text)) return false;
  }
  if (topicId.endsWith(":general_safety") || topicId === "general_safety") {
    if (/\b(?:TDS|trump derangement|jelly roll|political satire|satirical|parody)\b/i.test(text)) return false;
    const substantive = /nausea|vomit|constipat|diarrh|fatigue|headache|pancreatitis|gastroparesis|hair loss|vision|blindness|pain|death|died|hospital|dehydrat|cancer|suicid|adverse (?:event|reaction)|clinical trial|clinical study|patient.{0,35}(?:report|experienc)|\b(?:my|i|we)\b.{0,80}(?:side effects?|adverse|safety|tolerability|worried|concern)|\?.{0,25}$|副作用|부작용|不良反应|不良反應|efeitos? colaterais|efectos secundarios/i;
    if (!substantive.test(around)) return false;
    if (/\b(?:snack ideas|smart snack|recipes?|meal plans?|buy now|shop now|discount code|promo code)\b/i.test(around) && !/\b(?:i|my|patient)\b.{0,55}\b(?:experienced|developed|suffered|had|caused|nausea|vomit|diarrh|constipat)/i.test(text)) return false;
  }
  return true;
}
