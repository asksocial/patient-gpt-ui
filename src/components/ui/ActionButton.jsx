"use client";

import { useImperativeHandle, useRef, useState } from "react";
import { runAction } from "../../lib/client/requestActivity";
import Spinner from "./Spinner";

const actionOwners = new WeakMap();

export function WorkingLabel() {
  return <span className="asksocial-working-label" role="status" aria-live="polite"><Spinner className="h-4 w-4" /><span>Working…</span></span>;
}

export default function ActionButton({ children, onClick = undefined, disabled = false, className = "", ref = undefined, ...props }) {
  const [busy, setBusy] = useState(false);
  const element = useRef(null);
  useImperativeHandle(ref, () => element.current);
  const [owner] = useState(() => {
    let count = 0;
    return () => {
      count += 1;
      setBusy(true);
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        count -= 1;
        setBusy(count > 0);
      };
    };
  });
  return <button {...props} ref={(node) => {
    if (node) actionOwners.set(node, owner);
    element.current = node;
  }} disabled={disabled || busy} aria-busy={busy || undefined}
    aria-label={busy ? "Working…" : props["aria-label"]}
    data-working-action={busy || undefined}
    className={`${className}${busy ? " asksocial-working-action" : ""}`}
    onClick={(event) => {
      if (!busy && onClick) return runAction(owner, () => onClick(event));
    }}>
    <span className="asksocial-action-content" aria-hidden={busy || undefined}>{children}</span>
    {busy ? <WorkingLabel /> : null}
  </button>;
}

// The submitter associates keyboard and mouse submissions with the same button.
export function ActionForm({ onSubmit, children, ...props }) {
  return <form {...props} onSubmit={(event) => {
    const submitter = event.nativeEvent.submitter || event.currentTarget.querySelector('button[type="submit"], button:not([type])');
    const owner = submitter && actionOwners.get(submitter);
    return owner ? runAction(owner, () => onSubmit?.(event)) : onSubmit?.(event);
  }}>{children}</form>;
}
