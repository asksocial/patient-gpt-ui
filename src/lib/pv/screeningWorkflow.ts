/** Explicit reviewer actions; viewing history never reopens a completed review. */
export function screeningReviewAccess(status: string) {
  return { canStart: ["new", "in_review"].includes(status), canReopen: ["not_relevant", "health_experience"].includes(status) };
}

export function validateObservationForward(input: { productMention: string; healthExperience: string; classifications: unknown[]; followUpOwner?: string; followUpDueAt?: string }, now = Date.now()) {
  if (input.productMention !== "yes" || input.healthExperience !== "yes" || !input.classifications.length || !input.followUpOwner?.trim() || !Number.isFinite(Date.parse(input.followUpDueAt || "")) || Date.parse(input.followUpDueAt!) <= now) {
    throw new Error("Forwarding requires confirmed product and safety relevance, a classification, a follow-up owner and a future deadline. Missing patient or reporter details may remain unclear.");
  }
}

/** Closing/forwarding a record does not undo an earlier reviewer classification. */
export function retainedReviewSegmentation(record: Record<string, any>) {
  return {
    reviewer_detection_segment: record.reviewer_detection_segment ?? null,
    reviewer_health_experience_tags: record.reviewer_health_experience_tags ?? null,
    segment_reclassified_at: record.segment_reclassified_at ?? null,
    segment_reclassified_by: record.segment_reclassified_by ?? null,
  };
}
