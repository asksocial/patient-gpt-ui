import type { CanonicalFinding } from "../../answering/models/finding";

export type SearchSourceMention = {
  id: string;
  title: string;
  excerpt: string;
  sourceLabel: string;
  sourceType: "curated" | "social";
  url?: string;
  platform?: string;
  persona?: string;
  country?: string;
};

type SearchSourceTheme = {
  name: string;
  description: string;
  sourceType?: string;
  relationship?: string;
};

export type SearchSourceIntelligence = {
  curatedMentions: SearchSourceMention[];
  socialMentions: SearchSourceMention[];
  curatedThemes: SearchSourceTheme[];
  socialThemes: SearchSourceTheme[];
};

type FindingLike = CanonicalFinding & {
  id?: string;
  title?: string;
  description?: string;
  excerpt?: string;
  evidenceQuotes?: string[];
  labels?: string[];
  sourceType?: "curated" | "live";
  sourceDocument?: string;
  sourceSlideOrPage?: string;
  sourceId?: string;
  url?: string;
  country?: string;
  platform?: string;
  persona?: string;
  score?: number;
};

function compact(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function first(values: unknown): string {
  if (Array.isArray(values)) return compact(values[0]);
  return compact(values);
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceType(finding: FindingLike): "curated" | "social" {
  const value =
    finding.sourceType ||
    finding.evidence?.[0]?.sourceType ||
    "curated";
  return value === "live" ? "social" : "curated";
}

function sourceLabel(finding: FindingLike, kind: "curated" | "social") {
  const document = compact(finding.sourceDocument);
  const section = compact(finding.sourceSlideOrPage);
  if (document) return section ? `${document} · ${section}` : document;

  const evidence = finding.evidence?.[0];
  return (
    compact(evidence?.sectionTitle) ||
    compact(evidence?.documentId) ||
    compact(evidence?.sourceId) ||
    compact(finding.sourceId) ||
    (kind === "social" ? "Social intelligence corpus" : "Curated intelligence corpus")
  );
}

function toMention(finding: FindingLike): SearchSourceMention | null {
  const kind = sourceType(finding);
  const title =
    compact(finding.title) ||
    compact(finding.canonicalClaim) ||
    compact(finding.summary);
  const excerpt =
    first(finding.evidenceQuotes) ||
    compact(finding.evidence?.[0]?.excerpt) ||
    compact(finding.excerpt) ||
    compact(finding.summary) ||
    compact(finding.description);
  if (!title || !excerpt) return null;

  const evidence = finding.evidence?.[0];
  return {
    id: compact(finding.findingId || finding.id) || `${kind}:${title}`,
    title,
    excerpt,
    sourceLabel: sourceLabel(finding, kind),
    sourceType: kind,
    url: compact(evidence?.url || finding.url) || undefined,
    platform:
      compact(evidence?.platform) || first(finding.platforms) || compact(finding.platform) || undefined,
    persona:
      compact(evidence?.persona) || first(finding.personas) || compact(finding.persona) || undefined,
    country:
      compact(evidence?.country) || first(finding.countries) || compact(finding.country) || undefined,
  };
}

function representativeMentions(findings: FindingLike[], kind: "curated" | "social") {
  const seen = new Set<string>();
  return findings
    .filter((finding) => sourceType(finding) === kind)
    .sort(
      (left, right) =>
        Number(right.relevanceScore || right.score || right.confidence || 0) -
        Number(left.relevanceScore || left.score || left.confidence || 0)
    )
    .map(toMention)
    .filter((mention): mention is SearchSourceMention => Boolean(mention))
    .filter((mention) => {
      const key = `${mention.title.toLowerCase()}|${mention.excerpt.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function representativeThemes(
  findings: FindingLike[],
  kind: "curated" | "social"
): SearchSourceTheme[] {
  const groups = new Map<string, FindingLike[]>();
  findings
    .filter((finding) => sourceType(finding) === kind)
    .forEach((finding) => {
      const labels = finding.labels || finding.normalizedLabels || [];
      const label =
        labels.find((item) => compact(item) && compact(item) !== "other") ||
        compact(finding.findingType) ||
        "conversation signal";
      const key = compact(label).toLowerCase();
      groups.set(key, [...(groups.get(key) || []), finding]);
    });

  return Array.from(groups.entries())
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 6)
    .map(([label, items]) => ({
      name: humanize(label),
      description:
        compact(items[0]?.summary) ||
        compact(items[0]?.description) ||
        compact(items[0]?.canonicalClaim),
      ...(kind === "social"
        ? { sourceType: "analytical_corpus", relationship: "live" }
        : {}),
    }));
}

export function buildSourceIntelligence(
  findings: CanonicalFinding[] = []
): SearchSourceIntelligence {
  const sourceFindings = findings as FindingLike[];
  return {
    curatedMentions: representativeMentions(sourceFindings, "curated"),
    socialMentions: representativeMentions(sourceFindings, "social"),
    curatedThemes: representativeThemes(sourceFindings, "curated"),
    socialThemes: representativeThemes(sourceFindings, "social"),
  };
}
