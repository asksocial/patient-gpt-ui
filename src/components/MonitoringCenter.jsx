"use client";

import ActionButton, { ActionForm } from "./ui/ActionButton";

import { activityFetch as fetch } from "../lib/client/requestActivity";

import { useEffect, useState } from "react";
import { sourceGeographyOptions } from "../lib/continuous-intelligence/scope";

const inputClass = "mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60";
const geographyLabel = (value) => sourceGeographyOptions.find(option => option.value === value)?.label || value;

export default function MonitoringCenter({ workspaceId, therapeuticArea }) {
  const [profiles, setProfiles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("What themes are changing and what requires attention?");
  const [cadence, setCadence] = useState("weekly");
  const [threshold, setThreshold] = useState(5);
  const [channels, setChannels] = useState(["in_app"]);
  const [keywords, setKeywords] = useState("");
  const [keywordMatch, setKeywordMatch] = useState("any");
  const [geographies, setGeographies] = useState([]);
  const [geographyInput, setGeographyInput] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [profilesResponse, alertsResponse] = await Promise.all([
        fetch("/api/monitoring/profiles", { cache: "no-store" }),
        fetch("/api/monitoring/alerts", { cache: "no-store" }),
      ]);
      const [profilesData, alertsData] = await Promise.all([profilesResponse.json(), alertsResponse.json()]);
      if (profilesData.ok) setProfiles(profilesData.profiles || []);
      if (alertsData.ok) {
        setAlerts(alertsData.alerts || []);
        setDeliveries(alertsData.deliveries || []);
      }
    } catch {
      setMessage("Continuous Intelligence could not be loaded.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleChannel(channel) {
    setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  }

  const keywordTerms = [...new Set(keywords.split(/[,\n]/).map(term => term.trim()).filter(Boolean))];
  function resolveGeography() {
    const value = geographyInput.trim().toLowerCase();
    return sourceGeographyOptions.find(option => option.label.toLowerCase() === value || option.value.toLowerCase() === value);
  }
  function addGeography() {
    const option = resolveGeography();
    if (!option) { setMessage("Choose a country or region from the geography suggestions."); return; }
    setGeographies(current => [...new Set([...current, option.value])]);
    setGeographyInput("");
    setMessage("");
  }

  async function createProfile(event) {
    event.preventDefault();
    if (!workspaceId) {
      setMessage("Select or create a workspace before scheduling intelligence.");
      return;
    }
    const pendingGeography = geographyInput.trim() ? resolveGeography() : null;
    if (geographyInput.trim() && !pendingGeography) { setMessage("Choose a country or region from the geography suggestions."); return; }
    const selectedGeographies = [...new Set([...geographies, ...(pendingGeography ? [pendingGeography.value] : [])])];
    setBusy("create");
    setMessage("");
    try {
    const response = await fetch("/api/monitoring/profiles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name, query, therapeuticArea, cadence, threshold, monitorType: "theme_shift", deliveryChannels: channels.length ? channels : ["in_app"], criteria: { keywords: keywordTerms, keywordMatch, geographies: selectedGeographies } }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return setMessage(data.error || "Unable to create monitor.");
    setName("");
    setKeywords(""); setGeographies([]); setGeographyInput("");
    setMessage("Monitoring profile scheduled. Run it now to establish the baseline.");
    await load();
    } catch { setMessage("Unable to create monitor. Please try again."); }
    finally { setBusy(""); }
  }

  async function runNow(profileId) {
    setBusy(profileId);
    setMessage("");
    try {
    const response = await fetch("/api/monitoring/run", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId }),
    });
    const data = await response.json();
    setMessage(data.ok ? (data.payload?.scope?.matchedFindings === 0 ? "Monitor completed. No available evidence matches these keywords and geography." : data.alertCreated ? "Monitor completed and created an alert." : "Monitor completed; no threshold alert was required.") : data.error || "Monitor failed.");
    if (data.ok) await load();
    } catch { setMessage("Monitor could not run. Please try again."); }
    finally { setBusy(""); }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Schedule intelligence</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Follow keywords, specific countries or regions, or combine both. Each scheduled review uses matching evidence in the available {therapeuticArea || "selected topic"} corpus.</p>
        {!workspaceId ? <p role="status" className="mt-3 text-sm text-amber-200">Select or create a workspace to save scheduled intelligence.</p> : null}
        <ActionForm onSubmit={createProfile} className="mt-5 grid gap-3 lg:grid-cols-2">
          <label className="text-sm font-medium text-white/75">Profile name<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. GLP-1 access in Europe" className={inputClass} /></label>
          <label className="text-sm font-medium text-white/75">Monitoring question<input required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What should this briefing examine?" className={inputClass} /></label>
          <fieldset className="min-w-0 rounded-xl border border-white/10 p-4">
            <legend className="px-1 text-sm font-medium text-white/75">Keywords and phrases</legend>
            <label htmlFor="monitor-keywords" className="text-xs text-white/55">Separate terms with commas or new lines. Leave blank to follow all keywords.</label>
            <textarea id="monitor-keywords" value={keywords} onChange={event => setKeywords(event.target.value)} rows={3} placeholder="Wegovy, insurance coverage, affordability" className={inputClass} />
            <label className="mt-3 block text-xs text-white/65">Keyword matching<select value={keywordMatch} onChange={event => setKeywordMatch(event.target.value)} className={inputClass}><option value="any">Match any keyword or phrase</option><option value="all">Match all keywords and phrases</option></select></label>
          </fieldset>
          <fieldset className="min-w-0 rounded-xl border border-white/10 p-4">
            <legend className="px-1 text-sm font-medium text-white/75">Geography</legend>
            <label htmlFor="monitor-geography" className="text-xs text-white/55">Add countries or regions. Leave blank for all available markets.</label>
            <div className="flex items-end gap-2"><input id="monitor-geography" list="monitor-geography-options" value={geographyInput} onChange={event => setGeographyInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addGeography(); } }} placeholder="Search e.g. United States, Europe, Japan" className={inputClass} /><ActionButton type="button" onClick={addGeography} disabled={!geographyInput.trim()} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white disabled:opacity-40">Add</ActionButton></div>
            <datalist id="monitor-geography-options">{sourceGeographyOptions.map(option => <option key={option.value} value={option.label}>{option.kind === "region" ? "Region" : option.value}</option>)}</datalist>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Selected geographies">{geographies.map(value => <span key={value} className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 px-3 py-1 text-xs text-cyan-100">{geographyLabel(value)}<button type="button" aria-label={`Remove ${geographyLabel(value)}`} onClick={() => setGeographies(current => current.filter(item => item !== value))}>×</button></span>)}</div>
            <p className="mt-3 text-xs leading-5 text-white/45">Geography uses source-country metadata. Records with unknown geography are excluded when a geography is selected.</p>
          </fieldset>
          <p className="text-xs leading-5 text-white/50 lg:col-span-2">{keywordTerms.length ? `${keywordMatch === "all" ? "All" : "Any"} of ${keywordTerms.length} keywords / phrases` : "All keywords"} · {geographies.length ? geographies.map(geographyLabel).join(", ") : "All available markets"}. When both are selected, evidence must match the keywords and geography.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-white/75">Frequency<select value={cadence} onChange={(event) => setCadence(event.target.value)} className={inputClass}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            <label className="text-sm text-white/75">Alert threshold (points)<input type="number" min="0" step="0.5" required value={threshold} onChange={(event) => setThreshold(event.target.value)} className={inputClass} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["in_app", "email", "slack", "teams"].map((channel) => (
              <label key={channel} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-white/55">
                <input type="checkbox" checked={channels.includes(channel)} onChange={() => toggleChannel(channel)} /> {channel.replace("_", " ")}
              </label>
            ))}
          </div>
          <p className="text-xs text-white/45 lg:col-span-2">Scheduled profiles are checked daily. Use Run now for an immediate baseline. In-app briefings are available in AskSocial. Email, Slack and Teams delivery queues until the corresponding connector is configured.</p>
          <ActionButton type="submit" disabled={busy === "create" || !name.trim() || !query.trim() || !workspaceId} className="w-fit rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40">{busy === "create" ? "Scheduling…" : "Create monitor"}</ActionButton>
        </ActionForm>
        {message ? <p role="status" className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/55">{message}</p> : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Monitoring profiles</h2>
          <div className="mt-4 space-y-3">
            {profiles.length ? profiles.map((profile) => (
              <article key={profile.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-sm font-medium text-white/75">{profile.name}</h3><p className="mt-1 text-xs leading-5 text-white/35">{profile.query}</p></div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300">{profile.status}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-cyan-100/75">Keywords: {profile.criteria?.keywords?.length ? `${profile.criteria.keywordMatch === "all" ? "All" : "Any"} — ${profile.criteria.keywords.join(", ")}` : "All keywords"}<br />Geography: {profile.criteria?.geographies?.length ? profile.criteria.geographies.map(geographyLabel).join(", ") : "All available markets"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/35"><span>{profile.cadence}</span><span>{profile.threshold} point threshold</span><span>Next {new Date(profile.next_run_at).toLocaleDateString(undefined, { timeZone: "UTC" })}</span></div>
                <ActionButton onClick={() => runNow(profile.id)} disabled={busy === profile.id} className="mt-3 text-xs font-medium text-cyan-300 disabled:opacity-40">{busy === profile.id ? "Running…" : "Run now"}</ActionButton>
              </article>
            )) : <p className="text-sm text-white/35">No monitoring profiles yet.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Alerts</h2>
          <div className="mt-4 space-y-3">
            {alerts.length ? alerts.map((alert) => (
              <article key={alert.id} className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-4"><div className="flex items-center gap-2"><span className="text-[11px] uppercase text-amber-300">{alert.severity}</span><span className="text-xs text-white/30">{new Date(alert.created_at).toLocaleString()}</span></div><h3 className="mt-2 text-sm font-medium text-white/75">{alert.title}</h3><p className="mt-1 text-xs leading-5 text-white/40">{alert.summary}</p></article>
            )) : <p className="text-sm text-white/35">No threshold alerts have been created.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Report distribution</h2>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">{deliveries.slice(0, 12).map((delivery) => <div key={delivery.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3"><div><p className="text-sm text-white/65">{delivery.subject}</p><p className="mt-1 text-xs text-white/30">{delivery.channel.replace("_", " ")} · {delivery.status_detail}</p></div><span className="text-xs text-white/40">{delivery.status}</span></div>)}</div>
      </section>
    </div>
  );
}
