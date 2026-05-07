import { CanonicalFinding } from "../models/finding";
import { PlannedSections } from "./sectionPlanner";
import { AnswerTemplateRule } from "../templates/templateRegistry";
import {
  aggregateCountryThemes,
  aggregatePersonaThemes,
  aggregateSymptomThemes,
  formatThemeLabel,
} from "./themeAggregation";

export interface RenderedAnswerSection {
  key: string;
  title: string;
  text?: string;
  bullets?: string[];
  findings?: CanonicalFinding[];
}

export interface RenderedAnswer {
  directAnswer: string;
  sections: RenderedAnswerSection[];
  usedFindingIds: string[];
  usedClaims: string[];
  liveDataStatus: "confirmed" | "not_found" | "extends";
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeText(text?: string): string {
  return (text || "").toLowerCase().trim();
}

function sentenceCase(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function stripTrailingPeriod(text: string): string {
  return text.replace(/[.]+$/, "").trim();
}

function computeLiveStatus(sections: PlannedSections): "confirmed" | "not_found" | "extends" {
  const count = sections.liveDataCheck?.length || 0;
  if (count === 0) return "not_found";
  if (count === 1) return "confirmed";
  return "extends";
}

function renderLiveStatus(status: "confirmed" | "not_found" | "extends"): string {
  if (status === "not_found") {
    return "No live themes were retrieved for this response, so the answer reflects curated intelligence only.";
  }
  if (status === "extends") {
    return "Live social signals were retrieved and used to extend the curated intelligence.";
  }
  return "Live social signals were retrieved and used to validate the curated intelligence.";
}

function normalizePersonaLabel(label: string): string {
  const clean = label.toLowerCase().trim();

  if (clean === "patient") return "patients";
  if (clean === "caregiver") return "caregivers";

  return clean;
}

function buildTopThemeSummary(findings: CanonicalFinding[]): string[] {
  const themes = aggregateSymptomThemes(findings);

  if (themes.length === 0) return [];

  return themes.slice(0, 4).map((theme) => {
    const label = formatThemeLabel(theme.label);
    return `${label} (~${theme.percentage}% of findings)`;
  });
}

function buildDirectAnswer(
  sections: PlannedSections,
  template: AnswerTemplateRule
): string {
  const themes = aggregateSymptomThemes(sections.topBurdens || []);

  if (themes.length === 0) {
    return "Symptom burden is driven by quality-of-life disruption and uncertainty.";
  }

  const core = themes.slice(0, 2);
  const secondary = themes.slice(2, 4);

  let s1 = "";
  let s2 = "";
  let s3 = "";
  let s4 = "";

  if (template.intent === "symptom_qol_burden") {
    if (core.length > 0) {
      const coreLabels = core.map((t) => t.label);
      const topPercent = core[0]?.percentage || 0;

      s1 = `${coreLabels.join(" and ")} dominate patient discussion as the most immediate burdens, appearing in about ${topPercent}% of high-signal findings`;
    }

    if (secondary.length > 0) {
      const secondaryLabels = secondary.map((t) => t.label);
      s2 = `${secondaryLabels.join(" and ")} add secondary burden signals across the remaining discussion`;
    }

    const market = buildMarketIntelligence(sections, template);
    if (market.length > 0) s3 = market[0];

    const persona = buildPersonaIntelligence(sections, template);
    if (persona.length > 0) s4 = persona[0];
  }

  return [s1, s2, s3, s4]
    .filter(Boolean)
    .map((s) => sentenceCase(stripTrailingPeriod(s)) + ".")
    .join(" ");
}

function buildMarketIntelligence(
  sections: PlannedSections,
  template: AnswerTemplateRule
): string[] {
  const findings = sections.marketVariation || [];
  const countryThemes = aggregateCountryThemes(findings);

  return countryThemes.slice(0, 3).map((countryTheme) => {
    const countryLabel = formatThemeLabel(countryTheme.label);

    const relatedFindings = findings.filter((finding) =>
      (finding.countries || []).map((country) => normalizeText(country)).includes(countryTheme.label)
    );

    const symptomThemes = aggregateSymptomThemes(relatedFindings);
    const dominantSymptoms = symptomThemes.slice(0, 2).map((theme) => theme.label);

    if (template.intent === "symptom_qol_burden" && dominantSymptoms.length > 0) {
      return `${countryLabel} over-indexes on ${dominantSymptoms.join(" and ")}, with those themes appearing in about ${symptomThemes[0].percentage}% of local findings`;
    }

    return `${countryLabel} shows distinct symptom prioritization patterns`;
  });
}

function buildPersonaIntelligence(
  sections: PlannedSections,
  template: AnswerTemplateRule
): string[] {
  const findings = sections.topBurdens || [];
  const personaThemes = aggregatePersonaThemes(findings);

  return personaThemes.slice(0, 3).map((personaTheme) => {
    const personaLabel = sentenceCase(normalizePersonaLabel(personaTheme.label));

    const relatedFindings = findings.filter((finding) =>
      (finding.personas || []).map((persona) => normalizeText(persona)).includes(personaTheme.label)
    );

    const symptomThemes = aggregateSymptomThemes(relatedFindings);
    const dominantSymptoms = symptomThemes.slice(0, 2).map((theme) => theme.label);

    if (template.intent === "symptom_qol_burden" && dominantSymptoms.length > 0) {
      return `${personaLabel} are most associated with ${dominantSymptoms.join(" and ")}, representing about ${personaTheme.percentage}% of high-signal findings`;
    }

    return `${personaLabel} show distinct patterns in discussion`;
  });
}

function buildStrategicImplications(sections: PlannedSections) {
  const themes = aggregateSymptomThemes(sections.topBurdens || []);

  if (themes.length === 0) {
    return {
      implications: ["Discussion is fragmented across multiple concerns"],
      actions: ["Align messaging to the most visible patient concerns"],
    };
  }

  const dominant = themes.slice(0, 2);
  const dominantLabels = dominant.map((t) => t.label);
  const dominantPercent = dominant[0]?.percentage || 0;

  return {
    implications: [
      `Discussion is concentrated around ${dominantLabels.join(" and ")}, with the top theme appearing in about ${dominantPercent}% of high-signal findings`,
    ],
    actions: [
      `Anchor messaging in ${dominantLabels.join(" and ")} before expanding into broader disease education`,
    ],
  };
}

export function buildRenderedAnswer(
  sections: PlannedSections,
  template: AnswerTemplateRule
): RenderedAnswer {
  const liveStatus = computeLiveStatus(sections);

  const allFindings = [
    ...(sections.directAnswer || []),
    ...(sections.topBurdens || []),
  ];

  const usedFindingIds = uniq(allFindings.map((f) => f.findingId));
  const usedClaims = uniq(allFindings.map((f) => normalizeText(f.canonicalClaim)));

  const renderedSections: RenderedAnswerSection[] = [];

  if (sections.topBurdens?.length) {
    renderedSections.push({
      key: "top_burdens",
      title: "Most-Supported Burdens",
      bullets: buildTopThemeSummary(sections.topBurdens),
      findings: sections.topBurdens,
    });
  }

  const market = buildMarketIntelligence(sections, template);
  if (market.length) {
    renderedSections.push({
      key: "market_variation",
      title: "Market Intelligence",
      bullets: market,
      findings: sections.marketVariation,
    });
  }

  const persona = buildPersonaIntelligence(sections, template);
  if (persona.length) {
    renderedSections.push({
      key: "persona_intelligence",
      title: "Persona Intelligence",
      bullets: persona,
      findings: [],
    });
  }

  const strategy = buildStrategicImplications(sections);

  renderedSections.push({
    key: "strategic_implications",
    title: "What This Means",
    bullets: [
      ...strategy.implications,
      ...strategy.actions.map((a, i) => `${i + 1}. ${a}`),
    ],
    findings: [],
  });

  renderedSections.push({
    key: "live_data_check",
    title: "Live Data Check",
    text: renderLiveStatus(liveStatus),
    findings: sections.liveDataCheck,
  });

  return {
    directAnswer: buildDirectAnswer(sections, template),
    sections: renderedSections,
    usedFindingIds,
    usedClaims,
    liveDataStatus: liveStatus,
  };
}