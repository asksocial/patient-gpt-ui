import {
  assembleAnswer,
} from "../../answering/assembleAnswer";
import type {
  CanonicalFinding,
} from "../../answering/models/finding";
import type {
  AnswerIntent,
} from "../../answering/templates/templateRegistry";
import {
  TEMPLATE_REGISTRY,
} from "../../answering/templates/templateRegistry";
import {
  assignThemesToFindings,
} from "../../answering/themes/assignThemes";
import {
  aggregateThemes,
} from "../../answering/themes/aggregateThemes";
import {
  detectThemeRelationships,
} from "../../answering/themes/detectThemeRelationships";
import {
  buildThemeStrategicImplications,
} from "../../answering/themes/buildThemeStrategicImplications";
import {
  buildThemeLongitudinalTracking,
} from "../../answering/themes/buildThemeLongitudinalTracking";
import {
  getRankingProfile,
} from "../../answering/ranking/getRankingProfile";
import {
  rankFindings,
} from "../../answering/ranking/rankFindings";
import {
  enrichFindingsWithEvidenceIntelligence,
} from "../../answering/evidence";
import {
  buildThemeKnowledgeSnapshot,
} from "../../answering/knowledge";
import {
  buildExecutiveIntelligenceBrief,
} from "../../answering/executive";

const MAX_FINDINGS_FOR_RENDERING =
  50;

function classifyIntent(
  question: string
): AnswerIntent {
  const normalizedQuestion =
    question
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  if (
    normalizedQuestion.includes(
      "growing interest"
    ) ||
    normalizedQuestion.includes(
      "interest in"
    ) ||
    normalizedQuestion.includes(
      "market interest"
    ) ||
    normalizedQuestion.includes(
      "demand"
    ) ||
    normalizedQuestion.includes(
      "buzz"
    ) ||
    normalizedQuestion.includes(
      "trend"
    ) ||
    normalizedQuestion.includes(
      "trending"
    ) ||
    normalizedQuestion.includes(
      "why are people interested"
    ) ||
    normalizedQuestion.includes(
      "what is driving interest"
    ) ||
    normalizedQuestion.includes(
      "what is driving growing interest"
    )
  ) {
    return "market_interest";
  }

  if (
    normalizedQuestion.includes(
      "education barrier"
    ) ||
    normalizedQuestion.includes(
      "education barriers"
    ) ||
    normalizedQuestion.includes(
      "awareness barrier"
    ) ||
    normalizedQuestion.includes(
      "awareness barriers"
    ) ||
    normalizedQuestion.includes(
      "knowledge gap"
    ) ||
    normalizedQuestion.includes(
      "knowledge gaps"
    ) ||
    normalizedQuestion.includes(
      "education gap"
    ) ||
    normalizedQuestion.includes(
      "education gaps"
    ) ||
    normalizedQuestion.includes(
      "confusion"
    ) ||
    normalizedQuestion.includes(
      "confused"
    ) ||
    normalizedQuestion.includes(
      "misunderstanding"
    ) ||
    normalizedQuestion.includes(
      "misinformation"
    ) ||
    normalizedQuestion.includes(
      "skepticism"
    ) ||
    normalizedQuestion.includes(
      "skeptical"
    )
  ) {
    return "education_barriers";
  }

  if (
    normalizedQuestion.includes(
      "competitive alternative"
    ) ||
    normalizedQuestion.includes(
      "competitive alternatives"
    ) ||
    normalizedQuestion.includes(
      "alternative"
    ) ||
    normalizedQuestion.includes(
      "alternatives"
    ) ||
    normalizedQuestion.includes(
      "compare"
    ) ||
    normalizedQuestion.includes(
      "comparison"
    ) ||
    normalizedQuestion.includes(
      "compared against"
    ) ||
    normalizedQuestion.includes(
      "versus"
    ) ||
    normalizedQuestion.includes(
      " vs "
    ) ||
    normalizedQuestion.includes(
      "instead of"
    )
  ) {
    return "competitive_alternatives";
  }

  if (
    normalizedQuestion.includes(
      "adoption driver"
    ) ||
    normalizedQuestion.includes(
      "adoption drivers"
    ) ||
    normalizedQuestion.includes(
      "drive adoption"
    ) ||
    normalizedQuestion.includes(
      "driving adoption"
    ) ||
    normalizedQuestion.includes(
      "what drives adoption"
    ) ||
    normalizedQuestion.includes(
      "motivates adoption"
    ) ||
    normalizedQuestion.includes(
      "motivate adoption"
    )
  ) {
    return "adoption_drivers";
  }

  if (
    normalizedQuestion.includes(
      "market opportunity"
    ) ||
    normalizedQuestion.includes(
      "market opportunities"
    ) ||
    normalizedQuestion.includes(
      "opportunity"
    ) ||
    normalizedQuestion.includes(
      "opportunities"
    ) ||
    normalizedQuestion.includes(
      "white space"
    ) ||
    normalizedQuestion.includes(
      "whitespace"
    ) ||
    normalizedQuestion.includes(
      "unmet market need"
    ) ||
    normalizedQuestion.includes(
      "unmet market needs"
    )
  ) {
    return "market_opportunities";
  }

  if (
    normalizedQuestion.includes(
      "day-to-day impact"
    ) ||
    normalizedQuestion.includes(
      "day to day impact"
    ) ||
    normalizedQuestion.includes(
      "quality of life"
    ) ||
    normalizedQuestion.includes(
      "qol"
    ) ||
    normalizedQuestion.includes(
      "symptom burden"
    ) ||
    normalizedQuestion.includes(
      "biggest symptoms"
    ) ||
    normalizedQuestion.includes(
      "most significant symptoms"
    ) ||
    normalizedQuestion.includes(
      "what symptoms"
    ) ||
    normalizedQuestion.includes(
      "symptom"
    ) ||
    normalizedQuestion.includes(
      "symptoms"
    ) ||
    normalizedQuestion.includes(
      "burden"
    )
  ) {
    return "symptom_qol_burden";
  }

  if (
    normalizedQuestion.includes(
      "treatment decision"
    ) ||
    normalizedQuestion.includes(
      "treatment decisions"
    ) ||
    normalizedQuestion.includes(
      "treatment choice"
    ) ||
    normalizedQuestion.includes(
      "treatment choices"
    ) ||
    normalizedQuestion.includes(
      "why do patients choose"
    ) ||
    normalizedQuestion.includes(
      "why are patients choosing"
    ) ||
    normalizedQuestion.includes(
      "treatment journey"
    ) ||
    normalizedQuestion.includes(
      "choose"
    ) ||
    normalizedQuestion.includes(
      "choice"
    ) ||
    normalizedQuestion.includes(
      "preference"
    ) ||
    normalizedQuestion.includes(
      "switch"
    ) ||
    normalizedQuestion.includes(
      "switching"
    )
  ) {
    return "treatment_decision_drivers";
  }

  if (
    normalizedQuestion.includes(
      "diagnosis"
    ) ||
    normalizedQuestion.includes(
      "diagnostic"
    ) ||
    normalizedQuestion.includes(
      "misdiagnosed"
    ) ||
    normalizedQuestion.includes(
      "misdiagnosis"
    ) ||
    normalizedQuestion.includes(
      "time to diagnosis"
    ) ||
    normalizedQuestion.includes(
      "barriers to diagnosis"
    ) ||
    normalizedQuestion.includes(
      "diagnosis barrier"
    ) ||
    normalizedQuestion.includes(
      "diagnosis barriers"
    ) ||
    normalizedQuestion.includes(
      "access barrier"
    ) ||
    normalizedQuestion.includes(
      "access barriers"
    ) ||
    normalizedQuestion.includes(
      "diagnostic delay"
    )
  ) {
    return "diagnosis_barriers";
  }

  if (
    normalizedQuestion.includes(
      "side effect"
    ) ||
    normalizedQuestion.includes(
      "side effects"
    ) ||
    normalizedQuestion.includes(
      "adverse event"
    ) ||
    normalizedQuestion.includes(
      "adverse events"
    ) ||
    normalizedQuestion.includes(
      "safety"
    ) ||
    normalizedQuestion.includes(
      "tolerability"
    ) ||
    normalizedQuestion.includes(
      "risk"
    ) ||
    normalizedQuestion.includes(
      "risks"
    )
  ) {
    return "safety_signals";
  }

  if (
    normalizedQuestion.includes(
      "market landscape"
    ) ||
    normalizedQuestion.includes(
      "market intelligence"
    ) ||
    normalizedQuestion.includes(
      "country"
    ) ||
    normalizedQuestion.includes(
      "countries"
    ) ||
    normalizedQuestion.includes(
      "geography"
    ) ||
    normalizedQuestion.includes(
      "geographic"
    ) ||
    normalizedQuestion.includes(
      "regional"
    ) ||
    normalizedQuestion.includes(
      "region"
    ) ||
    normalizedQuestion.includes(
      "platform"
    ) ||
    normalizedQuestion.includes(
      "channel"
    )
  ) {
    return "market_landscape";
  }

  return "general";
}

function filterFindingsByTemplate(
  findings: CanonicalFinding[],
  intent: AnswerIntent
): CanonicalFinding[] {
  const template =
    TEMPLATE_REGISTRY[intent] ||
    TEMPLATE_REGISTRY.general;

  return findings
    .filter(
      (finding) =>
        !(finding as any)
          .duplicateOf
    )
    .filter((finding) => {
      const findingType =
        String(
          (finding as any)
            .findingType ||
            ""
        );

      return template
        .allowedFindingTypes
        .includes(
          findingType as any
        );
    })
    .filter((finding) => {
      const findingType =
        String(
          (finding as any)
            .findingType ||
            ""
        );

      return !(
        template
          .disallowedFindingTypes ||
        []
      ).includes(
        findingType as any
      );
    });
}

function countFindingTypes(
  findings: CanonicalFinding[]
): Record<string, number> {
  return findings.reduce<
    Record<string, number>
  >(
    (
      counts,
      finding
    ) => {
      const findingType =
        String(
          (finding as any)
            .findingType ||
            "unknown"
        );

      counts[findingType] =
        (
          counts[
            findingType
          ] || 0
        ) + 1;

      return counts;
    },
    {}
  );
}

function countThemes(
  findings: CanonicalFinding[]
): Record<string, number> {
  const counts: Record<
    string,
    number
  > = {};

  for (
    const finding of findings
  ) {
    const themes =
      Array.isArray(
        (finding as any)
          .themes
      )
        ? (finding as any)
            .themes
        : [];

    for (
      const theme of themes
    ) {
      const key =
        String(
          theme || ""
        ).trim();

      if (!key) {
        continue;
      }

      counts[key] =
        (counts[key] || 0) +
        1;
    }
  }

  return counts;
}

function countEvidenceField(
  findings: CanonicalFinding[],
  field: string
): Record<string, number> {
  const counts: Record<
    string,
    number
  > = {};

  for (
    const finding of findings
  ) {
    const intelligence =
      (finding as any)
        .evidenceIntelligence;

    const value =
      String(
        intelligence?.[
          field
        ] || ""
      ).trim();

    if (!value) {
      continue;
    }

    counts[value] =
      (counts[value] || 0) +
      1;
  }

  return counts;
}

function countOntologyField(
  findings: CanonicalFinding[],
  field: string
): Record<string, number> {
  const counts: Record<
    string,
    number
  > = {};

  for (
    const finding of findings
  ) {
    const ontology =
      (finding as any)
        .evidenceIntelligence
        ?.ontology;

    const value =
      String(
        ontology?.[
          field
        ] || ""
      ).trim();

    if (!value) {
      continue;
    }

    counts[value] =
      (counts[value] || 0) +
      1;
  }

  return counts;
}

function countOntologyCandidates(
  findings: CanonicalFinding[],
  field:
    | "authorCandidates"
    | "intentCandidates"
    | "publicationCandidates",
  limitPerFinding = 3
): Record<string, number> {
  const counts: Record<
    string,
    number
  > = {};

  for (
    const finding of findings
  ) {
    const ontology =
      (finding as any)
        .evidenceIntelligence
        ?.ontology;

    const candidates =
      Array.isArray(
        ontology?.[field]
      )
        ? ontology[field]
        : [];

    for (
      const candidate of candidates.slice(
        0,
        limitPerFinding
      )
    ) {
      const value =
        String(
          candidate?.value ||
            ""
        ).trim();

      if (!value) {
        continue;
      }

      counts[value] =
        (counts[value] || 0) +
        1;
    }
  }

  return counts;
}

function calculateAverageOntologyConfidence(
  findings: CanonicalFinding[]
): number {
  const values =
    findings
      .map((finding) =>
        Number(
          (finding as any)
            .evidenceIntelligence
            ?.ontology
            ?.overallConfidence
        )
      )
      .filter(
        (
          value
        ): value is number =>
          Number.isFinite(value)
      );

  if (
    values.length === 0
  ) {
    return 0;
  }

  const average =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length;

  return Number(
    average.toFixed(2)
  );
}

function countLowConfidenceOntologies(
  findings: CanonicalFinding[],
  threshold = 0.4
): number {
  return findings.filter(
    (finding) => {
      const confidence =
        Number(
          (finding as any)
            .evidenceIntelligence
            ?.ontology
            ?.overallConfidence
        );

      return (
        Number.isFinite(
          confidence
        ) &&
        confidence <
          threshold
      );
    }
  ).length;
}

function countUnknownOntologyDimensions(
  findings: CanonicalFinding[]
): {
  unknownAuthors: number;
  unknownIntents: number;
  unknownPublications: number;
  unknownRoles: number;
} {
  let unknownAuthors = 0;
  let unknownIntents = 0;
  let unknownPublications = 0;
  let unknownRoles = 0;

  for (
    const finding of findings
  ) {
    const ontology =
      (finding as any)
        .evidenceIntelligence
        ?.ontology;

    if (
      ontology
        ?.authorIdentity ===
      "unknown"
    ) {
      unknownAuthors += 1;
    }

    if (
      ontology
        ?.communicationIntent ===
      "unknown"
    ) {
      unknownIntents += 1;
    }

    if (
      ontology
        ?.publicationArchetype ===
      "unknown"
    ) {
      unknownPublications +=
        1;
    }

    if (
      ontology
        ?.evidenceRole ===
      "noise_or_low_trust"
    ) {
      unknownRoles += 1;
    }
  }

  return {
    unknownAuthors,
    unknownIntents,
    unknownPublications,
    unknownRoles,
  };
}

function getTherapeuticArea(
  findings: CanonicalFinding[]
): string | undefined {
  for (
    const finding of findings
  ) {
    const value =
      finding as any;

    const therapeuticArea =
      value
        .therapeuticArea ||
      value.diseaseArea ||
      value.profileId;

    if (
      typeof therapeuticArea ===
        "string" &&
      therapeuticArea.trim()
    ) {
      return therapeuticArea.trim();
    }
  }

  return undefined;
}

function determineLiveDataStatus(
  findings: CanonicalFinding[]
):
  | "not_found"
  | "extends"
  | "only" {
  if (
    findings.length === 0
  ) {
    return "not_found";
  }

  const sourceTypes =
    new Set(
      findings
        .map((finding) =>
          String(
            (finding as any)
              .sourceType ||
              (
                finding as any
              )
                .structuredData
                ?.sourceType ||
              (
                finding as any
              )
                .evidence?.[0]
                ?.sourceType ||
              ""
          )
            .toLowerCase()
            .trim()
        )
        .filter(Boolean)
    );

  const hasLive =
    sourceTypes.has(
      "live"
    ) ||
    sourceTypes.has(
      "meltwater"
    );

  const hasCurated =
    sourceTypes.has(
      "curated"
    ) ||
    sourceTypes.has(
      "pdf"
    ) ||
    sourceTypes.has(
      "pptx"
    ) ||
    sourceTypes.has(
      "docx"
    );

  if (
    hasLive &&
    !hasCurated
  ) {
    return "only";
  }

  if (
    !hasLive &&
    !hasCurated
  ) {
    return "not_found";
  }

  return "extends";
}

export function askSocial(
  question: string,
  rawCards: CanonicalFinding[]
) {
  const intent =
    classifyIntent(
      question
    );

  const therapeuticArea =
    getTherapeuticArea(
      rawCards
    );

  const templateFilteredCards =
    filterFindingsByTemplate(
      rawCards,
      intent
    );

  /**
   * Evidence Intelligence, Social Evidence Recovery,
   * and the Evidence Ontology Layer run across the full
   * template-filtered dataset before theme assignment,
   * aggregation, relationship detection, ranking, or
   * answer rendering.
   */
  const evidenceEnrichedCards =
    enrichFindingsWithEvidenceIntelligence(
      templateFilteredCards
    );

  const themedCards =
    assignThemesToFindings(
      evidenceEnrichedCards,
      therapeuticArea
    );

  const themeSummary =
    aggregateThemes(
      themedCards,
      therapeuticArea
    );

  const themeRelationships =
    detectThemeRelationships(
      themedCards,
      themeSummary,
      therapeuticArea
    );

  const themeStrategicImplications =
    buildThemeStrategicImplications(
      themeSummary,
      themeRelationships
    );

  const themeLongitudinalTracking =
    buildThemeLongitudinalTracking(
      themedCards,
      themeSummary
    );

  const knowledgeSnapshot =
    buildThemeKnowledgeSnapshot({
      therapeuticArea:
        therapeuticArea ||
        "unknown",
      themes: themeSummary,
      relationships:
        themeRelationships,
      strategicImplications:
        themeStrategicImplications,
      longitudinalTracking:
        themeLongitudinalTracking,
      sourceQuery: question,
    });

  const executiveIntelligence =
    buildExecutiveIntelligenceBrief({
      snapshot:
        knowledgeSnapshot,
    });

  const rankingProfile =
    getRankingProfile(
      therapeuticArea
    );

  const rankedCards =
    rankFindings({
      findings:
        themedCards,

      intent,

      profile:
        rankingProfile,

      limit:
        MAX_FINDINGS_FOR_RENDERING,
    });

  const liveDataStatus =
    determineLiveDataStatus(
      rankedCards
    );

  const ontologyUnknownCounts =
    countUnknownOntologyDimensions(
      evidenceEnrichedCards
    );

  const rankedOntologyUnknownCounts =
    countUnknownOntologyDimensions(
      rankedCards
    );

  const debug = {
    rawCount:
      rawCards.length,

    normalizedCount:
      rawCards.length,

    exactDedupedCount:
      rawCards.length,

    clusteredCount:
      rawCards.length,

    representativeCount:
      rawCards.length,

    templateFilteredCount:
      templateFilteredCards.length,

    evidenceEnrichedCount:
      evidenceEnrichedCards.length,

    themedCount:
      themedCards.length,

    rankedCount:
      rankedCards.length,

    therapeuticArea:
      therapeuticArea ||
      null,

    questionIntent:
      intent,

    templateUsed:
      intent,

    rankingProfileUsed:
      rankingProfile.profileId,

    rawFindingTypeCounts:
      countFindingTypes(
        rawCards
      ),

    templateFilteredFindingTypeCounts:
      countFindingTypes(
        templateFilteredCards
      ),

    themedFindingTypeCounts:
      countFindingTypes(
        themedCards
      ),

    rankedFindingTypeCounts:
      countFindingTypes(
        rankedCards
      ),

    themeCounts:
      countThemes(
        themedCards
      ),

    themeRelationshipCount:
      themeRelationships.length,

    /**
     * Core Evidence Intelligence diagnostics.
     */
    evidenceClassCounts:
      countEvidenceField(
        evidenceEnrichedCards,
        "evidenceClass"
      ),

    evidenceVoiceCounts:
      countEvidenceField(
        evidenceEnrichedCards,
        "voice"
      ),

    publicationTypeCounts:
      countEvidenceField(
        evidenceEnrichedCards,
        "publicationType"
      ),

    commercialIntentCounts:
      countEvidenceField(
        evidenceEnrichedCards,
        "commercialIntent"
      ),

    researchCredibilityCounts:
      countEvidenceField(
        evidenceEnrichedCards,
        "researchCredibility"
      ),

    evidenceQualityBandCounts:
      countEvidenceField(
        evidenceEnrichedCards,
        "qualityBand"
      ),

    rankedEvidenceClassCounts:
      countEvidenceField(
        rankedCards,
        "evidenceClass"
      ),

    rankedEvidenceVoiceCounts:
      countEvidenceField(
        rankedCards,
        "voice"
      ),

    rankedPublicationTypeCounts:
      countEvidenceField(
        rankedCards,
        "publicationType"
      ),

    rankedCommercialIntentCounts:
      countEvidenceField(
        rankedCards,
        "commercialIntent"
      ),

    rankedResearchCredibilityCounts:
      countEvidenceField(
        rankedCards,
        "researchCredibility"
      ),

    rankedEvidenceQualityBandCounts:
      countEvidenceField(
        rankedCards,
        "qualityBand"
      ),

    /**
     * Evidence Ontology diagnostics across the complete
     * template-filtered and enriched dataset.
     */
    ontologyAuthorIdentityCounts:
      countOntologyField(
        evidenceEnrichedCards,
        "authorIdentity"
      ),

    ontologyCommunicationIntentCounts:
      countOntologyField(
        evidenceEnrichedCards,
        "communicationIntent"
      ),

    ontologyPublicationArchetypeCounts:
      countOntologyField(
        evidenceEnrichedCards,
        "publicationArchetype"
      ),

    ontologyAuthorityLevelCounts:
      countOntologyField(
        evidenceEnrichedCards,
        "authorityLevel"
      ),

    ontologyEvidenceRoleCounts:
      countOntologyField(
        evidenceEnrichedCards,
        "evidenceRole"
      ),

    ontologyDerivedEvidenceClassCounts:
      countOntologyField(
        evidenceEnrichedCards,
        "derivedEvidenceClass"
      ),

    ontologyAuthorCandidateCounts:
      countOntologyCandidates(
        evidenceEnrichedCards,
        "authorCandidates"
      ),

    ontologyIntentCandidateCounts:
      countOntologyCandidates(
        evidenceEnrichedCards,
        "intentCandidates"
      ),

    ontologyPublicationCandidateCounts:
      countOntologyCandidates(
        evidenceEnrichedCards,
        "publicationCandidates"
      ),

    ontologyAverageConfidence:
      calculateAverageOntologyConfidence(
        evidenceEnrichedCards
      ),

    ontologyLowConfidenceCount:
      countLowConfidenceOntologies(
        evidenceEnrichedCards
      ),

    ontologyUnknownAuthorCount:
      ontologyUnknownCounts
        .unknownAuthors,

    ontologyUnknownIntentCount:
      ontologyUnknownCounts
        .unknownIntents,

    ontologyUnknownPublicationCount:
      ontologyUnknownCounts
        .unknownPublications,

    ontologyNoiseOrLowTrustRoleCount:
      ontologyUnknownCounts
        .unknownRoles,

    /**
     * Ontology diagnostics after evidence-aware ranking.
     */
    rankedOntologyAuthorIdentityCounts:
      countOntologyField(
        rankedCards,
        "authorIdentity"
      ),

    rankedOntologyCommunicationIntentCounts:
      countOntologyField(
        rankedCards,
        "communicationIntent"
      ),

    rankedOntologyPublicationArchetypeCounts:
      countOntologyField(
        rankedCards,
        "publicationArchetype"
      ),

    rankedOntologyAuthorityLevelCounts:
      countOntologyField(
        rankedCards,
        "authorityLevel"
      ),

    rankedOntologyEvidenceRoleCounts:
      countOntologyField(
        rankedCards,
        "evidenceRole"
      ),

    rankedOntologyDerivedEvidenceClassCounts:
      countOntologyField(
        rankedCards,
        "derivedEvidenceClass"
      ),

    rankedOntologyAverageConfidence:
      calculateAverageOntologyConfidence(
        rankedCards
      ),

    rankedOntologyLowConfidenceCount:
      countLowConfidenceOntologies(
        rankedCards
      ),

    rankedOntologyUnknownAuthorCount:
      rankedOntologyUnknownCounts
        .unknownAuthors,

    rankedOntologyUnknownIntentCount:
      rankedOntologyUnknownCounts
        .unknownIntents,

    rankedOntologyUnknownPublicationCount:
      rankedOntologyUnknownCounts
        .unknownPublications,

    rankedOntologyNoiseOrLowTrustRoleCount:
      rankedOntologyUnknownCounts
        .unknownRoles,

    themeSummary,

    themeRelationships,

    themeStrategicImplications,

    themeLongitudinalTracking,

    knowledgeSnapshotKey:
      knowledgeSnapshot.snapshotKey,

    executiveBriefId:
      executiveIntelligence.briefId,
  };

  const answer =
    assembleAnswer({
      question,

      intent,

      findings:
        rankedCards,

      themeSummary,

      themeRelationships,

      themeLongitudinalTracking,

      debug,

      liveDataStatus,
    });

  return {
    question,

    intent,

    therapeuticArea:
      therapeuticArea ||
      null,

    themeSummary,

    themeRelationships,

    themeStrategicImplications,

    themeLongitudinalTracking,

    knowledgeSnapshot,

    executiveIntelligence,

    answer,
  };
}
