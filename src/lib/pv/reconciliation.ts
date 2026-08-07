import type { PvReconciliationInput, PvReconciliationIssue } from "./types";

export function reconcilePvOperations(input: PvReconciliationInput) {
  const issues: PvReconciliationIssue[] = [];
  const transfersByRecord = new Map<string, typeof input.transfers>();
  for (const transfer of input.transfers) {
    transfersByRecord.set(transfer.recordId, [...(transfersByRecord.get(transfer.recordId) || []), transfer]);
  }

  for (const record of input.records) {
    const transfers = transfersByRecord.get(record.id) || [];
    if (record.reviewedAt && record.status === "ready_for_transfer" && transfers.length === 0) {
      issues.push({ type: "reviewed_not_transferred", recordId: record.id, detail: "Reviewed record has no transfer package.", severity: "critical" });
    }
    if (record.status === "transferred" && !record.acknowledgedAt) {
      issues.push({ type: "transferred_not_acknowledged", recordId: record.id, detail: "Sponsor acknowledgment has not been recorded.", severity: "critical" });
    }
    if (transfers.length > 1) {
      issues.push({ type: "duplicate_transfer", recordId: record.id, detail: `${transfers.length} transfer packages exist for one PV record.`, severity: "critical" });
    }
    if (["new", "in_review", "ready_for_transfer"].includes(record.status)) {
      issues.push({ type: "open_record", recordId: record.id, detail: `Record remains open with status ${record.status}.`, severity: "warning" });
    }
    if (record.transferredAt && record.reviewedAt && new Date(record.transferredAt) < new Date(record.reviewedAt)) {
      issues.push({ type: "timestamp_discrepancy", recordId: record.id, detail: "Transfer timestamp precedes human review.", severity: "critical" });
    }
  }

  const periodEnd = new Date(input.periodEnd).getTime();
  for (const source of input.sources.filter((item) => item.active)) {
    const lastScreened = source.lastScreenedAt ? new Date(source.lastScreenedAt).getTime() : 0;
    if (!lastScreened || periodEnd - lastScreened > source.cadenceMinutes * 60_000) {
      issues.push({ type: "missing_screening_run", sourceId: source.id, detail: "Source was not screened within its required cadence.", severity: "critical" });
    }
    if (lastScreened && !source.lastNilReturnAt) {
      issues.push({ type: "missing_nil_return", sourceId: source.id, detail: "Screening completed without a record or documented nil return.", severity: "warning" });
    }
  }

  return {
    status: issues.length === 0 ? "reconciled" as const : "exceptions" as const,
    issueCount: issues.length,
    criticalCount: issues.filter((issue) => issue.severity === "critical").length,
    explainedCount: 0,
    issues,
    objective: "Zero unexplained records",
  };
}
