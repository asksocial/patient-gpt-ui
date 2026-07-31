"use client";

const STATUS = {
  source_linked: { label: "Source linked", tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
  source_identified: { label: "Source identified", tone: "border-sky-500/20 bg-sky-500/10 text-sky-300" },
  context_only: { label: "Context only", tone: "border-amber-500/20 bg-amber-500/10 text-amber-300" },
};

export default function CitationManifest({ citations = [] }) {
  if (!citations.length) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
            Sources &amp; verification
          </h3>
          <p className="mt-1 text-sm leading-5 text-white/45">
            Traceability reflects supplied provenance. It does not independently authenticate a post or publisher.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/50">
          {citations.length} evidence {citations.length === 1 ? "record" : "records"}
        </span>
      </div>

      <ol className="mt-4 space-y-3">
        {citations.slice(0, 20).map((citation, index) => {
          const status = STATUS[citation.traceability] || STATUS.context_only;
          return (
            <li key={citation.citationId || index} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-white/35">[{index + 1}]</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.tone}`}>
                  {status.label}
                </span>
                {citation.themeLabel ? (
                  <span className="text-xs text-white/45">{citation.themeLabel}</span>
                ) : null}
              </div>
              <blockquote className="mt-3 text-sm leading-6 text-white/70">“{citation.quote}”</blockquote>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
                {citation.sourceUrl ? (
                  <a
                    href={citation.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 hover:text-cyan-200"
                  >
                    {citation.sourceHost || citation.sourceLabel}
                  </a>
                ) : (
                  <span>{citation.sourceLabel}</span>
                )}
                {citation.platform ? <span>Platform: {citation.platform}</span> : null}
                {citation.country ? <span>Market: {citation.country}</span> : null}
                {citation.evidenceQualityScore != null ? (
                  <span>Quality: {Math.round(citation.evidenceQualityScore)}</span>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] leading-4 text-white/30">{citation.verificationNote}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
