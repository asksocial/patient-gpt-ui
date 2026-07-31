import { loadCanonicalFindingsForAsk } from "../answers/loadCanonicalFindingsForAsk";
import { askSocial } from "../../app/api/ask";
import { getSupabaseServerClient } from "../supabase/server";
import { classifyAlertSeverity, nextMonitoringRun, type MonitoringCadence, type MonitoringChannel } from "./monitoring";

export async function executeMonitoringProfile(profile: any) {
  const startedAt = new Date().toISOString();
  const corpus = loadCanonicalFindingsForAsk(profile.therapeutic_area);
  if (corpus.status !== "available") throw new Error(corpus.reason);
  const intelligence = askSocial(profile.query, corpus.findings);
  const primaryTheme = [...(intelligence.themeSummary || [])]
    .sort((left: any, right: any) => (right.prevalence?.eligiblePercent || right.percent || 0) - (left.prevalence?.eligiblePercent || left.percent || 0))[0];
  const signalValue = Number(primaryTheme?.prevalence?.eligiblePercent ?? primaryTheme?.percent ?? 0);
  const supabase = getSupabaseServerClient();
  const { data: previous } = await supabase.from("intelligence_monitor_runs").select("signal_value")
    .eq("profile_id", profile.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle();
  const previousValue = previous?.signal_value == null ? null : Number(previous.signal_value);
  const changeValue = previousValue == null ? 0 : Math.round((signalValue - previousValue) * 100) / 100;
  const completedAt = new Date().toISOString();
  const summary = primaryTheme
    ? `${primaryTheme.label} is the leading monitored theme at ${signalValue.toFixed(1)}%.`
    : "No supported theme met the monitoring criteria.";
  const payload = {
    schemaVersion: "continuous_intelligence_run_v1", query: profile.query, therapeuticArea: profile.therapeutic_area,
    primaryTheme: primaryTheme ? { id: primaryTheme.themeId, label: primaryTheme.label, prevalencePercent: signalValue, confidence: primaryTheme.confidenceLabel } : null,
    themeSummary: (intelligence.themeSummary || []).slice(0, 10), generatedAt: completedAt,
  };
  const { data: run, error: runError } = await supabase.from("intelligence_monitor_runs").insert({
    profile_id: profile.id, principal_id: profile.principal_id, workspace_id: profile.workspace_id, status: "completed", summary,
    signal_value: signalValue, previous_signal_value: previousValue, change_value: changeValue, payload, started_at: startedAt, completed_at: completedAt,
  }).select("*").single();
  if (runError || !run) throw new Error(`Failed to save monitor run: ${runError?.message || "missing row"}`);

  await supabase.from("intelligence_work_products").insert({
    workspace_id: profile.workspace_id, principal_id: profile.principal_id, kind: "monitor_result", title: `${profile.name} · ${completedAt.slice(0, 10)}`,
    therapeutic_area: profile.therapeutic_area, module_id: null, status: "ready", payload, provenance: { profileId: profile.id, runId: run.id }, created_by: profile.owner_id,
  });

  const threshold = Number(profile.threshold || 0);
  const shouldAlert = previousValue != null && Math.abs(changeValue) >= threshold;
  if (shouldAlert) {
    await supabase.from("intelligence_alerts").insert({
      principal_id: profile.principal_id, workspace_id: profile.workspace_id, profile_id: profile.id, run_id: run.id,
      severity: classifyAlertSeverity(changeValue, threshold), title: `${primaryTheme?.label || "Monitored signal"} changed ${changeValue > 0 ? "+" : ""}${changeValue.toFixed(1)} points`,
      summary, evidence: primaryTheme?.clientFacingEvidence || [],
    });
  }

  const channels: MonitoringChannel[] = Array.isArray(profile.delivery_channels) ? profile.delivery_channels : ["in_app"];
  await supabase.from("intelligence_delivery_outbox").insert(channels.map((channel) => ({
    principal_id: profile.principal_id, workspace_id: profile.workspace_id, profile_id: profile.id, run_id: run.id, channel,
    subject: `${profile.name} intelligence briefing`, payload: { summary, signalValue, changeValue, alertCreated: shouldAlert },
    status: channel === "in_app" ? "delivered" : "queued",
    status_detail: channel === "in_app" ? "Available in AskSocial." : "Awaiting configured enterprise connector.",
    delivered_at: channel === "in_app" ? completedAt : null,
  })));

  await supabase.from("intelligence_monitoring_profiles").update({
    last_run_at: completedAt, next_run_at: nextMonitoringRun(profile.cadence as MonitoringCadence, new Date(completedAt)), updated_at: completedAt,
  }).eq("id", profile.id);
  return { run, payload, alertCreated: shouldAlert };
}
