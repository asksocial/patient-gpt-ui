import type {
  CanonicalFinding,
} from "../models/finding";
import type {
  EvidenceClass,
  EvidenceIntelligence,
} from "../evidence/types";
import {
  AUTHORITATIVE_EVIDENCE_CLASSES,
  CREDIBLE_CONTEXT_EVIDENCE_CLASSES,
  DIRECT_VOICE_EVIDENCE_CLASSES,
  LIMITED_FALLBACK_EVIDENCE_CLASSES,
  LOW_TRUST_EVIDENCE_CLASSES,
  PROMOTIONAL_EVIDENCE_CLASSES,
} from "../evidence/config/evidenceQualityConfig";
import type {
  EvidenceSelectionTier,
  EvidenceSourceCategory,
  RepresentativeEvidence,
  RepresentativeEvidenceSelectionResult,
  ThemeDefinition,
  ThemeQualityDiagnostics,
} from "./themeModels";
import {
  extractRepresentativeQuote,
} from "./extractRepresentativeQuote";
import {
  classifyEvidenceSource,
} from "./classifyEvidenceSource";
import {
  scoreThemeEvidenceRelevance,
} from "./scoreThemeEvidenceRelevance";
import {
  THEME_QUALITY_CONFIG,
} from "./themeQualityConfig";
import {
  isMeaningfulDimensionValue,
  normalizeDimensionValue,
} from "./dimensionQualityConfig";

export type RepresentativeEvidenceOptions = {
  limit?: number;

  minimumRelevance?: number;

  maximumPerPlatform?: number;

  maximumPerSourceType?: number;

  maximumPerCountry?: number;

  maximumPerPersona?: number;

  minimumDirectVoiceEvidence?: number;

  maximumAuthoritativeEvidence?: number;

  maximumCredibleContextEvidence?: number;

  maximumFallbackEvidence?: number;

  maximumConsumerNewsEvidence?: number;

  maximumUnknownEvidence?: number;
};

type CandidateEvidence = {
  evidence: RepresentativeEvidence;

  normalizedQuote: string;
};

function getFindingId(
  finding: CanonicalFinding
): string {
  const value = finding as any;

  return String(
    value.findingId ||
      value.id ||
      value.sourceId ||
      ""
  );
}

function getClaim(
  finding: CanonicalFinding
): string {
  const value = finding as any;

  return String(
    value.canonicalClaim ||
      value.summary ||
      value.title ||
      value.description ||
      ""
  ).trim();
}

function getPrimaryEvidence(
  finding: CanonicalFinding
): any | null {
  const evidence = Array.isArray(
    (finding as any).evidence
  )
    ? (finding as any).evidence
    : [];

  return evidence[0] || null;
}

function getEvidenceIntelligence(
  finding: CanonicalFinding
): EvidenceIntelligence | undefined {
  return (finding as any)
    .evidenceIntelligence;
}

function getConfidence(
  finding: CanonicalFinding
): number {
  const value = Number(
    (finding as any).confidence
  );

  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.max(
    0,
    Math.min(1, value)
  );
}

function getEvidenceStrength(
  finding: CanonicalFinding
): number {
  const value = Number(
    (finding as any)
      .evidenceStrength
  );

  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.max(
    0,
    Math.min(1, value)
  );
}

function mapEvidenceClassToLegacyCategory(
  evidenceClass: EvidenceClass
): EvidenceSourceCategory {
  switch (evidenceClass) {
    case "patient_conversation":
    case "youtube_review":
      return "first_person";

    case "caregiver_conversation":
      return "caregiver_voice";

    case "provider_conversation":
      return "provider_voice";

    case "community_conversation":
    case "forum":
    case "podcast":
    case "personal_blog":
      return "community_voice";

    case "research_journal":
    case "clinical_study":
    case "government_or_regulator":
    case "medical_society":
      return "research_or_science";

    case "advocacy_organization":
    case "healthcare_trade_publication":
    case "healthcare_news":
    case "consumer_news":
      return "independent_editorial";

    case "corporate_pr":
      return "press_release";

    case "clinic_marketing":
      return "clinic_marketing";

    case "retail_or_product":
      return "retail_or_product";

    case "event_or_conference":
      return "event_or_conference";

    case "sponsored_content":
    case "influencer_content":
      return "brand_owned";

    default:
      return "unknown";
  }
}

function getLegacyEvidenceClass(
  category: EvidenceSourceCategory
): EvidenceClass {
  switch (category) {
    case "first_person":
      return "patient_conversation";

    case "caregiver_voice":
      return "caregiver_conversation";

    case "provider_voice":
      return "provider_conversation";

    case "community_voice":
      return "community_conversation";

    case "research_or_science":
      return "healthcare_news";

    case "independent_editorial":
      return "consumer_news";

    case "brand_owned":
      return "sponsored_content";

    case "clinic_marketing":
      return "clinic_marketing";

    case "retail_or_product":
      return "retail_or_product";

    case "press_release":
      return "corporate_pr";

    case "event_or_conference":
      return "event_or_conference";

    default:
      return "unknown";
  }
}

function getSelectionTier(
  evidenceClass: EvidenceClass
): EvidenceSelectionTier {
  if (
    DIRECT_VOICE_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    return "direct_voice";
  }

  if (
    AUTHORITATIVE_EVIDENCE_CLASSES.has(
      evidenceClass
    ) ||
    CREDIBLE_CONTEXT_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    return "credible_context";
  }

  return "fallback";
}

function getThemeCompatibilityScore(
  evidenceClass: EvidenceClass,
  legacyCategory: EvidenceSourceCategory,
  theme: ThemeDefinition
): number | null {
  if (
    theme.excludedEvidenceClasses?.includes(
      evidenceClass
    )
  ) {
    return null;
  }

  if (
    theme.allowedEvidenceClasses &&
    theme.allowedEvidenceClasses.length >
      0 &&
    !theme.allowedEvidenceClasses.includes(
      evidenceClass
    )
  ) {
    return null;
  }

  if (
    theme.preferredEvidenceClasses?.includes(
      evidenceClass
    )
  ) {
    return 20;
  }

  if (
    theme.allowedEvidenceClasses?.includes(
      evidenceClass
    )
  ) {
    return 5;
  }

  if (
    theme.excludedSourceCategories?.includes(
      legacyCategory
    )
  ) {
    return null;
  }

  if (
    theme.allowedSourceCategories &&
    theme.allowedSourceCategories.length >
      0 &&
    !theme.allowedSourceCategories.includes(
      legacyCategory
    )
  ) {
    return null;
  }

  if (
    theme.preferredSourceCategories?.includes(
      legacyCategory
    )
  ) {
    return 20;
  }

  if (
    theme.allowedSourceCategories?.includes(
      legacyCategory
    )
  ) {
    return 5;
  }

  return 0;
}

function getFieldValue(
  finding: CanonicalFinding,
  pluralField: string,
  singularField: string
): string | undefined {
  const value = finding as any;

  if (
    Array.isArray(
      value[pluralField]
    )
  ) {
    const firstMeaningful =
      value[pluralField].find(
        isMeaningfulDimensionValue
      );

    if (firstMeaningful) {
      return String(firstMeaningful);
    }
  }

  if (
    isMeaningfulDimensionValue(
      value[singularField]
    )
  ) {
    return String(
      value[singularField]
    );
  }

  return undefined;
}

function normalizeForDedupe(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function calculateQualityScore(params: {
  finding: CanonicalFinding;

  themeRelevanceScore: number;

  evidenceQualityScore: number;

  sourceCompatibilityScore: number;

  quote: string;

  hasUrl: boolean;

  evidenceClass: EvidenceClass;
}): number {
  const {
    finding,
    themeRelevanceScore,
    evidenceQualityScore,
    sourceCompatibilityScore,
    quote,
    hasUrl,
    evidenceClass,
  } = params;

  let score = 0;

  score +=
    themeRelevanceScore * 40;

  score +=
    evidenceQualityScore * 0.4;

  score +=
    getConfidence(finding) * 8;

  score +=
    getEvidenceStrength(
      finding
    ) * 8;

  score +=
    sourceCompatibilityScore;

  if (
    DIRECT_VOICE_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    score += 12;
  }

  if (
    AUTHORITATIVE_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    score += 10;
  }

  if (
    evidenceClass ===
    "community_conversation"
  ) {
    score += 4;
  }

  if (
    evidenceClass ===
    "consumer_news"
  ) {
    score -= 20;
  }

  if (
    LIMITED_FALLBACK_EVIDENCE_CLASSES.has(
      evidenceClass
    )
  ) {
    score -= 5;
  }

  if (
    quote.length >=
      THEME_QUALITY_CONFIG
        .minimumQuoteLength &&
    quote.length <=
      THEME_QUALITY_CONFIG
        .maximumQuoteLength
  ) {
    score += 5;
  }

  if (hasUrl) {
    score += 3;
  }

  return Math.round(score);
}

function buildCandidate(
  finding: CanonicalFinding,
  theme: ThemeDefinition
): CandidateEvidence | null {
  const value = finding as any;

  const findingId =
    getFindingId(finding);

  if (!findingId) {
    return null;
  }

  const quote =
    extractRepresentativeQuote(
      finding
    );

  if (!quote) {
    return null;
  }

  const primaryEvidence =
    getPrimaryEvidence(finding);

  const intelligence =
    getEvidenceIntelligence(
      finding
    );

  const fallbackCategory =
    classifyEvidenceSource(
      finding,
      quote
    );

  const evidenceClass =
    intelligence?.evidenceClass ??
    getLegacyEvidenceClass(
      fallbackCategory
    );

  const sourceCategory =
    intelligence
      ? mapEvidenceClassToLegacyCategory(
          evidenceClass
        )
      : fallbackCategory;

  const compatibilityScore =
    getThemeCompatibilityScore(
      evidenceClass,
      sourceCategory,
      theme
    );

  if (compatibilityScore === null) {
    return null;
  }

  const relevanceScore =
    scoreThemeEvidenceRelevance(
      finding,
      theme
    );

  const url = String(
    primaryEvidence?.url ||
      value.url ||
      ""
  ).trim();

  const evidenceQualityScore =
    intelligence?.qualityScore ??
    50;

  const qualityScore =
    calculateQualityScore({
      finding,

      themeRelevanceScore:
        relevanceScore,

      evidenceQualityScore,

      sourceCompatibilityScore:
        compatibilityScore,

      quote,

      hasUrl: Boolean(url),

      evidenceClass,
    });

  return {
    normalizedQuote:
      normalizeForDedupe(quote),

    evidence: {
      findingId,

      claim: getClaim(finding),

      quote,

      sourceCategory,

      evidenceClass,

      evidenceVoice:
        intelligence?.voice,

      publicationType:
        intelligence?.publicationType,

      commercialIntent:
        intelligence?.commercialIntent,

      researchCredibility:
        intelligence?.researchCredibility,

      evidenceQualityScore:
        intelligence?.qualityScore,

      evidenceQualityBand:
        intelligence?.qualityBand,

      sourceType:
        String(
          primaryEvidence?.sourceType ||
            intelligence?.sourceType ||
            value.sourceType ||
            ""
        ) || undefined,

      selectionTier:
        getSelectionTier(
          evidenceClass
        ),

      platform:
        String(
          primaryEvidence?.platform ||
            getFieldValue(
              finding,
              "platforms",
              "platform"
            ) ||
            intelligence?.platform ||
            ""
        ) || undefined,

      country:
        String(
          primaryEvidence?.country ||
            getFieldValue(
              finding,
              "countries",
              "country"
            ) ||
            ""
        ) || undefined,

      persona:
        String(
          primaryEvidence?.persona ||
            getFieldValue(
              finding,
              "personas",
              "persona"
            ) ||
            intelligence?.voice ||
            ""
        ) || undefined,

      url: url || undefined,

      themeRelevanceScore:
        relevanceScore,

      sourceCompatibilityScore:
        compatibilityScore,

      qualityScore,

      score: qualityScore,
    },
  };
}

function createEmptyDiagnostics(
  totalCandidates: number
): ThemeQualityDiagnostics {
  return {
    totalCandidates,

    lowRelevanceRejected: 0,

    promotionalRejected: 0,

    unknownClassRejected: 0,

    lowTrustRejected: 0,

    taxonomyExcluded: 0,

    excludedCategoryRejected: 0,

    belowQualityRejected: 0,

    duplicateRejected: 0,

    diversityRejected: 0,

    directVoiceSelected: 0,

    editorialSelected: 0,

    fallbackSelected: 0,

    selectedCount: 0,
  };
}

function incrementDimensionCount(
  map: Map<string, number>,
  value?: string
): void {
  if (
    !isMeaningfulDimensionValue(
      value
    )
  ) {
    return;
  }

  const normalized =
    normalizeDimensionValue(value);

  map.set(
    normalized,
    (map.get(normalized) || 0) +
      1
  );
}

function exceedsDimensionLimit(
  map: Map<string, number>,
  value: string | undefined,
  maximum: number
): boolean {
  if (
    !isMeaningfulDimensionValue(
      value
    )
  ) {
    return false;
  }

  const normalized =
    normalizeDimensionValue(value);

  return (
    (map.get(normalized) || 0) >=
    maximum
  );
}

export function selectRepresentativeEvidence(
  findings: CanonicalFinding[],
  theme: ThemeDefinition,
  options: RepresentativeEvidenceOptions = {}
): RepresentativeEvidenceSelectionResult {
  const limit =
    options.limit ??
    THEME_QUALITY_CONFIG
      .maxRepresentativeEvidencePerTheme;

  const minimumRelevance =
    options.minimumRelevance ??
    THEME_QUALITY_CONFIG
      .minimumThemeEvidenceRelevance;

  const maximumPerPlatform =
    options.maximumPerPlatform ??
    THEME_QUALITY_CONFIG
      .maximumEvidencePerPlatform;

  const maximumPerSourceType =
    options.maximumPerSourceType ??
    THEME_QUALITY_CONFIG
      .maximumEvidencePerSourceType;

  const maximumPerCountry =
    options.maximumPerCountry ??
    THEME_QUALITY_CONFIG
      .maximumEvidencePerCountry;

  const maximumPerPersona =
    options.maximumPerPersona ??
    THEME_QUALITY_CONFIG
      .maximumEvidencePerPersona;

  const minimumDirectVoiceEvidence =
    options.minimumDirectVoiceEvidence ??
    THEME_QUALITY_CONFIG
      .minimumDirectVoiceEvidence;

  const maximumAuthoritativeEvidence =
    options.maximumAuthoritativeEvidence ??
    THEME_QUALITY_CONFIG
      .maximumAuthoritativeEvidence;

  const maximumCredibleContextEvidence =
    options.maximumCredibleContextEvidence ??
    THEME_QUALITY_CONFIG
      .maximumCredibleContextEvidence;

  const maximumFallbackEvidence =
    options.maximumFallbackEvidence ??
    THEME_QUALITY_CONFIG
      .maximumFallbackEvidence;

  const maximumConsumerNewsEvidence =
    options.maximumConsumerNewsEvidence ??
    THEME_QUALITY_CONFIG
      .maximumConsumerNewsEvidence;

  const maximumUnknownEvidence =
    options.maximumUnknownEvidence ??
    THEME_QUALITY_CONFIG
      .maximumUnknownEvidence;

  const diagnostics =
    createEmptyDiagnostics(
      findings.length
    );

  const candidates:
    CandidateEvidence[] = [];

  for (const finding of findings) {
    const intelligence =
      getEvidenceIntelligence(
        finding
      );

    if (
      intelligence &&
      PROMOTIONAL_EVIDENCE_CLASSES.has(
        intelligence.evidenceClass
      )
    ) {
      diagnostics.promotionalRejected +=
        1;

      continue;
    }

    if (
      intelligence?.evidenceClass ===
      "unknown"
    ) {
      diagnostics.unknownClassRejected +=
        1;

      continue;
    }

    if (
      intelligence &&
      LOW_TRUST_EVIDENCE_CLASSES.has(
        intelligence.evidenceClass
      )
    ) {
      diagnostics.lowTrustRejected +=
        1;

      continue;
    }

    const candidate =
      buildCandidate(
        finding,
        theme
      );

    if (!candidate) {
      diagnostics.taxonomyExcluded +=
        1;

      diagnostics.excludedCategoryRejected +=
        1;

      continue;
    }

    if (
      candidate.evidence
        .themeRelevanceScore <
      minimumRelevance
    ) {
      diagnostics.lowRelevanceRejected +=
        1;

      continue;
    }

    if (
      (
        candidate.evidence
          .evidenceQualityScore ??
        0
      ) <
      THEME_QUALITY_CONFIG
        .minimumEvidenceIntelligenceQualityScore
    ) {
      diagnostics.belowQualityRejected +=
        1;

      continue;
    }

    candidates.push(candidate);
  }

  candidates.sort(
    (first, second) =>
      second.evidence
        .qualityScore -
      first.evidence
        .qualityScore
  );

  const directVoice =
    candidates.filter(
      ({ evidence }) =>
        evidence.evidenceClass &&
        DIRECT_VOICE_EVIDENCE_CLASSES.has(
          evidence.evidenceClass
        )
    );

  const authoritative =
    candidates.filter(
      ({ evidence }) =>
        evidence.evidenceClass &&
        AUTHORITATIVE_EVIDENCE_CLASSES.has(
          evidence.evidenceClass
        )
    );

  const credibleContext =
    candidates.filter(
      ({ evidence }) =>
        evidence.evidenceClass &&
        CREDIBLE_CONTEXT_EVIDENCE_CLASSES.has(
          evidence.evidenceClass
        )
    );

  const fallback =
    candidates.filter(
      ({ evidence }) =>
        evidence.evidenceClass &&
        LIMITED_FALLBACK_EVIDENCE_CLASSES.has(
          evidence.evidenceClass
        )
    );

  const selected:
    RepresentativeEvidence[] = [];

  const seenFindingIds =
    new Set<string>();

  const seenQuotes =
    new Set<string>();

  const platformCounts =
    new Map<string, number>();

  const sourceTypeCounts =
    new Map<string, number>();

  const countryCounts =
    new Map<string, number>();

  const personaCounts =
    new Map<string, number>();

  let authoritativeCount = 0;

  let credibleContextCount = 0;

  let fallbackCount = 0;

  let consumerNewsCount = 0;

  let unknownCount = 0;

  function attemptSelection(
    candidate: CandidateEvidence
  ): boolean {
    const evidence =
      candidate.evidence;

    if (
      seenFindingIds.has(
        evidence.findingId
      )
    ) {
      return false;
    }

    if (
      !candidate.normalizedQuote ||
      seenQuotes.has(
        candidate.normalizedQuote
      )
    ) {
      diagnostics.duplicateRejected +=
        1;

      return false;
    }

    if (
      evidence.qualityScore <
      THEME_QUALITY_CONFIG
        .minimumClientFacingEvidenceScore
    ) {
      diagnostics.belowQualityRejected +=
        1;

      return false;
    }

    if (
      evidence.evidenceClass ===
        "consumer_news" &&
      consumerNewsCount >=
        maximumConsumerNewsEvidence
    ) {
      diagnostics.diversityRejected +=
        1;

      return false;
    }

    if (
      evidence.evidenceClass ===
        "unknown" &&
      unknownCount >=
        maximumUnknownEvidence
    ) {
      diagnostics.diversityRejected +=
        1;

      return false;
    }

    if (
      evidence.evidenceClass &&
      AUTHORITATIVE_EVIDENCE_CLASSES.has(
        evidence.evidenceClass
      ) &&
      authoritativeCount >=
        maximumAuthoritativeEvidence
    ) {
      diagnostics.diversityRejected +=
        1;

      return false;
    }

    if (
      evidence.evidenceClass &&
      CREDIBLE_CONTEXT_EVIDENCE_CLASSES.has(
        evidence.evidenceClass
      ) &&
      credibleContextCount >=
        maximumCredibleContextEvidence
    ) {
      diagnostics.diversityRejected +=
        1;

      return false;
    }

    if (
      evidence.evidenceClass &&
      LIMITED_FALLBACK_EVIDENCE_CLASSES.has(
        evidence.evidenceClass
      ) &&
      fallbackCount >=
        maximumFallbackEvidence
    ) {
      diagnostics.diversityRejected +=
        1;

      return false;
    }

    if (
      exceedsDimensionLimit(
        platformCounts,
        evidence.platform,
        maximumPerPlatform
      ) ||
      exceedsDimensionLimit(
        sourceTypeCounts,
        evidence.sourceType,
        maximumPerSourceType
      ) ||
      exceedsDimensionLimit(
        countryCounts,
        evidence.country,
        maximumPerCountry
      ) ||
      exceedsDimensionLimit(
        personaCounts,
        evidence.persona,
        maximumPerPersona
      )
    ) {
      diagnostics.diversityRejected +=
        1;

      return false;
    }

    seenFindingIds.add(
      evidence.findingId
    );

    seenQuotes.add(
      candidate.normalizedQuote
    );

    selected.push(evidence);

    incrementDimensionCount(
      platformCounts,
      evidence.platform
    );

    incrementDimensionCount(
      sourceTypeCounts,
      evidence.sourceType
    );

    incrementDimensionCount(
      countryCounts,
      evidence.country
    );

    incrementDimensionCount(
      personaCounts,
      evidence.persona
    );

    if (
      evidence.evidenceClass &&
      DIRECT_VOICE_EVIDENCE_CLASSES.has(
        evidence.evidenceClass
      )
    ) {
      diagnostics.directVoiceSelected +=
        1;
    } else if (
      evidence.evidenceClass &&
      (
        AUTHORITATIVE_EVIDENCE_CLASSES.has(
          evidence.evidenceClass
        ) ||
        CREDIBLE_CONTEXT_EVIDENCE_CLASSES.has(
          evidence.evidenceClass
        )
      )
    ) {
      diagnostics.editorialSelected +=
        1;
    } else {
      diagnostics.fallbackSelected +=
        1;
    }

    if (
      evidence.evidenceClass &&
      AUTHORITATIVE_EVIDENCE_CLASSES.has(
        evidence.evidenceClass
      )
    ) {
      authoritativeCount += 1;
    }

    if (
      evidence.evidenceClass &&
      CREDIBLE_CONTEXT_EVIDENCE_CLASSES.has(
        evidence.evidenceClass
      )
    ) {
      credibleContextCount += 1;
    }

    if (
      evidence.evidenceClass &&
      LIMITED_FALLBACK_EVIDENCE_CLASSES.has(
        evidence.evidenceClass
      )
    ) {
      fallbackCount += 1;
    }

    if (
      evidence.evidenceClass ===
      "consumer_news"
    ) {
      consumerNewsCount += 1;
    }

    if (
      evidence.evidenceClass ===
      "unknown"
    ) {
      unknownCount += 1;
    }

    return true;
  }

  let selectedDirectVoice = 0;

  for (const candidate of directVoice) {
    if (
      selected.length >= limit ||
      selectedDirectVoice >=
        minimumDirectVoiceEvidence
    ) {
      break;
    }

    if (
      attemptSelection(candidate)
    ) {
      selectedDirectVoice += 1;
    }
  }

  for (const candidate of directVoice) {
    if (selected.length >= limit) {
      break;
    }

    attemptSelection(candidate);
  }

  for (const candidate of authoritative) {
    if (selected.length >= limit) {
      break;
    }

    attemptSelection(candidate);
  }

  for (const candidate of credibleContext) {
    if (selected.length >= limit) {
      break;
    }

    attemptSelection(candidate);
  }

  for (const candidate of fallback) {
    if (selected.length >= limit) {
      break;
    }

    attemptSelection(candidate);
  }

  diagnostics.selectedCount =
    selected.length;

  return {
    evidence: selected,

    diagnostics,
  };
}