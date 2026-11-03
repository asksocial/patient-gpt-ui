/** Shared editorial standard for client-facing prose across AskSocial.
 * Evidence selection, quotations, metrics and structured records are unchanged. */
export const CLIENT_NARRATIVE_VERSION = 2;

export const CLIENT_NARRATIVE_INSTRUCTIONS = `
Write every client-facing narrative in a calm, clear, professional voice, using connected prose rather than a topic inventory or a description of the analysis process.
Lead with a direct, question-specific synthesis of what the supplied evidence discusses. Develop the relevant themes and explain their practical significance. Close with the material uncertainty or further research needed, woven naturally into the explanation.
Usually use one concise paragraph of three to five sentences; use additional paragraphs when the question needs more depth. Keep recommended actions and requested structured fields in their required format.
Apply this approach to direct answers, summaries, strategic interpretations and narrative work-product sections, regardless of topic, market, persona or mode. Do not echo the entire question or use stock phrases such as "The matching material", "evaluated eligible findings", or "strategic signals indicate".
Use only supplied evidence. Distinguish conversations, reported experiences, professional commentary and promotional material. Describe source-country metadata as conversation origins, not verified patient residence or local policy. Do not turn topic mentions into causal explanations, prevalence, proven outcomes or treatment advice. Preserve citations, exact source quotations, numerical qualifications, explicit evidence gaps and required human review.
When evidence is limited or absent, explain what cannot yet be answered and what additional evidence would help; never invent a substantive theme to complete the narrative structure.
`.trim();

export function joinNarrativeList(items: string[]): string {
  const clean = [...new Set(items.map(item => item.replace(/\s+/g, " ").trim()).filter(Boolean))];
  return clean.length > 2 ? `${clean.slice(0, -1).join(", ")}, and ${clean.at(-1)}` : clean.join(" and ");
}

export function clientNarrative(parts: {
  opening: string;
  observations?: string[];
  significance?: string;
  limitation?: string;
}): string {
  return [parts.opening, ...(parts.observations || []), parts.significance, parts.limitation]
    .map(text => text?.replace(/\s+/g, " ").trim())
    .filter(Boolean).join(" ");
}

export function topicNarrative(input: {
  themes: string[];
  sourceDescription?: string;
  context?: string;
  significance: string;
  limitation: string;
  observations?: string[];
  emptyMessage?: string;
}): string {
  const themes = joinNarrativeList(input.themes);
  if (!themes) return input.emptyMessage || "The available material does not yet provide enough evidence to describe a clear pattern. Additional relevant sources would help clarify the discussion before conclusions are drawn.";
  return clientNarrative({
    opening: `${input.sourceDescription || "The available conversations"}${input.context ? ` ${input.context}` : ""} highlight ${themes}.`,
    observations: input.observations,
    significance: input.significance,
    limitation: input.limitation,
  });
}
