import type { CanonicalFinding, EvidenceRef } from "../../answering/models/finding";
import { analyzeEvidence } from "../../answering/evidence/analyzeEvidence";
import { buildMedicalAestheticsEvidenceLabels } from "../evaluation/medicalAestheticsEvidenceLabels";

export type PatientSignal = {
  id: string;
  label: string;
  count: number;
  prevalencePercent: number;
  confidence: "high" | "moderate" | "directional";
  evidenceIds: string[];
};

export type PatientIntelligenceResult = {
  schemaVersion: "patient_intelligence_v1";
  therapeuticArea: string;
  generatedAt: string;
  headline: string;
  executiveSummary: string;
  dataQuality: {
    corpusFindingCount: number;
    patientVoiceFindingCount: number;
    caregiverVoiceFindingCount: number;
    patientVoiceCoveragePercent: number;
    assessment: "adequate" | "limited" | "insufficient";
    limitations: string[];
  };
  journeyStages: PatientSignal[];
  treatmentBarriers: PatientSignal[];
  emotionalBurden: PatientSignal[];
  treatmentSignals: PatientSignal[];
  unmetNeeds: PatientSignal[];
  recommendations: string[];
  evidence: Array<{
    id: string;
    findingId: string;
    quote: string;
    sourceLabel: string;
    url?: string;
    platform?: string;
    country?: string;
    voice: string;
    qualityScore: number;
  }>;
};

const JOURNEY_PATTERNS = [
  ["awareness", "Awareness", /heard about|learned about|what is|new treatment|trend/i],
  ["consideration", "Considering treatment", /thinking about|considering|should i|has anyone|worth it|want to try/i],
  ["provider_selection", "Provider selection", /provider|injector|doctor|dermatologist|clinic|consultation/i],
  ["treatment", "Treatment experience", /i got|i had|procedure|injected|treated|after my/i],
  ["recovery", "Recovery and follow-up", /recovery|downtime|swelling|bruising|follow.?up|healing/i],
  ["maintenance", "Maintenance or switching", /maintenance|wears off|lasted|switch|dissolv|stopped|again/i],
] as const;

const BARRIER_PATTERNS = [
  ["trust_safety", "Trust and safety", /safe|risk|fake|counterfeit|complication|botched|migration|legal|approved/i],
  ["expectations", "Outcome uncertainty", /natural|overdone|regret|result|work|effective|worth it|pillow face/i],
  ["reversibility", "Duration and reversibility", /permanent|revers|dissolv|wears off|duration|lasted/i],
  ["cost_access", "Cost and access", /cost|price|expensive|afford|access|available/i],
  ["provider_choice", "Provider selection", /provider|injector|doctor|clinic|qualified|credential/i],
  ["recovery_burden", "Pain, downtime, and recovery", /pain|downtime|swelling|bruising|recovery|healing/i],
] as const;

const EMOTION_PATTERNS = [
  ["fear", "Fear or anxiety", /fear|afraid|anxious|anxiety|worried|scared/i],
  ["confusion", "Confusion or uncertainty", /confus|unsure|don't know|question|should i/i],
  ["regret", "Regret or disappointment", /regret|disappoint|wish i|mistake|hate/i],
  ["hope", "Hope or optimism", /hope|excited|confidence|happy|love|improv/i],
  ["skepticism", "Skepticism", /skeptic|trust|fake|scam|hype|proven/i],
] as const;

const UNMET_NEED_PATTERNS = [
  ["plain_language_safety", "Clear safety and authenticity guidance", /safe|risk|fake|counterfeit|approved|legal/i],
  ["expectation_setting", "Realistic outcome and duration expectations", /result|natural|overdone|duration|lasted|regret/i],
  ["provider_guidance", "Trusted provider-selection guidance", /provider|injector|doctor|clinic|qualified/i],
  ["recovery_support", "Recovery and complication support", /recovery|swelling|bruising|pain|complication|healing/i],
  ["comparison_support", "Treatment comparison and reversibility support", /versus|compare|switch|revers|dissolv|alternative/i],
] as const;

function findingText(finding: CanonicalFinding) {
  const raw = finding as any;
  return [
    finding.canonicalClaim,
    finding.summary,
    raw.title,
    raw.description,
    raw.text,
    raw.excerpt,
    ...(finding.evidence || []).map((item) => item.excerpt),
    ...(finding.normalizedLabels || []),
  ].filter(Boolean).join(" ");
}

function findingId(finding: CanonicalFinding) {
  const raw = finding as any;
  return String(finding.findingId || raw.id || raw.sourceId || finding.semanticFingerprint || "unknown")
    .replace(/^"+|"+$/g, "");
}

function confidence(count: number, denominator: number): PatientSignal["confidence"] {
  const ratio = denominator ? count / denominator : 0;
  return count >= 5 && ratio >= 0.2 ? "high" : count >= 2 ? "moderate" : "directional";
}

function buildSignals(
  findings: CanonicalFinding[],
  patterns: readonly (readonly [string, string, RegExp])[]
): PatientSignal[] {
  return patterns
    .map(([id, label, pattern]) => {
      const matching = findings.filter((finding) => pattern.test(findingText(finding)));
      return {
        id,
        label,
        count: matching.length,
        prevalencePercent: findings.length ? Math.round((matching.length / findings.length) * 1000) / 10 : 0,
        confidence: confidence(matching.length, findings.length),
        evidenceIds: matching.slice(0, 5).map(findingId),
      };
    })
    .filter((signal) => signal.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function bestEvidence(finding: CanonicalFinding): EvidenceRef | undefined {
  const selected = [...(finding.evidence || [])].sort((left, right) => (right.score || 0) - (left.score || 0))[0];
  if (selected) return selected;
  const raw = finding as any;
  const excerpt = String(raw.excerpt || raw.text || finding.summary || finding.canonicalClaim || "").trim();
  if (!excerpt) return undefined;
  return {
    sourceType: "live",
    sourceId: findingId(finding),
    excerpt,
    url: raw.url,
    country: raw.country,
    platform: raw.platform,
    persona: raw.persona,
    score: raw.score,
  };
}

export function buildPatientIntelligence(
  therapeuticArea: string,
  findings: CanonicalFinding[],
  generatedAt = new Date().toISOString()
): PatientIntelligenceResult {
  const silverLabels = buildMedicalAestheticsEvidenceLabels(findings);
  const labelById = new Map(silverLabels.map((label) => [label.document_id.replace(/^"+|"+$/g, ""), label]));
  const analyzed = findings.map((finding) => ({
    finding,
    intelligence: analyzeEvidence(finding),
    label: labelById.get(findingId(finding)),
  }));
  const patient = analyzed.filter(({ intelligence, label }) => {
    return label?.is_promotional_silver !== "yes" &&
      label?.medical_aesthetics_relevance_silver !== "not_relevant" && (
      label?.source_group_silver === "patient" ||
      intelligence.voice === "patient" ||
      intelligence.voice === "caregiver" ||
      intelligence.evidenceClass === "patient_conversation" ||
      intelligence.evidenceClass === "caregiver_conversation"
    );
  });
  const patientFindings = patient.map(({ finding }) => finding);
  const caregiverCount = patient.filter(({ intelligence }) => intelligence.voice === "caregiver" || intelligence.evidenceClass === "caregiver_conversation").length;
  const coverage = findings.length ? (patientFindings.length / findings.length) * 100 : 0;
  const assessment = patientFindings.length >= 30 ? "adequate" : patientFindings.length >= 5 ? "limited" : "insufficient";
  const journeyStages = buildSignals(patientFindings, JOURNEY_PATTERNS);
  const treatmentBarriers = buildSignals(patientFindings, BARRIER_PATTERNS);
  const emotionalBurden = buildSignals(patientFindings, EMOTION_PATTERNS);
  const unmetNeeds = buildSignals(patientFindings, UNMET_NEED_PATTERNS);

  const treatmentCounts = new Map<string, string[]>();
  for (const finding of patientFindings) {
    for (const treatment of finding.treatments || []) {
      const key = treatment.trim();
      if (!key) continue;
      treatmentCounts.set(key, [...(treatmentCounts.get(key) || []), findingId(finding)]);
    }
  }
  const treatmentSignals: PatientSignal[] = [...treatmentCounts.entries()]
    .map(([label, ids]) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label, count: ids.length,
      prevalencePercent: patientFindings.length ? Math.round((ids.length / patientFindings.length) * 1000) / 10 : 0,
      confidence: confidence(ids.length, patientFindings.length), evidenceIds: ids.slice(0, 5),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const evidence = patient.slice(0, 20).map(({ finding, intelligence }) => {
    const source = bestEvidence(finding);
    return {
      id: `patient:${findingId(finding)}`,
      findingId: findingId(finding),
      quote: source?.excerpt || finding.summary || finding.canonicalClaim,
      sourceLabel: source?.platform || intelligence.sourceType || intelligence.platform || "Source metadata unavailable",
      url: source?.url,
      platform: source?.platform,
      country: source?.country,
      voice: intelligence.voice,
      qualityScore: intelligence.qualityScore,
    };
  });

  const topBarrier = treatmentBarriers[0]?.label || "trust and outcome uncertainty";
  const topNeed = unmetNeeds[0]?.label || "clear, evidence-backed education";
  return {
    schemaVersion: "patient_intelligence_v1",
    therapeuticArea,
    generatedAt,
    headline: `${topBarrier} is the leading patient-experience signal in the available ${therapeuticArea} evidence.`,
    executiveSummary: `Patient Intelligence identified ${patientFindings.length} patient or caregiver voice records from ${findings.length} corpus findings. The strongest supported opportunity is ${topNeed.toLowerCase()}. Findings should be interpreted with the stated coverage limitations.`,
    dataQuality: {
      corpusFindingCount: findings.length,
      patientVoiceFindingCount: patientFindings.length,
      caregiverVoiceFindingCount: caregiverCount,
      patientVoiceCoveragePercent: Math.round(coverage * 10) / 10,
      assessment,
      limitations: [
        "Audience labels are machine-derived silver labels pending human adjudication.",
        "The current Medical Aesthetics corpus is not a statistically representative patient panel.",
        caregiverCount ? "Caregiver findings are reported separately where present." : "No confidently classified caregiver evidence was available.",
      ],
    },
    journeyStages,
    treatmentBarriers,
    emotionalBurden,
    treatmentSignals,
    unmetNeeds,
    recommendations: [
      `Develop plain-language content addressing ${topBarrier.toLowerCase()} with explicit evidence and limitations.`,
      `Create decision support for ${topNeed.toLowerCase()} across consultation and follow-up touchpoints.`,
      "Validate the highest-priority signals with human-reviewed patient/HCP labels before external activation.",
    ],
    evidence,
  };
}
