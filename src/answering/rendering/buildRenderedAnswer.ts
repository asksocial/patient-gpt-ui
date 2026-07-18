import {
  CanonicalFinding,
} from "../models/finding";
import {
  RepresentativeEvidence,
  ThemeMatch,
  ThemeLongitudinalTracking,
  ThemeLongitudinalSignal,
  ThemeRelationship,
  ThemeStrategicImplication,
} from "../themes/themeModels";
import {
  buildThemeAnswerContext,
} from "../themes/buildThemeAnswerContext";

export type RenderedSection = {
  key: string;
  title: string;
  bullets?: string[];
  text?: string;
  findings?: CanonicalFinding[];
};

export type RenderedAnswer = {
  directAnswer: string;
  sections: RenderedSection[];
  usedFindingIds: string[];
  usedClaims: string[];

  liveDataStatus:
    | "not_found"
    | "extends"
    | "only";

  debug: any;
};

const LOW_SAMPLE_THRESHOLD =
  20;

const THEME_FIRST_INTENTS =
  new Set<string>([
    "market_interest",
    "education_barriers",
    "competitive_alternatives",
    "adoption_drivers",
    "market_opportunities",
    "market_landscape",
  ]);

function titleCase(
  value: string
): string {
  return value
    .split("_")
    .filter(Boolean)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function sentenceCase(
  value: string
): string {
  if (!value) return "";

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function joinList(
  values: string[],
  maximum = 3
): string {
  const items = Array.from(
    new Set(
      values.filter(Boolean)
    )
  ).slice(0, maximum);

  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items
    .slice(0, -1)
    .join(", ")}, and ${
    items[items.length - 1]
  }`;
}

function percentage(
  count: number,
  total: number
): number {
  if (total === 0) return 0;

  return Math.round(
    (count / total) * 100
  );
}

function formatThemePercent(
  theme: ThemeMatch
): string {
  const percentValue =
    theme.prevalence
      ?.eligiblePercent ??
    theme.percent;

  if (
    theme.count > 0 &&
    percentValue < 1
  ) {
    return "<1%";
  }

  return `${percentValue}%`;
}

function getEvidenceLabel(
  evidence:
    RepresentativeEvidence
): string {
  switch (
    evidence.evidenceClass
  ) {
    case "patient_conversation":
      return "Representative patient conversation";

    case "caregiver_conversation":
      return "Representative caregiver conversation";

    case "provider_conversation":
      return "Representative provider perspective";

    case "research_journal":
      return "Supporting research evidence";

    case "clinical_study":
      return "Supporting clinical-study evidence";

    case "government_or_regulator":
      return "Supporting government or regulatory evidence";

    case "medical_society":
      return "Supporting medical-society evidence";

    case "healthcare_trade_publication":
      return "Supporting healthcare trade reporting";

    case "healthcare_news":
      return "Supporting healthcare reporting";

    case "youtube_review":
      return "Representative video experience";

    default:
      return "Representative evidence";
  }
}

function sortDescending(
  map: Map<string, number>
): Array<[string, number]> {
  return Array.from(
    map.entries()
  ).sort(
    (first, second) =>
      second[1] - first[1]
  );
}

function uniqueIds(
  findings: CanonicalFinding[]
): string[] {
  return Array.from(
    new Set(
      findings
        .map((finding) =>
          String(
            (finding as any)
              .findingId ||
              (finding as any).id ||
              ""
          )
        )
        .filter(Boolean)
    )
  );
}

function uniqueClaims(
  findings: CanonicalFinding[]
): string[] {
  return Array.from(
    new Set(
      findings
        .map((finding) =>
          String(
            (finding as any)
              .canonicalClaim ||
              (finding as any)
                .summary ||
              ""
          )
        )
        .filter(Boolean)
    )
  );
}

function countSymptoms(
  findings: CanonicalFinding[]
): Map<string, number> {
  const counts =
    new Map<string, number>();

  for (const finding of findings) {
    const symptoms =
      Array.isArray(
        (finding as any).symptoms
      )
        ? (finding as any).symptoms
        : [];

    for (const symptom of symptoms) {
      const key = String(symptom)
        .trim()
        .toLowerCase();

      if (!key) continue;

      counts.set(
        key,
        (counts.get(key) || 0) +
          1
      );
    }
  }

  return counts;
}

function countCountries(
  findings: CanonicalFinding[]
): Map<string, number> {
  const counts =
    new Map<string, number>();

  for (const finding of findings) {
    const f = finding as any;

    const countries = [
      ...(Array.isArray(
        f.countries
      )
        ? f.countries
        : []),

      ...(f.country
        ? [f.country]
        : []),
    ];

    for (const country of countries) {
      const key = String(country)
        .trim()
        .toLowerCase();

      if (!key) continue;

      counts.set(
        key,
        (counts.get(key) || 0) +
          1
      );
    }
  }

  return counts;
}

function countPersonas(
  findings: CanonicalFinding[]
): Map<string, number> {
  const counts =
    new Map<string, number>();

  for (const finding of findings) {
    const f = finding as any;

    const personas = [
      ...(Array.isArray(
        f.personas
      )
        ? f.personas
        : []),

      ...(f.persona &&
      f.persona !== "unknown"
        ? [f.persona]
        : []),
    ];

    for (const persona of personas) {
      const key = String(persona)
        .trim()
        .toLowerCase();

      if (!key) continue;

      counts.set(
        key,
        (counts.get(key) || 0) +
          1
      );
    }
  }

  return counts;
}

function buildThemeDirectAnswer(
  themes: ThemeMatch[]
): string {
  const topThemes =
    themes.slice(0, 3);

  if (
    topThemes.length === 0
  ) {
    return "The available findings do not yet contain enough high-quality aggregated evidence to identify a reliable dominant pattern.";
  }

  const themeNames =
    topThemes.map(
      (theme) =>
        theme.label.toLowerCase()
    );

  const totalPercent =
    topThemes.reduce(
      (sum, theme) =>
        sum +
        (
          theme.prevalence
            ?.eligiblePercent ??
          theme.percent
        ),
      0
    );

  if (
    topThemes.length === 1
  ) {
    return `${sentenceCase(
      topThemes[0].label
    )} is the strongest recurring theme, appearing in ${formatThemePercent(
      topThemes[0]
    )} of qualifying discussion with ${topThemes[0].confidenceLabel} confidence.`;
  }

  return `Conversation is primarily shaped by ${joinList(
    themeNames
  )}. Together, these overlapping themes appear across approximately ${Math.min(
    totalPercent,
    100
  )}% of qualifying discussion, with the strongest evidence concentrated around ${topThemes[0].label.toLowerCase()}.`;
}

function buildThemeSection(
  themes: ThemeMatch[],
  title = "Dominant Themes",
  key = "top_themes"
): RenderedSection | null {
  if (themes.length === 0) {
    return null;
  }

  const bullets =
    themes.map((theme) => {
      const evidence =
        theme.clientFacingEvidence[0];

      const sourceAggregation =
        theme.sourceAggregation;

      const crossSourceSupport =
        sourceAggregation
          ? `, ${sourceAggregation.triangulationLabel.replace(
              /_/g,
              "-"
            )} cross-source support`
          : "";

      const base =
        `${theme.label} — ` +
        `${theme.count} findings, ` +
        `${formatThemePercent(
          theme
        )} of qualifying discussion, ` +
        `${theme.confidenceLabel} confidence` +
        crossSourceSupport;

      if (!evidence?.quote) {
        return base;
      }

      return `${base}. ${getEvidenceLabel(
        evidence
      )}: “${evidence.quote}”`;
    });

  return {
    key,
    title,
    bullets,
    findings: [],
  };
}

function buildRelationshipSection(
  themes: ThemeMatch[],
  relationships:
    ThemeRelationship[]
): RenderedSection | null {
  if (
    relationships.length === 0
  ) {
    return null;
  }

  const themeMap = new Map(
    themes.map((theme) => [
      theme.themeId,
      theme,
    ])
  );

  const bullets =
    relationships
      .slice(0, 5)
      .map((relationship) => {
        const source =
          themeMap.get(
            relationship.sourceThemeId
          )?.label ||
          titleCase(
            relationship.sourceThemeId
          );

        const target =
          themeMap.get(
            relationship.targetThemeId
          )?.label ||
          titleCase(
            relationship.targetThemeId
          );

        if (
          relationship.relationshipType ===
          "drives"
        ) {
          return `${source} shows a ${relationship.confidence} relationship with ${target} and may act as a driver.`;
        }

        if (
          relationship.relationshipType ===
          "supports"
        ) {
          return `${source} shows a ${relationship.confidence} supporting relationship with ${target}.`;
        }

        if (
          relationship.relationshipType ===
          "contrasts_with"
        ) {
          return `${source} shows a ${relationship.confidence} contrast with ${target}.`;
        }

        const count =
          relationship.coOccurrenceCount ||
          0;

        return `${source} and ${target} show a ${relationship.confidence} relationship, co-occurring across ${count} qualifying findings.`;
      });

  return {
    key:
      "theme_relationships",

    title:
      "Theme Relationships",

    bullets,
    findings: [],
  };
}

function formatSignedChange(
  value: number
): string {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function buildThemeMomentumSection(
  tracking?:
    ThemeLongitudinalTracking
): RenderedSection | null {
  if (!tracking) {
    return null;
  }

  const signals = tracking.themes
    .filter(
      (signal) =>
        signal.trajectory !==
        "insufficient"
    )
    .sort(
      (
        first:
          ThemeLongitudinalSignal,
        second:
          ThemeLongitudinalSignal
      ) =>
        Math.abs(
          second.percentagePointChange
        ) -
          Math.abs(
            first.percentagePointChange
          ) ||
        second.persistencePercent -
          first.persistencePercent
    )
    .slice(0, 4);

  if (signals.length === 0) {
    return null;
  }

  return {
    key: "theme_momentum",
    title: "Theme Momentum",
    bullets: signals.map(
      (signal) => {
        const change =
          formatSignedChange(
            signal.percentagePointChange
          );

        return `${signal.label} is ${signal.trajectory}, moving from ${signal.previousWindowAveragePercent}% to ${signal.recentWindowAveragePercent}% of qualifying discussion (${change} percentage points) with ${signal.confidence} longitudinal confidence and ${signal.persistencePercent}% period persistence.`;
      }
    ),
    findings: [],
  };
}

function buildThemeStrategicSection(
  implications:
    ThemeStrategicImplication[]
): RenderedSection {
  if (implications.length === 0) {
    return {
      key:
        "strategic_implications",

      title:
        "What This Means",

      bullets: [
        "The current dataset does not contain enough supported theme evidence for a reliable strategic interpretation.",
      ],

      findings: [],
    };
  }

  return {
    key:
      "strategic_implications",

    title:
      "What This Means",

    bullets:
      implications.map(
        (implication) =>
          `${implication.statement} Recommended action: ${implication.recommendedAction}`
      ),
    findings: [],
  };
}

function buildLiveDataSection(
  liveDataStatus:
    | "not_found"
    | "extends"
    | "only",
  lowSample: boolean,
  findings: CanonicalFinding[]
): RenderedSection {
  if (lowSample) {
    return {
      key:
        "live_data_check",

      title:
        "Live Data Check",

      text:
        "This answer is based on a limited sample and should be treated as directional.",

      findings:
        findings.slice(0, 3),
    };
  }

  if (
    liveDataStatus ===
    "not_found"
  ) {
    return {
      key:
        "live_data_check",

      title:
        "Live Data Check",

      text:
        "No live themes were retrieved for this response.",

      findings: [],
    };
  }

  if (
    liveDataStatus === "only"
  ) {
    return {
      key:
        "live_data_check",

      title:
        "Live Data Check",

      text:
        "This answer is based entirely on live social signals from the ingested dataset.",

      findings:
        findings.slice(0, 3),
    };
  }

  return {
    key:
      "live_data_check",

    title:
      "Live Data Check",

    text:
      "Live social signals were retrieved and used to extend the available intelligence.",

    findings:
      findings.slice(0, 3),
  };
}

function buildThemeFirstAnswer(
  findings: CanonicalFinding[],
  themeSummary: ThemeMatch[],
  themeRelationships:
    ThemeRelationship[],
  debug: any,
  liveDataStatus:
    | "not_found"
    | "extends"
    | "only",
  themeLongitudinalTracking?:
    ThemeLongitudinalTracking
): RenderedAnswer {
  const context =
    buildThemeAnswerContext(
      themeSummary,
      themeRelationships
    );

  const sections:
    RenderedSection[] = [];

  const dominantSection =
    buildThemeSection(
      context.dominantThemes
    );

  if (dominantSection) {
    sections.push(
      dominantSection
    );
  }

  if (
    context.supportingThemes
      .length > 0
  ) {
    const supportingSection =
      buildThemeSection(
        context.supportingThemes,
        "Supporting Themes",
        "supporting_themes"
      );

    if (supportingSection) {
      sections.push(
        supportingSection
      );
    }
  }

  const relationshipSection =
    buildRelationshipSection(
      themeSummary,
      context.relationships
    );

  if (relationshipSection) {
    sections.push(
      relationshipSection
    );
  }

  const momentumSection =
    buildThemeMomentumSection(
      themeLongitudinalTracking
    );

  if (momentumSection) {
    sections.push(
      momentumSection
    );
  }

  sections.push(
    buildThemeStrategicSection(
      context.strategicImplications
    )
  );

  sections.push(
    buildLiveDataSection(
      liveDataStatus,
      findings.length <
        LOW_SAMPLE_THRESHOLD,
      findings
    )
  );

  return {
    directAnswer:
      buildThemeDirectAnswer(
        context.dominantThemes
      ),

    sections,

    usedFindingIds:
      uniqueIds(findings),

    usedClaims:
      uniqueClaims(findings),

    liveDataStatus,
    debug,
  };
}

function buildFindingDirectAnswer(
  findings: CanonicalFinding[],
  lowSample: boolean
): string {
  const symptomCounts =
    sortDescending(
      countSymptoms(findings)
    );

  if (
    symptomCounts.length === 0
  ) {
    return "The current dataset does not contain enough symptom-specific signal to identify meaningful day-to-day burdens.";
  }

  const top =
    symptomCounts[0];

  const second =
    symptomCounts[1];

  if (lowSample) {
    if (second) {
      return `${titleCase(
        top[0]
      )} and ${titleCase(
        second[0]
      ).toLowerCase()} are the most visible day-to-day burdens in the current discussion sample.`;
    }

    return `${titleCase(
      top[0]
    )} is the most visible day-to-day burden in the current discussion sample.`;
  }

  if (second) {
    return `${titleCase(
      top[0]
    )} and ${titleCase(
      second[0]
    ).toLowerCase()} dominate discussion as the most immediate burdens, appearing in about ${percentage(
      top[1],
      findings.length
    )}% and ${percentage(
      second[1],
      findings.length
    )}% of high-signal findings.`;
  }

  return `${titleCase(
    top[0]
  )} dominates discussion as the most immediate burden, appearing in about ${percentage(
    top[1],
    findings.length
  )}% of high-signal findings.`;
}

function buildTopBurdensSection(
  findings: CanonicalFinding[],
  lowSample: boolean
): RenderedSection | null {
  const symptomCounts =
    sortDescending(
      countSymptoms(findings)
    );

  if (
    symptomCounts.length === 0
  ) {
    return null;
  }

  const topSymptoms =
    symptomCounts.slice(0, 3);

  const bullets =
    topSymptoms.map(
      ([symptom, count]) => {
        if (lowSample) {
          return titleCase(
            symptom
          );
        }

        return `${titleCase(
          symptom
        )} (~${percentage(
          count,
          findings.length
        )}% of findings)`;
      }
    );

  const topSet =
    new Set(
      topSymptoms.map(
        ([symptom]) =>
          symptom
      )
    );

  const matched =
    findings.filter(
      (finding) => {
        const symptoms =
          Array.isArray(
            (finding as any)
              .symptoms
          )
            ? (finding as any)
                .symptoms
            : [];

        return symptoms.some(
          (symptom: string) =>
            topSet.has(
              String(symptom)
                .trim()
                .toLowerCase()
            )
        );
      }
    );

  return {
    key:
      "top_burdens",

    title:
      "Most-Supported Burdens",

    bullets,

    findings:
      matched.slice(0, 5),
  };
}

function buildMarketSection(
  findings: CanonicalFinding[]
): RenderedSection | null {
  const countryCounts =
    sortDescending(
      countCountries(findings)
    );

  if (
    countryCounts.length < 2
  ) {
    return null;
  }

  return {
    key:
      "market_variation",

    title:
      "Market Intelligence",

    bullets:
      countryCounts
        .slice(0, 3)
        .map(
          ([country, count]) =>
            `${titleCase(
              country
            )} contributes about ${percentage(
              count,
              findings.length
            )}% of the current discussion sample`
        ),

    findings: [],
  };
}

function buildPersonaSection(
  findings: CanonicalFinding[]
): RenderedSection | null {
  const personaCounts =
    sortDescending(
      countPersonas(findings)
    );

  if (
    personaCounts.length === 0
  ) {
    return null;
  }

  return {
    key:
      "persona_intelligence",

    title:
      "Persona Intelligence",

    bullets:
      personaCounts
        .slice(0, 2)
        .map(
          ([persona, count]) =>
            `${titleCase(
              persona
            )} audiences represent about ${percentage(
              count,
              findings.length
            )}% of the current discussion sample`
        ),

    findings: [],
  };
}

function buildFindingStrategicSection(
  findings: CanonicalFinding[],
  lowSample: boolean
): RenderedSection {
  const symptomCounts =
    sortDescending(
      countSymptoms(findings)
    );

  const top =
    symptomCounts[0]?.[0];

  const second =
    symptomCounts[1]?.[0];

  if (lowSample) {
    return {
      key:
        "strategic_implications",

      title:
        "What This Means",

      bullets: [
        "The current answer is based on a relatively small high-signal sample, so the themes should be treated as directional.",

        top
          ? `Use ${top}${
              second
                ? ` and ${second}`
                : ""
            } as early hypotheses to validate with broader data before making market-level claims.`
          : "Validate the most visible signals against a broader sample before making strategic claims.",
      ],

      findings: [],
    };
  }

  return {
    key:
      "strategic_implications",

    title:
      "What This Means",

    bullets: [
      top
        ? `Discussion is concentrated around ${top}${
            second
              ? ` and ${second}`
              : ""
          }.`
        : "Discussion is concentrated around a narrow set of recurring themes.",

      "Validate the strongest recurring themes before expanding messaging or strategic recommendations.",
    ],

    findings: [],
  };
}

export function buildRenderedAnswer(
  findings: CanonicalFinding[],
  debug: any,
  liveDataStatus:
    | "not_found"
    | "extends"
    | "only",
  themeSummary: ThemeMatch[] = [],
  themeRelationships:
    ThemeRelationship[] = [],
  intent?: string,
  themeLongitudinalTracking?:
    ThemeLongitudinalTracking
): RenderedAnswer {
  const resolvedIntent =
    intent ||
    debug?.questionIntent ||
    "general";

  if (
    THEME_FIRST_INTENTS.has(
      resolvedIntent
    ) &&
    themeSummary.length > 0
  ) {
    return buildThemeFirstAnswer(
      findings,
      themeSummary,
      themeRelationships,
      debug,
      liveDataStatus,
      themeLongitudinalTracking
    );
  }

  const lowSample =
    (debug?.templateFilteredCount ??
      findings.length) <
    LOW_SAMPLE_THRESHOLD;

  const sections:
    RenderedSection[] = [];

  const burdens =
    buildTopBurdensSection(
      findings,
      lowSample
    );

  if (burdens) {
    sections.push(burdens);
  }

  if (!lowSample) {
    const market =
      buildMarketSection(
        findings
      );

    if (market) {
      sections.push(market);
    }

    const persona =
      buildPersonaSection(
        findings
      );

    if (persona) {
      sections.push(persona);
    }
  }

  sections.push(
    buildFindingStrategicSection(
      findings,
      lowSample
    )
  );

  sections.push(
    buildLiveDataSection(
      liveDataStatus,
      lowSample,
      findings
    )
  );

  return {
    directAnswer:
      buildFindingDirectAnswer(
        findings,
        lowSample
      ),

    sections,

    usedFindingIds:
      uniqueIds(findings),

    usedClaims:
      uniqueClaims(findings),

    liveDataStatus,
    debug,
  };
}
