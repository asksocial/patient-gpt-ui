"use client";

function displayValue(value, fallback = "Not available") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export default function EvidenceMentionCard({
  eyebrow = "Module evidence",
  badge,
  title,
  preview,
  metrics = [],
  tags = [],
  url,
  onOpen,
}) {
  const visibleTags = tags.filter(Boolean).slice(0, 3);
  const remainingTagCount = Math.max(0, tags.filter(Boolean).length - visibleTags.length);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.025]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View full evidence mention: ${displayValue(title, eyebrow)}`}
        className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70">{eyebrow}</p>
          {badge ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-2.5 py-1 text-[10px] font-medium capitalize text-cyan-200/75">{badge}</span> : null}
        </div>
        <h4 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-white/85">{displayValue(title, eyebrow)}</h4>
        <blockquote className="mt-4 line-clamp-4 whitespace-pre-wrap border-l-2 border-cyan-300/40 pl-4 text-sm leading-6 text-white/65">{displayValue(preview, "Evidence preview unavailable")}</blockquote>
      </button>

      {visibleTags.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => <span key={tag} className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-1 text-[10px] text-cyan-200/65">{tag}</span>)}
          {remainingTagCount ? <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/40">+{remainingTagCount} more</span> : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {metrics.slice(0, 4).map((metric) => (
          <div key={metric.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">{metric.label}</p>
            <p className={`mt-1 truncate text-white/65 ${metric.capitalize ? "capitalize" : ""}`} title={displayValue(metric.value)}>{displayValue(metric.value)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onOpen} className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black">View full mention</button>
        {url ? <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center rounded-xl border border-cyan-300/35 bg-cyan-300/[0.10] px-4 py-2.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-200/60 hover:bg-cyan-300/[0.16]">Open original source ↗</a> : null}
      </div>
    </article>
  );
}
