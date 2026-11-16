"use client";

import { useEffect, useId, useRef } from "react";
import ActionButton from "./ui/ActionButton";

export default function ExplorationMentionDialog({ mention, theme, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // A modal dialog supplies focus containment and makes the table behind it
    // inert, without moving or unmounting that table or its pagination state.
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl overflow-visible border-0 bg-transparent p-0 text-[var(--as-text)] backdrop:bg-black/80"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll('button:not(:disabled), a[href]');
        const first = controls[0], last = controls[controls.length - 1];
        if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[90dvh] overflow-y-auto overscroll-contain rounded-3xl border border-[var(--as-field-border)] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-[var(--as-text)]">Full mention</p>
              <span className="rounded-full border border-[var(--as-field-border)] bg-[var(--as-tint)] px-3 py-1 text-xs font-semibold text-[var(--as-text)]">Theme evidence</span>
            </div>
            <h2 id={titleId} className="mt-2 text-xl font-semibold text-[var(--as-text)]">{theme}</h2>
          </div>
          <ActionButton ref={closeRef} type="button" onClick={onClose} className="shrink-0 cursor-pointer rounded-lg border border-[var(--as-field-border)] px-3 py-2 text-sm text-[var(--as-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11766b]">Close</ActionButton>
        </div>
        <blockquote className="mt-6 whitespace-pre-wrap break-words border-l-2 border-[var(--as-field-border)] pl-4 text-sm leading-7 text-[var(--as-text)]">{mention.text}</blockquote>
        {/^https?:\/\//i.test(mention.url || "") ? <a href={mention.url} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl border border-[var(--as-field-border)] bg-[var(--as-tint)] px-4 py-3 text-sm font-semibold text-[var(--as-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11766b]">Open original source ↗</a> : <p className="mt-4 text-sm text-[var(--as-text)]">Original source URL is not available in the retained record.</p>}
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {[['Source', mention.platform], ['Market', mention.countries]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[var(--as-field-border)] bg-[var(--as-tint)] p-5"><dt className="text-xs font-medium text-[var(--as-text)]">{label}</dt><dd className="mt-2 break-words text-base font-semibold text-[var(--as-text)]">{value || "Not recorded"}</dd></div>)}
        </dl>
      </div>
    </dialog>
  );
}
