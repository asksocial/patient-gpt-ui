import { loadGlp1PersonaIntelligence } from "./loadGlp1PersonaIntelligence";
import { buildPersonaSection } from "../../answering/rendering/buildRenderedAnswer";

/** Refresh the presentation of full-source GLP-1 composition on read. Stored
 * messages and all historical narrative/evidence remain unchanged. */
export function refreshGlp1PersonaComposition<T extends { analyticalAnswer?: { sections?: any[] } }>(content: T, therapeuticArea: string): T {
  if (!/^glp[\s_-]?1$/i.test(therapeuticArea || "")) return content;
  const sections = content?.analyticalAnswer?.sections;
  if (!Array.isArray(sections) || !sections.some(section => section.key === "persona_intelligence" && section.personaIntelligence?.scope === "full_corpus" && (section.personaIntelligence?.clientGroupingVersion !== 2 || section.personaIntelligence?.corpusCharts?.version !== 1))) return content;
  const summary = loadGlp1PersonaIntelligence();
  return { ...content, analyticalAnswer: { ...content.analyticalAnswer, sections: sections.map(section =>
    section.key === "persona_intelligence" && section.personaIntelligence?.scope === "full_corpus" && section.personaIntelligence.denominator === summary.denominator
      ? buildPersonaSection([], summary) : section
  ) } };
}
