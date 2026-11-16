// Semantic labels retain their values; only the shared visual treatment changes.
export const PRIORITY_STYLES = { high: "as-badge-caution font-semibold", medium: "as-badge-caution", low: "as-badge-neutral" };
export const CONFIDENCE_STYLES = { high: "as-badge-success", medium: "as-badge-caution", moderate: "as-badge-caution", directional: "as-badge-neutral", insufficient: "as-badge-neutral" };

export function formatConfidenceLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b[a-z]/g, letter => letter.toUpperCase());
}
