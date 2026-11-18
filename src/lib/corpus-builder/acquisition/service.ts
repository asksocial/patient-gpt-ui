import { verifyAcquisitionCallback } from "./callback";
import { AcquisitionStoreError, runAcquisitionStep, type AcquisitionStore, type Work } from "./orchestrator";
import type { AcquisitionProvider } from "./provider";

type Plan = {
  protocol_id: string;
  request_key: string;
  provider: string;
  mapping_ref: string;
  concurrency: number;
  hours: number;
  jobs: { query_id: string; start: string; end: string; max_rows: number; cents: number }[];
};

type Auth = { userId: string; principalId: string; active: boolean; administrator: boolean };
type PlanStatus = {
  id: string;
  deadline: string;
  jobs: {
    id: string;
    phase: string;
    cancel_requested: boolean;
    review_code: string | null;
    offset: number;
    rows: number;
    attempt_status: string;
    reserved_cents: number;
    actual_cents: number | null;
  }[];
};

export function createAcquisitionService(deps: {
  enabled: () => boolean;
  session: () => Promise<Auth | null>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
  providers: readonly AcquisitionProvider[];
}) {
  const providers = new Map<string, AcquisitionProvider>();
  for (const provider of deps.providers) {
    const key = JSON.stringify([provider.approval.provider, provider.approval.ref]);
    if (providers.has(key)) throw new AcquisitionStoreError(400);
    providers.set(key, provider);
  }
  function providerFor(provider: string, ref: string) {
    return providers.get(JSON.stringify([provider, ref]));
  }

  async function access(workspace: string) {
    if (!deps.enabled()) throw new AcquisitionStoreError(404);
    const identity = await deps.session();
    if (!identity) throw new AcquisitionStoreError(401);
    if (!identity.active || !identity.administrator) throw new AcquisitionStoreError(403);
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(workspace)) throw new AcquisitionStoreError(400);
    return async <T>(operation: string, input: Record<string, unknown>) => {
      const result = await deps.rpc(`corpus_acquisition_${operation}`, {
        ...input, p_workspace: workspace, p_principal: identity.principalId, p_actor: identity.userId,
      });
      if (result.error) {
        const code = result.error.code;
        const status = code === "42501" ? 403 : code?.match(/^(22|23)/) ? 400 : code === "P0001" ? 409 : 503;
        throw new AcquisitionStoreError(status, code);
      }
      return result.data as T;
    };
  }

  return {
    async approve(workspace: string, plan: Plan) {
      const rpc = await access(workspace);
      const source = providerFor(plan.provider, plan.mapping_ref)?.approval;
      if (!source) throw new AcquisitionStoreError(400);
      return rpc<string>("approve", { p_plan: {
        ...plan, platform: source.platform, mapping_digest: source.fingerprint,
        normalization_version: source.normalizationVersion,
        source_policy_ref: source.sourcePolicyRef, retention_policy_ref: source.retentionPolicyRef,
      } });
    },
    async step(workspace: string, planId: string) {
      const rpc = await access(workspace);
      const store: AcquisitionStore = {
        claim: p_plan => rpc<Work | null>("claim", { p_plan }),
        advance: (work, p_step, p_data) => rpc<void>("advance", {
          p_work: work.id, p_lease: work.lease_token, p_step, p_data,
        }),
        cancel: p_work => rpc<void>("cancel", { p_work }),
        openDatasetRead: work => rpc<string | null>("dataset_read_begin", { p_work: work.id, p_lease: work.lease_token }),
        closeDatasetRead: (work, p_reader) => rpc<void>("dataset_read_end", { p_work: work.id, p_reader }),
      };
      return runAcquisitionStep({ planId, workspace, store, providerFor });
    },
    async cancel(workspace: string, work: string) {
      return (await access(workspace))<void>("cancel", { p_work: work });
    },
    async resume(workspace: string, work: string) {
      return (await access(workspace))<void>("resume", { p_work: work });
    },
    async approveDatasetRelease(workspace: string, work: string, discardIncomplete = false) {
      return (await access(workspace))<string>("release_approve", {
        p_work: work, p_discard_incomplete: discardIncomplete,
      });
    },
    async setDatasetHold(workspace: string, work: string, kind: "legal" | "internal", active: boolean) {
      return (await access(workspace))<void>("dataset_hold", { p_work: work, p_kind: kind, p_active: active });
    },
    async status(workspace: string, plan: string) {
      return (await access(workspace))<PlanStatus>("status", { p_plan: plan });
    },
    async completion(workspace: string, request: Parameters<typeof verifyAcquisitionCallback>[0]) {
      const rpc = await access(workspace);
      const event = verifyAcquisitionCallback(request);
      if (event.workspace !== workspace.toLowerCase()) throw new AcquisitionStoreError(403);
      return rpc<boolean>("callback", { p_plan: event.planId, p_run: event.runId, p_event: event.eventId });
    },
  };
}
