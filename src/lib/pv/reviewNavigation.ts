export type PvTerminalReviewDecision =
  | "close_not_relevant"
  | "reclassify_health_experience"
  | "escalate";

export type PvReviewCompletionNavigation = {
  tab: "overview" | "handoff";
  destination: "pv_overview" | "pv_handoff";
};

export function resolvePvReviewCompletionNavigation(
  decision: string,
): PvReviewCompletionNavigation | null {
  if (decision === "escalate") return { tab: "handoff", destination: "pv_handoff" };
  if (
    decision === "close_not_relevant" ||
    decision === "reclassify_health_experience" ||
    decision === "escalate"
  ) {
    return { tab: "overview", destination: "pv_overview" };
  }

  return null;
}
