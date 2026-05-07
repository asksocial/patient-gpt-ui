import { CanonicalFinding } from "../models/finding";

function overlapScore(a: CanonicalFinding, b: CanonicalFinding): number {
  const sameClaim = a.canonicalClaim.toLowerCase() === b.canonicalClaim.toLowerCase() ? 1 : 0;
  const sameCluster = a.clusterId && b.clusterId && a.clusterId === b.clusterId ? 1 : 0;
  const labelOverlap = intersectRatio(a.normalizedLabels, b.normalizedLabels);
  const symptomOverlap = intersectRatio(a.symptoms, b.symptoms);

  return 0.4 * sameClaim + 0.3 * sameCluster + 0.2 * labelOverlap + 0.1 * symptomOverlap;
}

function intersectRatio(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const shared = [...sa].filter(x => sb.has(x)).length;
  const denom = Math.max(sa.size, sb.size, 1);
  return shared / denom;
}

export function passesNovelty(candidate: CanonicalFinding, selected: CanonicalFinding[]): boolean {
  return !selected.some(s => overlapScore(candidate, s) > 0.7);
}