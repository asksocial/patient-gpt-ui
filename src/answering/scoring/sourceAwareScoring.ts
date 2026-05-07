import { CanonicalFinding } from "../models/finding";

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function getSourceMix(finding: CanonicalFinding): {
  curatedEvidenceCount: number;
  liveEvidenceCount: number;
  totalEvidenceCount: number;
  hasCurated: boolean;
  hasLive: boolean;
  primarySource: "curated" | "live" | "unknown";
} {
  const evidence = finding.evidence || [];

  const curatedEvidenceCount = evidence.filter(
    (e) => e.sourceType === "curated"
  ).length;

  const liveEvidenceCount = evidence.filter(
    (e) => e.sourceType === "live"
  ).length;

  const totalEvidenceCount = evidence.length;

  const hasCurated = curatedEvidenceCount > 0;
  const hasLive = liveEvidenceCount > 0;

  let primarySource: "curated" | "live" | "unknown" = "unknown";

  if (curatedEvidenceCount > liveEvidenceCount) {
    primarySource = "curated";
  } else if (liveEvidenceCount > curatedEvidenceCount) {
    primarySource = "live";
  } else if (hasCurated && !hasLive) {
    primarySource = "curated";
  } else if (hasLive && !hasCurated) {
    primarySource = "live";
  }

  return {
    curatedEvidenceCount,
    liveEvidenceCount,
    totalEvidenceCount,
    hasCurated,
    hasLive,
    primarySource,
  };
}

export function getSourceAwareScore(
  finding: CanonicalFinding,
  questionIntent: string
): number {
  const {
    curatedEvidenceCount,
    liveEvidenceCount,
    totalEvidenceCount,
    hasCurated,
    hasLive,
    primarySource,
  } = getSourceMix(finding);

  const intentMatch = finding.intentLabels?.includes(questionIntent) ? 1 : 0;
  const evidenceCount = Math.min(totalEvidenceCount, 5) / 5;
  const symptomSpecificity = (finding.symptoms || []).length > 0 ? 1 : 0;
  const treatmentSpecificity = (finding.treatments || []).length > 0 ? 1 : 0;
  const countrySpecificity = (finding.countries || []).length > 0 ? 1 : 0;
  const personaSpecificity = (finding.personas || []).length > 0 ? 1 : 0;

  const curatedRatio =
    totalEvidenceCount > 0 ? curatedEvidenceCount / totalEvidenceCount : 0;
  const liveRatio =
    totalEvidenceCount > 0 ? liveEvidenceCount / totalEvidenceCount : 0;

  // Curated gets a modest precision/trust lift.
  const curatedBoost =
    hasCurated ? 0.08 + curatedRatio * 0.07 : 0;

  // Live gets a modest freshness/coverage lift.
  const liveBoost =
    hasLive ? 0.05 + liveRatio * 0.05 : 0;

  // Mixed-source findings are especially valuable because they bridge
  // curated intelligence and live conversation.
  const mixedSourceBoost =
    hasCurated && hasLive ? 0.06 : 0;

  // Small preference to curated for diagnosis/safety-like trust-heavy use cases
  // and to live for burden/market-like socially expressed use cases.
  let intentSourceBias = 0;

  if (
    questionIntent === "diagnosis_barriers" ||
    questionIntent === "safety_signals"
  ) {
    intentSourceBias =
      primarySource === "curated" ? 0.04 : primarySource === "live" ? -0.01 : 0;
  } else if (
    questionIntent === "symptom_qol_burden" ||
    questionIntent === "market_landscape"
  ) {
    intentSourceBias =
      primarySource === "live" ? 0.03 : primarySource === "curated" ? 0.01 : 0;
  } else if (questionIntent === "treatment_decision_drivers") {
    intentSourceBias =
      hasCurated && hasLive
        ? 0.04
        : primarySource === "curated"
        ? 0.02
        : primarySource === "live"
        ? 0.02
        : 0;
  }

  const score =
    (finding.relevanceScore || 0) * 0.22 +
    (finding.evidenceStrength || 0) * 0.22 +
    (finding.confidence || 0) * 0.16 +
    intentMatch * 0.14 +
    symptomSpecificity * 0.06 +
    treatmentSpecificity * 0.06 +
    countrySpecificity * 0.04 +
    personaSpecificity * 0.03 +
    evidenceCount * 0.03 +
    curatedBoost +
    liveBoost +
    mixedSourceBoost +
    intentSourceBias;

  return clamp(score, 0, 2);
}