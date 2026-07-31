import type { ThemeMatch } from "../../answering/themes/themeModels";

export type CitationTraceability =
  | "source_linked"
  | "source_identified"
  | "context_only";

export type CitationVerification =
  | "traceable"
  | "metadata_only"
  | "not_independently_verified";

export type CitationManifestEntry = {
  citationId: string;
  findingId?: string;
  themeId?: string;
  themeLabel?: string;
  quote: string;
  claim?: string;
  sourceLabel: string;
  sourceUrl?: string;
  sourceHost?: string;
  platform?: string;
  country?: string;
  persona?: string;
  evidenceClass?: string;
  evidenceQualityScore?: number;
  traceability: CitationTraceability;
  verification: CitationVerification;
  verificationNote: string;
};

function normalizeUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function compact(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function buildCitationManifest(
  themes: ThemeMatch[] = [],
  curatedInsights: any[] = []
): CitationManifestEntry[] {
  const citations: CitationManifestEntry[] = [];
  const seen = new Set<string>();

  for (const theme of themes) {
    const evidence = theme.clientFacingEvidence?.length
      ? theme.clientFacingEvidence
      : theme.representativeEvidence || [];
    for (const item of evidence) {
      const quote = compact(item.quote || item.claim);
      if (!quote) continue;
      const dedupeKey = item.findingId || `${theme.themeId}:${quote.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const url = normalizeUrl(item.url);
      const sourceLabel = compact(item.platform || item.sourceType || item.sourceCategory) || "Source metadata unavailable";
      const traceability: CitationTraceability = url
        ? "source_linked"
        : item.platform || item.sourceType || item.findingId
          ? "source_identified"
          : "context_only";

      citations.push({
        citationId: `finding:${item.findingId || citations.length + 1}`,
        findingId: item.findingId || undefined,
        themeId: theme.themeId,
        themeLabel: theme.label,
        quote,
        claim: compact(item.claim) || undefined,
        sourceLabel,
        sourceUrl: url?.toString(),
        sourceHost: url?.hostname,
        platform: item.platform,
        country: item.country,
        persona: item.persona,
        evidenceClass: item.evidenceClass,
        evidenceQualityScore: item.evidenceQualityScore,
        traceability,
        verification: url && item.findingId ? "traceable" : "metadata_only",
        verificationNote: url && item.findingId
          ? "Traceable to the supplied source URL and internal finding record; authenticity has not been independently verified."
          : "Identified from supplied source metadata; no validated direct source URL is available.",
      });
    }
  }

  for (const insight of curatedInsights) {
    const quote = compact(insight?.evidence_excerpt || insight?.summary);
    if (!quote) continue;
    const id = compact(insight?.id) || `curated-${citations.length + 1}`;
    const dedupeKey = `curated:${id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const url = normalizeUrl(insight?.source_url || insight?.url);
    citations.push({
      citationId: `curated:${id}`,
      findingId: id,
      themeLabel: compact(insight?.title) || "Curated intelligence",
      quote,
      sourceLabel: compact(insight?.source_document || insight?.platform || insight?.source_type) || "Curated source",
      sourceUrl: url?.toString(),
      sourceHost: url?.hostname,
      platform: compact(insight?.platform) || undefined,
      country: compact(insight?.country) || undefined,
      persona: compact(insight?.persona) || undefined,
      traceability: url ? "source_linked" : "context_only",
      verification: url ? "traceable" : "not_independently_verified",
      verificationNote: url
        ? "Traceable to the supplied curated source URL; authenticity has not been independently verified."
        : "Grounded in an imported curated artifact; a direct source URL was not supplied.",
    });
  }

  return citations;
}
