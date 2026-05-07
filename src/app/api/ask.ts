import { assembleAnswer } from "../../answering/assembleAnswer";
import { CanonicalFinding } from "../../answering/models/finding";

function classifyIntent(question: string): string {
  const q = question.toLowerCase();

  if (
    q.includes("day-to-day impact") ||
    q.includes("day to day impact") ||
    q.includes("quality of life") ||
    q.includes("qol") ||
    q.includes("symptom burden") ||
    q.includes("biggest symptoms") ||
    q.includes("what symptoms")
  ) {
    return "symptom_qol_burden";
  }

  if (
    q.includes("treatment decision") ||
    q.includes("treatment decisions") ||
    q.includes("treatment choice") ||
    q.includes("why do patients choose") ||
    q.includes("why are patients choosing") ||
    q.includes("treatment journey")
  ) {
    return "treatment_decision_drivers";
  }

  if (
    q.includes("diagnosis") ||
    q.includes("misdiagnosed") ||
    q.includes("time to diagnosis") ||
    q.includes("barriers to diagnosis")
  ) {
    return "diagnosis_barriers";
  }

  if (
    q.includes("side effect") ||
    q.includes("side effects") ||
    q.includes("safety") ||
    q.includes("tolerability")
  ) {
    return "safety_signals";
  }

  if (
    q.includes("market") ||
    q.includes("country") ||
    q.includes("countries") ||
    q.includes("geography") ||
    q.includes("regional") ||
    q.includes("market intelligence")
  ) {
    return "market_landscape";
  }

  if (
    q.includes("persona") ||
    q.includes("caregiver") ||
    q.includes("patient type") ||
    q.includes("patient types")
  ) {
    return "persona_intelligence";
  }

  return "symptom_qol_burden";
}

export function askSocial(question: string, rawCards: CanonicalFinding[]) {
  const intent = classifyIntent(question);

  const debug = {
    rawCount: rawCards.length,
    normalizedCount: rawCards.length,
    exactDedupedCount: rawCards.length,
    clusteredCount: rawCards.length,
    representativeCount: rawCards.length,
    templateFilteredCount: rawCards.length,
    questionIntent: intent,
    templateUsed: intent,
  };

  const answer = assembleAnswer({
    question,
    intent,
    findings: rawCards,
    debug,
    liveDataStatus: rawCards.length > 0 ? "extends" : "not_found",
  });

  return {
    question,
    intent,
    answer,
  };
}