"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef } from "react";

export function SurfaceCard({ as: Element = "section", children, className = "", ...props }) {
  return <Element {...props} className={`as-card ${className}`}>{children}</Element>;
}
export function PageHeading({ title, subtitle, children }) {
  return <div className="as-page-heading"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{children}</div>;
}
export function Field({ label, children, className = "" }) {
  return <label className={`as-field-label ${className}`}><span>{label}</span>{children}</label>;
}
export function ContentSkeleton({ label = "Loading content…", rows = 3 }) {
  return <div className="as-content-skeleton" role="status" aria-label={label} aria-busy="true"><span className="sr-only">{label}</span><div className="as-skeleton-title" aria-hidden="true" />{Array.from({ length: rows }, (_, index) => <div key={index} className="as-skeleton-row" aria-hidden="true" />)}</div>;
}
export function ErrorState({ message, onRetry, title = "This view could not be loaded" }) {
  return <div className="as-error-state" role="alert"><h3>{title}</h3>{message ? <p>{message}</p> : null}{onRetry ? <button type="button" className="as-button as-secondary-button" onClick={onRetry}>Try again</button> : <p>Try the action again, or refresh the page if the problem continues.</p>}</div>;
}
export function EmptyState({ title = "No matching records", description, children }) {
  return <div className="as-empty-state"><h3>{title}</h3>{description ? <p>{description}</p> : null}{children}</div>;
}

/** Reuses the caller's existing dismiss action; never changes save/submit logic. */
export function ModalSurface({ children, onRequestClose, dismissDisabled = false, className = "", ...props }) {
  const node = useRef(null);
  const dismiss = useRef({ onRequestClose, dismissDisabled });
  useEffect(() => { dismiss.current = { onRequestClose, dismissDisabled }; }, [onRequestClose, dismissDisabled]);
  useEffect(() => {
    const previous = document.activeElement;
    const root = node.current;
    const focusable = () => [...root.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])')].filter(item => !item.disabled && item.getClientRects().length);
    (focusable()[0] || root).focus();
    const handleKey = event => {
      const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
      if (dialogs.at(-1) !== root) return;
      if (event.key === "Escape" && dismiss.current.onRequestClose && !dismiss.current.dismissDisabled) { event.preventDefault(); event.stopPropagation(); dismiss.current.onRequestClose(); }
      if (event.key === "Tab") {
        const items = focusable(), first = items[0], last = items.at(-1);
        if (!items.length) { event.preventDefault(); root.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    root.addEventListener('keydown', handleKey);
    return () => { root.removeEventListener('keydown', handleKey); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const close = onRequestClose ? <button type="button" disabled={dismissDisabled} onClick={onRequestClose} className="as-modal-close" aria-label="Close dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg></button> : null;
  const panel = Children.toArray(children);
  const hasPanel = className.split(/\s+/).includes("fixed") && panel.length === 1 && isValidElement(panel[0]);
  const content = hasPanel ? cloneElement(panel[0], {}, close, panel[0].props.children) : <>{close}{children}</>;
  return <div {...props} ref={node} data-as-ui="dialog" role="dialog" aria-modal="true" tabIndex={-1} className={`as-modal ${className}`}>{content}</div>;
}
