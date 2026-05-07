import { FindingType } from "../models/finding";

type RawCard = {
  id?: string;
  title?: string;
  summary?: string;
  description?: string;
  text?: string;
  excerpt?: string;
  snippet?: string;
  country?: string | string[];
  persona?: string | string[];
  platform?: string | string[];
  symptoms?: string[];
  treatments?: string[];
  labels?: string[];
  lifecycleStage?: string | string[];
  findingType?: FindingType;
  therapeuticArea?: string;
};

function normalizeText(text?: string): string {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function toArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function joinList(values: string[], max = 3): string {
  const items = uniq(values).slice(0, max);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const cleaned = normalizeText(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function stripTrailingPeriod(text: string): string {
  return text.replace(/[.]+$/, "").trim();
}

function sentenceCase(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function inferFindingType(raw: RawCard): FindingType {
  if (raw.findingType) return raw.findingType;

  const labels = (raw.labels || []).map((l) => l.toLowerCase());
  const textBlob = [
    raw.title,
    raw.summary,
    raw.description,
    raw.text,
    raw.excerpt,
    raw.snippet,
    ...(raw.labels || []),
    ...(raw.treatments || []),
    ...toArray(raw.lifecycleStage),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (labels.some((l) => l.includes("symptom")) || textBlob.includes("symptom")) {
    return "symptom_burden";
  }

  if (
    labels.some((l) => l.includes("quality of life")) ||
    textBlob.includes("daily life") ||
    textBlob.includes("quality of life")
  ) {
    return "quality_of_life";
  }

  if (labels.some((l) => l.includes("persona")) || textBlob.includes("persona")) {
    return "persona_pattern";
  }

  if (
    raw.country ||
    textBlob.includes("germany") ||
    textBlob.includes("spain") ||
    textBlob.includes("poland")
  ) {
    return "country_pattern";
  }

  if (labels.some((l) => l.includes("platform")) || textBlob.includes("forum")) {
    return "platform_preference";
  }

  if (
    labels.some((l) => l.includes("treatment")) ||
    textBlob.includes("treatment") ||
    textBlob.includes("switch") ||
    textBlob.includes("discontinu") ||
    textBlob.includes("adherence") ||
    textBlob.includes("compliance")
  ) {
    return "treatment_concern";
  }

  if (labels.some((l) => l.includes("diagnosis")) || textBlob.includes("diagnosis")) {
    return "diagnosis_barrier";
  }

  if (labels.some((l) => l.includes("safety")) || textBlob.includes("adverse")) {
    return "safety_signal";
  }

  return "other";
}

function buildSymptomClaim(raw: RawCard): string {
  const symptoms = uniq(raw.symptoms || []);
  const countries = uniq(toArray(raw.country));
  const personas = uniq(toArray(raw.persona));
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);

  if (symptoms.length > 0 && personas.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(personas, 2)} discussions emphasize ${joinList(symptoms)} as key symptom burdens`
      )
    );
  }

  if (symptoms.length > 0 && countries.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(countries, 2)} discussion highlights ${joinList(symptoms)} as major symptom burdens`
      )
    );
  }

  if (symptoms.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(`${joinList(symptoms)} emerge as major symptom burdens in discussion`)
    );
  }

  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }

  return "Symptom burden is a recurring theme in discussion";
}

function buildQolClaim(raw: RawCard): string {
  const symptoms = uniq(raw.symptoms || []);
  const personas = uniq(toArray(raw.persona));
  const countries = uniq(toArray(raw.country));
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);

  if (symptoms.length > 0 && personas.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(personas, 2)} discussions link ${joinList(symptoms)} to daily-life burden`
      )
    );
  }

  if (symptoms.length > 0 && countries.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(countries, 2)} discussions connect ${joinList(symptoms)} with quality-of-life impact`
      )
    );
  }

  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }

  return "Quality-of-life burden is a recurring theme in discussion";
}

function buildPersonaClaim(raw: RawCard): string {
  const personas = uniq(toArray(raw.persona));
  const symptoms = uniq(raw.symptoms || []);
  const countries = uniq(toArray(raw.country));
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);

  if (personas.length > 0 && symptoms.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(personas, 2)} audiences are most associated with ${joinList(symptoms)}`
      )
    );
  }

  if (personas.length > 0 && countries.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(personas, 2)} patterns are especially visible in ${joinList(countries, 2)}`
      )
    );
  }

  if (personas.length > 0) {
    return sentenceCase(stripTrailingPeriod(`${joinList(personas, 2)} represent a distinct discussion pattern`));
  }

  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }

  return "A distinct persona pattern appears in discussion";
}

function buildCountryClaim(raw: RawCard): string {
  const countries = uniq(toArray(raw.country));
  const personas = uniq(toArray(raw.persona));
  const symptoms = uniq(raw.symptoms || []);
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);

  if (countries.length > 0 && symptoms.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(countries, 2)} discussion emphasizes ${joinList(symptoms)} more than other themes`
      )
    );
  }

  if (countries.length > 0 && personas.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(countries, 2)} shows a stronger ${joinList(personas, 2)} pattern`
      )
    );
  }

  if (countries.length > 0 && sourceText) {
    return sentenceCase(stripTrailingPeriod(`${joinList(countries, 2)}: ${sourceText}`));
  }

  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }

  return "A country-specific pattern appears in discussion";
}

function buildPlatformClaim(raw: RawCard): string {
  const platforms = uniq(toArray(raw.platform));
  const countries = uniq(toArray(raw.country));
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);

  if (platforms.length > 0 && countries.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(platforms, 2)} are leading discussion platforms in ${joinList(countries, 2)}`
      )
    );
  }

  if (platforms.length > 0) {
    return sentenceCase(stripTrailingPeriod(`${joinList(platforms, 2)} are leading discussion platforms`));
  }

  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }

  return "Platform preference appears as a secondary discussion pattern";
}

function buildTreatmentClaim(raw: RawCard): string {
  const treatments = uniq(raw.treatments || []);
  const personas = uniq(toArray(raw.persona));
  const countries = uniq(toArray(raw.country));
  const lifecycleStages = uniq(toArray(raw.lifecycleStage));
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);

  if (treatments.length > 0 && lifecycleStages.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(treatments)} are most associated with ${joinList(lifecycleStages, 2)} in discussion`
      )
    );
  }

  if (treatments.length > 0 && personas.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(personas, 2)} discussions focus on ${joinList(treatments)} as key treatment concerns`
      )
    );
  }

  if (treatments.length > 0 && countries.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(countries, 2)} discussion focuses on ${joinList(treatments)} as treatment priorities`
      )
    );
  }

  if (treatments.length > 0) {
    return sentenceCase(stripTrailingPeriod(`${joinList(treatments)} emerge as key treatment concerns`));
  }

  if (lifecycleStages.length > 0 && sourceText) {
    return sentenceCase(stripTrailingPeriod(`${joinList(lifecycleStages, 2)}: ${sourceText}`));
  }

  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }

  return "Treatment concern is a recurring theme in discussion";
}

function buildDiagnosisClaim(raw: RawCard): string {
  const countries = uniq(toArray(raw.country));
  const personas = uniq(toArray(raw.persona));
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);

  if (personas.length > 0 && countries.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(
        `${joinList(personas, 2)} in ${joinList(countries, 2)} describe notable diagnosis barriers`
      )
    );
  }

  if (countries.length > 0) {
    return sentenceCase(
      stripTrailingPeriod(`${joinList(countries, 2)} discussion highlights barriers to diagnosis`)
    );
  }

  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }

  return "Barriers to diagnosis are a recurring theme in discussion";
}

function buildSafetyClaim(raw: RawCard): string {
  const countries = uniq(toArray(raw.country));
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);

  if (countries.length > 0 && sourceText) {
    return sentenceCase(stripTrailingPeriod(`${joinList(countries, 2)} discussion highlights: ${sourceText}`));
  }

  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }

  return "Safety-related concerns appear in discussion";
}

function buildFallbackClaim(raw: RawCard): string {
  const sourceText = firstNonEmpty(raw.summary, raw.description, raw.text, raw.excerpt, raw.snippet, raw.title);
  if (sourceText) {
    return sentenceCase(stripTrailingPeriod(sourceText));
  }
  return "A distinct discussion finding was identified";
}

export function buildCanonicalClaim(raw: RawCard): string {
  const findingType = inferFindingType(raw);

  switch (findingType) {
    case "symptom_burden":
      return buildSymptomClaim(raw);
    case "quality_of_life":
      return buildQolClaim(raw);
    case "persona_pattern":
      return buildPersonaClaim(raw);
    case "country_pattern":
      return buildCountryClaim(raw);
    case "platform_preference":
      return buildPlatformClaim(raw);
    case "treatment_concern":
      return buildTreatmentClaim(raw);
    case "diagnosis_barrier":
      return buildDiagnosisClaim(raw);
    case "safety_signal":
      return buildSafetyClaim(raw);
    default:
      return buildFallbackClaim(raw);
  }
}