import { CanonicalFinding } from "../models/finding";

export interface AggregatedTheme {
  label: string;
  count: number;
  percentage: number;
  findingIds: string[];
  sourceTypes: Array<"curated" | "live">;
  countries: string[];
  personas: string[];
}

function normalizeText(text?: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeSymptomLabel(label: string): string {
  const clean = normalizeText(label);

  if (clean === "pregnancy concern") return "pregnancy-related concerns";
  if (clean === "painful") return "pain";
  if (clean === "weak") return "weakness";

  return clean;
}

function applyPercentages(
  themes: Omit<AggregatedTheme, "percentage">[],
  totalFindings: number
): AggregatedTheme[] {
  const safeTotal = totalFindings > 0 ? totalFindings : 1;

  return themes.map((theme) => ({
    ...theme,
    percentage: Math.round((theme.count / safeTotal) * 100),
  }));
}

export function aggregateSymptomThemes(findings: CanonicalFinding[]): AggregatedTheme[] {
  const byTheme = new Map<string, Omit<AggregatedTheme, "percentage">>();

  for (const finding of findings) {
    const symptoms = unique((finding.symptoms || []).map(normalizeSymptomLabel));

    for (const symptom of symptoms) {
      const existing = byTheme.get(symptom);

      const sourceTypes = unique(
        (finding.evidence || []).map((e) => e.sourceType)
      ) as Array<"curated" | "live">;

      if (!existing) {
        byTheme.set(symptom, {
          label: symptom,
          count: 1,
          findingIds: [finding.findingId],
          sourceTypes,
          countries: unique(finding.countries || []),
          personas: unique(finding.personas || []),
        });
      } else {
        existing.count += 1;
        existing.findingIds = unique([...existing.findingIds, finding.findingId]);
        existing.sourceTypes = unique([
          ...existing.sourceTypes,
          ...sourceTypes,
        ]) as Array<"curated" | "live">;
        existing.countries = unique([...existing.countries, ...(finding.countries || [])]);
        existing.personas = unique([...existing.personas, ...(finding.personas || [])]);
      }
    }
  }

  return applyPercentages(Array.from(byTheme.values()), findings.length).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

export function aggregatePersonaThemes(findings: CanonicalFinding[]): AggregatedTheme[] {
  const byTheme = new Map<string, Omit<AggregatedTheme, "percentage">>();

  for (const finding of findings) {
    const personas = unique((finding.personas || []).map(normalizeText));

    for (const persona of personas) {
      const existing = byTheme.get(persona);

      const sourceTypes = unique(
        (finding.evidence || []).map((e) => e.sourceType)
      ) as Array<"curated" | "live">;

      if (!existing) {
        byTheme.set(persona, {
          label: persona,
          count: 1,
          findingIds: [finding.findingId],
          sourceTypes,
          countries: unique(finding.countries || []),
          personas: [persona],
        });
      } else {
        existing.count += 1;
        existing.findingIds = unique([...existing.findingIds, finding.findingId]);
        existing.sourceTypes = unique([
          ...existing.sourceTypes,
          ...sourceTypes,
        ]) as Array<"curated" | "live">;
        existing.countries = unique([...existing.countries, ...(finding.countries || [])]);
      }
    }
  }

  return applyPercentages(Array.from(byTheme.values()), findings.length).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

export function aggregateCountryThemes(findings: CanonicalFinding[]): AggregatedTheme[] {
  const byTheme = new Map<string, Omit<AggregatedTheme, "percentage">>();

  for (const finding of findings) {
    const countries = unique((finding.countries || []).map(normalizeText));

    for (const country of countries) {
      const existing = byTheme.get(country);

      const sourceTypes = unique(
        (finding.evidence || []).map((e) => e.sourceType)
      ) as Array<"curated" | "live">;

      if (!existing) {
        byTheme.set(country, {
          label: country,
          count: 1,
          findingIds: [finding.findingId],
          sourceTypes,
          countries: [country],
          personas: unique(finding.personas || []),
        });
      } else {
        existing.count += 1;
        existing.findingIds = unique([...existing.findingIds, finding.findingId]);
        existing.sourceTypes = unique([
          ...existing.sourceTypes,
          ...sourceTypes,
        ]) as Array<"curated" | "live">;
        existing.personas = unique([...existing.personas, ...(finding.personas || [])]);
      }
    }
  }

  return applyPercentages(Array.from(byTheme.values()), findings.length).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

export function formatThemeLabel(label: string): string {
  return titleCase(label);
}