import { CanonicalFinding } from "../models/finding";

export type EvidenceText = {
  rawText: string;
  normalizedText: string;
};

function normalizeWhitespace(
  value: string
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function removeTrackingParameters(
  value: string
): string {
  return value.replace(
    /([?&])(utm_[^=]+|fbclid|gclid)=[^&\s]+/gi,
    "$1"
  );
}

export function buildEvidenceText(
  finding: CanonicalFinding
): EvidenceText {
  const f = finding as any;

  const rawText = [
    f.title,
    f.summary,
    f.excerpt,
    f.description,
    f.text,
    f.canonicalClaim,
    f.author,
    f.publication,
    f.platform,
    f.sourceType,
    f.url,
    ...(Array.isArray(f.labels)
      ? f.labels
      : []),
    ...(Array.isArray(f.normalizedLabels)
      ? f.normalizedLabels
      : []),
  ]
    .filter(Boolean)
    .join(" ");

  const cleanedRawText =
    removeTrackingParameters(
      normalizeWhitespace(rawText)
    );

  return {
    rawText: cleanedRawText,
    normalizedText:
      cleanedRawText.toLowerCase(),
  };
}