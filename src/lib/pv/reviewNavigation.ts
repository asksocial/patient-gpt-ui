export type PvTerminalReviewDecision =
  | "close_not_relevant"
  | "reclassify_health_experience"
  | "escalate";

export type PvReviewCompletionNavigation = {
  tab: "overview";
  destination: "pv_overview";
};

export function resolvePvReviewCompletionNavigation(
  decision: string,
): PvReviewCompletionNavigation | null {
  if (
    decision === "close_not_relevant" ||
    decision === "reclassify_health_experience" ||
    decision === "escalate"
  ) {
    return { tab: "overview", destination: "pv_overview" };
  }

  return null;
}
