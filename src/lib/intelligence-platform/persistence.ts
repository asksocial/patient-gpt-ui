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
  role: WorkspaceRole;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRole = "owner" | "editor" | "viewer";

export type WorkspaceMember = {
  userId: string;
  role: WorkspaceRole;
  addedBy: string;
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

function mapWorkspace(row: any, role: WorkspaceRole = "viewer"): IntelligenceWorkspace {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description || undefined,
    therapeuticArea: row.therapeutic_area || undefined,
    moduleIds: Array.isArray(row.module_ids) ? row.module_ids : [],
    settings: row.settings && typeof row.settings === "object" ? row.settings : {},
    role,
    archivedAt: row.archived_at || undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function isWorkspaceManagementMigrationMissing(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    message.includes("intelligence_workspace_members") ||
    message.includes("archived_at") ||
    message.includes("schema cache")
  );
}

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

async function getWorkspaceAndRole(
  principal: PlatformPrincipal,
  workspaceId: string,
  minimumRole: WorkspaceRole = "viewer"
) {
  const { data: workspace, error } = await getSupabaseServerClient()
    .from("intelligence_workspaces")
    .select("id, principal_id, created_by")
    .eq("id", workspaceId)
    .eq("principal_id", principal.principalId)
    .maybeSingle();
  if (error) throw new Error(`Failed to verify workspace: ${error.message}`);
  if (!workspace) throw new Error("Workspace not found.");

  const { data: membership, error: memberError } = await getSupabaseServerClient()
    .from("intelligence_workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("principal_id", principal.principalId)
    .eq("user_id", principal.actorId)
    .maybeSingle();

  let role: WorkspaceRole;
  if (memberError && isWorkspaceManagementMigrationMissing(memberError)) {
    role = workspace.created_by === principal.actorId ? "owner" : "editor";
  } else if (memberError) {
    throw new Error(`Failed to verify workspace membership: ${memberError.message}`);
  } else if (!membership && workspace.created_by === principal.actorId) {
    role = "owner";
  } else if (!membership) {
    throw new Error("Workspace access denied.");
  } else {
    role = membership.role as WorkspaceRole;
  }

  if (ROLE_RANK[role] < ROLE_RANK[minimumRole]) {
    throw new Error(`Workspace ${minimumRole} access is required.`);
  }
  return { workspace, role };
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
  const workspaceResult = await getSupabaseServerClient()
    .from("intelligence_workspaces")
    .select("id, name, description, therapeutic_area, module_ids, settings, created_by, archived_at, created_at, updated_at")
    .eq("principal_id", principal.principalId)
    .order("updated_at", { ascending: false });
  let data: any[] | null = workspaceResult.data;
  let error: any = workspaceResult.error;

  if (error && isWorkspaceManagementMigrationMissing(error)) {
    const legacy = await getSupabaseServerClient()
      .from("intelligence_workspaces")
      .select("id, name, description, therapeutic_area, module_ids, settings, created_by, created_at, updated_at")
      .eq("principal_id", principal.principalId)
      .order("updated_at", { ascending: false });
    data = legacy.data;
    error = legacy.error;
  }

  if (error) throw new Error(`Failed to load workspaces: ${error.message}`);

  const { data: memberships, error: memberError } = await getSupabaseServerClient()
    .from("intelligence_workspace_members")
    .select("workspace_id, role")
    .eq("principal_id", principal.principalId)
    .eq("user_id", principal.actorId);

  if (memberError && !isWorkspaceManagementMigrationMissing(memberError)) {
    throw new Error(`Failed to load workspace memberships: ${memberError.message}`);
  }

  if (memberError) {
    return (data || []).map((row: any) =>
      mapWorkspace(row, row.created_by === principal.actorId ? "owner" : "editor")
    );
  }

  const roles = new Map(
    (memberships || []).map((member: any) => [member.workspace_id, member.role as WorkspaceRole])
  );
  return (data || [])
    .filter((row: any) => roles.has(row.id) || row.created_by === principal.actorId)
    .map((row: any) => mapWorkspace(row, roles.get(row.id) || "owner"));
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
  const { error: memberError } = await getSupabaseServerClient()
    .from("intelligence_workspace_members")
    .insert({
      workspace_id: data.id,
      principal_id: principal.principalId,
      user_id: principal.actorId,
      role: "owner",
      added_by: principal.actorId,
    });
  if (memberError && !isWorkspaceManagementMigrationMissing(memberError)) {
    throw new Error(`Failed to create workspace owner: ${memberError.message}`);
  }
  await appendPlatformAuditEvent(principal, {
    workspaceId: String(data.id),
    action: "workspace.create",
    resourceType: "workspace",
    resourceId: String(data.id),
    outcome: "completed",
    metadata: { name },
  });
  return mapWorkspace(data, "owner");
}

export async function assertWorkspaceAccess(
  principal: PlatformPrincipal,
  workspaceId: string,
  minimumRole: WorkspaceRole = "viewer"
) {
  return getWorkspaceAndRole(principal, workspaceId, minimumRole);
}

export async function updateIntelligenceWorkspace(
  principal: PlatformPrincipal,
  input: {
    workspaceId: string;
    name?: string;
    description?: string;
    therapeuticArea?: string;
    moduleIds?: IntelligenceModuleId[];
    archived?: boolean;
  }
) {
  const minimumRole = typeof input.archived === "boolean" ? "owner" : "editor";
  await assertWorkspaceAccess(principal, input.workspaceId, minimumRole);
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: principal.actorId,
  };
  if (typeof input.name === "string") {
    if (!input.name.trim()) throw new Error("Workspace name is required.");
    updates.name = input.name.trim();
  }
  if (typeof input.description === "string") updates.description = input.description.trim() || null;
  if (typeof input.therapeuticArea === "string") updates.therapeutic_area = input.therapeuticArea.trim() || null;
  if (Array.isArray(input.moduleIds)) updates.module_ids = input.moduleIds;
  if (typeof input.archived === "boolean") updates.archived_at = input.archived ? new Date().toISOString() : null;

  const updateResult = await getSupabaseServerClient()
    .from("intelligence_workspaces")
    .update(updates)
    .eq("id", input.workspaceId)
    .eq("principal_id", principal.principalId)
    .select("id, name, description, therapeutic_area, module_ids, settings, archived_at, created_at, updated_at")
    .single();
  let data: any = updateResult.data;
  let error: any = updateResult.error;
  if (error && isWorkspaceManagementMigrationMissing(error) && typeof input.archived !== "boolean") {
    delete updates.updated_by;
    const legacy = await getSupabaseServerClient()
      .from("intelligence_workspaces")
      .update(updates)
      .eq("id", input.workspaceId)
      .eq("principal_id", principal.principalId)
      .select("id, name, description, therapeutic_area, module_ids, settings, created_at, updated_at")
      .single();
    data = legacy.data;
    error = legacy.error;
  }
  if (error || !data) {
    if (isWorkspaceManagementMigrationMissing(error)) {
      throw new Error("Workspace archival requires the pending workspace-management migration.");
    }
    throw new Error(`Failed to update workspace: ${error?.message || "missing row"}`);
  }
  const { role } = await assertWorkspaceAccess(principal, input.workspaceId);
  await appendPlatformAuditEvent(principal, {
    workspaceId: input.workspaceId,
    action: typeof input.archived === "boolean" ? (input.archived ? "workspace.archive" : "workspace.restore") : "workspace.update",
    resourceType: "workspace",
    resourceId: input.workspaceId,
    outcome: "completed",
    metadata: { changedFields: Object.keys(updates).filter((field) => !["updated_at", "updated_by"].includes(field)) },
  });
  return mapWorkspace(data, role);
}

export async function deleteIntelligenceWorkspace(
  principal: PlatformPrincipal,
  workspaceId: string
) {
  await assertWorkspaceAccess(principal, workspaceId, "owner");
  const { error } = await getSupabaseServerClient()
    .from("intelligence_workspaces")
    .delete()
    .eq("id", workspaceId)
    .eq("principal_id", principal.principalId);
  if (error) throw new Error(`Failed to delete workspace: ${error.message}`);
  await appendPlatformAuditEvent(principal, {
    action: "workspace.delete",
    resourceType: "workspace",
    resourceId: workspaceId,
    outcome: "completed",
    metadata: { deletedWorkspaceId: workspaceId },
  });
  return { workspaceId };
}

export async function listWorkspaceMembers(principal: PlatformPrincipal, workspaceId: string) {
  await assertWorkspaceAccess(principal, workspaceId, "viewer");
  const { data, error } = await getSupabaseServerClient()
    .from("intelligence_workspace_members")
    .select("user_id, role, added_by, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("principal_id", principal.principalId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isWorkspaceManagementMigrationMissing(error)) throw new Error("Workspace members require the pending workspace-management migration.");
    throw new Error(`Failed to load workspace members: ${error.message}`);
  }
  return (data || []).map((member: any): WorkspaceMember => ({
    userId: member.user_id,
    role: member.role,
    addedBy: member.added_by,
    createdAt: member.created_at,
    updatedAt: member.updated_at,
  }));
}

export async function upsertWorkspaceMember(
  principal: PlatformPrincipal,
  input: { workspaceId: string; userId: string; role: WorkspaceRole }
) {
  await assertWorkspaceAccess(principal, input.workspaceId, "owner");
  if (!input.userId.trim()) throw new Error("A user ID is required.");
  if (!(["owner", "editor", "viewer"] as string[]).includes(input.role)) throw new Error("A valid workspace role is required.");
  if (input.role !== "owner") {
    const { data: currentMember } = await getSupabaseServerClient()
      .from("intelligence_workspace_members")
      .select("role")
      .eq("workspace_id", input.workspaceId)
      .eq("user_id", input.userId.trim())
      .maybeSingle();
    if (currentMember?.role === "owner") {
      const { count } = await getSupabaseServerClient()
        .from("intelligence_workspace_members")
        .select("user_id", { count: "exact", head: true })
        .eq("workspace_id", input.workspaceId)
        .eq("role", "owner");
      if ((count || 0) <= 1) throw new Error("A workspace must retain at least one owner.");
    }
  }
  const { data, error } = await getSupabaseServerClient()
    .from("intelligence_workspace_members")
    .upsert({
      workspace_id: input.workspaceId,
      principal_id: principal.principalId,
      user_id: input.userId.trim(),
      role: input.role,
      added_by: principal.actorId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,user_id" })
    .select("user_id, role, added_by, created_at, updated_at")
    .single();
  if (error || !data) {
    if (isWorkspaceManagementMigrationMissing(error)) throw new Error("Workspace members require the pending workspace-management migration.");
    throw new Error(`Failed to save workspace member: ${error?.message || "missing row"}`);
  }
  await appendPlatformAuditEvent(principal, {
    workspaceId: input.workspaceId,
    action: "workspace.member.upsert",
    resourceType: "workspace_member",
    resourceId: input.userId.trim(),
    outcome: "completed",
    metadata: { role: input.role },
  });
  return data;
}

export async function removeWorkspaceMember(
  principal: PlatformPrincipal,
  input: { workspaceId: string; userId: string }
) {
  await assertWorkspaceAccess(principal, input.workspaceId, "owner");
  const { data: member } = await getSupabaseServerClient()
    .from("intelligence_workspace_members")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (member?.role === "owner") {
    const { count } = await getSupabaseServerClient()
      .from("intelligence_workspace_members")
      .select("user_id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("role", "owner");
    if ((count || 0) <= 1) throw new Error("A workspace must retain at least one owner.");
  }
  const { error } = await getSupabaseServerClient()
    .from("intelligence_workspace_members")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("principal_id", principal.principalId)
    .eq("user_id", input.userId);
  if (error) throw new Error(`Failed to remove workspace member: ${error.message}`);
  await appendPlatformAuditEvent(principal, {
    workspaceId: input.workspaceId,
    action: "workspace.member.remove",
    resourceType: "workspace_member",
    resourceId: input.userId,
    outcome: "completed",
  });
  return { userId: input.userId };
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
  await assertWorkspaceAccess(principal, input.workspaceId, "editor");
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
  if (input.workspaceId) await assertWorkspaceAccess(principal, input.workspaceId, "viewer");
  const permittedWorkspaceIds = input.workspaceId
    ? [input.workspaceId]
    : (await listIntelligenceWorkspaces(principal)).map((workspace) => workspace.id);
  if (!permittedWorkspaceIds.length) return [];
  let query = getSupabaseServerClient()
    .from("intelligence_work_products")
    .select("id, workspace_id, kind, title, therapeutic_area, module_id, status, payload, provenance, created_by, created_at, updated_at")
    .eq("principal_id", principal.principalId)
    .in("workspace_id", permittedWorkspaceIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, input.limit || 50)));
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
