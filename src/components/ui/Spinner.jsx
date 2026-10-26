export default function Spinner({ className = "h-6 w-6" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`${className} shrink-0 animate-spin motion-reduce:animate-none`}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

export function ActivityNotice({ label = "Working…" }) {
  return <div className="asksocial-activity-notice" role="status" aria-live="polite" aria-atomic="true" data-testid="app-loading-indicator">
    <Spinner />
    <span>{label}</span>
  </div>;
}
