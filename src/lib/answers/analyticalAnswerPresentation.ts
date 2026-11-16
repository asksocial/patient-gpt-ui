/** Keep evidence limitations separate without mistaking a finding about
 * available conversations or future research uses for a caveat. */
export function splitAnalyticalAnswer(answer: string) {
  const sentences = String(answer || "").split(/(?<=[.!?])\s+/);
  const isCaveat = (sentence: string) => /\b(?:findings reflect|further research is needed|time comparison is needed|cannot establish|not representative|do not establish|directional only)\b/i.test(sentence);
  return {
    main: sentences.filter(sentence => !isCaveat(sentence)).join(" ").trim(),
    caveats: sentences.filter(isCaveat).join(" ").trim(),
  };
}
