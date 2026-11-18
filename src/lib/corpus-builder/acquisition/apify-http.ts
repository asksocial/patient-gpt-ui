import "server-only";

import type { ApifyTransport } from "./apify";

const APIFY_ORIGIN = "https://api.apify.com";
const MAX_RESPONSE_BYTES = 2_000_000;

/** Explicit transport construction only. No caller or credentials are wired in Gate 2A. */
export function createApifyHttpTransport(token: string, request: typeof fetch): ApifyTransport {
  if (!/^apify_api_[a-zA-Z0-9_-]{10,200}$/.test(token)) throw new Error("Apify transport credential unavailable.");
  return async ({ method, path, query, body }) => {
    if (!/^\/v2\/(?:acts|actor-runs|datasets|key-value-stores)\/[a-zA-Z0-9_/-]+$/.test(path)) {
      throw new Error("Invalid Apify request path.");
    }
    const url = new URL(path, APIFY_ORIGIN);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (key.toLowerCase() === "token") throw new Error("Invalid Apify request parameter.");
      url.searchParams.set(key, value);
    }
    const response = await request(url, {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const headers = Object.fromEntries(response.headers);
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return { status: response.status, headers, body: null };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_RESPONSE_BYTES) throw new Error("Apify response exceeded its size limit.");
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return { status: response.status, headers, body: raw ? JSON.parse(raw) : null };
  };
}
