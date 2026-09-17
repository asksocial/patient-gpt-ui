export type PvTerminalReviewDecision =
  | "close_not_relevant"
  | "reclassify_health_experience";

export type PvReviewCompletionNavigation = {
  tab: "overview" | "health";
  destination: "pv_overview" | "pv_health";
};

export function resolvePvReviewCompletionNavigation(
  decision: string,
): PvReviewCompletionNavigation | null {
  if (decision === "close_not_relevant") {
    return { tab: "overview", destination: "pv_overview" };
  }

  if (decision === "reclassify_health_experience") {
    return { tab: "health", destination: "pv_health" };
  }

  return null;
}
