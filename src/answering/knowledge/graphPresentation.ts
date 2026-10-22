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

function wrapGraphLabel(label: string): string[] {
  const width = (text: string) => Array.from(text).reduce((sum, char) =>
    sum + (/[MWmw]/.test(char) ? 15 : /[ilIft r.,'’]/.test(char) ? 5 : 10), 0);
  const lines: string[] = [];
  for (const word of String(label || "Unnamed theme").split(/\s+/).filter(Boolean)) {
    const chunks: string[] = [];
    let chunk = "";
    for (const char of Array.from(word)) {
      if (chunk && width(chunk + char) > 138) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += char;
    }
    if (chunk) chunks.push(chunk);
    for (const part of chunks) {
      const last = lines.length - 1;
      if (last >= 0 && width(`${lines[last]} ${part}`) <= 138) {
        lines[last] += ` ${part}`;
      } else {
        lines.push(part);
      }
    }
  }
  return lines;
}

export function graphArcLayout(nodes: Array<{ themeId: string; label: string; eligiblePercent?: number }>) {
  const width = Math.max(760, nodes.length * 144 + 96);
  const span = nodes.length > 1 ? width - 240 : 0;
  const baseline = nodes.length > 1 ? Math.ceil(Math.max(250, span * 0.31 + 70)) : 150;
  const prevalence = (value: number) => Math.max(0, Math.min(100, Number(value) || 0));
  const largest = Math.max(1, ...nodes.map((node) => prevalence(node.eligiblePercent)));
  const positions = new Map(nodes.map((node, index) => [node.themeId, {
    label: node.label,
    x: nodes.length > 1 ? 120 + (index * span) / (nodes.length - 1) : width / 2,
    radius: 56 * Math.sqrt(prevalence(node.eligiblePercent) / largest),
    lines: wrapGraphLabel(node.label),
  }]));
  const lineCount = Math.max(1, ...Array.from(positions.values(), (position) => position.lines.length));
  return { width, height: baseline + 82 + lineCount * 23 + 50, baseline, positions };
}
