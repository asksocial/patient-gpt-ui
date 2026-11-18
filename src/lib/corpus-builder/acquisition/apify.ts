import { createHash, createHmac } from "node:crypto";

import {
  positiveInteger, providerDate, ProviderFailure, validProviderId, validateAcquisitionInput,
  type AcquisitionProvider, type ProviderRun,
} from "./provider";

const NORMALIZATION_VERSION = "apify-row-v1";

export type ApifyTransport = (request: {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, string | number>;
}) => Promise<{ status: number; headers: Record<string, string | undefined>; body: unknown }>;

export type ApifyMapping = {
  ref: string;
  version: number;
  actorId: string;
  build: string;
  buildId: string;
  platform: string;
  sourcePolicyRef: string;
  retentionPolicyRef: string;
  timeoutSeconds: number;
  fields: { query: string; start: string; end: string; maxRows: string; correlation: string };
  output: {
    id: string; content: string; published?: string; collected?: string; url?: string;
    author?: string; engagement?: string;
  };
  permittedUrlHosts: string[];
  retainAuthor: boolean;
  authorKeyVersion?: string;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProviderFailure("schema");
  return value as Record<string, unknown>;
}

function field(value: Record<string, unknown>, key: string | undefined) {
  return key !== undefined && Object.hasOwn(value, key) ? value[key] : undefined;
}

function identifier(value: unknown): string {
  if (!validProviderId(value)) throw new ProviderFailure("schema");
  return value;
}

function cents(usd: unknown) {
  if (usd == null) return null;
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd < 0 || usd > 1000000) {
    throw new ProviderFailure("schema");
  }
  // Convert the decimal representation to cents, rounding up sub-cent charges.
  const [mantissa, exponent = "0"] = usd.toString().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const digits = BigInt(whole + fraction);
  const shift = Number(exponent) + 2 - fraction.length;
  const base = BigInt(10);
  if (shift >= 0) return Number(digits * base ** BigInt(shift));
  const divisor = base ** BigInt(-shift);
  return Number((digits + divisor - BigInt(1)) / divisor);
}

function headerNumber(headers: Record<string, string | undefined>, name: string) {
  const value = headers[name];
  if (value === undefined || !/^\d+$/.test(value)) throw new ProviderFailure("schema");
  return positiveInteger(Number(value), 1000000);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createApifyProvider(configuration: ApifyMapping, deps: {
  transport: ApifyTransport;
  approvedActors: ReadonlySet<string>;
  authorKey?: string;
}): AcquisitionProvider {
  const map = structuredClone(configuration);
  const authorKey = deps.authorKey;
  const inputKeys = Object.values(map.fields);
  const fieldName = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;
  if (!validProviderId(map.actorId) || !validProviderId(map.buildId) || !/^\d+\.\d+\.\d+$/.test(map.build) ||
    !deps.approvedActors.has(map.actorId) || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(map.ref) ||
    !/^[a-z0-9_]{1,32}$/.test(map.platform) || !map.sourcePolicyRef || !map.retentionPolicyRef ||
    (map.retainAuthor && (!map.output.author || !map.authorKeyVersion || Buffer.byteLength(authorKey ?? "") < 32)) ||
    map.permittedUrlHosts.some(host => !/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(host)) ||
    new Set(inputKeys).size !== 5 || [...inputKeys, ...Object.values(map.output)].some(
      key => !fieldName.test(key) || ["__proto__", "constructor", "prototype"].includes(key))) {
    throw new ProviderFailure("permanent");
  }
  positiveInteger(map.version, 99999, 1);
  positiveInteger(map.timeoutSeconds, 3600, 1);
  const approval = Object.freeze({
    provider: "apify", ref: `${map.ref}:v${map.version}`,
    normalizationVersion: NORMALIZATION_VERSION,
    fingerprint: createHash("sha256").update(canonical({ map, normalizationVersion: NORMALIZATION_VERSION })).digest("hex"),
    platform: map.platform, sourcePolicyRef: map.sourcePolicyRef, retentionPolicyRef: map.retentionPolicyRef,
  });
  const pageFields = [...new Set([
    map.output.id, map.output.content, map.output.published, map.output.collected, map.output.engagement,
    map.permittedUrlHosts.length ? map.output.url : undefined, map.retainAuthor ? map.output.author : undefined,
  ].filter((key): key is string => key !== undefined))].join(",");

  async function request(input: Parameters<ApifyTransport>[0], historicalInputMissing = false) {
    let response: Awaited<ReturnType<ApifyTransport>>;
    try {
      response = await deps.transport(input);
    } catch {
      throw new ProviderFailure("temporary");
    }
    if (response.status === 429) {
      const retryAfter = response.headers["retry-after"];
      const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter)
        : retryAfter ? Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000) : 0;
      throw new ProviderFailure("rate_limit", Number.isFinite(seconds) ? Math.max(0, Math.min(3600, seconds)) : 0);
    }
    if (response.status === 408 || response.status >= 500) throw new ProviderFailure("temporary");
    if (response.status === 404 && historicalInputMissing) return null;
    if (response.status < 200 || response.status >= 300) throw new ProviderFailure("permanent");
    return response;
  }

  async function readRun(runId: string) {
    const result = await request({ method: "GET", path: `/v2/actor-runs/${identifier(runId)}` });
    const run = object(object(result?.body).data);
    if (run.id !== runId || run.actId !== map.actorId || run.buildId !== map.buildId) {
      throw new ProviderFailure("schema");
    }
    return run;
  }

  return {
    approval,
    async submit(input) {
      validateAcquisitionInput(input);
      const result = await request({
        method: "POST", path: `/v2/acts/${map.actorId}/runs`,
        query: {
          build: map.build, waitForFinish: "0", restartOnError: "false",
          forcePermissionLevel: "LIMITED_PERMISSIONS", timeout: String(map.timeoutSeconds),
          maxTotalChargeUsd: (input.cents / 100).toFixed(2), maxItems: String(input.maxRows),
        },
        body: {
          [map.fields.query]: input.query, [map.fields.start]: input.start, [map.fields.end]: input.end,
          [map.fields.maxRows]: input.maxRows, [map.fields.correlation]: input.correlationId,
        },
      });
      const started = object(object(result?.body).data);
      if (started.actId !== map.actorId || started.buildId !== map.buildId) throw new ProviderFailure("schema");
      return identifier(started.id);
    },
    async reconcile(input, submittedAt) {
      validateAcquisitionInput(input);
      const since = Date.parse(providerDate(submittedAt)) - 5000;
      const response = await request({ method: "GET", path: `/v2/acts/${map.actorId}/runs`, query: { desc: "1", limit: "4" } });
      const items = object(object(response?.body).data).items;
      if (!Array.isArray(items) || items.length > 4) throw new ProviderFailure("schema");
      const matches: string[] = [];
      for (const item of items) {
        const candidate = object(item);
        if (candidate.startedAt == null || Date.parse(providerDate(candidate.startedAt)) < since) continue;
        const id = identifier(candidate.id);
        // Other approved builds can share the Actor. Inspect the exact run before matching its input.
        const detail = await request({ method: "GET", path: `/v2/actor-runs/${id}` });
        const run = object(object(detail?.body).data);
        if (run.id !== id || run.actId !== map.actorId) throw new ProviderFailure("schema");
        if (run.buildId !== map.buildId) continue;
        const original = await request({
          method: "GET", path: `/v2/key-value-stores/${identifier(run.defaultKeyValueStoreId)}/records/INPUT`,
        }, true);
        if (!original) continue;
        const body = object(original.body);
        if (field(body, map.fields.correlation) === input.correlationId &&
          field(body, map.fields.query) === input.query && field(body, map.fields.start) === input.start &&
          field(body, map.fields.end) === input.end && field(body, map.fields.maxRows) === input.maxRows) matches.push(id);
      }
      if (matches.length > 1) throw new ProviderFailure("schema");
      return matches[0] ?? null;
    },
    async status(id) {
      const run = await readRun(id);
      if (typeof run.status !== "string") throw new ProviderFailure("schema");
      const pending = ["READY", "RUNNING", "TIMING-OUT", "ABORTING"].includes(run.status);
      let state: ProviderRun["state"];
      if (pending) state = "pending";
      else if (run.status === "SUCCEEDED") state = "succeeded";
      else if (run.status === "ABORTED") state = "cancelled";
      else if (["FAILED", "TIMED-OUT"].includes(run.status)) state = "failed";
      else throw new ProviderFailure("schema");
      return {
        id, state, datasetId: run.defaultDatasetId == null ? null : identifier(run.defaultDatasetId),
        collectedAt: run.finishedAt == null ? null : providerDate(run.finishedAt),
        cents: state === "pending" ? null : cents(run.usageTotalUsd),
      };
    },
    async size(datasetId) {
      const result = await request({ method: "GET", path: `/v2/datasets/${identifier(datasetId)}` });
      const data = object(object(result?.body).data);
      if (data.id !== datasetId) throw new ProviderFailure("schema");
      return positiveInteger(data.itemCount, 1000000);
    },
    async page(datasetId, offset, limit) {
      positiveInteger(offset, 1000000);
      positiveInteger(limit, 100, 1);
      const response = await request({
        method: "GET", path: `/v2/datasets/${identifier(datasetId)}/items`,
        query: { offset: String(offset), limit: String(limit), format: "json", clean: "false", desc: "false", fields: pageFields },
      });
      if (!response || !Array.isArray(response.body) || response.body.length > limit ||
        headerNumber(response.headers, "x-apify-pagination-offset") !== offset ||
        headerNumber(response.headers, "x-apify-pagination-count") !== response.body.length) {
        throw new ProviderFailure("schema");
      }
      return { total: headerNumber(response.headers, "x-apify-pagination-total"), items: response.body };
    },
    normalize(item, collectedAt, workspace) {
      const row = object(item);
      const id = field(row, map.output.id);
      const content = field(row, map.output.content);
      const published = field(row, map.output.published);
      const collected = field(row, map.output.collected);
      const engagement = field(row, map.output.engagement);
      const author = map.retainAuthor ? field(row, map.output.author) : null;
      if (typeof id !== "string" || !id.trim() || id.trim().length > 200 ||
        typeof content !== "string" || !content.trim() || content.length > 16000 ||
        (author != null && (typeof author !== "string" || author.length > 240))) throw new ProviderFailure("schema");
      let sourceUrl: string | null = null;
      const rawUrl = map.permittedUrlHosts.length ? field(row, map.output.url) : null;
      if (typeof rawUrl === "string" && rawUrl.length <= 2000) {
        try {
          const parsed = new URL(rawUrl);
          if (parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port &&
            map.permittedUrlHosts.includes(parsed.hostname)) sourceUrl = parsed.origin + parsed.pathname;
        } catch { /* Invalid URLs remain missing provenance. */ }
      }
      const acquisitionTime = providerDate(collected ?? collectedAt);
      if (Date.parse(acquisitionTime) > Date.parse(providerDate(collectedAt))) throw new ProviderFailure("schema");
      return {
        post_id: id.trim(), content, published_at: published == null ? null : providerDate(published),
        collected_at: acquisitionTime, source_url: sourceUrl,
        author_key: author ? createHmac("sha256", authorKey!).update(JSON.stringify([workspace, map.platform, author])).digest("hex") : null,
        engagement: engagement == null ? null : positiveInteger(engagement, Number.MAX_SAFE_INTEGER),
        match_kind: "returned",
      };
    },
    async cancel(runId) {
      await request({ method: "POST", path: `/v2/actor-runs/${identifier(runId)}/abort` });
    },
  };
}
