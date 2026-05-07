import { CanonicalFinding } from "../models/finding";

function normalizeText(text?: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function mergeEvidence(
  a: CanonicalFinding["evidence"],
  b: CanonicalFinding["evidence"]
): CanonicalFinding["evidence"] {
  const seen = new Set<string>();

  return [...a, ...b].filter((item) => {
    const key = [
      item.sourceType,
      item.sourceId,
      item.documentId || "",
      item.sectionId || "",
      normalizeText(item.excerpt || ""),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function exactDedupe(findings: CanonicalFinding[]): CanonicalFinding[] {
  const seen = new Map<string, CanonicalFinding>();

  for (const finding of findings) {
    const key = [
      normalizeText(finding.canonicalClaim),
      normalizeText(finding.evidence?.[0]?.excerpt || ""),
      [...(finding.countries || [])].sort().join(","),
      [...(finding.normalizedLabels || [])].sort().join(","),
    ].join("|");

    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, { ...finding });
      continue;
    }

    existing.evidence = mergeEvidence(existing.evidence || [], finding.evidence || []);
    existing.countries = uniqueStrings([...(existing.countries || []), ...(finding.countries || [])]);
    existing.personas = uniqueStrings([...(existing.personas || []), ...(finding.personas || [])]);
    existing.platforms = uniqueStrings([...(existing.platforms || []), ...(finding.platforms || [])]);
    existing.symptoms = uniqueStrings([...(existing.symptoms || []), ...(finding.symptoms || [])]);
    existing.treatments = uniqueStrings([...(existing.treatments || []), ...(finding.treatments || [])]);
    existing.lifecycleStages = uniqueStrings([
      ...(existing.lifecycleStages || []),
      ...(finding.lifecycleStages || []),
    ]);
    existing.intentLabels = uniqueStrings([...(existing.intentLabels || []), ...(finding.intentLabels || [])]);
    existing.normalizedLabels = uniqueStrings([
      ...(existing.normalizedLabels || []),
      ...(finding.normalizedLabels || []),
    ]);

    existing.evidenceStrength = Math.max(existing.evidenceStrength || 0, finding.evidenceStrength || 0);
    existing.confidence = Math.max(existing.confidence || 0, finding.confidence || 0);
    existing.relevanceScore = Math.max(existing.relevanceScore || 0, finding.relevanceScore || 0);
  }

  return Array.from(seen.values());
}