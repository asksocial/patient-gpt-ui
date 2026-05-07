import { CanonicalFinding, EvidenceRef, FindingType } from "../models/finding";
import { normalizeLabel, buildSemanticFingerprint } from "../utils/normalization";
import { buildCanonicalClaim } from "./buildCanonicalClaim";

type RawCard = {
  id?: string;
  title?: string;
  summary?: string;
  description?: string;
  text?: string;
  excerpt?: string;
  snippet?: string;

  labels?: string[];
  findingType?: string;
  therapeuticArea?: string;

  country?: string | string[];
  persona?: string | string[];
  platform?: string | string[];
  symptoms?: string[];
  treatments?: string[];
  lifecycleStage?: string | string[];

  confidence?: number;
  score?: number;

  sourceType?: "curated" | "live";
  sourceId?: string;
  documentId?: string;
  sectionId?: string;
  sectionTitle?: string;
  url?: string;

  evidence?: Array<{
    sourceType?: "curated" | "live";
    sourceId?: string;
    documentId?: string;
    sectionId?: string;
    sectionTitle?: string;
    excerpt?: string;
    url?: string;
    country?: string;
    platform?: string;
    persona?: string;
    score?: number;
  }>;
};

function toArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeArray(value?: string | string[]): string[] {
  return Array.from(
    new Set(
      toArray(value)
        .map((v) => (v || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeStringArray(value?: string[]): string[] {
  return Array.from(
    new Set(
      (value || [])
        .map((v) => (v || "").trim())
        .filter(Boolean)
    )
  );
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const cleaned = (value || "").replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  return "";
}

function textBlob(raw: RawCard): string {
  return [
    raw.title,
    raw.summary,
    raw.description,
    raw.text,
    raw.excerpt,
    raw.snippet,
    ...(raw.labels || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function inferJourneyStage(raw: RawCard): CanonicalFinding["structuredData"]["treatmentJourney"]["stage"] {
  const blob = textBlob(raw);

  if (includesAny(blob, ["started", "starting", "began", "beginning", "initiated"])) {
    return "initiation";
  }
  if (includesAny(blob, ["missed dose", "forgot dose", "skip dose", "adherence", "compliance"])) {
    return "adherence";
  }
  if (includesAny(blob, ["dose increase", "dose decrease", "increased dose", "reduced dose", "titrat"])) {
    return "dose_change";
  }
  if (includesAny(blob, ["switched", "switching", "moved to", "changed to"])) {
    return "switch";
  }
  if (includesAny(blob, ["stopped", "discontinued", "came off", "quit", "dropped"])) {
    return "discontinuation";
  }
  if ((raw.treatments || []).length > 0) {
    return "ongoing_use";
  }

  return "unknown";
}

function inferJourneyAction(raw: RawCard): CanonicalFinding["structuredData"]["treatmentJourney"]["action"] {
  const blob = textBlob(raw);

  if (includesAny(blob, ["started", "starting", "began", "initiated"])) {
    return "started";
  }
  if (includesAny(blob, ["stopped", "discontinued", "came off", "quit", "dropped"])) {
    return "stopped";
  }
  if (includesAny(blob, ["switched", "switching", "changed to", "moved to"])) {
    return "switched";
  }
  if (includesAny(blob, ["missed dose", "forgot dose", "skip dose"])) {
    return "missed";
  }
  if (includesAny(blob, ["restarted", "back on"])) {
    return "restarted";
  }
  if (includesAny(blob, ["dose increase", "increased dose", "higher dose", "up-titrate"])) {
    return "dose_increase";
  }
  if (includesAny(blob, ["dose decrease", "reduced dose", "lower dose", "down-titrate"])) {
    return "dose_decrease";
  }

  return "unknown";
}

function inferDrivers(raw: RawCard): string[] {
  const blob = textBlob(raw);
  const drivers: string[] = [];

  if (includesAny(blob, ["side effect", "adverse", "nausea", "pain worsened", "bleeding worsened"])) {
    drivers.push("side_effects");
  }
  if (includesAny(blob, ["cost", "expensive", "insurance", "coverage", "copay"])) {
    drivers.push("cost_access");
  }
  if (includesAny(blob, ["not working", "ineffective", "didn't help", "no benefit"])) {
    drivers.push("lack_of_efficacy");
  }
  if (includesAny(blob, ["doctor advised", "provider advised", "doctor said"])) {
    drivers.push("provider_recommendation");
  }
  if (includesAny(blob, ["fertility", "pregnancy", "trying to conceive"])) {
    drivers.push("fertility_pregnancy_considerations");
  }
  if (includesAny(blob, ["convenient", "burden", "injection burden", "administration"])) {
    drivers.push("administration_burden");
  }

  return Array.from(new Set(drivers));
}

function inferBenefitSignals(raw: RawCard): string[] {
  const blob = textBlob(raw);
  const benefits: string[] = [];

  if (includesAny(blob, ["less pain", "pain improved", "pain relief"])) {
    benefits.push("pain_relief");
  }
  if (includesAny(blob, ["less bleeding", "bleeding improved", "lighter periods"])) {
    benefits.push("bleeding_reduction");
  }
  if (includesAny(blob, ["felt better", "improved quality of life", "more energy"])) {
    benefits.push("quality_of_life_improvement");
  }

  return Array.from(new Set(benefits));
}

function inferAdherenceSignals(raw: RawCard): string[] {
  const blob = textBlob(raw);
  const signals: string[] = [];

  if (includesAny(blob, ["missed dose", "forgot dose", "skip dose"])) {
    signals.push("missed_dose");
  }
  if (includesAny(blob, ["hard to stay on", "can't stay on", "stopped taking regularly"])) {
    signals.push("poor_adherence");
  }
  if (includesAny(blob, ["taking as prescribed", "staying on treatment", "consistent use"])) {
    signals.push("good_adherence");
  }

  return Array.from(new Set(signals));
}

function inferUsagePattern(raw: RawCard): string[] {
  const blob = textBlob(raw);
  const patterns: string[] = [];

  if (includesAny(blob, ["daily", "once daily", "twice daily"])) {
    patterns.push("daily_use");
  }
  if (includesAny(blob, ["weekly", "monthly"])) {
    patterns.push("periodic_use");
  }
  if (includesAny(blob, ["higher dose", "lower dose", "dose increase", "dose decrease"])) {
    patterns.push("dose_adjustment");
  }

  return Array.from(new Set(patterns));
}

function mapFindingType(raw: RawCard): FindingType {
  if (raw.findingType) {
    return raw.findingType as FindingType;
  }

  const labels = (raw.labels || []).map((l) => l.toLowerCase());
  const blob = textBlob(raw);

  if (
    includesAny(blob, [
      "started", "starting", "began", "initiated", "switched", "switching", "changed to",
      "stopped", "discontinued", "missed dose", "forgot dose", "dose increase", "dose decrease"
    ]) ||
    labels.some((l) => l.includes("journey")) ||
    labels.some((l) => l.includes("compliance")) ||
    labels.some((l) => l.includes("adherence")) ||
    labels.some((l) => l.includes("switch"))
  ) {
    return "treatment_journey";
  }

  if (
    includesAny(blob, ["benefit", "improved", "felt better", "pain relief", "less bleeding"]) ||
    labels.some((l) => l.includes("benefit")) ||
    labels.some((l) => l.includes("effectiveness"))
  ) {
    return "perceived_benefit";
  }

  if (labels.some((l) => l.includes("symptom")) || blob.includes("symptom")) {
    return "symptom_burden";
  }

  if (
    labels.some((l) => l.includes("quality of life")) ||
    blob.includes("daily life") ||
    blob.includes("quality of life")
  ) {
    return "quality_of_life";
  }

  if (labels.some((l) => l.includes("persona")) || blob.includes("persona")) {
    return "persona_pattern";
  }

  if (
    labels.some((l) => l.includes("country")) ||
    blob.includes("germany") ||
    blob.includes("spain") ||
    blob.includes("poland") ||
    blob.includes("austria") ||
    blob.includes("italy")
  ) {
    return "country_pattern";
  }

  if (labels.some((l) => l.includes("platform")) || blob.includes("forum")) {
    return "platform_preference";
  }

  if (labels.some((l) => l.includes("treatment")) || blob.includes("treatment")) {
    return "treatment_concern";
  }

  if (labels.some((l) => l.includes("diagnosis")) || blob.includes("diagnosis")) {
    return "diagnosis_barrier";
  }

  if (
    labels.some((l) => l.includes("safety")) ||
    blob.includes("adverse") ||
    blob.includes("side effect")
  ) {
    return "safety_signal";
  }

  return "other";
}

function buildSummary(raw: RawCard): string {
  const candidate = firstNonEmpty(
    raw.summary,
    raw.description,
    raw.excerpt,
    raw.snippet,
    raw.text,
    raw.title
  );

  if (!candidate) {
    return "No summary available.";
  }

  return candidate;
}

function inferIntentLabels(raw: RawCard): string[] {
  const labels = new Set<string>();
  const findingType = mapFindingType(raw);
  const blob = textBlob(raw);

  if (
    findingType === "symptom_burden" ||
    findingType === "quality_of_life" ||
    blob.includes("pain") ||
    blob.includes("bleeding") ||
    blob.includes("daily life")
  ) {
    labels.add("symptom_qol_burden");
  }

  if (
    findingType === "treatment_concern" ||
    findingType === "treatment_journey" ||
    findingType === "perceived_benefit" ||
    blob.includes("treatment") ||
    blob.includes("surgery") ||
    blob.includes("embolization") ||
    blob.includes("switched") ||
    blob.includes("stopped")
  ) {
    labels.add("treatment_decision_drivers");
  }

  if (
    findingType === "diagnosis_barrier" ||
    blob.includes("diagnosis") ||
    blob.includes("misdiagnosis") ||
    blob.includes("delay")
  ) {
    labels.add("diagnosis_barriers");
  }

  if (
    findingType === "safety_signal" ||
    blob.includes("adverse") ||
    blob.includes("side effect")
  ) {
    labels.add("safety_signals");
  }

  if (
    findingType === "country_pattern" ||
    findingType === "platform_preference" ||
    findingType === "persona_pattern"
  ) {
    labels.add("market_landscape");
  }

  if (labels.size === 0) {
    labels.add("general");
  }

  return Array.from(labels);
}

function estimateEvidenceStrength(raw: RawCard): number {
  const explicitEvidenceCount = raw.evidence?.length || 0;
  const hasExcerpt = !!firstNonEmpty(
    raw.excerpt,
    raw.snippet,
    raw.text,
    raw.summary,
    raw.description,
    raw.title
  );
  const hasStructuredSignals =
    normalizeArray(raw.country).length > 0 ||
    normalizeArray(raw.persona).length > 0 ||
    normalizeArray(raw.platform).length > 0 ||
    normalizeStringArray(raw.symptoms).length > 0 ||
    normalizeStringArray(raw.treatments).length > 0;

  let score = 0.3;

  if (explicitEvidenceCount > 0) {
    score += Math.min(explicitEvidenceCount, 5) * 0.1;
  }

  if (hasExcerpt) {
    score += 0.2;
  }

  if (hasStructuredSignals) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

function buildEvidenceRefs(raw: RawCard): EvidenceRef[] {
  if (raw.evidence && raw.evidence.length > 0) {
    return raw.evidence.map((item, index) => ({
      sourceType: item.sourceType || raw.sourceType || "curated",
      sourceId: item.sourceId || raw.sourceId || raw.id || `source-${index}`,
      documentId: item.documentId || raw.documentId,
      sectionId: item.sectionId || raw.sectionId,
      sectionTitle: item.sectionTitle || raw.sectionTitle,
      excerpt:
        firstNonEmpty(
          item.excerpt,
          raw.excerpt,
          raw.snippet,
          raw.summary,
          raw.description,
          raw.title
        ) || "No excerpt available",
      url: item.url || raw.url,
      country: item.country || normalizeArray(raw.country)[0],
      platform: item.platform || normalizeArray(raw.platform)[0],
      persona: item.persona || normalizeArray(raw.persona)[0],
      score: item.score ?? raw.score,
    }));
  }

  return [
    {
      sourceType: raw.sourceType || "curated",
      sourceId: raw.sourceId || raw.id || "unknown-source",
      documentId: raw.documentId,
      sectionId: raw.sectionId,
      sectionTitle: raw.sectionTitle,
      excerpt:
        firstNonEmpty(
          raw.excerpt,
          raw.snippet,
          raw.summary,
          raw.description,
          raw.title
        ) || "No excerpt available",
      url: raw.url,
      country: normalizeArray(raw.country)[0],
      platform: normalizeArray(raw.platform)[0],
      persona: normalizeArray(raw.persona)[0],
      score: raw.score,
    },
  ];
}

export function rawCardToFinding(raw: RawCard): CanonicalFinding {
  const normalizedLabels = normalizeStringArray((raw.labels || []).map(normalizeLabel));
  const findingType = mapFindingType(raw);

  return {
    findingId: raw.id || `finding-${Math.random().toString(36).slice(2, 10)}`,
    findingType,
    canonicalClaim: buildCanonicalClaim({
      ...raw,
      findingType,
    }),
    summary: buildSummary(raw),
    therapeuticArea: raw.therapeuticArea || "unknown",

    countries: normalizeArray(raw.country),
    personas: normalizeArray(raw.persona),
    platforms: normalizeArray(raw.platform),
    symptoms: normalizeStringArray(raw.symptoms),
    treatments: normalizeStringArray(raw.treatments),
    lifecycleStages: normalizeArray(raw.lifecycleStage),

    intentLabels: inferIntentLabels({
      ...raw,
      findingType,
    }),

    confidence: raw.confidence ?? 0.6,
    relevanceScore: raw.score ?? 0.0,
    evidenceStrength: estimateEvidenceStrength(raw),

    evidence: buildEvidenceRefs(raw),

    normalizedLabels,
    semanticFingerprint: buildSemanticFingerprint(raw),

    structuredData: {
      treatmentJourney:
        findingType === "treatment_journey" || findingType === "perceived_benefit"
          ? {
              stage: inferJourneyStage(raw),
              action: inferJourneyAction(raw),
              fromTreatment: normalizeStringArray(raw.treatments)[0],
              toTreatment: normalizeStringArray(raw.treatments)[1],
              drivers: inferDrivers(raw),
              benefitSignals: inferBenefitSignals(raw),
              adherenceSignals: inferAdherenceSignals(raw),
              usagePattern: inferUsagePattern(raw),
            }
          : undefined,
    },
  };
}