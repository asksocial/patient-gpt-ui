import { CanonicalFinding } from "../models/finding";

const CLUSTER_SIMILARITY_THRESHOLD = 0.78;

const WEIGHTS = {
  claim: 0.5,
  labels: 0.2,
  symptoms: 0.15,
  personas: 0.1,
  countries: 0.05,
};

function normalizeText(text?: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArray(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((v) => normalizeText(v))
        .filter(Boolean)
    )
  );
}

function tokenize(text?: string): string[] {
  return normalizeText(text).split(" ").filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const na = normalizeArray(a);
  const nb = normalizeArray(b);

  const sa = new Set(na);
  const sb = new Set(nb);

  if (sa.size === 0 && sb.size === 0) return 0;

  const intersection = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;

  return union === 0 ? 0 : intersection / union;
}

function claimSimilarity(a?: string, b?: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);

  if (ta.length === 0 && tb.length === 0) return 0;

  return jaccard(ta, tb);
}

function pairSimilarity(a: CanonicalFinding, b: CanonicalFinding): number {
  return (
    WEIGHTS.claim * claimSimilarity(a.canonicalClaim, b.canonicalClaim) +
    WEIGHTS.labels * jaccard(a.normalizedLabels || [], b.normalizedLabels || []) +
    WEIGHTS.symptoms * jaccard(a.symptoms || [], b.symptoms || []) +
    WEIGHTS.personas * jaccard(a.personas || [], b.personas || []) +
    WEIGHTS.countries * jaccard(a.countries || [], b.countries || [])
  );
}

export function clusterFindings(findings: CanonicalFinding[]): CanonicalFinding[] {
  const clustered = findings.map((finding) => ({
    ...finding,
    normalizedLabels: normalizeArray(finding.normalizedLabels || []),
    symptoms: normalizeArray(finding.symptoms || []),
    personas: normalizeArray(finding.personas || []),
    countries: normalizeArray(finding.countries || []),
    canonicalClaim: normalizeText(finding.canonicalClaim),
  }));

  let clusterCounter = 1;

  for (let i = 0; i < clustered.length; i++) {
    const a = clustered[i];
    if (a.clusterId) continue;

    a.clusterId = `cluster_${clusterCounter++}`;

    for (let j = i + 1; j < clustered.length; j++) {
      const b = clustered[j];
      if (b.clusterId) continue;

      const sim = pairSimilarity(a, b);

      if (sim >= CLUSTER_SIMILARITY_THRESHOLD) {
        b.clusterId = a.clusterId;
      }
    }
  }

  return clustered;
}