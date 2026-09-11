import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type CacheEntry = {
  status: "resolved" | "unresolved";
  text?: string;
  reason?: string;
  httpStatus?: number;
  retrievedAt: string;
};

type Cache = Record<string, CacheEntry>;

const DEFAULT_INPUT = "data/botulinum-toxin.csv";
const DEFAULT_CACHE = "/private/tmp/asksocial-botulinum-reddit-hit-sentences.json";
const USER_AGENT =
  "AskSocial corpus enrichment/1.0 (public-source data quality; contact via AskSocial project owner)";

const args = process.argv.slice(2);
const applyChanges = args.includes("--apply");
const commentsOnly = args.includes("--comments-only");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const concurrencyArg = args.find((arg) => arg.startsWith("--concurrency="));
const delayArg = args.find((arg) => arg.startsWith("--delay-ms="));
const inputArg = args.find((arg) => arg.startsWith("--input="));
const cacheArg = args.find((arg) => arg.startsWith("--cache="));

const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;
const concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 2;
const delayMs = delayArg ? Number(delayArg.split("=")[1]) : 1_000;
const inputPath = resolve(inputArg?.slice("--input=".length) || DEFAULT_INPUT);
const cachePath = resolve(cacheArg?.slice("--cache=".length) || DEFAULT_CACHE);

if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 6) {
  throw new Error("--concurrency must be between 1 and 6.");
}

if (!Number.isFinite(delayMs) || delayMs < 250) {
  throw new Error("--delay-ms must be at least 250 milliseconds.");
}

if (!(Number.isFinite(limit) || limit === Number.POSITIVE_INFINITY) || limit < 1) {
  throw new Error("--limit must be a positive number.");
}

const sleep = (milliseconds: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function isRedditUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "reddit.com" || hostname.endsWith(".reddit.com");
  } catch {
    return false;
  }
}

function redditTargetId(value: string) {
  const url = new URL(value);
  const commentMatch = url.pathname.match(/\/comment\/([^/]+)/i);
  if (commentMatch) return `t1_${commentMatch[1]}`;

  const postMatch = url.pathname.match(/\/comments\/([^/]+)/i);
  if (postMatch) return `t3_${postMatch[1]}`;

  return null;
}

function redditEmbedUrl(value: string) {
  const url = new URL(value);
  url.hostname = "embed.reddit.com";
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
  return url.toString();
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return namedEntities[entity.toLowerCase()] ?? match;
  });
}

function htmlToSingleLineText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<!--[^]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li)\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractPostFromHtml(html: string, targetId: string) {
  const bodyMarker = `id="${targetId}-post-rtjson-content"`;
  const bodyMarkerIndex = html.indexOf(bodyMarker);
  if (bodyMarkerIndex >= 0) {
    const contentStart = html.indexOf(">", bodyMarkerIndex);
    const overflowMarker = `id="${targetId}-overflow-cover"`;
    const overflowIndex = html.indexOf(overflowMarker, contentStart);
    const contentEnd = overflowIndex >= 0
      ? html.lastIndexOf("<", overflowIndex)
      : html.indexOf("</div>", contentStart);
    if (contentStart >= 0 && contentEnd > contentStart) {
      const body = htmlToSingleLineText(html.slice(contentStart + 1, contentEnd));
      if (body) return body;
    }
  }

  const titleMatch = html.match(/<shreddit-embed-title>([^]*?)<\/shreddit-embed-title>/i);
  return titleMatch ? htmlToSingleLineText(titleMatch[1]) : "";
}

async function loadCache(): Promise<Cache> {
  try {
    return JSON.parse(await readFile(cachePath, "utf8")) as Cache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function saveCache(cache: Cache) {
  const temporaryPath = `${cachePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  await rename(temporaryPath, cachePath);
}

async function fetchRedditText(sourceUrl: string): Promise<CacheEntry> {
  const targetId = redditTargetId(sourceUrl);
  if (!targetId) {
    return {
      status: "unresolved",
      reason: "unsupported_reddit_url",
      retrievedAt: new Date().toISOString(),
    };
  }

  let lastStatus: number | undefined;
  let lastReason = "request_failed";
  const requestUrl = redditEmbedUrl(sourceUrl);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(requestUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": USER_AGENT,
        },
        redirect: "follow",
        signal: controller.signal,
      });
      lastStatus = response.status;

      const remaining = Number(response.headers.get("x-ratelimit-remaining") || "NaN");
      const resetSeconds = Number(response.headers.get("x-ratelimit-reset") || "NaN");

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") || "0");
        await sleep(Math.max(retryAfter * 1_000, attempt * 5_000));
        lastReason = "rate_limited";
        continue;
      }

      if (!response.ok) {
        lastReason = `http_${response.status}`;
        if (response.status >= 500 && attempt < 3) {
          await sleep(attempt * 2_000);
          continue;
        }
        break;
      }

      const responseText = await response.text();
      const text = extractPostFromHtml(responseText, targetId);
      if (
        !text ||
        /^\[\s*(deleted|removed|removed by moderator)\s*\](?:\s+\[link\]\s+\[comments\])?$/i.test(text)
      ) {
        lastReason = "content_deleted_removed_or_empty";
        break;
      }

      if (Number.isFinite(remaining) && remaining < 2 && Number.isFinite(resetSeconds)) {
        console.log(`Reddit rate window exhausted; waiting ${resetSeconds + 2} seconds.`);
        await sleep((resetSeconds + 2) * 1_000);
      }

      return {
        status: "resolved",
        text,
        httpStatus: response.status,
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastReason = error instanceof Error ? error.name : "request_failed";
      if (attempt < 3) await sleep(attempt * 2_000);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    status: "unresolved",
    reason: lastReason,
    httpStatus: lastStatus,
    retrievedAt: new Date().toISOString(),
  };
}

async function main() {
const sourceBuffer = await readFile(inputPath);
if (sourceBuffer[0] !== 0xff || sourceBuffer[1] !== 0xfe) {
  throw new Error(`${inputPath} is expected to be UTF-16LE with a BOM.`);
}

const decoded = sourceBuffer.toString("utf16le");
const withoutBom = decoded.startsWith("\uFEFF") ? decoded.slice(1) : decoded;
const lineEnding = withoutBom.includes("\r\n") ? "\r\n" : "\n";
const hadTrailingLineEnding = withoutBom.endsWith(lineEnding);
const lines = withoutBom.split(/\r?\n/);
if (hadTrailingLineEnding) lines.pop();

const headers = lines[0].split("\t");
const urlIndex = headers.indexOf("URL");
const sourceIndex = headers.indexOf("Source");
const hitSentenceIndex = headers.indexOf("Hit Sentence");
if ([urlIndex, sourceIndex, hitSentenceIndex].some((index) => index < 0)) {
  throw new Error("The export must contain URL, Source, and Hit Sentence columns.");
}

const rows = lines.slice(1).map((line, offset) => {
  const columns = line.split("\t");
  if (columns.length !== headers.length) {
    throw new Error(
      `Row ${offset + 2} has ${columns.length} columns; expected ${headers.length}.`,
    );
  }
  return { columns, lineNumber: offset + 2 };
});

const targets = rows.filter(({ columns }) => {
  const source = (columns[sourceIndex] || "").toLowerCase();
  return (
    !columns[hitSentenceIndex]?.trim() &&
    (isRedditUrl(columns[urlIndex] || "") || source.includes("reddit"))
  );
});

const cache = await loadCache();
const isResolved = (entry: CacheEntry | undefined) =>
  entry?.status === "resolved" &&
  Boolean(entry.text) &&
  !/^\[\s*(deleted|removed|removed by moderator)\s*\](?:\s+\[link\]\s+\[comments\])?$/i.test(
    entry.text || "",
  );
const isDefinitivelyUnavailable = (entry: CacheEntry | undefined) =>
  entry?.status === "unresolved" &&
  (entry.reason === "content_deleted_removed_or_empty" ||
    entry.reason === "unsupported_reddit_url");
const pending = targets
  .map(({ columns }) => columns[urlIndex])
  .filter(
    (url) =>
      (!commentsOnly || /\/comment\/[^/]+\/?(?:\?|$)/i.test(new URL(url).pathname)) &&
      !isResolved(cache[url]) &&
      !isDefinitivelyUnavailable(cache[url]),
  )
  .slice(0, limit);

console.log(
  JSON.stringify({
    inputPath,
    totalRows: rows.length,
    targetRows: targets.length,
    alreadyResolved: targets.filter(({ columns }) => isResolved(cache[columns[urlIndex]])).length,
    pendingThisRun: pending.length,
    concurrency,
    delayMs,
    applyChanges,
  }),
);

let cursor = 0;
let processed = 0;
const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
  while (cursor < pending.length) {
    const currentIndex = cursor;
    cursor += 1;
    const url = pending[currentIndex];
    cache[url] = await fetchRedditText(url);
    processed += 1;

    if (processed % 10 === 0 || processed === pending.length) {
      await saveCache(cache);
      const resolved = Object.values(cache).filter(
        (entry) => entry.status === "resolved",
      ).length;
      console.log(`Processed ${processed}/${pending.length}; cache resolved: ${resolved}`);
    }

    await sleep(delayMs);
  }
});

await Promise.all(workers);
if (pending.length > 0) await saveCache(cache);

let populated = 0;
for (const { columns } of targets) {
  const entry = cache[columns[urlIndex]];
  if (!isResolved(entry) || !entry?.text) continue;
  columns[hitSentenceIndex] = entry.text;
  populated += 1;
}

const unresolved = targets.length - populated;
const unresolvedReasons = targets.reduce<Record<string, number>>((counts, { columns }) => {
  const entry = cache[columns[urlIndex]];
  if (isResolved(entry)) return counts;
  const reason = entry?.reason || "not_attempted";
  counts[reason] = (counts[reason] || 0) + 1;
  return counts;
}, {});

if (applyChanges) {
  const outputLines = [headers.join("\t"), ...rows.map(({ columns }) => columns.join("\t"))];
  const outputText = `\uFEFF${outputLines.join(lineEnding)}${hadTrailingLineEnding ? lineEnding : ""}`;
  const temporaryPath = `${inputPath}.tmp`;
  await writeFile(temporaryPath, Buffer.from(outputText, "utf16le"));
  await rename(temporaryPath, inputPath);
}

console.log(
  JSON.stringify(
    {
      applyChanges,
      populated,
      unresolved,
      unresolvedReasons,
      cachePath,
    },
    null,
    2,
  ),
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
