import type { PvClockStatus, PvRecordStatus, PvSlaPolicy } from "./types";

const MINUTE = 60_000;

function validTime(value?: string) {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : time;
}
export function calculatePvClock(
  input: {
    status: PvRecordStatus;
    postedAt: string;
    ingestedAt: string;
    identifiedAt: string;
    reportabilityIdentifiedAt?: string;
    reviewedAt?: string;
    transferredAt?: string;
    acknowledgedAt?: string;
  },
  policy: PvSlaPolicy,
  now = new Date()
): PvClockStatus {
  const startCandidates = {
    posted_at: validTime(input.postedAt),
    ingested_at: validTime(input.ingestedAt),
    identified_at: validTime(input.identifiedAt),
    reportability_identified_at: validTime(input.reportabilityIdentifiedAt),
  };
  const initialStart = startCandidates[policy.clockStart];
  if (!initialStart && policy.clockStart === "reportability_identified_at") {
    return {
      stage: "not_started",
      startedAt: "",
      elapsedMinutes: 0,
      percentConsumed: 0,
      state: "not_started",
      governingClock: policy.clockStart,
    };
  }
  if (!initialStart) throw new Error(`A valid ${policy.clockStart} timestamp is required.`);

  let stage: PvClockStatus["stage"] = "review";
  let startedAt = initialStart;
  let limit = policy.reviewMinutes;
  let completedAt = validTime(input.reviewedAt);

  if (["ready_for_transfer", "transferred", "acknowledged", "reconciled"].includes(input.status)) {
    stage = "transfer";
    startedAt = validTime(input.reviewedAt) || initialStart;
    limit = policy.transferMinutes;
    completedAt = validTime(input.transferredAt);
  }
  if (["transferred", "acknowledged", "reconciled"].includes(input.status)) {
    stage = "acknowledgment";
    startedAt = validTime(input.transferredAt) || validTime(input.reviewedAt) || initialStart;
    limit = policy.acknowledgmentMinutes;
    completedAt = validTime(input.acknowledgedAt);
  }
  if (["not_relevant", "acknowledged", "reconciled"].includes(input.status)) {
    stage = "complete";
    completedAt = completedAt || validTime(input.acknowledgedAt) || validTime(input.reviewedAt) || now.getTime();
  }

  const effectiveEnd = completedAt || now.getTime();
  const elapsedMinutes = Math.max(0, Math.floor((effectiveEnd - startedAt) / MINUTE));
  const dueAt = new Date(startedAt + Math.max(0, limit) * MINUTE).toISOString();
  const remainingMinutes = Math.max(0, limit - elapsedMinutes);
  const percentConsumed = limit > 0 ? Math.round((elapsedMinutes / limit) * 100) : 100;
  const state = stage === "complete"
    ? "complete"
    : elapsedMinutes >= limit
      ? "breached"
      : percentConsumed >= 80
        ? "approaching"
        : "healthy";

  return {
    stage,
    startedAt: new Date(startedAt).toISOString(),
    dueAt,
    elapsedMinutes,
    remainingMinutes,
    percentConsumed,
    state,
    governingClock: policy.clockStart,
    governingTimestamp: new Date(initialStart).toISOString(),
  };
}
