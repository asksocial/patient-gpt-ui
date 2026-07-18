export const IGNORED_DIMENSION_VALUES = new Set([
  "",
  "unknown",
  "unspecified",
  "none",
  "null",
  "undefined",
  "n/a",
  "na",
  "not available",
  "not applicable",
  "other",
]);

export function normalizeDimensionValue(
  value: unknown
): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isMeaningfulDimensionValue(
  value: unknown
): boolean {
  const normalized =
    normalizeDimensionValue(value);

  return (
    normalized.length > 0 &&
    !IGNORED_DIMENSION_VALUES.has(
      normalized
    )
  );
}

export function filterMeaningfulDimensionValues(
  values: unknown[]
): string[] {
  return Array.from(
    new Set(
      values
        .map(normalizeDimensionValue)
        .filter(
          isMeaningfulDimensionValue
        )
    )
  );
}