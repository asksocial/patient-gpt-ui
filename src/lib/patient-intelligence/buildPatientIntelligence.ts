import { sourceContext, matchesContextSignal, expressesInformationNeed, CONTEXT_RULES_VERSION } from "../intelligence/sourceContext";
import { SEARCH_SUBJECTS } from "../../answering/search/searchSubjects";
import type { CanonicalFinding, EvidenceRef } from "../../answering/models/finding";
import {
  classifyPatientEvidence,
  patientEvidenceTierLabel,
  patientContentTypeLabel,
  type PatientEvidenceTier,
} from "./classifyPatientEvidence";

export type PatientSignal = {
  id: string;
  label: string;
  count: number;
  prevalencePercent: number;
  confidence: "high" | "moderate" | "directional";
  evidenceIds: string[];
};

export type PatientEvidenceScope = "patient_related" | "patient_voice";

export type PatientIntelligenceBuildOptions = {
  evidenceScope?: PatientEvidenceScope;
  sourceComposition?: { sourceRecordCount: number; patientRelatedCount: number };
};

export function resolvePatientEvidenceScope(therapeuticArea: string, requested?: string): PatientEvidenceScope {
  if (!/^glp[ _-]?1$/i.test(therapeuticArea)) return "patient_voice";
  return requested === "patient_voice" ? "patient_voice" : "patient_related";
}

export type PatientEvidenceDimension =
  | "all"
  | "journey"
  | "treatment_barriers"
  | "emotional_burden"
  | "unmet_needs";

export type PatientEvidenceItem = {
  id: string;
  findingId: string;
  quote: string;
  fullMention: string;
  mentionTitle?: string;
  author?: string;
  publishedAt?: string;
  sourceLabel: string;
  url?: string;
  platform?: string;
  country?: string;
  voice: string;
  audienceLabel: string;
  patientContentLabel?: string;
  evidenceTier: PatientEvidenceTier;
  evidenceTierLabel: string;
  classificationConfidence: number;
  classificationRationale: string;
  qualityScore: number;
  matchedSignalIds: string[];
  matchedSignalLabels: string[];
};

export type PatientEvidenceCatalogResult = {
  therapeuticArea: string;
  evidenceScope: PatientEvidenceScope;
  dimension: PatientEvidenceDimension;
  dimensionLabel: string;
  query: string;
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  items: PatientEvidenceItem[];
};

export type PatientIntelligenceResult = {
  schemaVersion: "patient_intelligence_v1";
  therapeuticArea: string;
  generatedAt: string;
  headline: string;
  executiveSummary: string;
  dataQuality: {
    contextRulesVersion?: string;
    evidenceScope: PatientEvidenceScope;
    analyzedFindingCount: number;
    analyzedCoveragePercent: number;
    patientRelatedFindingCount: number;
    sourceRecordCount?: number;
    sourcePatientRelatedCount?: number;
    excludedPatientRelatedCount?: number;
    corpusFindingCount: number;
    patientVoiceFindingCount: number;
    caregiverVoiceFindingCount: number;
    confirmedPatientFindingCount: number;
    confirmedCaregiverFindingCount: number;
    likelyPatientFindingCount: number;
    likelyCaregiverFindingCount: number;
    resolvedAudienceCounts: Record<string, number>;
    patientVoiceCoveragePercent: number;
    assessment: "adequate" | "limited" | "insufficient";
    limitations: string[];
  };
  journeyStages: PatientSignal[];
  treatmentBarriers: PatientSignal[];
  emotionalBurden: PatientSignal[];
  treatmentSignals: PatientSignal[];
  unmetNeeds: PatientSignal[];
  evidenceDimensions: Array<{
    id: PatientEvidenceDimension;
    label: string;
    findingCount: number;
  }>;
  recommendations: string[];
  evidence: Array<{
    id: string;
    findingId: string;
    quote: string;
    fullMention: string;
    mentionTitle?: string;
    author?: string;
    publishedAt?: string;
    sourceLabel: string;
    url?: string;
    platform?: string;
    country?: string;
    voice: string;
    audienceLabel: string;
    patientContentLabel?: string;
    evidenceTier: PatientEvidenceTier;
    evidenceTierLabel: string;
    classificationConfidence: number;
    classificationRationale: string;
    qualityScore: number;
    matchedSignalLabels: string[];
  }>;
};

const JOURNEY_PATTERNS = [
  ["awareness", "Awareness", /heard about|learned about|what is|new treatment|trend/i],
  ["consideration", "Considering treatment", /thinking about|considering|should i|has anyone|worth it|want to try/i],
  ["provider_selection", "Provider selection", /provider|injector|doctor|dermatologist|clinic|consultation/i],
  ["treatment", "Treatment experience", /i got|i had|procedure|injected|treated|after my/i],
  ["recovery", "Recovery and follow-up", /recovery|downtime|swelling|bruising|follow.?up|healing/i],
  ["maintenance", "Maintenance, continuation or switching", /maintenance|wears off|lasted|switch|dissolv|stopped taking/i],
] as const;

const BARRIER_PATTERNS = [
  ["trust_safety", "Trust and safety discussion", /safe|risk|fake|counterfeit|complication|botched|migration|legal|approved/i],
  ["expectations", "Treatment outcomes and expectations", /natural|overdone|regret|result|worked for me|works for me|didn.t work|doesn.t work|effective|worth it|pillow face/i],
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

const PATIENT_EVIDENCE_DIMENSIONS: Record<
  PatientEvidenceDimension,
  {
    label: string;
    patterns: readonly (readonly [string, string, RegExp])[];
  }
> = {
  all: { label: "All analyzed mentions", patterns: [] },
  journey: { label: "Patient journey", patterns: JOURNEY_PATTERNS },
  treatment_barriers: { label: "Treatment considerations", patterns: BARRIER_PATTERNS },
  emotional_burden: { label: "Emotional burden", patterns: EMOTION_PATTERNS },
  unmet_needs: { label: "Unmet needs", patterns: UNMET_NEED_PATTERNS },
};

function findingText(finding: CanonicalFinding) { return sourceContext(finding); }

function findingId(finding: CanonicalFinding) {
  const raw = finding as any;
  return String(finding.findingId || raw.id || raw.sourceId || finding.semanticFingerprint || "unknown")
    .replace(/^"+|"+$/g, "");
}

function confidence(count: number, denominator: number): PatientSignal["confidence"] {
  const ratio = denominator ? count / denominator : 0;
  return count >= 5 && ratio >= 0.2 ? "high" : count >= 2 ? "moderate" : "directional";
}

function matchesPatientSignal(id: string, pattern: RegExp, text: string) {
  if (id === "maintenance" && SEARCH_SUBJECTS.find(subject => subject.id === "maintenance")!.topics.some(topic => topic.pattern.test(text))) return true;
  return matchesContextSignal(id, pattern, text);
}

function buildSignals(
  findings: CanonicalFinding[],
  patterns: readonly (readonly [string, string, RegExp])[]
): PatientSignal[] {
  return patterns
    .map(([id, label, pattern]) => {
      const matching = findings.filter((finding) => {
        const text = findingText(finding);
        return (patterns !== UNMET_NEED_PATTERNS || expressesInformationNeed(text)) && matchesPatientSignal(id, pattern, text);
      });
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

function metadataString(finding: CanonicalFinding, ...keys: string[]) {
  const value = keys
    .map((key) => finding.rawMetadata?.normalizedFields?.[key])
    .find((candidate) =>
      Array.isArray(candidate)
        ? candidate.some((item) => String(item || "").trim())
        : String(candidate || "").trim()
    );
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
  return String(value || "").trim();
}

function fullMention(finding: CanonicalFinding, source?: EvidenceRef) {
  const raw = finding as CanonicalFinding & Record<string, unknown>;
  const candidates = [
    metadataString(finding, "full_text", "document_text", "article_body", "body", "content", "post_text", "opening_text", "text", "caption"),
    raw.text,
    raw.description,
    metadataString(finding, "description", "summary"),
    source?.excerpt,
    raw.excerpt,
    finding.summary,
    finding.canonicalClaim,
    metadataString(finding, "headline", "title"),
    raw.title,
  ].map((value) => String(value || "").trim()).filter(Boolean);
  return candidates.sort((left, right) => right.length - left.length)[0] || "Patient evidence mention unavailable";
}

function originalSourceUrl(finding: CanonicalFinding, source?: EvidenceRef) {
  const raw = finding as CanonicalFinding & Record<string, unknown>;
  const candidate = String(
    source?.url || raw.url || metadataString(finding, "url", "source_url", "source_link", "permalink", "link") || ""
  ).trim();
  if (!candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function classifyPatientCorpus(findings: CanonicalFinding[]) {
  return findings
    .map((finding) => ({
      finding,
      classification: classifyPatientEvidence(finding),
    }))
    .map(({ finding, classification }) => ({
      finding,
      classification,
      intelligence: classification.intelligence,
    }));
}

function selectPatientEvidence(classified: ReturnType<typeof classifyPatientCorpus>, scope: PatientEvidenceScope) {
  return classified
    .filter(({ classification }) => classification.eligible || scope === "patient_related" && classification.patientRelated && classification.patientContentType !== "commercial_patient_testimonial")
    .map(item => item.classification.eligible ? item : {
      ...item, classification: { ...item.classification, tier: "patient_related_context" as PatientEvidenceTier },
    });
}

function matchedPatientSignals(
  finding: CanonicalFinding,
  dimension: PatientEvidenceDimension
) {
  if (dimension === "all") return [{ id: "all", label: "All analyzed mentions" }];
  const text = findingText(finding);
  if (dimension === "unmet_needs" && !expressesInformationNeed(text)) return [];
  return PATIENT_EVIDENCE_DIMENSIONS[dimension].patterns
    .filter(([id, , pattern]) => matchesPatientSignal(id, pattern, text))
    .map(([id, label]) => ({ id, label }));
}

function allMatchedPatientSignals(finding: CanonicalFinding) {
  const signals = (Object.keys(PATIENT_EVIDENCE_DIMENSIONS) as PatientEvidenceDimension[]).filter(dimension => dimension !== "all")
    .flatMap((dimension) => matchedPatientSignals(finding, dimension));
  return [...new Map(signals.map((signal) => [signal.id, signal])).values()];
}

function buildPatientEvidenceItem(
  finding: CanonicalFinding,
  classification: ReturnType<typeof classifyPatientEvidence>,
  dimension: PatientEvidenceDimension
): PatientEvidenceItem {
  const intelligence = classification.intelligence;
  const source = bestEvidence(finding);
  const matchedSignals = matchedPatientSignals(finding, dimension);
  return {
    id: `patient:${findingId(finding)}`,
    findingId: findingId(finding),
    quote: source?.excerpt || finding.summary || finding.canonicalClaim,
    fullMention: fullMention(finding, source),
    mentionTitle: metadataString(finding, "headline", "title") || undefined,
    author: metadataString(finding, "influencer", "author", "author_name", "username") || undefined,
    publishedAt: metadataString(finding, "date", "published_at", "published_date", "alternate_date_format") || undefined,
    sourceLabel: source?.platform || intelligence.sourceType || intelligence.platform || "Source metadata unavailable",
    url: originalSourceUrl(finding, source),
    platform: source?.platform,
    country: source?.country,
    voice: intelligence.voice,
    audienceLabel: classification.resolvedAudience,
    patientContentLabel: classification.patientContentType ? patientContentTypeLabel(classification.patientContentType) : undefined,
    evidenceTier: classification.tier,
    evidenceTierLabel: patientEvidenceTierLabel(classification.tier),
    classificationConfidence: classification.confidence,
    classificationRationale: classification.rationale,
    qualityScore: intelligence.qualityScore,
    matchedSignalIds: matchedSignals.map((signal) => signal.id),
    matchedSignalLabels: matchedSignals.map((signal) => signal.label),
  };
}

export function isPatientEvidenceDimension(value: unknown): value is PatientEvidenceDimension {
  return typeof value === "string" && value in PATIENT_EVIDENCE_DIMENSIONS;
}

export function buildPatientEvidenceCatalog(
  therapeuticArea: string,
  findings: CanonicalFinding[],
  dimension: PatientEvidenceDimension,
  params: { query?: string; page?: number; pageSize?: number; evidenceScope?: PatientEvidenceScope } = {}
): PatientEvidenceCatalogResult {
  const query = String(params.query || "").trim();
  const normalizedQuery = query.toLowerCase();
  const pageSize = Math.min(50, Math.max(10, Math.floor(Number(params.pageSize) || 20)));
  const seen = new Set<string>();
  const evidenceScope = resolvePatientEvidenceScope(therapeuticArea, params.evidenceScope);
  const matching = selectPatientEvidence(classifyPatientCorpus(findings), evidenceScope)
    .filter(({ finding }) => matchedPatientSignals(finding, dimension).length > 0)
    .filter(({ finding }) => {
      if (normalizedQuery && ![
        findingText(finding),
        metadataString(finding, "headline", "title", "author", "source", "publication", "country"),
      ].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery)) return false;
      const id = findingId(finding);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((left, right) =>
      Number(right.classification.tier.startsWith("confirmed_")) - Number(left.classification.tier.startsWith("confirmed_")) ||
      right.classification.confidence - left.classification.confidence ||
      right.intelligence.qualityScore - left.intelligence.qualityScore ||
      matchedPatientSignals(right.finding, dimension).length - matchedPatientSignals(left.finding, dimension).length ||
      findingId(left.finding).localeCompare(findingId(right.finding))
    );
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(params.page) || 1)));
  const offset = (page - 1) * pageSize;
  return {
    therapeuticArea,
    evidenceScope,
    dimension,
    dimensionLabel: PATIENT_EVIDENCE_DIMENSIONS[dimension].label,
    query,
    page,
    pageSize,
    pageCount,
    total: matching.length,
    items: matching
      .slice(offset, offset + pageSize)
      .map(({ finding, classification }) => buildPatientEvidenceItem(finding, classification, dimension)),
  };
}

export function buildPatientIntelligence(
  therapeuticArea: string,
  findings: CanonicalFinding[],
  generatedAt = new Date().toISOString(),
  options: PatientIntelligenceBuildOptions = {}
): PatientIntelligenceResult {
  const classifiedCorpus = classifyPatientCorpus(findings);
  const evidenceScope = resolvePatientEvidenceScope(therapeuticArea, options.evidenceScope);
  const voice = classifiedCorpus.filter(({ classification }) => classification.eligible);
  const related = selectPatientEvidence(classifiedCorpus, "patient_related");
  const patient = selectPatientEvidence(classifiedCorpus, evidenceScope);
  const patientFindings = patient.map(({ finding }) => finding);
  const tierCount = (tier: PatientEvidenceTier) => voice.filter(({ classification }) => classification.tier === tier).length;
  const confirmedPatientCount = tierCount("confirmed_patient");
  const confirmedCaregiverCount = tierCount("confirmed_caregiver");
  const likelyPatientCount = tierCount("likely_patient");
  const likelyCaregiverCount = tierCount("likely_caregiver");
  const caregiverCount = confirmedCaregiverCount + likelyCaregiverCount;
  const resolvedAudienceCounts = classifiedCorpus.reduce<Record<string, number>>((counts, { classification }) => {
    const audience = classification.resolvedAudience;
    counts[audience] = (counts[audience] || 0) + 1;
    return counts;
  }, {});
  const coverage = findings.length ? (voice.length / findings.length) * 100 : 0;
  const analyzedCoverage = findings.length ? (patientFindings.length / findings.length) * 100 : 0;
  const assessment = patientFindings.length >= 30 ? "adequate" : patientFindings.length >= 5 ? "limited" : "insufficient";
  const journeyStages = buildSignals(patientFindings, JOURNEY_PATTERNS);
  const treatmentBarriers = buildSignals(patientFindings, BARRIER_PATTERNS);
  const emotionalBurden = buildSignals(patientFindings, EMOTION_PATTERNS);
  const unmetNeeds = buildSignals(patientFindings, UNMET_NEED_PATTERNS);
  const evidenceDimensions = (Object.keys(PATIENT_EVIDENCE_DIMENSIONS) as PatientEvidenceDimension[])
    .map((dimension) => ({
      id: dimension,
      label: PATIENT_EVIDENCE_DIMENSIONS[dimension].label,
      findingCount: new Set(
        patientFindings
          .filter((finding) => matchedPatientSignals(finding, dimension).length > 0)
          .map(findingId)
      ).size,
    }));

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

  const evidence = patient
    .sort((left, right) =>
      Number(right.classification.tier.startsWith("confirmed_")) - Number(left.classification.tier.startsWith("confirmed_")) ||
      right.classification.confidence - left.classification.confidence ||
      right.intelligence.qualityScore - left.intelligence.qualityScore
    )
    .slice(0, 20)
    .map(({ finding, intelligence, classification }) => {
    const source = bestEvidence(finding);
    const matchedSignals = allMatchedPatientSignals(finding);
    return {
      id: `patient:${findingId(finding)}`,
      findingId: findingId(finding),
      quote: source?.excerpt || finding.summary || finding.canonicalClaim,
      fullMention: fullMention(finding, source),
      mentionTitle: metadataString(finding, "headline", "title") || undefined,
      author: metadataString(finding, "influencer", "author", "author_name", "username") || undefined,
      publishedAt: metadataString(finding, "date", "published_at", "published_date", "alternate_date_format") || undefined,
      sourceLabel: source?.platform || intelligence.sourceType || intelligence.platform || "Source metadata unavailable",
      url: originalSourceUrl(finding, source),
      platform: source?.platform,
      country: source?.country,
      voice: intelligence.voice,
      audienceLabel: classification.resolvedAudience,
      patientContentLabel: classification.patientContentType ? patientContentTypeLabel(classification.patientContentType) : undefined,
      evidenceTier: classification.tier,
      evidenceTierLabel: patientEvidenceTierLabel(classification.tier),
      classificationConfidence: classification.confidence,
      classificationRationale: classification.rationale,
      qualityScore: intelligence.qualityScore,
      matchedSignalLabels: matchedSignals.map((signal) => signal.label),
    };
  });

  const topBarrier = treatmentBarriers[0]?.label;
  const topNeed = unmetNeeds[0]?.label;
  return {
    schemaVersion: "patient_intelligence_v1",
    therapeuticArea,
    generatedAt,
    headline: topBarrier ? `${topBarrier} is the leading ${evidenceScope === "patient_related" ? "patient-related discussion" : "patient-experience"} signal in the available ${therapeuticArea} evidence.` : `No supported treatment-consideration priority was identified in the available ${therapeuticArea} patient evidence.`,
    executiveSummary: `Patient Intelligence analyzed ${patientFindings.length} ${evidenceScope === "patient_related" ? "patient-related mentions, including community and third-party context," : "patient or caregiver voice records"} from ${findings.length} corpus findings. ${topNeed ? `The strongest supported information need is ${topNeed.toLowerCase()}.` : "No explicit unmet-information need was identified in the available source wording."} Findings should be interpreted with the stated coverage limitations.`,
    dataQuality: {
      contextRulesVersion: CONTEXT_RULES_VERSION,
      evidenceScope,
      analyzedFindingCount: patientFindings.length,
      analyzedCoveragePercent: Math.round(analyzedCoverage * 10) / 10,
      patientRelatedFindingCount: related.length,
      ...(options.sourceComposition ? {
        sourceRecordCount: options.sourceComposition.sourceRecordCount,
        sourcePatientRelatedCount: options.sourceComposition.patientRelatedCount,
        excludedPatientRelatedCount: Math.max(0, options.sourceComposition.patientRelatedCount - related.length),
      } : {}),
      corpusFindingCount: findings.length,
      patientVoiceFindingCount: voice.length,
      caregiverVoiceFindingCount: caregiverCount,
      confirmedPatientFindingCount: confirmedPatientCount,
      confirmedCaregiverFindingCount: confirmedCaregiverCount,
      likelyPatientFindingCount: likelyPatientCount,
      likelyCaregiverFindingCount: likelyCaregiverCount,
      resolvedAudienceCounts,
      patientVoiceCoveragePercent: Math.round(coverage * 10) / 10,
      assessment,
      limitations: [
        ...(evidenceScope === "patient_related" ? ["Patient-related mentions include support-community discussion, media/reposted accounts and family or peer references. These are not counts of patient authors."] : []),
        "Direct labels come from the evidence ontology; likely patient and caregiver labels are machine-derived from personal-experience signals and require human validation.",
        `The current ${therapeuticArea} corpus is not a statistically representative patient panel.`,
        caregiverCount ? "Caregiver findings are reported separately where present." : "No confidently classified caregiver evidence was available.",
      ],
    },
    journeyStages,
    treatmentBarriers,
    emotionalBurden,
    treatmentSignals,
    unmetNeeds,
    evidenceDimensions,
    recommendations: patientFindings.length ? [
      ...(topBarrier ? [`Develop plain-language content addressing ${topBarrier.toLowerCase()} with explicit evidence and limitations.`] : []),
      ...(topNeed ? [`Create decision support for ${topNeed.toLowerCase()} across consultation and follow-up touchpoints.`] : []),
      "Validate the highest-priority signals with human-reviewed patient/HCP labels before external activation.",
    ] : [],
    evidence,
  };
}
