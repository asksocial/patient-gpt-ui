import { buildCorpusBurdenAnswer } from "../../answering/personas/buildCorpusCharts";
import { loadGlp1PersonaIntelligence } from "./loadGlp1PersonaIntelligence";
import { buildPersonaSection } from "../../answering/rendering/buildRenderedAnswer";

/** Refresh the presentation of full-source GLP-1 composition on read. Stored
 * messages and evidence remain unchanged; the displayed burden overview uses
 * the same corpus counts as the charts. */
export function refreshGlp1PersonaComposition<T extends { analyticalAnswer?: { directAnswer?: string; sections?: any[] } }>(content: T, therapeuticArea: string): T {
  if (!/^glp[\s_-]?1$/i.test(therapeuticArea || "")) return content;
  const sections = content?.analyticalAnswer?.sections;
  if (!Array.isArray(sections) || !sections.some(section => section.key === "persona_intelligence" && section.personaIntelligence?.scope === "full_corpus")) return content;
  const summary = loadGlp1PersonaIntelligence();
  const burdenAnswer = sections.some(section => section.key === "top_burdens") && summary.corpusCharts
    ? buildCorpusBurdenAnswer(summary.corpusCharts.burdens) : content.analyticalAnswer?.directAnswer;
  const needsRefresh = sections.some(section => section.key === "persona_intelligence" && section.personaIntelligence?.scope === "full_corpus" && (section.personaIntelligence?.clientGroupingVersion !== 2 || section.personaIntelligence?.corpusCharts?.version !== 1));
  if (!needsRefresh && burdenAnswer === content.analyticalAnswer?.directAnswer) return content;
  return { ...content, analyticalAnswer: { ...content.analyticalAnswer, directAnswer: burdenAnswer, sections: sections.map(section =>
    section.key === "persona_intelligence" && section.personaIntelligence?.scope === "full_corpus" && section.personaIntelligence.denominator === summary.denominator
      ? buildPersonaSection([], summary) : section
  ) } };
}
