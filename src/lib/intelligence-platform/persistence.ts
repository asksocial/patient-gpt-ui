import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "../supabase/server";
import type { IntelligenceModuleId } from "./ids";

export type PlatformPrincipal = {
  principalId: string;
  principalType: "organization" | "user";
  actorId: string;
};

export type IntelligenceWorkspace = {
  id: string;
  name: string;
  description?: string;
  therapeuticArea?: string;
  moduleIds: IntelligenceModuleId[];
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WorkProductKind =
  | "answer"
  | "report"
  | "snapshot"
  | "patient_intelligence"
  | "monitor_result"
  | "export";

function assertPrincipal(principal: PlatformPrincipal) {
  if (!principal.principalId.trim() || !principal.actorId.trim()) {
    throw new Error("A platform principal and actor are required.");
  }
}

function mapWorkspace(row: any): IntelligenceWorkspace {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description || undefined,
    therapeuticArea: row.therapeutic_area || undefined,
    moduleIds: Array.isArray(row.module_ids) ? row.module_ids : [],
    settings: row.settings && typeof row.settings === "object" ? row.settings : {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function platformPrincipalFromEntitlements(entitlements: {
  userId: string;
  organizationId?: string;
}): PlatformPrincipal {
  return {
    principalId: entitlements.organizationId || entitlements.userId,
    principalType: entitlements.organizationId ? "organization" : "user",
    actorId: entitlements.userId,
  };
}

export async function listIntelligenceWorkspaces(principal: PlatformPrincipal) {
  assertPrincipal(principal);
  const { data, error } = await getSupabaseServerClient()
    .from("intelligence_workspaces")
    .select("id, name, description, therapeutic_area, module_ids, settings, created_at, updated_at")
    .eq("principal_id", principal.principalId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to load workspaces: ${error.message}`);
  return (data || []).map(mapWorkspace);
}

export async function createIntelligenceWorkspace(
  principal: PlatformPrincipal,
  input: {
    name: string;
    description?: string;
    therapeuticArea?: string;
    moduleIds?: IntelligenceModuleId[];
  }
) {
  assertPrincipal(principal);
  const name = input.name.trim();
  if (!name) throw new Error("Workspace name is required.");

  const { data, error } = await getSupabaseServerClient()
    .from("intelligence_workspaces")
    .insert({
      principal_id: principal.principalId,
      principal_type: principal.principalType,
      name,
      description: input.description?.trim() || null,
      therapeutic_area: input.therapeuticArea?.trim() || null,
      module_ids: input.moduleIds || [],
      created_by: principal.actorId,
    })
    .select("id, name, description, therapeutic_area, module_ids, settings, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(`Failed to create workspace: ${error?.message || "missing row"}`);
  await appendPlatformAuditEvent(principal, {
    workspaceId: String(data.id),
    action: "workspace.create",
    resourceType: "workspace",
    resourceId: String(data.id),
    outcome: "completed",
    metadata: { name },
  });
  return mapWorkspace(data);
}

export async function assertWorkspaceAccess(
  principal: PlatformPrincipal,
  workspaceId: string
) {
  const { data, error } = await getSupabaseServerClient()
    .from("intelligence_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("principal_id", principal.principalId)
    .maybeSingle();
  if (error) throw new Error(`Failed to verify workspace: ${error.message}`);
  if (!data) throw new Error("Workspace not found.");
}

export async function saveIntelligenceWorkProduct(
  principal: PlatformPrincipal,
  input: {
    workspaceId: string;
    kind: WorkProductKind;
    title: string;
    therapeuticArea?: string;
    moduleId?: IntelligenceModuleId;
    status?: "draft" | "ready" | "approved" | "archived";
    payload: unknown;
    provenance?: Record<string, unknown>;
  }
) {
  assertPrincipal(principal);
  await assertWorkspaceAccess(principal, input.workspaceId);
  const { data, error } = await getSupabaseServerClient()
    .from("intelligence_work_products")
    .insert({
      workspace_id: input.workspaceId,
      principal_id: principal.principalId,
      kind: input.kind,
      title: input.title.trim() || "Untitled intelligence",
      therapeutic_area: input.therapeuticArea || null,
      module_id: input.moduleId || null,
      status: input.status || "ready",
      payload: input.payload,
      provenance: input.provenance || {},
      created_by: principal.actorId,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to save work product: ${error?.message || "missing row"}`);
  await appendPlatformAuditEvent(principal, {
    workspaceId: input.workspaceId,
    action: "work_product.create",
    resourceType: input.kind,
    resourceId: String(data.id),
    outcome: "completed",
  });
  return data;
}

export async function listIntelligenceWorkProducts(
  principal: PlatformPrincipal,
  input: { workspaceId?: string; kind?: WorkProductKind; limit?: number }
) {
  assertPrincipal(principal);
  let query = getSupabaseServerClient()
    .from("intelligence_work_products")
    .select("id, workspace_id, kind, title, therapeutic_area, module_id, status, payload, provenance, created_by, created_at, updated_at")
    .eq("principal_id", principal.principalId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, input.limit || 50)));
  if (input.workspaceId) query = query.eq("workspace_id", input.workspaceId);
  if (input.kind) query = query.eq("kind", input.kind);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load work products: ${error.message}`);
  return data || [];
}

export async function appendPlatformAuditEvent(
  principal: PlatformPrincipal,
  input: {
    workspaceId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    outcome: "allowed" | "denied" | "completed" | "failed";
    metadata?: Record<string, unknown>;
    occurredAt?: string;
  }
) {
  assertPrincipal(principal);
  const supabase = getSupabaseServerClient();
  const { data: previous, error: previousError } = await supabase
    .from("intelligence_audit_events")
    .select("event_hash")
    .eq("principal_id", principal.principalId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) throw new Error(`Failed to read audit chain: ${previousError.message}`);

  const occurredAt = input.occurredAt || new Date().toISOString();
  const previousHash = previous?.event_hash || "GENESIS";
  const canonical = JSON.stringify({
    principalId: principal.principalId,
    actorId: principal.actorId,
    ...input,
    occurredAt,
    previousHash,
  });
  const eventHash = createHash("sha256").update(canonical).digest("hex");
  const { data, error } = await supabase
    .from("intelligence_audit_events")
    .insert({
      principal_id: principal.principalId,
      workspace_id: input.workspaceId || null,
      actor_id: principal.actorId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId || null,
      outcome: input.outcome,
      metadata: input.metadata || {},
      previous_hash: previousHash,
      event_hash: eventHash,
      occurred_at: occurredAt,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to append audit event: ${error?.message || "missing row"}`);
  return data;
}
