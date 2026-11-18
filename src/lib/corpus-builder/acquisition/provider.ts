import type { BuilderSource } from "../service";

export type SourceApproval = {
  provider: string;
  ref: string;
  fingerprint: string;
  normalizationVersion: string;
  platform: string;
  sourcePolicyRef: string;
  retentionPolicyRef: string;
};

export type AcquisitionInput = {
  correlationId: string;
  query: string;
  start: string;
  end: string;
  maxRows: number;
  cents: number;
};

export type ProviderRun = {
  id: string;
  state: "pending" | "succeeded" | "failed" | "cancelled";
  datasetId: string | null;
  collectedAt: string | null;
  cents: number | null;
};

export interface AcquisitionProvider {
  readonly approval: Readonly<SourceApproval>;
  submit(input: AcquisitionInput): Promise<string>;
  reconcile(input: AcquisitionInput, submittedAt: string): Promise<string | null>;
  status(runId: string): Promise<ProviderRun>;
  size(datasetId: string): Promise<number>;
  page(datasetId: string, offset: number, limit: number): Promise<{ total: number; items: unknown[] }>;
  normalize(item: unknown, collectedAt: string, workspace: string): BuilderSource;
  cancel(runId: string): Promise<void>;
}

export class ProviderFailure extends Error {
  constructor(
    readonly kind: "temporary" | "rate_limit" | "permanent" | "schema",
    readonly retryAfterSeconds = 0,
  ) {
    super(`Acquisition provider ${kind}`);
  }
}

export function validProviderId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_-]{1,160}$/i.test(value);
}

export function positiveInteger(value: unknown, maximum: number, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ProviderFailure("schema");
  }
  return value;
}

export function providerDate(value: unknown): string {
  if (typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))) throw new ProviderFailure("schema");
  return value;
}

export function validateAcquisitionInput(input: AcquisitionInput) {
  providerDate(input.start);
  providerDate(input.end);
  positiveInteger(input.maxRows, 10000, 1);
  positiveInteger(input.cents, 100000000, 1);
  if (!validProviderId(input.correlationId) || typeof input.query !== "string" ||
    !input.query.trim() || input.query.length > 1024 || /[\x00-\x1f\x7f-\x9f]/.test(input.query) ||
    Date.parse(input.start) >= Date.parse(input.end)) throw new ProviderFailure("schema");
}
