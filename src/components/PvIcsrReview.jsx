"use client";

import { useCallback, useEffect, useState } from "react";
import { caseFields } from "../lib/pv/icsr/case";
import { fieldLabel } from "../lib/pv/icsr/email";

const inputClass = "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300";
const buttonClass = "rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-100 disabled:opacity-40 disabled:cursor-not-allowed";
const availability = [["reported", "Reported"], ["not_reported", "Not reported"], ["unknown", "Explicitly unknown"], ["not_available_from_source", "Not available from source"], ["requires_review", "Requires review"]];

function fieldAt(object, path) { return path.split(".").reduce((value, key) => value?.[key], object); }
function SourceLink({ url }) {
  return /^https?:\/\//i.test(url || "") ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-200 underline">Open original source ↗</a> : null;
}
function FieldEditor({ path, field, original, sources, update }) {
  const seriousness = path.includes(".seriousness.");
  return <div className="rounded-xl border border-white/10 p-3">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-white/70">{fieldLabel(path.split(".").at(-1))}</span><label className="flex items-center gap-2 text-xs text-cyan-100"><input type="checkbox" checked={field.confirmed} onChange={event => update({ confirmed: event.target.checked })} />Reviewed / confirmed</label></div>
    {seriousness ? <select aria-label={`${path} evidence status`} className={inputClass} value={field.value} onChange={event => update({ value: event.target.value, availability: event.target.value === "evidence_present" ? "reported" : event.target.value === "evidence_absent_from_source" ? "not_available_from_source" : "requires_review", confirmed: false })}><option value="evidence_present">Evidence present — classification requires PV review</option><option value="evidence_absent_from_source">Evidence absent from source</option><option value="requires_pv_review">Requires PV review</option></select> : <>
      <select aria-label={`${path} availability`} className={`${inputClass} mb-2`} value={field.availability} onChange={event => update({ availability: event.target.value, ...( ["not_reported", "not_available_from_source"].includes(event.target.value) ? { value: "" } : {}), confirmed: false })}>{availability.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
      {path === "identification.reportType" ? <select aria-label="Report type" className={inputClass} value={field.value} onChange={event => update({ value: event.target.value, confirmed: false })}><option>Initial</option><option>Follow-up</option></select> : <textarea aria-label={`${path} value`} rows={path === "narrative" ? 7 : 2} value={field.value} disabled={["not_reported", "not_available_from_source"].includes(field.availability)} placeholder="Not reported" onChange={event => update({ value: event.target.value, confirmed: false })} className={`${inputClass} disabled:opacity-40`} />}
    </>}
    <details className="mt-2 text-xs text-white/50"><summary className="cursor-pointer text-cyan-100">Supporting evidence &amp; original extraction</summary>
      <p className="mt-2 whitespace-pre-wrap">Original extracted value: {original?.value || "Not reported"}</p><p>Original availability: {original?.availability || "Human-added field"}</p><p>Confidence: {field.confidence === null ? "Not available" : field.confidence}</p><p>Origin: {field.origin.replaceAll("_", " ")}</p>
      <label className="mt-3 block">Supporting excerpt or documented follow-up evidence<textarea aria-label={`${path} supporting evidence`} className={`${inputClass} mt-1`} rows={3} value={field.evidence} onChange={event => update({ evidence: event.target.value, confirmed: false })} /></label>
      <label className="mt-2 block">Provenance<select aria-label={`${path} source reference`} className={`${inputClass} mt-1`} value={field.source_reference || ""} onChange={event => update({ source_reference: event.target.value || null, confirmed: false })}><option value="">Human follow-up / reviewer documentation</option>{sources.map(source => <option key={source.id} value={source.id}>{source.platform} · {source.mentionId}</option>)}</select></label>
      {sources.filter(source => source.id === field.source_reference).map(source => <div key={source.id} className="mt-3 rounded-lg bg-white/5 p-3"><blockquote className="whitespace-pre-wrap border-l border-cyan-300/50 pl-3">{source.excerpt}</blockquote><div className="mt-2"><SourceLink url={source.url} /></div></div>)}
    </details>
  </div>;
}

export default function PvIcsrReview({ recordId }) {
  const [data, setData] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [email, setEmail] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sentConfirmation, setSentConfirmation] = useState(false);
  const endpoint = `/api/pv/records/${recordId}/icsr`;
  const accept = useCallback(payload => { setData(payload); setCaseData(payload.snapshot.caseData); setEmail(payload.snapshot.email); setDirty(false); setEmailDirty(false); setSentConfirmation(false); }, []);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const response = await fetch(endpoint, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); accept(payload); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }, [endpoint, accept]);
  useEffect(() => { setData(null); setCaseData(null); setEmail(null); load(); }, [load]);
  function editField(path, patch) {
    setCaseData(current => { const next = structuredClone(current); Object.assign(fieldAt(next, path), patch); return next; });
    setDirty(true); setNotice("");
  }
  function editCriterion(key, patch) { setCaseData(current => ({ ...current, minimumCriteria: { ...current.minimumCriteria, [key]: { ...current.minimumCriteria[key], ...patch } } })); setDirty(true); setNotice(""); }
  async function act(action, extra = {}) {
    setBusy(true); setError(""); setNotice("");
    try {
      const review = action === "save_review" ? { fields: Object.fromEntries(caseFields(caseData).map(([path, field]) => [path, { value: field.value, availability: field.availability, evidence: field.evidence, source_reference: field.source_reference, confirmed: field.confirmed }])), criteria: caseData.minimumCriteria, internalNotes: caseData.internalNotes, ...extra } : undefined;
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, revision: data.snapshot.revision, review, email, sentConfirmation }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      // Refresh protected revision history after a successful mutation.
      accept({ ...payload, history: data.history });
      if (action === "export") {
        const blob = new Blob([JSON.stringify(payload.exportedSummary, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `AskSocial-ICSR-${recordId}.json`; anchor.click(); URL.revokeObjectURL(url);
        setNotice("Case summary exported. No email was transmitted.");
      } else setNotice(action === "approve" ? "Review approved. You can generate the email preview." : action === "sent" ? "Notification recorded as sent by the reviewer." : action === "generate" ? "Email preview generated. Review recipients and content before sharing." : "Saved to the case revision history.");
      const historyResponse = await fetch(endpoint, { cache: "no-store" });
      if (historyResponse.ok) { const refreshed = await historyResponse.json(); setData(refreshed); }
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function copyEmail() {
    try { await navigator.clipboard.writeText(`To: ${email.recipients}\nSubject: ${email.subject}\n\n${email.body}`); setNotice("Email copied. Send it using your approved client process."); }
    catch { setError("Clipboard unavailable. Select and copy the preview text manually."); }
  }
  const fields = caseData ? caseFields(caseData) : [];
  const groups = [...new Set(fields.map(([path]) => path.startsWith("events.") || path.startsWith("suspectProducts.") || path.startsWith("concomitantProducts.") ? path.split(".").slice(0, 2).join(".") : path.split(".")[0]))];
  return <section aria-label="R3-aligned ICSR review" className="rounded-2xl border border-cyan-300/20 bg-white/[0.02] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-white">Review ICSR · R3-Aligned Email</h2><p className="mt-1 text-xs leading-5 text-white/50">Source evidence → structured safety case → human PV review → email preview. Final regulatory decisions remain with qualified PV personnel.</p></div><button className={buttonClass} onClick={load} disabled={busy || dirty || emailDirty}>Reload case</button></div>
    {error ? <p role="alert" className="mt-3 whitespace-pre-wrap text-xs text-amber-200">{error}</p> : null}{notice ? <p role="status" className="mt-3 text-xs text-cyan-100">{notice}</p> : null}
    {!caseData ? <p className="mt-4 text-sm text-white/50">{busy ? "Loading structured case…" : "Structured case unavailable."}</p> : <>
      <ol aria-label="ICSR workflow status" className="mt-4 flex flex-wrap gap-2 text-xs">{["detected", "requires_review", "reviewed", "email_ready", "sent", "exported"].map(status => <li key={status} aria-current={caseData.status === status ? "step" : undefined} className={`rounded-full border px-3 py-1 ${caseData.status === status ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-white/40"}`}>{fieldLabel(status.replaceAll("_", " "))}</li>)}</ol>
      <p className="mt-3 text-sm text-amber-100">{data.validation.label}</p><p className="mt-1 text-xs text-white/40">Revision {data.snapshot.revision} · {caseData.approval ? `Approved by ${caseData.approval.reviewer} at ${caseData.approval.timestamp}` : "Human approval pending"}{dirty ? " · Unsaved changes require renewed approval" : ""}</p>
      <details className="mt-4 rounded-xl border border-white/10 p-4" open><summary className="cursor-pointer text-sm text-white/80">AskSocial Observed Evidence</summary>{caseData.sourceEvidence.map(source => <div key={source.id} className="mt-3 text-xs text-white/60"><blockquote className="whitespace-pre-wrap border-l-2 border-cyan-300/40 pl-4 text-sm leading-6">{source.excerpt}</blockquote><p className="mt-2">{source.platform} · Account: {source.authorIdentifier || "Not reported"}</p><p>Published: {source.publicationTimestamp || "Not available from source"} · Detected: {source.detectionTimestamp}</p><p className="break-all">Mention: {source.mentionId} · Evidence hash: {source.evidenceHash}</p><SourceLink url={source.url} /></div>)}</details>
      <details className="mt-4 rounded-xl border border-white/10 p-4" open><summary className="cursor-pointer text-sm text-white/80">Minimum ICSR criteria</summary><div className="mt-3 grid gap-3 md:grid-cols-2">{Object.entries(caseData.minimumCriteria).map(([key, criterion]) => <div key={key} className="rounded-xl border border-white/10 p-3"><label className="block text-xs text-white/70">{fieldLabel(key)}<select aria-label={`${key} minimum criterion`} className={`${inputClass} mt-2`} value={criterion.present} onChange={event => editCriterion(key, { present: event.target.value, confirmed: false })}><option value="present">Present</option><option value="potentially_present">Potentially present / requires review</option><option value="not_identified">Not identified</option></select></label><textarea aria-label={`${key} criterion evidence`} className={`${inputClass} mt-2`} rows={3} value={criterion.evidence} placeholder="Document supporting evidence; never fabricate a minimum element." onChange={event => editCriterion(key, { evidence: event.target.value, confirmed: false })} /><label className="mt-2 flex items-center gap-2 text-xs text-cyan-100"><input type="checkbox" checked={criterion.confirmed} onChange={event => editCriterion(key, { confirmed: event.target.checked })} />Reviewed / confirmed under client procedures</label><p className="mt-2 text-xs text-white/40">Evidence reference: {criterion.source_reference || "Reviewer documentation"}</p>{key === "reporter" ? <p className="mt-1 text-xs text-white/40">A public username is available identification evidence, subject to client PV procedures.</p> : null}</div>)}</div></details>
      <div className="mt-4 space-y-3">{groups.map(group => <details key={group} className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm font-medium text-white/80">{group === "pvAssessment" ? "PV Assessment — human interpretation, separate from source facts" : group.split(".").map((value, index) => index === 1 ? Number(value) + 1 : fieldLabel(value)).join(" ")}</summary>{group === "pvAssessment" ? <p className="mt-2 text-xs text-white/45">Document qualified PV judgments here. They do not alter observed source facts or automatically establish regulatory reportability. Internal notes and assessments are excluded from case exports.</p> : null}<div className={`mt-3 grid gap-3 ${group === "narrative" ? "" : "lg:grid-cols-2"}`}>{fields.filter(([path]) => path === group || path.startsWith(`${group}.`)).map(([path, field]) => <FieldEditor key={path} path={path} field={field} original={fieldAt(data.snapshot.originalExtraction, path)} sources={caseData.sourceEvidence} update={patch => editField(path, patch)} />)}</div></details>)}</div>
      <div className="mt-4 flex flex-wrap gap-2">{[["product", "Add suspect product"], ["event", "Add adverse event"], ["concomitant", "Add concomitant product"]].map(([add, title]) => <button key={add} className={buttonClass} disabled={busy || dirty} onClick={() => act("save_review", { add })}>{title}</button>)}</div>
      <label className="mt-4 block text-xs text-white/60">Internal PV notes (excluded from email and case export)<textarea className={`${inputClass} mt-2`} rows={3} value={caseData.internalNotes} onChange={event => { setCaseData(current => ({ ...current, internalNotes: event.target.value })); setDirty(true); }} /></label>
      <div className="mt-4 flex flex-wrap gap-2"><button className={buttonClass} disabled={busy} onClick={() => act("save_review")}>Save review / corrections</button><button className={buttonClass} disabled={busy || dirty || data.validation.issues.length > 0} onClick={() => act("approve")}>Approve case for email generation</button><button className={buttonClass} disabled={busy || dirty || !caseData.approval} onClick={() => act("generate")}>Generate ICSR Email</button></div>
      {data.validation.issues.length ? <details className="mt-3 text-xs text-white/50"><summary className="cursor-pointer">Review requirements ({data.validation.issues.length}) — save changes to refresh</summary><ul className="mt-2 list-disc space-y-1 pl-5">{data.validation.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details> : null}
      {email && !dirty ? <section aria-label="ICSR email preview" className="mt-5 rounded-xl border border-cyan-300/30 p-4"><h3 className="text-sm font-semibold text-cyan-100">Email preview</h3><p className="mt-1 text-xs text-white/50">Review and copy/export for your approved sharing process. Marking sent records a manual action; it does not transmit email.</p>{[["subject", "Subject"], ["recipients", "Recipients"]].map(([key, title]) => <label key={key} className="mt-3 block text-xs text-white/60">{title}<input className={`${inputClass} mt-1`} value={email[key]} onChange={event => { setEmail(current => ({ ...current, [key]: event.target.value })); setEmailDirty(true); }} /></label>)}<label className="mt-3 block text-xs text-white/60">Email content<textarea className={`${inputClass} mt-1 font-mono`} rows={24} value={email.body} onChange={event => { setEmail(current => ({ ...current, body: event.target.value })); setEmailDirty(true); }} /></label><div className="mt-3 flex flex-wrap gap-2"><button className={buttonClass} disabled={busy} onClick={() => act("save_email")}>Save preview edits</button><button className={buttonClass} disabled={busy || emailDirty} onClick={copyEmail}>Copy email</button><button className={buttonClass} disabled={busy || emailDirty} onClick={() => act("export")}>Export email / case summary</button></div><label className="mt-4 flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={sentConfirmation} onChange={event => setSentConfirmation(event.target.checked)} />I sent this notification through the approved external process.</label><button className={`${buttonClass} mt-2`} disabled={busy || emailDirty || !sentConfirmation || !email.recipients.trim()} onClick={() => act("sent")}>Mark notification as sent</button></section> : null}
      <details className="mt-4 rounded-xl border border-white/10 p-4 text-xs text-white/60"><summary className="cursor-pointer">ICSR revision history · original extraction and reviewed values</summary>{(data.history || []).map(revision => <details key={revision.revision} className="mt-3 border-t border-white/10 pt-3"><summary className="cursor-pointer">Revision {revision.revision} · {revision.action} · {revision.reviewer_id} · {revision.reviewed_at}</summary><p className="mt-2 break-all">Changes: {revision.changes.join(", ")}</p><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(revision.snapshot, null, 2)}</pre></details>)}</details>
    </>}
  </section>;
}
