import type { BuilderSource } from "../service";
import { ProviderFailure, validateAcquisitionInput, type AcquisitionProvider, type DatasetOwnership } from "./provider";

export type Work = {
  id: string;
  plan_id: string;
  provider: string;
  mapping_ref: string;
  mapping_digest: string;
  normalization_version: string;
  exclusive_dataset_required: boolean;
  platform: string;
  query: string;
  start: string;
  end: string;
  max_rows: number;
  cents: number;
  rows: number;
  offset: number;
  deadline: string;
  phase: "ready" | "submitting" | "running" | "paging";
  lease_token: string;
  submitted_at: string | null;
  run_id: string | null;
  dataset_id: string | null;
  collected_at: string | null;
  verified_cost: number | null;
  failures: number;
  cancel_requested: boolean;
  abort_sent: boolean;
};

type ReviewCode = "ambiguous" | "schema" | "partial" | "usage" | "limit" | "deadline" | "provider";
type Transition =
  | ["submit", Record<string, never>]
  | ["run", { run_id: string }]
  | ["bind", { run_id: string; dataset_id: string; collected_at: string; total: number; cents: number; ownership?: DatasetOwnership }]
  | ["page", { dataset_id: string; offset: number; total: number; rows: BuilderSource[] }]
  | ["finish", { outcome: "succeeded" | "cancelled" | "failed"; cents: number; run_id?: string }]
  | ["abort_sent" | "wait" | "retry", { delay: number }]
  | ["review", { code: ReviewCode }];

export interface AcquisitionStore {
  claim(plan: string): Promise<Work | null>;
  advance(work: Work, ...transition: Transition): Promise<void>;
  cancel(workId: string): Promise<void>;
  openDatasetRead(work: Work): Promise<string | null>;
  closeDatasetRead(work: Work, token: string): Promise<void>;
}

export class AcquisitionStoreError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super("Acquisition operation rejected.");
  }
}

const PAGE_SIZE = 10;

export async function runAcquisitionStep(options: {
  planId: string;
  workspace: string;
  store: AcquisitionStore;
  providerFor: (provider: string, ref: string) => AcquisitionProvider | undefined;
  now?: () => number;
}): Promise<"idle" | "processed"> {
  const { store, workspace } = options;
  const work = await store.claim(options.planId);
  if (!work) return "idle";

  const advance = (...step: Transition) => store.advance(work, ...step);
  const review = (code: ReviewCode) => advance("review", { code });
  const expiry = Date.parse(work.deadline) <= (options.now ?? Date.now)();
  if (expiry && !work.cancel_requested) await store.cancel(work.id);
  const cancel = expiry || work.cancel_requested;
  if (cancel && work.phase === "ready") {
    await advance("finish", { outcome: "cancelled", cents: 0 });
    return "processed";
  }

  const provider = options.providerFor(work.provider, work.mapping_ref);
  if (!provider || provider.approval.provider !== work.provider || provider.approval.ref !== work.mapping_ref ||
    provider.approval.fingerprint !== work.mapping_digest ||
    provider.approval.normalizationVersion !== work.normalization_version || provider.approval.platform !== work.platform ||
    (work.exclusive_dataset_required && !provider.inspectExclusiveDataset)) {
    await review("provider");
    return "processed";
  }
  // PostgreSQL serializes timestamptz with +00:00. Persist a stable UTC input
  // for both the original submission and subsequent reconciliation.
  const input = {
    correlationId: work.id, query: work.query,
    start: new Date(work.start).toISOString(), end: new Date(work.end).toISOString(),
    maxRows: work.max_rows, cents: work.cents,
  };

  function retry(error?: ProviderFailure) {
    const delay = Math.min(3600, Math.max(5 * 2 ** work.failures, error?.retryAfterSeconds ?? 0));
    return advance("retry", { delay });
  }

  async function readDataset<T>(read: () => Promise<T>): Promise<T> {
    const token = await store.openDatasetRead(work);
    try {
      return await read();
    } finally {
      if (token) await store.closeDatasetRead(work, token);
    }
  }

  try {
    validateAcquisitionInput(input);
    switch (work.phase) {
      case "ready": {
        await advance("submit", {});
        // This POST is never repeated for this work item even if its response
        // or the worker disappears. Recovery starts from the submitting phase.
        let run_id: string;
        try {
          run_id = await provider.submit(input);
        } catch (error) {
          await retry(error instanceof ProviderFailure ? error : undefined);
          break;
        }
        await advance("run", { run_id });
        break;
      }
      case "submitting": {
        if (!work.submitted_at) {
          await review("ambiguous");
          break;
        }
        const run_id = await provider.reconcile(input, new Date(work.submitted_at).toISOString());
        if (run_id) await advance("run", { run_id });
        else await retry();
        break;
      }
      case "running": {
        if (!work.run_id) {
          await review("ambiguous");
          break;
        }
        const run = await provider.status(work.run_id);
        if (run.id !== work.run_id) throw new ProviderFailure("schema");
        if (run.state === "pending") {
          if (cancel && !work.abort_sent) {
            try {
              await provider.cancel(run.id);
            } catch (error) {
              // The run can reach a terminal state between poll and abort.
              // Retry by polling first rather than assuming it is still live.
              await retry(error instanceof ProviderFailure ? error : undefined);
              break;
            }
            await advance("abort_sent", { delay: 5 });
          } else await advance("wait", { delay: 5 });
          break;
        }
        if (run.cents === null || !Number.isSafeInteger(run.cents) || run.cents < 0 || run.cents > work.cents) {
          await review("usage");
          break;
        }
        if (run.state !== "succeeded" || cancel) {
          await advance("finish", { outcome: cancel || run.state === "cancelled" ? "cancelled" : "failed", cents: run.cents, run_id: run.id });
          break;
        }
        if (!run.datasetId || !run.collectedAt) {
          await review("schema");
          break;
        }
        const inspected = await provider.inspectExclusiveDataset?.(run.datasetId, run.id);
        const total = inspected?.total ?? await provider.size(run.datasetId);
        if (!Number.isSafeInteger(total) || total < 0 || total > work.max_rows) {
          await review("limit");
          break;
        }
        try {
          await advance("bind", {
            run_id: run.id, dataset_id: run.datasetId, collected_at: run.collectedAt, total, cents: run.cents,
            ...(inspected ? { ownership: inspected.ownership } : {}),
          });
        } catch (error) {
          if (!(error instanceof AcquisitionStoreError) || !error.code?.match(/^(22|23)/)) throw error;
          await review("provider");
        }
        break;
      }
      case "paging": {
        if (work.verified_cost === null || !work.dataset_id || !work.collected_at) {
          await review("schema");
          break;
        }
        if (cancel) {
          await advance("finish", { outcome: "cancelled", cents: work.verified_cost });
          break;
        }
        if (work.offset === work.rows) {
          const finalTotal = await readDataset(() => provider.size(work.dataset_id!));
          await advance("finish", { outcome: finalTotal === work.rows ? "succeeded" : "failed", cents: work.verified_cost });
          break;
        }
        const count = Math.min(PAGE_SIZE, work.rows - work.offset);
        const page = await readDataset(() => provider.page(work.dataset_id!, work.offset, count));
        if (page.total !== work.rows || page.items.length !== count) {
          await advance("finish", { outcome: "failed", cents: work.verified_cost });
          break;
        }
        const rows = page.items.map(row => provider.normalize(row, work.collected_at!, workspace));
        try {
          await advance("page", { dataset_id: work.dataset_id, offset: work.offset, total: work.rows, rows });
        } catch (error) {
          // A definite DB rejection (including a withdrawn post) rolls back the page.
          // A lost commit response must be recovered by the next lease instead.
          if (!(error instanceof AcquisitionStoreError) || !error.code?.match(/^(22|23)/)) throw error;
          await advance("finish", { outcome: "failed", cents: work.verified_cost });
        }
        break;
      }
    }
  } catch (error) {
    if (!(error instanceof ProviderFailure)) throw error;
    if (error.kind === "temporary" || error.kind === "rate_limit") await retry(error);
    else if (work.phase === "paging" && work.verified_cost !== null) {
      await advance("finish", { outcome: "failed", cents: work.verified_cost });
    } else await review(error.kind === "schema" ? "schema" : "provider");
  }
  return "processed";
}
