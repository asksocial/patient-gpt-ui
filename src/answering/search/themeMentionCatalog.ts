import type { QuestionEvidence } from "./buildQuestionEvidence";

/** Accepts the complete validated theme collection, in the same order as Search samples. */
export function paginateThemeMentions(evidence: QuestionEvidence | undefined, topicId: string, query = "", requestedPage = 1) {
  const topic = evidence?.topics.find(topic => topic.id === topicId);
  if (!topic) return undefined;
  const all = evidence!.examples.filter(example => example.topicId === topicId);
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const remaining = all.slice(2).filter(example => {
    const text = [example.excerpt, example.country, example.language, example.sourceCategory].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(remaining.length / pageSize));
  const page = Math.max(1, Math.min(pages, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  return { theme: topic.label, topicId, totalMatched: all.length, sampleCount: Math.min(2, all.length), total: remaining.length, page, pages, items: remaining.slice((page - 1) * pageSize, page * pageSize) };
}
