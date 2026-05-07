import { CanonicalFinding } from "../models/finding";
import { AnswerTemplateRule } from "../templates/templateRegistry";
import { getSourceAwareScore } from "../scoring/sourceAwareScoring";

export interface PlannedSections {
  directAnswer: CanonicalFinding[];
  topBurdens?: CanonicalFinding[];
  topDrivers?: CanonicalFinding[];
  barriers?: CanonicalFinding[];
  topSafetySignals?: CanonicalFinding[];
  marketVariation: CanonicalFinding[];
  platforms?: CanonicalFinding[];
  evidence: CanonicalFinding[];
  supportingFindings?: CanonicalFinding[];
  liveDataCheck: CanonicalFinding[];
}

interface PlanOptions {
  maxDirectAnswerFindings?: number;
  maxThemeFindings?: number;
  maxMarketVariationFindings?: number;
  maxEvidenceFindings?: number;
  maxPlatformFindings?: number;
  maxSupportingFindings?: number;
}

const DEFAULTS: Required<PlanOptions> = {
  maxDirectAnswerFindings: 3,
  maxThemeFindings: 5,
  maxMarketVariationFindings: 3,
  maxEvidenceFindings: 3,
  maxPlatformFindings: 3,
  maxSupportingFindings: 5,
};

function normalizeText(text?: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClaim(claim?: string): string {
  return normalizeText(claim);
}

function uniqueByClaim(findings: CanonicalFinding[]): CanonicalFinding[] {
  const seen = new Set<string>();
  const output: CanonicalFinding[] = [];

  for (const finding of findings) {
    const claim = normalizeClaim(finding.canonicalClaim);
    if (!claim || seen.has(claim)) continue;
    seen.add(claim);
    output.push(finding);
  }

  return output;
}

function uniqueByCountry(findings: CanonicalFinding[]): CanonicalFinding[] {
  const seenCountries = new Set<string>();
  const output: CanonicalFinding[] = [];

  for (const finding of findings) {
    const country = normalizeText(finding.countries?.[0]);
    if (!country) continue;
    if (seenCountries.has(country)) continue;
    seenCountries.add(country);
    output.push(finding);
  }

  return output;
}

function buildEvidenceKey(finding: CanonicalFinding): string {
  const firstEvidence = finding.evidence?.[0];
  if (!firstEvidence) {
    return `finding:${finding.findingId}`;
  }

  return [
    firstEvidence.sourceType,
    firstEvidence.sourceId,
    firstEvidence.documentId || "",
    firstEvidence.sectionId || "",
    normalizeText(firstEvidence.excerpt || ""),
  ].join("|");
}

function uniqueByEvidence(findings: CanonicalFinding[]): CanonicalFinding[] {
  const seen = new Set<string>();
  const output: CanonicalFinding[] = [];

  for (const finding of findings) {
    const key = buildEvidenceKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }

  return output;
}

function scoreForPlanning(finding: CanonicalFinding, questionIntent: string): number {
  return getSourceAwareScore(finding, questionIntent);
}

function sortByScore(findings: CanonicalFinding[], questionIntent: string): CanonicalFinding[] {
  return [...findings].sort(
    (a, b) => scoreForPlanning(b, questionIntent) - scoreForPlanning(a, questionIntent)
  );
}

function isDirectAnswerCandidate(finding: CanonicalFinding, questionIntent: string): boolean {
  if (!finding.intentLabels.includes(questionIntent)) return false;

  if (questionIntent === "symptom_qol_burden") {
    return (
      finding.findingType === "symptom_burden" ||
      finding.findingType === "quality_of_life" ||
      (finding.findingType === "persona_pattern" && finding.symptoms.length > 0)
    );
  }

  if (questionIntent === "treatment_decision_drivers") {
    return (
      finding.findingType === "treatment_concern" ||
      finding.findingType === "treatment_journey" ||
      finding.findingType === "perceived_benefit" ||
      finding.findingType === "persona_pattern"
    );
  }

  if (questionIntent === "diagnosis_barriers") {
    return (
      finding.findingType === "diagnosis_barrier" ||
      finding.findingType === "persona_pattern"
    );
  }

  if (questionIntent === "safety_signals") {
    return finding.findingType === "safety_signal";
  }

  if (questionIntent === "market_landscape") {
    return (
      finding.findingType === "country_pattern" ||
      finding.findingType === "persona_pattern"
    );
  }

  return true;
}

function isTopBurdenCandidate(finding: CanonicalFinding, questionIntent: string): boolean {
  return (
    questionIntent === "symptom_qol_burden" &&
    (finding.findingType === "symptom_burden" || finding.findingType === "quality_of_life")
  );
}

function isTopDriverCandidate(finding: CanonicalFinding, questionIntent: string): boolean {
  return (
    questionIntent === "treatment_decision_drivers" &&
    (
      finding.findingType === "treatment_concern" ||
      finding.findingType === "treatment_journey" ||
      finding.findingType === "perceived_benefit"
    )
  );
}

function isBarrierCandidate(finding: CanonicalFinding, questionIntent: string): boolean {
  return (
    questionIntent === "diagnosis_barriers" &&
    finding.findingType === "diagnosis_barrier"
  );
}

function isSafetyCandidate(finding: CanonicalFinding, questionIntent: string): boolean {
  return (
    questionIntent === "safety_signals" &&
    finding.findingType === "safety_signal"
  );
}

function isMarketVariationCandidate(finding: CanonicalFinding, questionIntent: string): boolean {
  const hasCountry = finding.countries.length > 0;
  const hasPersona = finding.personas.length > 0;

  if (!hasCountry && !hasPersona) return false;

  if (questionIntent === "symptom_qol_burden") {
    return (
      finding.intentLabels.includes(questionIntent) &&
      (
        finding.findingType === "country_pattern" ||
        finding.findingType === "persona_pattern" ||
        finding.findingType === "symptom_burden" ||
        finding.findingType === "quality_of_life" ||
        finding.symptoms.length > 0
      )
    );
  }

  if (questionIntent === "treatment_decision_drivers") {
    return (
      finding.intentLabels.includes(questionIntent) &&
      (
        finding.findingType === "country_pattern" ||
        finding.findingType === "persona_pattern" ||
        finding.findingType === "treatment_concern" ||
        finding.findingType === "treatment_journey" ||
        finding.findingType === "perceived_benefit" ||
        finding.treatments.length > 0
      )
    );
  }

  if (questionIntent === "diagnosis_barriers") {
    return (
      finding.intentLabels.includes(questionIntent) &&
      (
        finding.findingType === "country_pattern" ||
        finding.findingType === "persona_pattern" ||
        finding.findingType === "diagnosis_barrier"
      )
    );
  }

  if (questionIntent === "safety_signals") {
    return (
      finding.intentLabels.includes(questionIntent) &&
      (
        finding.findingType === "country_pattern" ||
        finding.findingType === "persona_pattern" ||
        finding.findingType === "safety_signal"
      )
    );
  }

  if (questionIntent === "market_landscape") {
    return (
      finding.findingType === "country_pattern" ||
      finding.findingType === "persona_pattern" ||
      finding.findingType === "platform_preference"
    );
  }

  return finding.findingType === "country_pattern" || finding.findingType === "persona_pattern";
}

function isPlatformCandidate(finding: CanonicalFinding, questionIntent: string): boolean {
  return (
    questionIntent === "market_landscape" &&
    finding.findingType === "platform_preference"
  );
}

function isSupportingFindingCandidate(finding: CanonicalFinding): boolean {
  return !finding.duplicateOf;
}

function hasLiveEvidence(finding: CanonicalFinding): boolean {
  return (finding.evidence || []).some((e) => e.sourceType === "live");
}

function takeTop(
  findings: CanonicalFinding[],
  maxItems: number,
  predicate?: (finding: CanonicalFinding) => boolean
): CanonicalFinding[] {
  const filtered = predicate ? findings.filter(predicate) : findings;
  return uniqueByClaim(filtered).slice(0, maxItems);
}

export function planSections(
  findings: CanonicalFinding[],
  template: AnswerTemplateRule,
  questionIntent: string,
  options: PlanOptions = {}
): PlannedSections {
  const config = { ...DEFAULTS, ...options };

  const filtered = findings
    .filter((f) => !f.duplicateOf)
    .filter((f) => template.allowedFindingTypes.includes(f.findingType))
    .filter((f) => !(template.disallowedFindingTypes || []).includes(f.findingType));

  const ranked = sortByScore(filtered, questionIntent);

  const directAnswer = takeTop(
    ranked,
    config.maxDirectAnswerFindings,
    (f) => isDirectAnswerCandidate(f, questionIntent)
  );

  const topBurdens = template.requiredSections.includes("top_burdens")
    ? takeTop(
        ranked,
        config.maxThemeFindings,
        (f) => isTopBurdenCandidate(f, questionIntent)
      )
    : undefined;

  const topDrivers = template.requiredSections.includes("top_drivers")
    ? takeTop(
        ranked,
        config.maxThemeFindings,
        (f) => isTopDriverCandidate(f, questionIntent)
      )
    : undefined;

  const barriers = template.requiredSections.includes("barriers")
    ? takeTop(
        ranked,
        config.maxThemeFindings,
        (f) => isBarrierCandidate(f, questionIntent)
      )
    : undefined;

  const topSafetySignals = template.requiredSections.includes("top_safety_signals")
    ? takeTop(
        ranked,
        config.maxThemeFindings,
        (f) => isSafetyCandidate(f, questionIntent)
      )
    : undefined;

  const marketVariation = template.requiredSections.includes("market_variation")
    ? uniqueByCountry(
        takeTop(
          ranked,
          config.maxMarketVariationFindings * 4,
          (f) => isMarketVariationCandidate(f, questionIntent)
        ).filter((f) => f.countries.length > 0)
      ).slice(0, config.maxMarketVariationFindings)
    : [];

  const platforms = template.requiredSections.includes("platforms")
    ? takeTop(
        ranked,
        config.maxPlatformFindings,
        (f) => isPlatformCandidate(f, questionIntent)
      )
    : undefined;

  const evidence = template.requiredSections.includes("evidence")
    ? uniqueByEvidence(ranked).slice(0, config.maxEvidenceFindings)
    : [];

  const supportingFindings = template.requiredSections.includes("supporting_findings")
    ? takeTop(
        ranked,
        config.maxSupportingFindings,
        (f) => isSupportingFindingCandidate(f)
      )
    : undefined;

  const liveDataCheck = template.requiredSections.includes("live_data_check")
    ? ranked.filter((f) => hasLiveEvidence(f)).slice(0, 3)
    : [];

  return {
    directAnswer,
    topBurdens,
    topDrivers,
    barriers,
    topSafetySignals,
    marketVariation,
    platforms,
    evidence,
    supportingFindings,
    liveDataCheck,
  };
}