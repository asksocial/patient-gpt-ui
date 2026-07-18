import { CanonicalFinding } from "../models/finding";
import type {
  EvidenceClass,
} from "../evidence/types";
import {
  RepresentativeEvidence,
  ThemeEvidenceScore,
} from "./themeModels";
import {
  filterMeaningfulDimensionValues,
} from "./dimensionQualityConfig";

const DIRECT_VOICE_CLASSES =
  new Set<EvidenceClass>([
    "patient_conversation",
    "caregiver_conversation",
    "provider_conversation",
  ]);

const CREDIBLE_CONTEXT_CLASSES =
  new Set<EvidenceClass>([
    "research_journal",
    "clinical_study",
    "government_or_regulator",
    "medical_society",
    "advocacy_organization",
    "healthcare_trade_publication",
    "healthcare_news",
  ]);

const PROMOTIONAL_CLASSES =
  new Set<EvidenceClass>([
    "corporate_pr",
    "clinic_marketing",
    "retail_or_product",
    "sponsored_content",
  ]);

function clamp(
  value: number,
  minimum = 0,
  maximum = 100
): number {
  return Math.max(
    minimum,
    Math.min(maximum, value)
  );
}

function toArray(
  value: unknown
): unknown[] {
  if (!value) return [];

  return Array.isArray(value)
    ? value
    : [value];
}

function countUniqueValues(
  findings: CanonicalFinding[],
  pluralField: string,
  singularField?: string
): number {
  const rawValues: unknown[] = [];

  for (const finding of findings) {
    const f = finding as any;

    rawValues.push(
      ...toArray(f[pluralField])
    );

    if (singularField) {
      rawValues.push(
        ...toArray(
          f[singularField]
        )
      );
    }
  }

  return filterMeaningfulDimensionValues(
    rawValues
  ).length;
}

function averageConfidence(
  findings: CanonicalFinding[]
): number {
  if (findings.length === 0) {
    return 0;
  }

  const values = findings.map(
    (finding) => {
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
  );

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length
  );
}

function averageEvidenceQuality(
  evidence: RepresentativeEvidence[]
): number {
  if (evidence.length === 0) {
    return 0;
  }

  const total = evidence.reduce(
    (sum, item) =>
      sum +
      Math.max(
        0,
        Math.min(
          100,
          item.evidenceQualityScore ??
            item.qualityScore
        )
      ),
    0
  );

  return total / evidence.length;
}

function scoreDiversityCount(
  uniqueCount: number,
  saturationPoint: number
): number {
  if (saturationPoint <= 0) {
    return 0;
  }

  return clamp(
    (uniqueCount /
      saturationPoint) *
      100
  );
}

function calculateEvidenceCompositionScore(
  findings: CanonicalFinding[]
): number {
  if (findings.length === 0) {
    return 0;
  }

  let directVoiceCount = 0;
  let credibleContextCount = 0;
  let promotionalCount = 0;

  for (const finding of findings) {
    const evidenceClass =
      (finding as any)
        .evidenceIntelligence
        ?.evidenceClass as
        | EvidenceClass
        | undefined;

    if (!evidenceClass) {
      continue;
    }

    if (
      DIRECT_VOICE_CLASSES.has(
        evidenceClass
      )
    ) {
      directVoiceCount += 1;
    }

    if (
      CREDIBLE_CONTEXT_CLASSES.has(
        evidenceClass
      )
    ) {
      credibleContextCount += 1;
    }

    if (
      PROMOTIONAL_CLASSES.has(
        evidenceClass
      )
    ) {
      promotionalCount += 1;
    }
  }

  const total =
    findings.length;

  const directVoiceProportion =
    directVoiceCount / total;

  const credibleContextProportion =
    credibleContextCount / total;

  const lowPromotionalProportion =
    1 -
    promotionalCount / total;

  return clamp(
    directVoiceProportion * 100 * 0.4 +
      credibleContextProportion *
        100 *
        0.35 +
      lowPromotionalProportion *
        100 *
        0.25
  );
}

export function scoreThemeEvidence(
  findings: CanonicalFinding[],
  representativeEvidence:
    RepresentativeEvidence[] = []
): ThemeEvidenceScore {
  if (findings.length === 0) {
    return {
      supportScore: 0,
      diversityScore: 0,
      confidenceScore: 0,
      qualityScore: 0,
      evidenceCompositionScore: 0,
      totalScore: 0,
    };
  }

  const supportScore = clamp(
    (findings.length / 50) * 100
  );

  const platformCount =
    countUniqueValues(
      findings,
      "platforms",
      "platform"
    );

  const countryCount =
    countUniqueValues(
      findings,
      "countries",
      "country"
    );

  const personaCount =
    countUniqueValues(
      findings,
      "personas",
      "persona"
    );

  const sourceTypeCount =
    countUniqueValues(
      findings,
      "sourceTypes",
      "sourceType"
    );

  const platformDiversity =
    scoreDiversityCount(
      platformCount,
      5
    );

  const countryDiversity =
    scoreDiversityCount(
      countryCount,
      6
    );

  const personaDiversity =
    scoreDiversityCount(
      personaCount,
      4
    );

  const sourceTypeDiversity =
    scoreDiversityCount(
      sourceTypeCount,
      3
    );

  const diversityScore = clamp(
    platformDiversity * 0.3 +
      countryDiversity * 0.25 +
      personaDiversity * 0.2 +
      sourceTypeDiversity * 0.25
  );

  const confidenceScore = clamp(
    averageConfidence(findings) *
      100
  );

  const qualityScore = clamp(
    averageEvidenceQuality(
      representativeEvidence
    )
  );

  const evidenceCompositionScore =
    calculateEvidenceCompositionScore(
      findings
    );

  const totalScore = clamp(
    supportScore * 0.3 +
      diversityScore * 0.2 +
      confidenceScore * 0.15 +
      qualityScore * 0.2 +
      evidenceCompositionScore *
        0.15
  );

  return {
    supportScore:
      Math.round(supportScore),

    diversityScore:
      Math.round(diversityScore),

    confidenceScore:
      Math.round(confidenceScore),

    qualityScore:
      Math.round(qualityScore),

    evidenceCompositionScore:
      Math.round(
        evidenceCompositionScore
      ),

    totalScore:
      Math.round(totalScore),
  };
}