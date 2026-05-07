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

function titleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
    .join(" ");
}

function countSymptoms(findings: CanonicalFinding[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const finding of findings) {
    for (const symptom of finding.symptoms || []) {
      const key = symptom.trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return map;
}

function countCountries(findings: CanonicalFinding[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const finding of findings) {
    for (const country of finding.countries || []) {
      const key = country.trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return map;
}

function countPersonas(findings: CanonicalFinding[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const finding of findings) {
    for (const persona of finding.personas || []) {
      const key = persona.trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return map;
}

function percent(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function sortDesc(map: Map<string, number>): Array<[string, number]> {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function uniqueIds(findings: CanonicalFinding[]): string[] {
  return Array.from(new Set(findings.map((finding) => finding.findingId)));
}

function uniqueClaims(findings: CanonicalFinding[]): string[] {
  return Array.from(
    new Set(findings.map((finding) => finding.canonicalClaim).filter(Boolean))
  );
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
    if (lowSample) {
      return `${titleCase(symptom)}`;
    }

    return `${titleCase(symptom)} (~${percent(count, total)}% of findings)`;
  });

  const topSymptomSet = new Set(topSymptoms.map(([symptom]) => symptom));
  const matchedFindings = findings.filter((finding) =>
    (finding.symptoms || []).some((symptom) =>
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

export function buildRenderedAnswer(
  findings: CanonicalFinding[],
  debug: any,
  liveDataStatus: "not_found" | "extends" | "only"
): RenderedAnswer {
  const lowSample = (debug?.templateFilteredCount ?? 0) < LOW_SAMPLE_THRESHOLD;

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