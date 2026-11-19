import { createClient } from "@supabase/supabase-js";

function jwtRole(token: string): unknown {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => !part)) return undefined;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))?.role;
  } catch {
    return undefined;
  }
}

export function assertSupabasePublishableKey(key: string | undefined): asserts key is string {
  if (!key || key === process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (!/^sb_publishable_[\w-]+$/.test(key) && jwtRole(key) !== "anon")) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key or legacy anon key.");
  }
}

export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(url, key);
}

export function getScopedSupabaseClient(clerkSessionToken: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error("SUPABASE_URL is required for scoped Supabase access.");
  assertSupabasePublishableKey(key);
  // Supabase verifies the signature. This check surfaces a missing Clerk integration
  // instead of querying under an anonymous or elevated database role.
  if (jwtRole(clerkSessionToken) !== "authenticated") {
    throw new Error("Scoped Supabase access requires a Clerk session with the authenticated role claim.");
  }
  return createClient(url, key, { accessToken: async () => clerkSessionToken });
}
