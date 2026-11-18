type UUID = string;

export type BuilderProtocol = {
  corpus_key: string;
  name: string;
  subject: string;
  window_start: string;
  window_end: string;
  platform: string;
  source_policy_ref: string;
  retention_policy_ref: string;
  retain_days: number;
  sampling_policy: Record<string, unknown>;
  budget_cents: number;
  attempt_limit_cents: number;
  queries: { key: string; expression: string }[];
};

export type BuilderSource = {
  post_id: string;
  content: string;
  collected_at: string;
  published_at?: string | null;
  source_url?: string | null;
  author_key?: string | null;
  engagement?: number | null;
  match_kind?: "returned" | "confirmed";
};

type Settlement = "succeeded" | "failed" | "cancelled";
type JobStatus = "queued" | "running" | Settlement;

type Operations = {
  configure: [{ p_config: BuilderProtocol }, UUID];
  status: [{ p_protocol: UUID }, {
    protocol_id: UUID;
    corpus_id: UUID;
    revision: number;
    budget_cents: number;
    queries: { id: UUID; key: string }[];
  }];
  queue: [{ p_query: UUID; p_start: string; p_end: string }, UUID];
  reserve: [{
    p_job: UUID;
    p_key: string;
    p_dataset: string;
    p_expected_rows: number;
    p_cents: number;
  }, UUID];
  page: [{ p_attempt: UUID; p_offset: number; p_rows: BuilderSource[] }, number];
  finish: [{ p_attempt: UUID; p_status: Settlement; p_actual: number }, null];
  job_status: [{ p_job: UUID }, {
    id: UUID;
    status: JobStatus;
    attempts: {
      id: UUID;
      status: Exclude<JobStatus, "queued">;
      next_offset: number;
      expected_rows: number;
      reserved_cents: number;
      actual_cents: number | null;
    }[];
  }];
  freeze_frame: [{ p_protocol: UUID }, UUID];
  frame_manifest: [{ p_frame: UUID }, {
    frame_id: UUID;
    digest: string;
    record_count: number;
    available: boolean;
    record_ids: UUID[];
  }];
  freeze_version: [{
    p_frame: UUID;
    p_method: string;
    p_seed: string;
    p_records: UUID[];
  }, UUID];
  version_status: [{ p_version: UUID }, {
    id: UUID;
    digest: string;
    record_count: number;
    valid: boolean;
  }];
  source_lookup: [{ p_platform: string; p_post_id: string }, { id: UUID; withdrawn: boolean } | null];
  expire_revisions: [{ p_cutoff: string; p_limit: number }, number];
  purge_operations: [{ p_limit: number }, number];
  revision_artifact_put: [{ p_revision: UUID; p_key: UUID; p_kind: "extract" | "embedding"; p_payload: unknown }, null];
  revision_artifact_get: [{ p_revision: UUID; p_key: UUID }, unknown];
  withdraw: [{ p_record: UUID; p_reason: "withdrawn" }, null];
};

const operations = new Set<keyof Operations>([
  "configure", "status", "queue", "reserve", "page", "finish", "job_status",
  "freeze_frame", "frame_manifest", "freeze_version", "version_status", "source_lookup", "withdraw",
  "expire_revisions", "purge_operations", "revision_artifact_put", "revision_artifact_get",
]);

export class CorpusBuilderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Dependencies = {
  enabled: () => boolean;
  session: () => Promise<{
    userId: string;
    principalId: string;
    active: boolean;
    administrator: boolean;
  } | null>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { code?: string } | null;
  }>;
};

export function createCorpusBuilderService(dependencies: Dependencies) {
  return async function execute<K extends keyof Operations>(
    workspace: UUID, operation: K, input: Operations[K][0],
  ): Promise<Operations[K][1]> {
    if (!dependencies.enabled()) throw new CorpusBuilderError("Corpus Builder unavailable.", 404);
    const session = await dependencies.session();
    if (!session) throw new CorpusBuilderError("Authentication required.", 401);
    if (!session.active || !session.administrator) {
      throw new CorpusBuilderError("Active platform administrator required.", 403);
    }
    if (!operations.has(operation) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(workspace)) {
      throw new CorpusBuilderError("Invalid Corpus Builder operation.", 400);
    }

    const { data, error } = await dependencies.rpc(`corpus_builder_${operation}`, {
      ...input,
      p_workspace: workspace,
      p_principal: session.principalId,
      p_actor: session.userId,
    });
    if (error?.code === "42501") throw new CorpusBuilderError("Corpus Builder access denied.", 403);
    if (error?.code?.startsWith("22") || error?.code?.startsWith("23")) {
      throw new CorpusBuilderError("Invalid or conflicting Corpus Builder inputs.", 400);
    }
    if (error?.code === "P0001") throw new CorpusBuilderError("Corpus Builder operation conflicts with current state.", 409);
    if (error) throw new CorpusBuilderError("Corpus Builder operation unavailable.", 503);
    return data as Operations[K][1];
  };
}
