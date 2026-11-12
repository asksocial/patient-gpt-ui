import { getSupabaseServerClient } from "../supabase/server";
import type { PlatformPrincipal } from "../intelligence-platform/persistence";
import { normalizeMonitoringCriteria } from "./scope";

export type MonitoringCadence = "daily" | "weekly" | "monthly";
export type MonitoringChannel = "in_app" | "email" | "slack" | "teams";

export function nextMonitoringRun(cadence: MonitoringCadence, from = new Date()) {
  const next = new Date(from);
  if (cadence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  if (cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  if (cadence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  // Due dates use UTC calendar days so daily scheduler jitter cannot skip a day.
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
}

export function classifyAlertSeverity(change: number, threshold: number) {
  const magnitude = Math.abs(change);
  if (magnitude >= threshold * 2) return "material" as const;
  if (magnitude >= threshold) return "watch" as const;
  return "info" as const;
}

export async function listMonitoringProfiles(principal: PlatformPrincipal) {
  const { data, error } = await getSupabaseServerClient().from("intelligence_monitoring_profiles")
    .select("*").eq("principal_id", principal.principalId).order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load monitoring profiles: ${error.message}`);
  return data || [];
}

export async function createMonitoringProfile(
  principal: PlatformPrincipal,
  input: {
    workspaceId: string; name: string; monitorType: "theme_shift" | "patient_signal" | "narrative" | "competitor";
    therapeuticArea: string; query: string; cadence: MonitoringCadence; threshold?: number; deliveryChannels?: MonitoringChannel[]; criteria?: unknown;
  }
) {
  if (!input.workspaceId || !input.name.trim() || !input.query.trim() || !input.therapeuticArea.trim()) {
    throw new Error("Workspace, name, topic, and query are required.");
  }
  const criteria = normalizeMonitoringCriteria(input.criteria);
  if (!["daily", "weekly", "monthly"].includes(input.cadence)) throw new Error("Choose a supported monitoring cadence.");
  if (input.threshold != null && (!Number.isFinite(input.threshold) || input.threshold < 0)) throw new Error("Alert threshold must be a non-negative number.");
  if (input.deliveryChannels?.some(channel => !["in_app", "email", "slack", "teams"].includes(channel))) throw new Error("Choose supported delivery channels.");
  const { data: workspace } = await getSupabaseServerClient().from("intelligence_workspaces").select("id")
    .eq("id", input.workspaceId).eq("principal_id", principal.principalId).maybeSingle();
  if (!workspace) throw new Error("Workspace not found.");
  const { data, error } = await getSupabaseServerClient().from("intelligence_monitoring_profiles").insert({
    principal_id: principal.principalId, owner_id: principal.actorId, workspace_id: input.workspaceId,
    name: input.name.trim(), monitor_type: input.monitorType, therapeutic_area: input.therapeuticArea.trim(), query: input.query.trim(),
    cadence: input.cadence, threshold: Math.max(0, input.threshold ?? 5), delivery_channels: input.deliveryChannels?.length ? input.deliveryChannels : ["in_app"], criteria,
    next_run_at: new Date().toISOString(),
  }).select("*").single();
  if (error || !data) throw new Error(`Failed to create monitoring profile: ${error?.message || "missing row"}`);
  return data;
}

export async function listIntelligenceAlerts(principal: PlatformPrincipal, limit = 50) {
  const { data, error } = await getSupabaseServerClient().from("intelligence_alerts")
    .select("*, intelligence_monitoring_profiles(name)").eq("principal_id", principal.principalId)
    .order("created_at", { ascending: false }).limit(Math.max(1, Math.min(100, limit)));
  if (error) throw new Error(`Failed to load alerts: ${error.message}`);
  return data || [];
}

export async function listDeliveryOutbox(principal: PlatformPrincipal, limit = 50) {
  const { data, error } = await getSupabaseServerClient().from("intelligence_delivery_outbox")
    .select("*").eq("principal_id", principal.principalId).order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) throw new Error(`Failed to load delivery history: ${error.message}`);
  return data || [];
}
