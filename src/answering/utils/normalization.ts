import { LABEL_MAP } from "../config/labelMap";

export function normalizeLabel(label: string): string {
  const key = (label || "").trim().toLowerCase();
  return LABEL_MAP[key] || key.replace(/\s+/g, "_");
}

function normalizeText(text?: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeArray(values?: string[] | string): string[] {
  return Array.from(
    new Set(
      toArray(values)
        .map((v) => normalizeText(v))
        .filter(Boolean)
    )
  );
}

export function buildSemanticFingerprint(raw: any): string {
  const parts = [
    normalizeText(raw.title),
    normalizeText(raw.summary),
    normalizeText(raw.description),
    normalizeText(raw.text),
    normalizeText(raw.excerpt),
    normalizeText(raw.snippet),
    ...normalizeArray(raw.country),
    ...normalizeArray(raw.persona),
    ...normalizeArray(raw.platform),
    ...normalizeArray(raw.labels || []),
    ...normalizeArray(raw.symptoms || []),
    ...normalizeArray(raw.treatments || []),
    ...normalizeArray(raw.lifecycleStage || []),
  ].filter(Boolean);

  return Array.from(new Set(parts)).join("|");
}