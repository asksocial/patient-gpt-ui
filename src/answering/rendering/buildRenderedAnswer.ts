import { CanonicalFinding } from "../models/finding";

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
  liveDataStatus: "not_found" | "extends" | "only";
  debug: any;
};

const LOW_SAMPLE_THRESHOLD = 20;

const MARKET_INTENTS = new Set([
  "market_interest",
  "education_barriers",
  "competitive_alternatives",
  "adoption_drivers",
  "market_opportunities",
  "market_landscape",
]);

function titleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
    .join(" ");
}

function normalizeText(value?: string): string {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function percent(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function sortDesc(map: Map<string, number>): Array<[string, number]> {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function uniqueIds(findings: CanonicalFinding[]): string[] {
  return Array.from(
    new Set(
      findings
        .map((finding: any) => finding.findingId || finding.id)
        .filter(Boolean)
    )
  );
}

function uniqueClaims(findings: CanonicalFinding[]): string[] {
  return Array.from(
    new Set(
      findings
        .map((finding: any) => finding.canonicalClaim || finding.summary)
        .filter(Boolean)
    )
  );
}

function getFindingText(finding: CanonicalFinding): string {
  const f: any = finding;

  return [
    f.canonicalClaim,
    f.summary,
    f.title,
    f.description,
    f.text,
    f.excerpt,
    ...(f.normalizedLabels || []),
    ...(f.labels || []),
    ...(f.symptoms || []),
    ...(f.treatments || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function countSymptoms(findings: CanonicalFinding[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const finding of findings as any[]) {
    for (const symptom of finding.symptoms || []) {
      const key = String(symptom).trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return map;
}

function countCountries(findings: CanonicalFinding[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const finding of findings as any[]) {
    const countries = finding.countries || (finding.country ? [finding.country] : []);

    for (const country of countries) {
      const key = String(country).trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return map;
}

function countPersonas(findings: CanonicalFinding[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const finding of findings as any[]) {
    const personas = finding.personas || (finding.persona ? [finding.persona] : []);

    for (const persona of personas) {
      const key = String(persona).trim().toLowerCase();
      if (!key || key === "unknown") continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return map;
}

function countPlatforms(findings: CanonicalFinding[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const finding of findings as any[]) {
    const platforms =
      finding.platforms || (finding.platform ? [finding.platform] : []);

    for (const platform of platforms) {
      const key = String(platform).trim().toLowerCase();
      if (!key || key === "unknown") continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return map;
}

function countKeywordGroups(
  findings: CanonicalFinding[],
  groups: Record<string, string[]>
): Map<string, number> {
  const map = new Map<string, number>();

  for (const finding of findings) {
    const text = getFindingText(finding);

    for (const [label, patterns] of Object.entries(groups)) {
      if (patterns.some((pattern) => text.includes(pattern.toLowerCase()))) {
        map.set(label, (map.get(label) || 0) + 1);
      }
    }
  }

  return map;
}

function matchFindingsByKeywordGroup(
  findings: CanonicalFinding[],
  labels: string[],
  groups: Record<string, string[]>
): CanonicalFinding[] {
  const selected = new Set(labels);
  return findings.filter((finding) => {
    const text = getFindingText(finding);

    return Object.entries(groups).some(([label, patterns]) => {
      if (!selected.has(label)) return false;
      return patterns.some((pattern) => text.includes(pattern.toLowerCase()));
    });
  });
}

const MARKET_INTEREST_GROUPS: Record<string, string[]> = {
  natural_results: [
    "natural results",
    "subtle results",
    "look natural",
    "not overfilled",
    "undetectable",
  ],
  skin_quality: [
    "skin quality",
    "glow",
    "glowy",
    "dewy",
    "radiance",
    "texture",
    "pores",
    "hydration",
    "smooth",
    "bouncy skin",
    "glass skin",
  ],
  regenerative_positioning: [
    "regenerative",
    "regeneration",
    "collagen",
    "biostimulation",
    "biostimulator",
    "exosome",
    "exosomes",
    "pdrn",
    "polynucleotide",
    "growth factor",
    "prp",
    "prf",
  ],
  anti_aging_longevity: [
    "anti-aging",
    "anti aging",
    "aging",
    "wrinkles",
    "fine lines",
    "longevity",
    "long lasting",
    "maintenance",
  ],
  social_proof: [
    "before and after",
    "results",
    "review",
    "recommend",
    "must-have",
    "game changer",
    "why i love",
  ],
};

const EDUCATION_BARRIER_GROUPS: Record<string, string[]> = {
  confusion_about_category: [
    "confused",
    "confusing",
    "what is",
    "don't know where to start",
    "how does it work",
    "education",
    "awareness",
  ],
  skepticism_and_trust: [
    "skeptical",
    "skepticism",
    "scam",
    "overhyped",
    "hype",
    "trust",
    "credible",
    "doctor",
    "dermatologist",
  ],
  safety_uncertainty: [
    "safety",
    "safe",
    "unsafe",
    "risk",
    "side effects",
    "downtime",
    "recovery",
  ],
  cost_uncertainty: [
    "cost",
    "price",
    "expensive",
    "worth it",
    "affordable",
  ],
};

const COMPETITIVE_ALTERNATIVE_GROUPS: Record<string, string[]> = {
  injectables: [
    "botox",
    "tox",
    "neurotoxin",
    "dysport",
    "xeomin",
    "jeuveau",
    "filler",
    "fillers",
    "dermal filler",
  ],
  devices: [
    "laser",
    "ipl",
    "bbl",
    "radiofrequency",
    "rf microneedling",
    "microneedling",
    "morpheus8",
    "ultherapy",
    "thermage",
    "fraxel",
  ],
  skincare_topicals: [
    "serum",
    "toner",
    "moisturizer",
    "retinal",
    "retinol",
    "tranexamic acid",
    "azelaic",
    "bakuchiol",
    "skincare",
  ],
  surgery: [
    "facelift",
    "neck lift",
    "blepharoplasty",
    "plastic surgery",
    "cosmetic surgery",
  ],
  facials_and_peels: [
    "facial",
    "hydrafacial",
    "chemical peel",
    "peel",
    "skin booster",
    "mesotherapy",
  ],
};

const ADOPTION_DRIVER_GROUPS: Record<string, string[]> = {
  visible_results: [
    "results",
    "before and after",
    "glow",
    "smooth",
    "plumping",
    "refined pores",
    "glass skin",
  ],
  provider_credibility: [
    "doctor",
    "dermatologist",
    "clinic",
    "aesthetic doctor",
    "provider",
    "med spa",
  ],
  ease_and_routine_fit: [
    "routine",
    "quick",
    "easy",
    "daily",
    "maintenance",
    "minimal downtime",
  ],
  natural_biologic_appeal: [
    "natural",
    "regenerative",
    "collagen",
    "exosomes",
    "pdrn",
    "growth factors",
    "prp",
    "prf",
  ],
};

const MARKET_OPPORTUNITY_GROUPS: Record<string, string[]> = {
  education_whitespace: [
    "confused",
    "don't know where to start",
    "what is",
    "education",
    "awareness",
    "skeptical",
  ],
  premium_skin_quality_positioning: [
    "skin quality",
    "glow",
    "dewy",
    "texture",
    "pores",
    "hydration",
    "glass skin",
  ],
  alternative_to_injectables: [
    "botox",
    "filler",
    "fillers",
    "natural results",
    "not overfilled",
  ],
  provider_led_adoption: [
    "doctor",
    "dermatologist",
    "clinic",
    "aesthetic doctor",
    "med spa",
  ],
  social_proof_content: [
    "before and after",
    "review",
    "recommend",
    "results",
    "game changer",
  ],
};

function getMarketGroupsForIntent(intent: string): Record<string, string[]> {
  if (intent === "education_barriers") return EDUCATION_BARRIER_GROUPS;
  if (intent === "competitive_alternatives") return COMPETITIVE_ALTERNATIVE_GROUPS;
  if (intent === "adoption_drivers") return ADOPTION_DRIVER_GROUPS;
  if (intent === "market_opportunities") return MARKET_OPPORTUNITY_GROUPS;
  return MARKET_INTEREST_GROUPS;
}

function buildMarketDirectAnswer(
  findings: CanonicalFinding[],
  intent: string,
  lowSample: boolean
): string {
  const groups = getMarketGroupsForIntent(intent);
  const topGroups = sortDesc(countKeywordGroups(findings, groups)).slice(0, 3);

  if (topGroups.length === 0) {
    if (intent === "education_barriers") {
      return "The current dataset does not contain enough education-barrier signal to identify what is limiting adoption.";
    }

    if (intent === "competitive_alternatives") {
      return "The current dataset does not contain enough comparison signal to identify the strongest competitive alternatives.";
    }

    if (intent === "adoption_drivers") {
      return "The current dataset does not contain enough adoption-driver signal to identify what is motivating uptake.";
    }

    if (intent === "market_opportunities") {
      return "The current dataset does not contain enough opportunity-specific signal to identify clear market white space.";
    }

    return "The current dataset does not contain enough market-interest signal to identify clear drivers of growth.";
  }

  const labels = topGroups.map(([label]) => titleCase(label).toLowerCase());

  if (intent === "education_barriers") {
    return `Education barriers appear to center on ${labels.join(
      ", "
    )}. These signals suggest adoption may be limited less by lack of interest and more by uncertainty, trust, and clarity gaps.`;
  }

  if (intent === "competitive_alternatives") {
    return `People are most often comparing regenerative aesthetics against ${labels.join(
      ", "
    )}. This suggests the category is being evaluated alongside both traditional aesthetic procedures and everyday skincare routines.`;
  }

  if (intent === "adoption_drivers") {
    return `Adoption appears to be driven by ${labels.join(
      ", "
    )}. These themes point to demand for visible results, credible providers, and treatments that fit naturally into beauty routines.`;
  }

  if (intent === "market_opportunities") {
    return `The clearest market opportunities are around ${labels.join(
      ", "
    )}. These areas suggest white space for education, positioning, provider-led credibility, and proof-oriented content.`;
  }

  if (lowSample) {
    return `Growing interest appears directionally linked to ${labels.join(
      ", "
    )}, though the current high-signal sample should be treated as directional.`;
  }

  return `Growing interest appears to be driven by ${labels.join(
    ", "
  )}. These themes indicate that regenerative aesthetics is gaining attention through skin-quality benefits, regenerative positioning, and visible social proof.`;
}

function buildMarketDriversSection(
  findings: CanonicalFinding[],
  intent: string,
  lowSample: boolean
): RenderedSection | null {
  const groups = getMarketGroupsForIntent(intent);
  const topGroups = sortDesc(countKeywordGroups(findings, groups)).slice(0, 5);

  if (topGroups.length === 0) return null;

  const bullets = topGroups.map(([label, count]) => {
    if (lowSample) return titleCase(label);
    return `${titleCase(label)} (~${percent(count, findings.length)}% of high-signal findings)`;
  });

  const matchedFindings = matchFindingsByKeywordGroup(
    findings,
    topGroups.map(([label]) => label),
    groups
  );

  let title = "Top Market Drivers";
  if (intent === "education_barriers") title = "Education Barriers";
  if (intent === "competitive_alternatives") title = "Competitive Alternatives";
  if (intent === "adoption_drivers") title = "Adoption Drivers";
  if (intent === "market_opportunities") title = "Market Opportunities";

  return {
    key: intent === "education_barriers" ? "barriers" : "top_drivers",
    title,
    bullets,
    findings: matchedFindings.slice(0, 5),
  };
}

function buildPlatformSection(findings: CanonicalFinding[]): RenderedSection | null {
  const platformCounts = sortDesc(countPlatforms(findings));
  if (platformCounts.length === 0) return null;

  return {
    key: "platforms",
    title: "Channel Signals",
    bullets: platformCounts.slice(0, 4).map(([platform, count]) => {
      return `${titleCase(platform)} contributes about ${percent(
        count,
        findings.length
      )}% of the current high-signal sample`;
    }),
    findings: [],
  };
}

function buildMarketStrategicSection(
  findings: CanonicalFinding[],
  intent: string,
  lowSample: boolean
): RenderedSection {
  const groups = getMarketGroupsForIntent(intent);
  const topGroups = sortDesc(countKeywordGroups(findings, groups)).slice(0, 2);
  const top = topGroups[0]?.[0];
  const second = topGroups[1]?.[0];

  if (lowSample) {
    return {
      key: "strategic_implications",
      title: "What This Means",
      bullets: [
        "The current answer is based on a relatively small high-signal sample, so the themes should be treated as directional.",
        top
          ? `Use ${titleCase(top).toLowerCase()}${
              second ? ` and ${titleCase(second).toLowerCase()}` : ""
            } as early hypotheses to validate with broader data.`
          : "Validate themes against a broader sample before making market-level claims.",
      ],
      findings: [],
    };
  }

  if (intent === "education_barriers") {
    return {
      key: "strategic_implications",
      title: "What This Means",
      bullets: [
        top
          ? `Education should prioritize ${titleCase(top).toLowerCase()}${
              second ? ` and ${titleCase(second).toLowerCase()}` : ""
            } before broader category-building claims.`
          : "Education should focus on clarifying what regenerative aesthetics is, how it works, and who it is for.",
        "Messaging should reduce skepticism by pairing plain-language explanation with credible provider voices and proof-oriented examples.",
      ],
      findings: [],
    };
  }

  if (intent === "competitive_alternatives") {
    return {
      key: "strategic_implications",
      title: "What This Means",
      bullets: [
        top
          ? `Positioning should clearly differentiate regenerative aesthetics from ${titleCase(top).toLowerCase()}${
              second ? ` and ${titleCase(second).toLowerCase()}` : ""
            }.`
          : "Positioning should clearly explain where regenerative aesthetics fits relative to injectables, devices, skincare, and surgery.",
        "The category should be framed around when it complements alternatives versus when it offers a different value proposition.",
      ],
      findings: [],
    };
  }

  if (intent === "adoption_drivers") {
    return {
      key: "strategic_implications",
      title: "What This Means",
      bullets: [
        top
          ? `Adoption messaging should lead with ${titleCase(top).toLowerCase()}${
              second ? ` and ${titleCase(second).toLowerCase()}` : ""
            }.`
          : "Adoption messaging should lead with visible benefits, credibility, and ease of integration into beauty routines.",
        "Provider education and social proof can help translate interest into action.",
      ],
      findings: [],
    };
  }

  if (intent === "market_opportunities") {
    return {
      key: "strategic_implications",
      title: "What This Means",
      bullets: [
        top
          ? `The strongest opportunity area appears to be ${titleCase(top).toLowerCase()}${
              second ? `, followed by ${titleCase(second).toLowerCase()}` : ""
            }.`
          : "The strongest opportunity areas are likely education, differentiation, and proof-building.",
        "Prioritize content and offers that make the category easier to understand, compare, and trust.",
      ],
      findings: [],
    };
  }

  return {
    key: "strategic_implications",
    title: "What This Means",
    bullets: [
      top
        ? `Interest is concentrated around ${titleCase(top).toLowerCase()}${
            second ? ` and ${titleCase(second).toLowerCase()}` : ""
          }.`
        : "Interest is concentrated around a small set of category and benefit signals.",
      "Anchor messaging in the clearest benefit language before expanding into broader category education.",
    ],
    findings: [],
  };
}

function buildDirectAnswer(
  findings: CanonicalFinding[],
  lowSample: boolean
): string {
  const symptomCounts = sortDesc(countSymptoms(findings));

  if (symptomCounts.length === 0) {
    return "The current dataset does not contain enough symptom-specific signal to identify meaningful day-to-day burdens.";
  }

  const top = symptomCounts[0];
  const second = symptomCounts[1];

  if (lowSample) {
    if (second) {
      return `${titleCase(top[0])} and ${titleCase(
        second[0]
      ).toLowerCase()} are the most visible day-to-day burdens in the current patient discussion sample.`;
    }

    return `${titleCase(top[0])} is the most visible day-to-day burden in the current patient discussion sample.`;
  }

  const total = findings.length;

  if (second) {
    return `${titleCase(top[0])} and ${titleCase(
      second[0]
    ).toLowerCase()} dominate patient discussion as the most immediate burdens, appearing in about ${percent(
      top[1],
      total
    )}% and ${percent(second[1], total)}% of high-signal findings.`;
  }

  return `${titleCase(top[0])} dominates patient discussion as the most immediate burden, appearing in about ${percent(
    top[1],
    total
  )}% of high-signal findings.`;
}

function buildTopBurdensSection(
  findings: CanonicalFinding[],
  lowSample: boolean
): RenderedSection | null {
  const symptomCounts = sortDesc(countSymptoms(findings));

  if (symptomCounts.length === 0) return null;

  const total = findings.length;
  const topSymptoms = symptomCounts.slice(0, 3);

  const bullets = topSymptoms.map(([symptom, count]) => {
    if (lowSample) return titleCase(symptom);
    return `${titleCase(symptom)} (~${percent(count, total)}% of findings)`;
  });

  const topSymptomSet = new Set(topSymptoms.map(([symptom]) => symptom));
  const matchedFindings = findings.filter((finding: any) =>
    (finding.symptoms || []).some((symptom: string) =>
      topSymptomSet.has(symptom.trim().toLowerCase())
    )
  );

  return {
    key: "top_burdens",
    title: "Most-Supported Burdens",
    bullets,
    findings: matchedFindings.slice(0, 5),
  };
}

function buildMarketSection(findings: CanonicalFinding[]): RenderedSection | null {
  const countryCounts = sortDesc(countCountries(findings));
  if (countryCounts.length < 2) return null;

  const bullets = countryCounts.slice(0, 3).map(([country, count]) => {
    return `${titleCase(country)} contributes about ${percent(
      count,
      findings.length
    )}% of the current discussion sample`;
  });

  return {
    key: "market_variation",
    title: "Market Intelligence",
    bullets,
    findings: [],
  };
}

function buildPersonaSection(findings: CanonicalFinding[]): RenderedSection | null {
  const personaCounts = sortDesc(countPersonas(findings));
  if (personaCounts.length === 0) return null;

  const bullets = personaCounts.slice(0, 2).map(([persona, count]) => {
    return `${titleCase(persona)}s represent about ${percent(
      count,
      findings.length
    )}% of the current discussion sample`;
  });

  return {
    key: "persona_intelligence",
    title: "Persona Intelligence",
    bullets,
    findings: [],
  };
}

function buildStrategicSection(
  findings: CanonicalFinding[],
  lowSample: boolean
): RenderedSection {
  const symptomCounts = sortDesc(countSymptoms(findings));
  const top = symptomCounts[0]?.[0];
  const second = symptomCounts[1]?.[0];

  if (lowSample) {
    return {
      key: "strategic_implications",
      title: "What This Means",
      bullets: [
        "The current answer is based on a relatively small high-signal sample, so the themes should be treated as directional.",
        top
          ? `Use ${top}${
              second ? ` and ${second}` : ""
            } as early hypotheses to validate with broader data before making market-level claims.`
          : "Validate themes against a broader sample before making strategic claims.",
      ],
      findings: [],
    };
  }

  return {
    key: "strategic_implications",
    title: "What This Means",
    bullets: [
      top
        ? `Discussion is concentrated around ${top}${
            second ? ` and ${second}` : ""
          }, with the top theme appearing in about ${percent(
            symptomCounts[0][1],
            findings.length
          )}% of high-signal findings`
        : "Discussion is concentrated around a narrow set of symptom themes",
      top
        ? `1. Anchor messaging in ${top}${
            second ? ` and ${second}` : ""
          } before expanding into broader disease education`
        : "1. Validate the most visible burden themes before expanding messaging",
    ],
    findings: [],
  };
}

function buildLiveDataSection(
  liveDataStatus: "not_found" | "extends" | "only",
  lowSample: boolean,
  findings: CanonicalFinding[]
): RenderedSection {
  if (lowSample) {
    return {
      key: "live_data_check",
      title: "Live Data Check",
      text: "This answer is based on a limited sample of live social data and should be treated as directional.",
      findings: findings.slice(0, 3),
    };
  }

  if (liveDataStatus === "not_found") {
    return {
      key: "live_data_check",
      title: "Live Data Check",
      text: "No live themes were retrieved for this response.",
      findings: [],
    };
  }

  if (liveDataStatus === "only") {
    return {
      key: "live_data_check",
      title: "Live Data Check",
      text: "This answer is based entirely on live social signals from the ingested dataset.",
      findings: findings.slice(0, 3),
    };
  }

  return {
    key: "live_data_check",
    title: "Live Data Check",
    text: "Live social signals were retrieved and used to extend the curated intelligence.",
    findings: findings.slice(0, 3),
  };
}

function buildMarketIntentAnswer(
  findings: CanonicalFinding[],
  debug: any,
  liveDataStatus: "not_found" | "extends" | "only",
  intent: string,
  lowSample: boolean
): RenderedAnswer {
  const sections = [
    buildMarketDriversSection(findings, intent, lowSample),
    buildPlatformSection(findings),
    buildMarketSection(findings),
    buildPersonaSection(findings),
    buildMarketStrategicSection(findings, intent, lowSample),
    buildLiveDataSection(liveDataStatus, lowSample, findings),
  ].filter(Boolean) as RenderedSection[];

  return {
    directAnswer: buildMarketDirectAnswer(findings, intent, lowSample),
    sections,
    usedFindingIds: uniqueIds(findings),
    usedClaims: uniqueClaims(findings),
    liveDataStatus,
    debug,
  };
}

export function buildRenderedAnswer(
  findings: CanonicalFinding[],
  debug: any,
  liveDataStatus: "not_found" | "extends" | "only"
): RenderedAnswer {
  const intent = debug?.questionIntent || debug?.templateUsed || "general";
  const lowSample = (debug?.templateFilteredCount ?? findings.length) < LOW_SAMPLE_THRESHOLD;

  if (MARKET_INTENTS.has(intent)) {
    return buildMarketIntentAnswer(
      findings,
      debug,
      liveDataStatus,
      intent,
      lowSample
    );
  }

  if (lowSample) {
    const sections = [
      buildTopBurdensSection(findings, true),
      buildStrategicSection(findings, true),
      buildLiveDataSection(liveDataStatus, true, findings),
    ].filter(Boolean) as RenderedSection[];

    return {
      directAnswer: buildDirectAnswer(findings, true),
      sections,
      usedFindingIds: uniqueIds(findings),
      usedClaims: uniqueClaims(findings),
      liveDataStatus,
      debug,
    };
  }

  const sections: RenderedSection[] = [];

  const topBurdens = buildTopBurdensSection(findings, false);
  if (topBurdens) sections.push(topBurdens);

  const market = buildMarketSection(findings);
  if (market) sections.push(market);

  const persona = buildPersonaSection(findings);
  if (persona) sections.push(persona);

  sections.push(buildStrategicSection(findings, false));
  sections.push(buildLiveDataSection(liveDataStatus, false, findings));

  return {
    directAnswer: buildDirectAnswer(findings, false),
    sections,
    usedFindingIds: uniqueIds(findings),
    usedClaims: uniqueClaims(findings),
    liveDataStatus,
    debug,
  };
}