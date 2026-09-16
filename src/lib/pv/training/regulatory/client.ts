import { createHash } from "node:crypto";
import { getBotulinumProductRegistry, getBotulinumRegulatoryCorpusManifest, getOpenFdaRegulatoryMapping } from "./config";
import { faersDeduplicationKey, normalizeOpenFdaRegulatoryCase, sourceProductValues, sourceReactionValues } from "./normalize";
import { buildBotulinumOpenFdaQueries, redactOpenFdaApiKey, withOpenFdaApiKey } from "./query";
import type {
  OpenFdaIngestionResult,
  OpenFdaMalformedRecord,
  OpenFdaQueryDefinition,
  OpenFdaQueryObservation,
  OpenFdaQueryRun,
  OpenFdaRawRecordEnvelope,
} from "./types";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type OpenFdaIngestionOptions = {
  apiKey?: string;
  products?: string[];
  suspectOnly?: boolean;
  maxRecords?: number;
  maxPagesPerQuery?: number;
  continueOnQueryError?: boolean;
  fetchImpl?: FetchLike;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  retainRawRecords?: boolean;
  onUniqueRawRecord?: (record: OpenFdaRawRecordEnvelope) => void | Promise<void>;
  onQueryObservation?: (input: { deduplicationKey: string; observation: OpenFdaQueryObservation }) => void | Promise<void>;
};

export class OpenFdaRequestError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryable = false) {
    super(message);
    this.name = "OpenFdaRequestError";
  }
}

class OpenFdaPersistenceHookError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
    this.name = "OpenFdaPersistenceHookError";
  }
}

async function invokePersistenceHook<T>(
  name: string,
  hook: ((value: T) => void | Promise<void>) | undefined,
  value: T,
) {
  if (!hook) return;
  try {
    await hook(value);
  } catch (error) {
    throw new OpenFdaPersistenceHookError(`The ${name} persistence hook failed; ingestion stopped to avoid an incomplete, unauditable snapshot.`, error);
  }
}

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function parseNextLink(header: string | null) {
  if (!header) return undefined;
  const match = header.match(/<([^>]+)>\s*;\s*rel=["']?next["']?/i);
  return match?.[1];
}

export function validateOpenFdaPageUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "api.fda.gov" || url.pathname !== "/drug/event.json") {
    throw new OpenFdaRequestError("openFDA pagination returned an unexpected endpoint; ingestion stopped to protect query provenance.");
  }
  return url.toString();
}

function retryAfterMilliseconds(response: Response, now: () => Date) {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? undefined : Math.max(0, date - now().getTime());
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new OpenFdaRequestError(`openFDA returned malformed JSON (HTTP ${response.status}).`, response.status, response.status >= 500);
  }
}

function noMatches(response: Response, body: Record<string, any>) {
  const code = String(body.error?.code || "").toUpperCase();
  const message = String(body.error?.message || "").toLowerCase();
  return response.status === 404 && (code === "NOT_FOUND" || message.includes("no matches"));
}

function deduplicateObservations(observations: OpenFdaQueryObservation[]) {
  const seen = new Set<string>();
  return observations.filter((observation) => {
    const key = `${observation.queryId}:${observation.retrievedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rawHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function recordObservation(rawRecord: unknown, query: OpenFdaQueryDefinition, retrievedAt: string, sourceApiQuery: string): OpenFdaQueryObservation {
  return {
    queryId: query.queryId,
    queryKind: query.kind,
    productSearched: query.productSearched,
    field: query.field,
    suspectOnly: query.suspectOnly,
    sourceApiQuery: redactOpenFdaApiKey(sourceApiQuery),
    retrievedAt,
    sourceProductValues: sourceProductValues(rawRecord),
    sourceReactionValues: sourceReactionValues(rawRecord),
  };
}

export async function ingestBotulinumOpenFda(options: OpenFdaIngestionOptions = {}): Promise<OpenFdaIngestionResult> {
  const mapping = getOpenFdaRegulatoryMapping();
  const corpusManifest = getBotulinumRegulatoryCorpusManifest();
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || (() => new Date());
  const sleep = options.sleep || ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const queries = buildBotulinumOpenFdaQueries({ suspectOnly: options.suspectOnly, products: options.products });
  const startedAt = now().toISOString();
  const records = new Map<string, {
    rawSourceRecordSha256: string;
    observations: OpenFdaQueryObservation[];
    raw?: OpenFdaRawRecordEnvelope;
    normalized: ReturnType<typeof normalizeOpenFdaRegulatoryCase>["normalized"];
  }>();
  const malformedRecords: OpenFdaMalformedRecord[] = [];
  const queryRuns: OpenFdaQueryRun[] = [];
  let duplicateCount = 0;
  let truncated = false;
  let lastRequestAt = 0;

  const fetchPage = async (url: string) => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= mapping.retry.maxAttempts; attempt += 1) {
      const intervalRemaining = mapping.retry.minimumRequestIntervalMs - (now().getTime() - lastRequestAt);
      if (intervalRemaining > 0) await sleep(intervalRemaining);
      lastRequestAt = now().getTime();
      try {
        const response = await fetchImpl(withOpenFdaApiKey(validateOpenFdaPageUrl(url), options.apiKey), {
          headers: { Accept: "application/json", "User-Agent": "AskSocial-FAERS-Corpus-Ingestion/1.0" },
        });
        const body = object(await parseResponseBody(response));
        if (response.ok || noMatches(response, body)) return { response, body, noMatches: noMatches(response, body) };
        const retryable = response.status === 429 || response.status >= 500;
        const message = String(body.error?.message || body.error?.code || response.statusText || "request failed");
        if (!retryable) throw new OpenFdaRequestError(`openFDA request failed (${response.status}): ${message}`, response.status, false);
        lastError = new OpenFdaRequestError(`openFDA request failed (${response.status}): ${message}`, response.status, true);
        if (attempt < mapping.retry.maxAttempts) {
          const retryAfter = retryAfterMilliseconds(response, now);
          const exponential = Math.min(mapping.retry.maximumDelayMs, mapping.retry.initialDelayMs * 2 ** (attempt - 1));
          await sleep(retryAfter ?? exponential);
        }
      } catch (error) {
        if (error instanceof OpenFdaRequestError && !error.retryable) throw error;
        lastError = error;
        if (attempt < mapping.retry.maxAttempts) {
          await sleep(Math.min(mapping.retry.maximumDelayMs, mapping.retry.initialDelayMs * 2 ** (attempt - 1)));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new OpenFdaRequestError("openFDA request failed after all retry attempts.", undefined, true);
  };

  queryLoop: for (const query of queries) {
    const run: OpenFdaQueryRun = {
      query,
      pagesRetrieved: 0,
      sourceHits: 0,
      uniqueRecordsAdded: 0,
      duplicatesObserved: 0,
      recordsRejectedBySuspectPostFilter: 0,
      completed: false,
    };
    queryRuns.push(run);
    let nextUrl: string | undefined = query.publicUrl;
    const visitedPages = new Set<string>();
    try {
      while (nextUrl) {
        if (options.maxPagesPerQuery && run.pagesRetrieved >= options.maxPagesPerQuery) {
          truncated = true;
          break;
        }
        const validatedUrl = validateOpenFdaPageUrl(nextUrl);
        const publicPageUrl = redactOpenFdaApiKey(validatedUrl);
        if (visitedPages.has(publicPageUrl)) throw new OpenFdaRequestError("openFDA returned a repeated pagination URL; ingestion stopped to prevent an infinite loop.");
        visitedPages.add(publicPageUrl);
        const retrievedAt = now().toISOString();
        const page = await fetchPage(validatedUrl);
        run.pagesRetrieved += 1;
        if (page.noMatches) {
          run.completed = true;
          break;
        }
        const sourceRecords = Array.isArray(page.body.results) ? page.body.results : [];
        run.totalReportedByApi ??= Number.isFinite(Number(page.body.meta?.results?.total)) ? Number(page.body.meta.results.total) : undefined;
        run.apiLastUpdated ||= String(page.body.meta?.last_updated || "") || undefined;
        for (const rawRecord of sourceRecords) {
          run.sourceHits += 1;
          const observation = recordObservation(rawRecord, query, retrievedAt, publicPageUrl);
          try {
            const deduplicationKey = faersDeduplicationKey(rawRecord);
            const existing = records.get(deduplicationKey);
            if (existing) {
              duplicateCount += 1;
              run.duplicatesObserved += 1;
              if (existing.rawSourceRecordSha256 !== rawHash(rawRecord)) {
                malformedRecords.push({ queryId: query.queryId, retrievedAt, error: `Conflicting payloads share deduplication key ${deduplicationKey}; the first payload was retained.`, rawSourceRecord: rawRecord });
              }
              existing.observations = deduplicateObservations([...existing.observations, observation]);
              if (existing.raw) existing.raw.observations = existing.observations;
              existing.normalized.provenance.source_api_queries = existing.observations;
              await invokePersistenceHook("query-observation", options.onQueryObservation, { deduplicationKey, observation });
              continue;
            }
            const normalized = normalizeOpenFdaRegulatoryCase(rawRecord, [observation]);
            if (query.suspectOnly && !normalized.normalized.drugs.some((drug) => drug.is_target_botulinum_product && drug.drug_role === "suspect")) {
              run.recordsRejectedBySuspectPostFilter += 1;
              continue;
            }
            records.set(deduplicationKey, {
              rawSourceRecordSha256: normalized.raw.rawSourceRecordSha256,
              observations: normalized.raw.observations,
              raw: options.retainRawRecords === false ? undefined : normalized.raw,
              normalized: normalized.normalized,
            });
            await invokePersistenceHook("raw-record", options.onUniqueRawRecord, normalized.raw);
            await invokePersistenceHook("query-observation", options.onQueryObservation, { deduplicationKey, observation });
            run.uniqueRecordsAdded += 1;
            if (options.maxRecords && records.size >= options.maxRecords) {
              truncated = true;
              break queryLoop;
            }
          } catch (error) {
            if (error instanceof OpenFdaPersistenceHookError) throw error;
            malformedRecords.push({
              queryId: query.queryId,
              retrievedAt,
              error: error instanceof Error ? error.message : "Malformed openFDA record.",
              rawSourceRecord: rawRecord,
            });
          }
        }
        nextUrl = parseNextLink(page.response.headers.get("link"));
        if (!nextUrl) run.completed = true;
      }
      if (truncated && !run.completed) run.completed = false;
    } catch (error) {
      if (error instanceof OpenFdaPersistenceHookError) throw error;
      run.error = error instanceof Error ? error.message : "Unknown openFDA query failure.";
      if (!options.continueOnQueryError) break;
    }
  }

  const complete = !truncated && queryRuns.length === queries.length && queryRuns.every((run) => run.completed && !run.error);
  const ordered = [...records.values()].sort((a, b) => a.normalized.case_id.localeCompare(b.normalized.case_id));
  return {
    startedAt,
    completedAt: now().toISOString(),
    configurationVersion: corpusManifest.configurationVersion,
    productRegistryVersion: getBotulinumProductRegistry().registryVersion,
    sourceMappingVersion: mapping.mappingVersion,
    status: complete ? "complete" : "partial",
    truncated,
    queryRuns,
    rawRecords: ordered.flatMap((item) => item.raw ? [item.raw] : []),
    normalizedRecords: ordered.map((item) => item.normalized),
    malformedRecords,
    duplicateCount,
  };
}
