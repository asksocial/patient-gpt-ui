import { CanonicalFinding } from "../models/finding";
import { getSourceAwareScore } from "../scoring/sourceAwareScoring";

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function mergeEvidence(
  a: CanonicalFinding["evidence"],
  b: CanonicalFinding["evidence"]
): CanonicalFinding["evidence"] {
  const seen = new Set<string>();
  const merged = [...a, ...b].filter((item) => {
    const key = [
      item.sourceType,
      item.sourceId,
      item.documentId || "",
      item.sectionId || "",
      (item.excerpt || "").trim().toLowerCase(),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged;
}

function scoreFinding(f: CanonicalFinding, questionIntent: string): number {
  return getSourceAwareScore(f, questionIntent);
}

function mergeClusterIntoWinner(
  winner: CanonicalFinding,
  group: CanonicalFinding[]
): CanonicalFinding {
  const others = group.filter((f) => f.findingId !== winner.findingId);

  if (others.length === 0) {
    return winner;
  }

  return {
    ...winner,
    countries: uniqueStrings([
      ...winner.countries,
      ...others.flatMap((f) => f.countries || []),
    ]),
    personas: uniqueStrings([
      ...winner.personas,
      ...others.flatMap((f) => f.personas || []),
    ]),
    platforms: uniqueStrings([
      ...winner.platforms,
      ...others.flatMap((f) => f.platforms || []),
    ]),
    symptoms: uniqueStrings([
      ...winner.symptoms,
      ...others.flatMap((f) => f.symptoms || []),
    ]),
    treatments: uniqueStrings([
      ...winner.treatments,
      ...others.flatMap((f) => f.treatments || []),
    ]),
    lifecycleStages: uniqueStrings([
      ...winner.lifecycleStages,
      ...others.flatMap((f) => f.lifecycleStages || []),
    ]),
    intentLabels: uniqueStrings([
      ...winner.intentLabels,
      ...others.flatMap((f) => f.intentLabels || []),
    ]),
    normalizedLabels: uniqueStrings([
      ...winner.normalizedLabels,
      ...others.flatMap((f) => f.normalizedLabels || []),
    ]),
    evidence: others.reduce(
      (acc, finding) => mergeEvidence(acc, finding.evidence || []),
      winner.evidence || []
    ),
    evidenceStrength: Math.max(
      winner.evidenceStrength,
      ...others.map((f) => f.evidenceStrength || 0)
    ),
    confidence: Math.max(
      winner.confidence,
      ...others.map((f) => f.confidence || 0)
    ),
  };
}

export function selectRepresentatives(
  findings: CanonicalFinding[],
  questionIntent: string
): CanonicalFinding[] {
  const byCluster = new Map<string, CanonicalFinding[]>();

  for (const finding of findings) {
    const key = finding.clusterId || finding.findingId;
    const group = byCluster.get(key) || [];
    group.push(finding);
    byCluster.set(key, group);
  }

  const representatives: CanonicalFinding[] = [];

  for (const [, group] of byCluster) {
    const ranked = [...group].sort(
      (a, b) => scoreFinding(b, questionIntent) - scoreFinding(a, questionIntent)
    );

    const winner = ranked[0];
    const mergedWinner = mergeClusterIntoWinner(winner, ranked);

    for (let i = 1; i < ranked.length; i++) {
      ranked[i].duplicateOf = winner.findingId;
    }

    representatives.push(mergedWinner);
  }

  return representatives.sort(
    (a, b) => scoreFinding(b, questionIntent) - scoreFinding(a, questionIntent)
  );
}