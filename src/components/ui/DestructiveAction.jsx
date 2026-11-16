"use client";
import { useState } from "react";
import ActionButton from "./ActionButton";
import { ModalSurface } from "./Surface";

/** Keep the original handler and any existing native confirmation intact. */
export default function DestructiveAction({ children, onClick, existingConfirmation = false, ...props }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = typeof children === 'string' ? children.trim() : "Remove this item";
  const perform = async event => {
    setBusy(true); setError("");
    try { await onClick?.(event); setConfirming(false); } catch { setError("The action could not be completed. Try again."); } finally { setBusy(false); }
  };
  return <><details className="as-action-overflow"><summary aria-label={`Actions: ${title}`}><span aria-hidden="true">⋯</span></summary><div className="as-action-menu"><ActionButton {...props} type="button" variant="destructive" onClick={event => existingConfirmation ? onClick?.(event) : setConfirming(true)}>{children}</ActionButton></div></details>{confirming ? <ModalSurface onRequestClose={() => setConfirming(false)} dismissDisabled={busy} aria-label={`Confirm ${title}`} className="as-confirm-dialog"><h2>{title}?</h2><p>This will apply the action to the selected item. Review your selection before continuing.</p>{error ? <p role="alert">{error}</p> : null}<div className="as-dialog-actions"><ActionButton type="button" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</ActionButton><ActionButton type="button" variant="destructive" disabled={busy} onClick={perform}>{title}</ActionButton></div></ModalSurface> : null}</>;
}
