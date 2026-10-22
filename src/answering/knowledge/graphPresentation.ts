import type { ThemeSourceAggregation } from "../themes/themeModels";

const INDEPENDENT_CATEGORIES = new Set([
  "first_person", "caregiver_voice", "provider_voice", "community_voice",
  "research_or_science", "independent_editorial",
]);

export function graphSourceNames(aggregation?: ThemeSourceAggregation) {
  const supported = (values = {}) => Object.entries(values)
    .filter(([, support]) => Number((support as { count: number }).count) > 0)
    .map(([name]) => name);

  return {
    independentSourceCategories: supported(aggregation?.sourceCategories)
      .filter((name) => INDEPENDENT_CATEGORIES.has(name)),
    channels: supported(aggregation?.channels),
  };
}

export function formatGraphMarket(value: string) {
  return String(value).replace(/_/g, " ").replace(/\b\p{L}+/gu, (word) =>
    /^(us|usa|uk|uae|eu|emea|apac|gcc)$/i.test(word)
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

export function graphBubble(label: string, eligiblePercent: number) {
  const lines: string[] = [];
  // Bound each line conservatively at a 14px font, including wide characters.
  for (const word of String(label || "Unnamed theme").split(/\s+/)) {
    const chunks = word.match(/.{1,16}/gu) || [];
    for (const chunk of chunks) {
      const last = lines.length - 1;
      if (last >= 0 && `${lines[last]} ${chunk}`.length <= 16) {
        lines[last] += ` ${chunk}`;
      } else {
        lines.push(chunk);
      }
    }
  }
  const halfWidth = Math.max(...lines.map((line) => Array.from(line).length * 7), 24);
  const halfHeight = ((lines.length + 1) * 20) / 2;
  return {
    lines,
    radius: Math.max(
      Math.ceil(Math.hypot(halfWidth, halfHeight) + 16),
      50 + Math.max(0, Math.min(100, Number(eligiblePercent) || 0)) * 0.5
    ),
  };
}
