import { loadCurrentGlp1ExecutiveIntelligence } from "./loadCurrentGlp1ExecutiveIntelligence";
import { buildSourceIntelligence } from "./buildSourceIntelligence";
import { buildSourceGroundedSearchAnswer, type HybridAnswer } from "./composeHybridAnswer";
import { loadCanonicalFindingsForAsk } from "./loadCanonicalFindingsForAsk";
import { selectSearchCorpusForQuestion, filterSearchInsightsForQuestion } from "./loadSearchCorpusIntelligence";
import { buildCorpusBurdenAnswer, buildFocusedSearchAnswer } from "../../answering/personas/buildCorpusCharts";
import { buildPersonaSection } from "../../answering/rendering/buildRenderedAnswer";

/** Upgrade saved Search presentation from the topic's registered corpus.
 * Stored messages, evidence, and non-Search products remain unchanged. */
export function refreshSearchCorpusIntelligence<T extends { analyticalAnswer?: { directAnswer?: string; sections?: any[] } }>(content: T, therapeuticArea: string, question = ""): T {
  const answer = content?.analyticalAnswer;
  if (!answer || !Array.isArray(answer.sections)) return content;
  const corpus = loadCanonicalFindingsForAsk(therapeuticArea);
  if (corpus.status !== "available") return content;
  const previousSummary = answer.sections.find(section => section.personaIntelligence)?.personaIntelligence;
  const scopedQuestion = question || previousSummary?.queryContext?.question || "";
  const selection = selectSearchCorpusForQuestion(therapeuticArea, corpus.findings, scopedQuestion);
  const summary = selection.summary;
  const sourceIntelligence = buildSourceIntelligence(selection.findings, summary.questionEvidence);
  const saved = content as T & { answer?: HybridAnswer; relevantCuratedInsights?: any[]; curatedIntelligenceAvailable?: boolean };
  const insights = summary.queryContext ? filterSearchInsightsForQuestion(therapeuticArea, corpus.findings, scopedQuestion, saved.relevantCuratedInsights || []) : saved.relevantCuratedInsights || [];
  const focusChanged = summary.queryContext && (previousSummary?.questionEvidence?.version !== summary.questionEvidence?.version || JSON.stringify(previousSummary?.queryContext?.filters) !== JSON.stringify(summary.queryContext.filters) || previousSummary?.denominator !== summary.denominator || previousSummary?.analyticalCount !== summary.analyticalCount);
  const refreshedHybrid = focusChanged && saved.answer ? buildSourceGroundedSearchAnswer({ questionEvidence: summary.questionEvidence, question: scopedQuestion, therapeuticArea, curatedThemes: sourceIntelligence.curatedThemes, liveThemes: sourceIntelligence.socialThemes, matches: [], curatedInsights: insights }) : saved.answer;
  const persona = buildPersonaSection([], summary);
  const hasBurdens = answer.sections.some(section => section.key === "top_burdens");
  const directAnswer = summary.queryContext ? buildFocusedSearchAnswer(summary) : hasBurdens && summary.corpusCharts ? buildCorpusBurdenAnswer(summary.corpusCharts.burdens) : answer.directAnswer;
  const sections = answer.sections.filter(section => section.key !== "persona_intelligence" && section.key !== "strategic_implications" && !/^what this means$/i.test(section.title || ""));
  if (persona) sections.push(persona);
  const executive = loadCurrentGlp1ExecutiveIntelligence(therapeuticArea, scopedQuestion);
  return { ...content, ...(executive || {}), sourceIntelligence, ...(refreshedHybrid ? { answer: refreshedHybrid } : {}), ...(summary.queryContext ? { relevantCuratedInsights: insights, curatedIntelligenceAvailable: sourceIntelligence.curatedThemes.length > 0 || insights.length > 0 } : {}), analyticalAnswer: { ...answer, directAnswer, sections } };
}
