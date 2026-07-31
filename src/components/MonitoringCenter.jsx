"use client";

import { useEffect, useState } from "react";

export default function MonitoringCenter({ workspaceId, therapeuticArea }) {
  const [profiles, setProfiles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("What themes are changing and what requires attention?");
  const [cadence, setCadence] = useState("weekly");
  const [threshold, setThreshold] = useState(5);
  const [channels, setChannels] = useState(["in_app"]);
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

  async function createProfile(event) {
    event.preventDefault();
    if (!workspaceId) {
      setMessage("Select or create a workspace before scheduling intelligence.");
      return;
    }
    setBusy("create");
    const response = await fetch("/api/monitoring/profiles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name, query, therapeuticArea, cadence, threshold, monitorType: "theme_shift", deliveryChannels: channels.length ? channels : ["in_app"] }),
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok || !data.ok) return setMessage(data.error || "Unable to create monitor.");
    setName("");
    setMessage("Monitoring profile scheduled. Run it now to establish the baseline.");
    load();
  }

  async function runNow(profileId) {
    setBusy(profileId);
    setMessage("");
    const response = await fetch("/api/monitoring/run", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId }),
    });
    const data = await response.json();
    setBusy("");
    setMessage(data.ok ? (data.alertCreated ? "Monitor completed and created an alert." : "Monitor completed; no threshold alert was required.") : data.error || "Monitor failed.");
    if (data.ok) load();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Schedule intelligence</h2>
        <p className="mt-1 text-sm text-white/45">Create a governed recurring profile. In-app delivery is active; external channels queue until their enterprise connectors are configured.</p>
        <form onSubmit={createProfile} className="mt-5 grid gap-3 lg:grid-cols-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Profile name" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Monitoring question" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={cadence} onChange={(event) => setCadence(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white/50">Threshold <input type="number" min="0" step="0.5" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="w-16 bg-transparent text-sm text-white outline-none" /> pts</label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["in_app", "email", "slack", "teams"].map((channel) => (
              <label key={channel} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-white/55">
                <input type="checkbox" checked={channels.includes(channel)} onChange={() => toggleChannel(channel)} /> {channel.replace("_", " ")}
              </label>
            ))}
          </div>
          <button type="submit" disabled={busy === "create" || !name.trim()} className="w-fit rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40">{busy === "create" ? "Scheduling…" : "Create monitor"}</button>
        </form>
        {message ? <p className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/55">{message}</p> : null}
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
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/35"><span>{profile.cadence}</span><span>{profile.threshold} point threshold</span><span>Next {new Date(profile.next_run_at).toLocaleString()}</span></div>
                <button onClick={() => runNow(profile.id)} disabled={busy === profile.id} className="mt-3 text-xs font-medium text-cyan-300 disabled:opacity-40">{busy === profile.id ? "Running…" : "Run now"}</button>
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
