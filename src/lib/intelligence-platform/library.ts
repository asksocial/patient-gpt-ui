import { getSupabaseServerClient } from "../supabase/server";
import type { IntelligenceModuleId } from "./ids";
import { listIntelligenceWorkspaces, type PlatformPrincipal } from "./persistence";

function terms(value: string) {
  return Array.from(new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1)));
}

export function scoreCrossWorkspaceRecord(query: string, record: { title?: string; payload?: unknown }) {
  const queryTerms = terms(query);
  if (!queryTerms.length) return 0;
  const title = String(record.title || "").toLowerCase();
  const body = JSON.stringify(record.payload || {}).toLowerCase();
  return queryTerms.reduce((score, term) => score + (title.includes(term) ? 3 : 0) + (body.includes(term) ? 1 : 0), 0) / (queryTerms.length * 4);
}

export async function searchAcrossWorkspaces(
  principal: PlatformPrincipal,
  input: { query: string; moduleIds?: IntelligenceModuleId[]; limit?: number }
) {
  const query = input.query.trim();
  if (!query) return [];
  const permittedWorkspaceIds = new Set(
    (await listIntelligenceWorkspaces(principal)).map((workspace) => workspace.id)
  );
  const { data, error } = await getSupabaseServerClient()
    .from("intelligence_work_products")
    .select("id, workspace_id, kind, title, therapeutic_area, module_id, status, payload, provenance, created_at, intelligence_workspaces(name)")
    .eq("principal_id", principal.principalId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Failed to search intelligence: ${error.message}`);

  return (data || [])
    .filter((record: any) => permittedWorkspaceIds.has(record.workspace_id))
    .filter((record: any) => !record.module_id || (input.moduleIds || []).includes(record.module_id))
    .map((record: any) => ({ ...record, score: scoreCrossWorkspaceRecord(query, record) }))
    .filter((record: any) => record.score > 0)
    .sort((left: any, right: any) => right.score - left.score || String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, Math.max(1, Math.min(50, input.limit || 20)));
}

export async function listSavedSearches(principal: PlatformPrincipal) {
  const { data, error } = await getSupabaseServerClient()
    .from("saved_intelligence_searches")
    .select("*")
    .eq("principal_id", principal.principalId)
    .or(`owner_id.eq.${principal.actorId},is_shared.eq.true`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to load saved searches: ${error.message}`);
  return data || [];
}

export async function saveSearch(
  principal: PlatformPrincipal,
  input: { name: string; query: string; workspaceId?: string; filters?: Record<string, unknown>; isShared?: boolean }
) {
  if (!input.name.trim() || !input.query.trim()) throw new Error("Search name and query are required.");
  const { data, error } = await getSupabaseServerClient()
    .from("saved_intelligence_searches")
    .insert({
      principal_id: principal.principalId,
      owner_id: principal.actorId,
      workspace_id: input.workspaceId || null,
      name: input.name.trim(),
      query: input.query.trim(),
      filters: input.filters || {},
      is_shared: Boolean(input.isShared),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to save search: ${error?.message || "missing row"}`);
  return data;
}

export async function listSavedPrompts(principal: PlatformPrincipal, moduleIds?: IntelligenceModuleId[]) {
  const { data, error } = await getSupabaseServerClient()
    .from("saved_intelligence_prompts")
    .select("*")
    .eq("principal_id", principal.principalId)
    .or(`owner_id.eq.${principal.actorId},is_shared.eq.true`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to load saved prompts: ${error.message}`);
  return (data || []).filter((prompt: any) => !prompt.module_id || !moduleIds?.length || moduleIds.includes(prompt.module_id));
}

export async function savePrompt(
  principal: PlatformPrincipal,
  input: { name: string; prompt: string; description?: string; workspaceId?: string; moduleId?: IntelligenceModuleId; tags?: string[]; isShared?: boolean }
) {
  if (!input.name.trim() || !input.prompt.trim()) throw new Error("Prompt name and content are required.");
  const { data, error } = await getSupabaseServerClient()
    .from("saved_intelligence_prompts")
    .insert({
      principal_id: principal.principalId,
      owner_id: principal.actorId,
      workspace_id: input.workspaceId || null,
      name: input.name.trim(),
      prompt: input.prompt.trim(),
      description: input.description?.trim() || null,
      module_id: input.moduleId || null,
      tags: input.tags || [],
      is_shared: Boolean(input.isShared),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to save prompt: ${error?.message || "missing row"}`);
  return data;
}
