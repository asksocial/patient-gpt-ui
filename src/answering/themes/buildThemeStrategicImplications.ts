import type {
  EvidenceSourceCategory,
  ThemeConfidenceLabel,
  ThemeMatch,
  ThemeRelationship,
  ThemeStrategicImplication,
  ThemeStrategicPriority,
} from "./themeModels";

const SOURCE_LABELS: Record<
  EvidenceSourceCategory,
  string
> = {
  first_person: "first-person voices",
  caregiver_voice: "caregiver voices",
  provider_voice: "provider voices",
  community_voice: "community voices",
  research_or_science: "research and scientific sources",
  independent_editorial: "independent editorial sources",
  brand_owned: "brand-owned sources",
  clinic_marketing: "clinic marketing",
  retail_or_product: "retail and product sources",
  press_release: "press releases",
  event_or_conference: "event and conference sources",
  unknown: "unclassified sources",
};

const ACTIVATION_SOURCES = new Set<
  EvidenceSourceCategory
>([
  "first_person",
  "caregiver_voice",
  "provider_voice",
  "community_voice",
  "research_or_science",
  "independent_editorial",
]);

function percentLabel(
  value: number
): string {
  if (value > 0 && value < 1) {
    return "less than 1%";
  }

  return `${value}%`;
}

function eligiblePercent(
  theme: ThemeMatch
): number {
  return (
    theme.prevalence
      ?.eligiblePercent ??
    theme.percent
  );
}

function priorityForTheme(
  theme: ThemeMatch
): ThemeStrategicPriority {
  const support =
    theme.sourceAggregation;

  if (
    theme.confidenceLabel === "high" &&
    support?.triangulationLabel === "strong" &&
    eligiblePercent(theme) >= 20
  ) {
    return "high";
  }

  if (
    theme.confidenceLabel !== "insufficient" &&
    support?.isCrossSourceCorroborated
  ) {
    return "medium";
  }

  return "low";
}

function implicationConfidence(
  theme: ThemeMatch
): ThemeConfidenceLabel {
  const label =
    theme.sourceAggregation
      ?.triangulationLabel;

  if (
    theme.confidenceLabel === "high" &&
    label === "strong"
  ) {
    return "high";
  }

  if (
    theme.confidenceLabel !== "insufficient" &&
    (label === "strong" ||
      label === "moderate")
  ) {
    return "moderate";
  }

  if (theme.count > 0) {
    return "directional";
  }

  return "insufficient";
}

function strongestIndependentSource(
  theme: ThemeMatch
): EvidenceSourceCategory | undefined {
  const categories =
    theme.sourceAggregation
      ?.sourceCategories;

  if (!categories) {
    return undefined;
  }

  return (
    Object.entries(categories) as Array<
      [
        EvidenceSourceCategory,
        {
          weightedSharePercent:
            number;
        }
      ]
    >
  )
    .filter(([category]) =>
      ACTIVATION_SOURCES.has(
        category
      )
    )
    .sort(
      (first, second) =>
        second[1]
          .weightedSharePercent -
        first[1]
          .weightedSharePercent
    )[0]?.[0];
}

function buildPriorityImplication(
  theme: ThemeMatch
): ThemeStrategicImplication {
  const support =
    theme.sourceAggregation;

  const corroboration = support
    ? `${support.distinctIndependentSourceCategoryCount} independent source categories across ${support.distinctChannelCount} channels`
    : "the available qualifying evidence";

  return {
    implicationId:
      `priority:${theme.themeId}`,
    type: "priority_narrative",
    priority:
      priorityForTheme(theme),
    confidence:
      implicationConfidence(
        theme
      ),
    themeIds: [theme.themeId],
    statement:
      `${theme.label} is the leading supported narrative, appearing in ${percentLabel(
        eligiblePercent(theme)
      )} of qualifying discussion and supported by ${corroboration}.`,
    recommendedAction:
      `Use ${theme.label.toLowerCase()} as a primary planning lens while preserving the audience language and evidence boundaries shown in the underlying findings.`,
    evidenceBasis: [
      `${theme.count} matching findings`,
      `${percentLabel(
        eligiblePercent(theme)
      )} eligible prevalence`,
      `${support?.triangulationLabel || "unavailable"} cross-source support`,
      `${theme.confidenceLabel} theme confidence`,
    ],
  };
}

function buildRelationshipImplication(
  relationship:
    ThemeRelationship,
  themeMap: Map<
    string,
    ThemeMatch
  >
): ThemeStrategicImplication | null {
  const source = themeMap.get(
    relationship.sourceThemeId
  );
  const target = themeMap.get(
    relationship.targetThemeId
  );

  if (!source || !target) {
    return null;
  }

  if (
    relationship.confidence ===
      "directional" ||
    relationship.strength < 0.3
  ) {
    return null;
  }

  const relation =
    relationship.relationshipType ===
    "drives"
      ? "may help drive"
      : relationship.relationshipType ===
          "supports"
        ? "supports"
        : relationship.relationshipType ===
            "contrasts_with"
          ? "contrasts with"
          : "frequently appears alongside";

  return {
    implicationId:
      `relationship:${source.themeId}:${target.themeId}:${relationship.relationshipType}`,
    type: "integrated_narrative",
    priority:
      relationship.confidence ===
      "high"
        ? "high"
        : "medium",
    confidence:
      relationship.confidence,
    themeIds: [
      source.themeId,
      target.themeId,
    ],
    relationshipType:
      relationship.relationshipType,
    statement:
      `${source.label} ${relation} ${target.label.toLowerCase()}, indicating that audiences may interpret these themes as connected rather than isolated ideas.`,
    recommendedAction:
      `Test an integrated narrative that connects ${source.label.toLowerCase()} with ${target.label.toLowerCase()}, while measuring each theme separately to confirm the relationship.`,
    evidenceBasis: [
      `${relationship.relationshipType} relationship`,
      `${relationship.strength} relationship strength`,
      `${relationship.confidence} relationship confidence`,
      `${relationship.coOccurrenceCount || 0} co-occurring findings`,
    ],
  };
}

function buildAudienceImplication(
  theme: ThemeMatch
): ThemeStrategicImplication | null {
  const category =
    strongestIndependentSource(
      theme
    );

  const support =
    category
      ? theme.sourceAggregation
          ?.sourceCategories[
          category
        ]
      : undefined;

  if (
    !category ||
    !support ||
    support.count < 2
  ) {
    return null;
  }

  return {
    implicationId:
      `audience:${theme.themeId}:${category}`,
    type: "audience_activation",
    priority: "medium",
    confidence:
      implicationConfidence(
        theme
      ),
    themeIds: [theme.themeId],
    statement:
      `${SOURCE_LABELS[category]} provide the strongest independent evidence for ${theme.label.toLowerCase()}, accounting for ${support.weightedSharePercent}% of its weighted support.`,
    recommendedAction:
      `Prioritize ${SOURCE_LABELS[category]} when validating language, education needs, and engagement opportunities for this theme.`,
    evidenceBasis: [
      `${support.count} findings from ${SOURCE_LABELS[category]}`,
      `${support.weightedSharePercent}% weighted source share`,
      `${support.averageEvidenceQualityScore} average evidence-quality score`,
    ],
  };
}

function buildValidationImplication(
  theme: ThemeMatch
): ThemeStrategicImplication {
  const support =
    theme.sourceAggregation;

  return {
    implicationId:
      `validation:${theme.themeId}`,
    type: "evidence_validation",
    priority: "low",
    confidence: "directional",
    themeIds: [theme.themeId],
    statement:
      `${theme.label} is visible but is not yet independently corroborated${
        support
          ? ` (${support.triangulationLabel.replace(
              /_/g,
              "-"
            )} support)`
          : ""
      }.`,
    recommendedAction:
      `Treat ${theme.label.toLowerCase()} as a hypothesis and seek confirmation from additional independent source categories or channels before using it as a strategic premise.`,
    evidenceBasis: [
      `${theme.count} matching findings`,
      `${support?.distinctIndependentSourceCategoryCount || 0} independent source categories`,
      `${support?.distinctChannelCount || 0} channels`,
      `${theme.confidenceLabel} theme confidence`,
    ],
  };
}

function buildCommercialSafeguard(
  theme: ThemeMatch
): ThemeStrategicImplication | null {
  const commercialPercent =
    theme.sourceAggregation
      ?.commercialPercent || 0;

  if (commercialPercent < 35) {
    return null;
  }

  return {
    implicationId:
      `commercial:${theme.themeId}`,
    type: "commercial_safeguard",
    priority: "medium",
    confidence: "moderate",
    themeIds: [theme.themeId],
    statement:
      `${commercialPercent}% of findings supporting ${theme.label.toLowerCase()} come from commercially influenced sources, limiting the strength of audience-level inference.`,
    recommendedAction:
      `Validate ${theme.label.toLowerCase()} with independent patient, caregiver, provider, community, research, or editorial evidence before translating it into audience strategy.`,
    evidenceBasis: [
      `${commercialPercent}% commercial-source share`,
      `${theme.sourceAggregation?.independentPercent || 0}% independent-source share`,
      `${theme.sourceAggregation?.triangulationLabel || "unavailable"} cross-source support`,
    ],
  };
}

export function buildThemeStrategicImplications(
  themes: ThemeMatch[],
  relationships:
    ThemeRelationship[] = [],
  limit = 5
): ThemeStrategicImplication[] {
  if (themes.length === 0) {
    return [];
  }

  const eligible = themes.filter(
    (theme) =>
      theme.count > 0 &&
      theme.confidenceLabel !==
        "insufficient"
  );

  const themeMap = new Map(
    eligible.map((theme) => [
      theme.themeId,
      theme,
    ])
  );

  const implications:
    ThemeStrategicImplication[] = [];

  const corroborated =
    eligible.filter(
      (theme) =>
        theme.sourceAggregation
          ?.isCrossSourceCorroborated
    );

  if (corroborated[0]) {
    implications.push(
      buildPriorityImplication(
        corroborated[0]
      )
    );
  }

  const relationship =
    relationships
      .slice()
      .sort(
        (first, second) =>
          second.strength -
          first.strength
      )
      .map((item) =>
        buildRelationshipImplication(
          item,
          themeMap
        )
      )
      .filter(
        (
          item
        ): item is ThemeStrategicImplication =>
          Boolean(item)
      )[0];

  if (relationship) {
    implications.push(
      relationship
    );
  }

  const audience =
    corroborated
      .map(
        buildAudienceImplication
      )
      .find(Boolean);

  if (audience) {
    implications.push(
      audience
    );
  }

  for (const theme of eligible) {
    const safeguard =
      buildCommercialSafeguard(
        theme
      );

    if (safeguard) {
      implications.push(
        safeguard
      );
      break;
    }
  }

  const validationTheme =
    themes.find(
      (theme) =>
        theme.count > 0 &&
        !theme.sourceAggregation
          ?.isCrossSourceCorroborated
    );

  if (validationTheme) {
    implications.push(
      buildValidationImplication(
        validationTheme
      )
    );
  }

  return implications
    .filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.implicationId ===
            item.implicationId
        ) === index
    )
    .slice(0, limit);
}
