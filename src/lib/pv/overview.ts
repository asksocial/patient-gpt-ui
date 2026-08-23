import { calculatePvClock } from "./clock";
import type { PvRecordStatus, PvSlaPolicy } from "./types";

export const DEFAULT_PV_SLA: PvSlaPolicy = {
  reviewMinutes: 15 * 24 * 60,
  transferMinutes: 24 * 60,
  acknowledgmentMinutes: 48 * 60,
  clockStart: "posted_at",
  timezone: "UTC",
};

type OverviewRecord = {
  id: string;
  status: PvRecordStatus;
  assigned_reviewer_id?: string | null;
  sla_policy_id?: string | null;
  day_zero_basis?: "posted_at" | "identified_at" | "reportability_identified_at" | null;
  posted_at: string;
  ingested_at: string;
  identified_at: string;
  reportability_identified_at?: string | null;
};

type OverviewReview = { record_id: string; reviewed_at: string };
type OverviewTransfer = {
  record_id: string;
  status: "queued" | "delivered" | "acknowledged" | "failed";
  transferred_at?: string | null;
  acknowledged_at?: string | null;
  created_at?: string | null;
};
type OverviewReviewList = {
  status?: string | null;
  assigned_to?: string | null;
  items?: Array<{ record_id: string }>;
};
type OverviewPolicy = {
  id: string;
  review_minutes: number;
  transfer_minutes: number;
  acknowledgment_minutes: number;
  clock_start: PvSlaPolicy["clockStart"];
  timezone: string;
};
type OverviewScreeningRun = { status: string; nil_return?: boolean | null };

function latestByRecord<T extends { record_id: string }>(rows: T[], dateOf: (row: T) => string | null | undefined) {
  const result = new Map<string, T>();
  for (const row of rows) {
    const current = result.get(row.record_id);
    const rowTime = new Date(dateOf(row) || 0).getTime();
    const currentTime = current ? new Date(dateOf(current) || 0).getTime() : -1;
    if (!current || rowTime >= currentTime) result.set(row.record_id, row);
  }
  return result;
}

export function derivePvOverviewMetrics(input: {
  records: OverviewRecord[];
  reviews?: OverviewReview[];
  transfers?: OverviewTransfer[];
  reviewLists?: OverviewReviewList[];
  policies?: OverviewPolicy[];
  screeningRuns?: OverviewScreeningRun[];
  now?: Date;
}) {
  const records = input.records || [];
  const reviews = input.reviews || [];
  const transfers = input.transfers || [];
  const reviewLists = input.reviewLists || [];
  const policies = new Map((input.policies || []).map((policy) => [policy.id, policy]));
  const latestReviews = latestByRecord(reviews, (review) => review.reviewed_at);
  const latestTransfers = latestByRecord(transfers, (transfer) => transfer.created_at || transfer.transferred_at);
  const assignedThroughLists = new Set(
    reviewLists
      .filter((list) => list.status !== "archived" && Boolean(list.assigned_to?.trim()))
      .flatMap((list) => (list.items || []).map((item) => item.record_id))
  );
  const reviewedStatuses = new Set<PvRecordStatus>([
    "not_relevant",
    "ready_for_transfer",
    "transferred",
    "acknowledged",
    "reconciled",
  ]);
  const awaitingStatuses = new Set<PvRecordStatus>(["new", "in_review"]);
  const terminalStatuses = new Set<PvRecordStatus>(["not_relevant", "acknowledged", "reconciled"]);

  const statusCounts = records.reduce((counts: Record<string, number>, record) => {
    counts[record.status] = (counts[record.status] || 0) + 1;
    return counts;
  }, {});
  const reviewedRecordIds = new Set(
    records
      .filter((record) => latestReviews.has(record.id) || reviewedStatuses.has(record.status))
      .map((record) => record.id)
  );
  const assignedRecordIds = new Set(
    records
      .filter((record) => Boolean(record.assigned_reviewer_id?.trim()) || assignedThroughLists.has(record.id))
      .map((record) => record.id)
  );
  const awaitingReview = records.filter(
    (record) => awaitingStatuses.has(record.status) && !reviewedRecordIds.has(record.id)
  );

  let approachingSla = 0;
  let unassignedActiveClock = 0;
  for (const record of records) {
    if (terminalStatuses.has(record.status)) continue;
    const review = latestReviews.get(record.id);
    const transfer = latestTransfers.get(record.id);
    const configured = record.sla_policy_id ? policies.get(record.sla_policy_id) : undefined;
    const policy: PvSlaPolicy = configured ? {
      reviewMinutes: Number(configured.review_minutes),
      transferMinutes: Number(configured.transfer_minutes),
      acknowledgmentMinutes: Number(configured.acknowledgment_minutes),
      clockStart: configured.clock_start,
      timezone: configured.timezone,
    } : DEFAULT_PV_SLA;
    const effectivePolicy: PvSlaPolicy = {
      ...policy,
      clockStart: record.day_zero_basis === "reportability_identified_at"
        ? "reportability_identified_at"
        : record.day_zero_basis === "identified_at" ? "identified_at" : policy.clockStart,
    };
    const clock = calculatePvClock({
      status: record.status,
      postedAt: record.posted_at,
      ingestedAt: record.ingested_at,
      identifiedAt: record.identified_at,
      reportabilityIdentifiedAt: record.reportability_identified_at || undefined,
      reviewedAt: review?.reviewed_at,
      transferredAt: transfer?.transferred_at || undefined,
      acknowledgedAt: transfer?.acknowledged_at || undefined,
    }, effectivePolicy, input.now || new Date());
    if (clock.state === "approaching" || clock.state === "breached") approachingSla += 1;
    if (
      clock.stage === "review" &&
      awaitingStatuses.has(record.status) &&
      !reviewedRecordIds.has(record.id) &&
      !assignedRecordIds.has(record.id)
    ) unassignedActiveClock += 1;
  }

  const transferredRecordIds = new Set(
    records
      .filter((record) => ["transferred", "acknowledged", "reconciled"].includes(record.status))
      .map((record) => record.id)
  );
  for (const transfer of transfers) {
    if (["delivered", "acknowledged"].includes(transfer.status)) transferredRecordIds.add(transfer.record_id);
  }
  const unacknowledgedRecordIds = new Set(
    records.filter((record) => record.status === "transferred").map((record) => record.id)
  );
  for (const transfer of latestTransfers.values()) {
    if (transfer.status === "delivered" && !transfer.acknowledged_at) unacknowledgedRecordIds.add(transfer.record_id);
    if (transfer.status === "acknowledged" || transfer.acknowledged_at) unacknowledgedRecordIds.delete(transfer.record_id);
  }
  const triagedRecordIds = new Set([...reviewedRecordIds, ...assignedRecordIds]);

  return {
    metrics: {
      totalRecords: records.length,
      reviewedRecords: reviewedRecordIds.size,
      screeningCompliance: records.length ? Math.round((triagedRecordIds.size / records.length) * 1000) / 10 : 100,
      unassignedActiveClock,
      awaitingReview: awaitingReview.length,
      approachingSla,
      transferred: transferredRecordIds.size,
      unacknowledged: unacknowledgedRecordIds.size,
      nilReturns: (input.screeningRuns || []).filter((run) => run.status === "completed" && run.nil_return).length,
      reconciliationCompletion: records.length ? Math.round(((statusCounts.reconciled || 0) / records.length) * 100) : 100,
    },
    statusCounts,
  };
}
