/** Source-language cues for extraction proposals, never a clinical assessment. */
export type EvidenceAssertion = "asserted" | "negated" | "uncertain";

export function evidenceOccurrences(text: string, pattern: RegExp) {
  const flags = [...new Set((pattern.flags.replace(/[gy]/g, "") + "g").split(""))].join("");
  return [...text.matchAll(new RegExp(pattern.source, flags))].map(match => {
    const index = match.index!;
    // A sentence, source boundary, contrast, or new subject/predicate ends scope.
    const prefix = text.slice(0, index).replace(/[\u2018\u2019]/g, "'")
      .split(/[.!?;\n]|\b(?:but|however|yet|then|just|instead)\b|(?:,|\band\b)\s*(?:I|we|he|she|they|it|the patient)\s+(?:was|were|am|is|are|had|have|has|developed|became)\b/i).pop()!
      .replace(/\b(?:not only|not to mention|no doubt|without doubt)\b/gi, "");
    const cues = [...prefix.matchAll(/\b(?:cannot rule out|can't rule out|not ruled out|not without|risk of|worried about|can cause|may cause|could cause|would|could|might|if|heard|read|nearly|almost|no|not|never|without|denies|denied|wasn't|weren't|isn't|aren't|don't|doesn't|didn't|hasn't|haven't|won't|wouldn't)\b/gi)];
    const cue = cues.at(-1)?.[0].toLowerCase();
    let assertion: EvidenceAssertion = !cue ? "asserted" : /^(?:no|not|never|without|denies|denied|wasn't|weren't|isn't|aren't|don't|doesn't|didn't|hasn't|haven't|won't|wouldn't)$/.test(cue) ? "negated" : "uncertain";
    // Postposed denial is common in source reports. Unresolved possibilities stay reviewable.
    const suffix = text.slice(index + match[0].length);
    if (/^\s+(?:(?:was|were|is|are|has been|had been)\s+)?not ruled out\b/i.test(suffix)) assertion = "uncertain";
    else if (/^\s+(?:(?:was|were|is|are|has been|had been)\s+)?(?:ruled out|denied|absent|not (?:required|reported|present))\b/i.test(suffix)) assertion = "negated";
    return { evidence: match[0], index, assertion };
  });
}

export function findEvidence(text: string, pattern: RegExp, includeUncertain = false) {
  const occurrences = evidenceOccurrences(text, pattern);
  return occurrences.find(item => item.assertion === "asserted")
    || (includeUncertain ? occurrences.find(item => item.assertion === "uncertain") : undefined);
}

export function literalEvidencePattern(evidence: string) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${evidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
}
