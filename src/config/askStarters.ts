export type AskStarter = { id: string; category: string; question: string };
type StarterDefinition = { id: string; category: string; template: string; requiresReport?: boolean };

const DEFAULT_STARTERS: StarterDefinition[] = [
  { id: "baseline", category: "Baseline themes", template: "What are the main themes in {topic} conversations?" },
  { id: "emerging", category: "Emerging narratives", template: "Which {topic} narratives are gaining traction?" },
  { id: "concerns", category: "Changing concerns", template: "How have concerns about {topic} changed over time?" },
  { id: "trust", category: "Trust signals", template: "Which sources do patients trust for {topic} information?" },
  { id: "countries", category: "Country differences", template: "How do {topic} conversations differ across countries?" },
  { id: "shifted", category: "What has shifted", template: "What has changed since the last report?", requiresReport: true },
];

// Topic-specific wording lives here, independently of rendering and handlers.
const TOPIC_STARTERS: Record<string, Partial<Record<string, string>>> = {
  glp_1: { concerns: "How have concerns about side effects changed over time?" },
};

export function buildAskStarters(topic: string, context: { topMarkets?: string[]; hasPreviousReport?: boolean } = {}): AskStarter[] {
  if (!topic.trim()) return [];
  const key = topic.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const overrides = TOPIC_STARTERS[key === "glp1" ? "glp_1" : key] || {};
  const markets = [...new Set(context.topMarkets || [])].filter(Boolean).slice(0, 2);
  return DEFAULT_STARTERS.filter(item => !item.requiresReport || context.hasPreviousReport).map(item => {
    let template = overrides[item.id] || item.template;
    if (item.id === "countries" && markets.length === 2) template = `How do {topic} conversations differ between ${markets[0]} and ${markets[1]}?`;
    return { id: item.id, category: item.category, question: template.replaceAll("{topic}", topic) };
  });
}
