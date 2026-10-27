"use client";

import { WorkingLabel } from "./ActionButton";
import { useState } from "react";
import { downloadFile } from "../../lib/client/downloadFile";

export default function DownloadLink({ href, download, children, ...props }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handleDownload(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await downloadFile(href, typeof download === "string" ? download : undefined);
    } catch (failure) {
      setError(failure.message || "Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <>
    <a {...props} href={href} download={download} onClick={handleDownload} aria-disabled={busy || undefined} aria-busy={busy || undefined} data-working-action={busy || undefined} className={`${props.className || ""}${busy ? " asksocial-working-action" : ""}`}><span className="asksocial-action-content" aria-hidden={busy || undefined}>{children}</span>{busy ? <WorkingLabel /> : null}</a>
    {error ? <span role="alert" className="block text-xs text-rose-400">{error}</span> : null}
  </>;
}
