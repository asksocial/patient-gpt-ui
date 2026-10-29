/** Two distinct original mentions per theme; reuse across themes is allowed only
 * when the caller can supply a separate, directly supporting source passage. */
export function selectThemeEvidence<C, T extends { findingId: string; quote: string; url?: string }>(candidates: C[], toSupportedMention: (candidate: C) => T | undefined): T[] {
  const selected: T[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const item = toSupportedMention(candidate);
    if (!item) continue;
    const quote = item.quote.normalize("NFKC").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const keys = [`id:${item.findingId}`, `quote:${quote}`, ...(item.url ? [`url:${item.url}`] : [])];
    if (!quote || keys.some(key => seen.has(key))) continue;
    keys.forEach(key => seen.add(key)); selected.push(item);
    if (selected.length === 2) break;
  }
  return selected;
}
