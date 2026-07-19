"use client";

import Tooltip from "./ui/Tooltip";

const SIGNAL_STYLES = {
  momentum:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  opportunity:
    "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  risk:
    "border-rose-500/20 bg-rose-500/10 text-rose-300",
  evidence_gap:
    "border-amber-500/20 bg-amber-500/10 text-amber-300",
  stability:
    "border-blue-500/20 bg-blue-500/10 text-blue-300",
};

const PRIORITY_STYLES = {
  high: "bg-rose-500/15 text-rose-300",
  medium:
    "bg-amber-500/15 text-amber-300",
  low: "bg-white/10 text-white/55",
};

function words(value) {
  return String(value || "")
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function signed(value) {
  const numeric = Number(value || 0);
  return numeric > 0
    ? `+${numeric}`
    : String(numeric);
}

function formatDate(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm leading-6 text-white/45">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-white/40">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function TableHeading({ label, tooltip }) {
  return (
    <th className="pb-3 font-medium">
      <Tooltip
        content={tooltip}
        delay={200}
        side="bottom"
        align="start"
      >
        <button
          type="button"
          aria-label={`${label}: ${tooltip}`}
          className="inline-flex cursor-help items-center gap-1.5 text-left uppercase tracking-[0.14em] text-white/35 transition-colors hover:text-white/65 focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          <span>{label}</span>
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px] normal-case tracking-normal text-white/50"
          >
            ?
          </span>
        </button>
      </Tooltip>
    </th>
  );
}

function EmptyState({ reason }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <div className="max-w-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-xl text-cyan-300">
          ↗
        </div>
        <h2 className="mt-5 text-xl font-semibold text-white">
          Executive brief not available yet
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/50">
          {reason || "Run an analysis that produces a theme knowledge snapshot. AskSocial will then turn the supported prevalence, trajectory, triangulation, and strategic-implication signals into this leadership view."}
        </p>
        <p className="mt-3 text-xs leading-5 text-white/35">
          No metrics or recommendations are inferred when the analytical evidence is absent.
        </p>
      </div>
    </div>
  );
}

export default function ExecutiveIntelligenceView({ brief, unavailableReason }) {
  if (!brief) return <EmptyState reason={unavailableReason} />;

  const quality = brief.dataQuality || {};
  const themes = brief.topThemes || [];
  const signals = brief.decisionSignals || [];
  const actions = brief.recommendedActions || [];
  const watchlist = brief.watchlist || [];
  const warnings = quality.warnings || [];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-white/[0.03] to-violet-500/10 p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              <span>Executive Intelligence</span>
              <span className="text-white/20">•</span>
              <span>{brief.therapeuticArea}</span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-white md:text-4xl">
              {brief.headline}
            </h1>
            <div className="mt-5 space-y-2">
              {(brief.executiveSummary || []).map((item, index) => (
                <p key={`${item}-${index}`} className="text-sm leading-6 text-white/65">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="min-w-56 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-white/45">
            <p className="font-semibold uppercase tracking-[0.16em] text-white/65">
              Analysis window
            </p>
            <p className="mt-3">
              {formatDate(brief.analysisStart)} — {formatDate(brief.analysisEnd)}
            </p>
            <p className="mt-2">
              Generated {formatDate(brief.generatedAt)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Findings analyzed" value={quality.datasetFindingCount ?? 0} detail="Qualifying analytical dataset" />
        <Metric label="Temporal coverage" value={`${quality.temporalCoveragePercent ?? 0}%`} detail="Findings with usable dates" />
        <Metric label="High-confidence themes" value={quality.highConfidenceThemeCount ?? 0} detail="Meets strongest evidence threshold" />
        <Metric label="Corroborated themes" value={quality.corroboratedThemeCount ?? 0} detail="At least two sources and channels" />
      </div>

      <Section title="Priority themes" subtitle="Prevalence, direction, confidence, and corroboration in one decision view">
        {themes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-white/35">
                <tr>
                  <TableHeading
                    label="Theme"
                    tooltip="The conversation topic or pattern being measured."
                  />
                  <TableHeading
                    label="Prevalence"
                    tooltip="The share of qualifying findings connected to this theme."
                  />
                  <TableHeading
                    label="Trajectory"
                    tooltip="Whether the theme is growing, stable, declining, or newly emerging over time."
                  />
                  <TableHeading
                    label="Recent change"
                    tooltip="How many percentage points the theme moved in the most recent comparison period."
                  />
                  <TableHeading
                    label="Confidence"
                    tooltip="How strongly the available evidence supports this theme and its direction."
                  />
                  <TableHeading
                    label="Triangulation"
                    tooltip="How consistently the theme is supported across different source types and channels."
                  />
                </tr>
              </thead>
              <tbody>
                {themes.map((theme) => (
                  <tr key={theme.themeId} className="border-b border-white/[0.06] text-white/70 last:border-0">
                    <td className="py-4 pr-5 font-medium text-white">{theme.label}</td>
                    <td className="py-4 pr-5">{theme.eligiblePercent}%</td>
                    <td className="py-4 pr-5">{words(theme.trajectory)}</td>
                    <td className={`py-4 pr-5 ${Number(theme.percentagePointChange) > 0 ? "text-emerald-300" : Number(theme.percentagePointChange) < 0 ? "text-rose-300" : ""}`}>
                      {signed(theme.percentagePointChange)} pts
                    </td>
                    <td className="py-4 pr-5">{words(theme.confidence)}</td>
                    <td className="py-4">{words(theme.triangulation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-white/45">No supported priority themes are available.</p>
        )}
      </Section>

      <Section title="Decision signals" subtitle="The strongest evidence-backed momentum, opportunity, risk, and validation signals">
        {signals.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {signals.map((signal) => (
              <article key={signal.signalId} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${SIGNAL_STYLES[signal.type] || SIGNAL_STYLES.stability}`}>
                    {words(signal.type)}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLES[signal.priority] || PRIORITY_STYLES.low}`}>
                    {words(signal.priority)} priority
                  </span>
                  <span className="text-xs text-white/35">{words(signal.confidence)} confidence</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{signal.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{signal.statement}</p>
                <ul className="mt-4 space-y-1.5 text-xs text-white/40">
                  {(signal.evidenceBasis || []).map((basis) => (
                    <li key={basis}>• {basis}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/45">No decision signal currently clears the evidence threshold.</p>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Recommended actions" subtitle="Actions inherited from supported strategic implications">
          {actions.length ? (
            <div className="space-y-3">
              {actions.map((action, index) => (
                <article key={action.actionId} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">{index + 1}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.low}`}>
                      {words(action.priority)} priority
                    </span>
                    <span className="text-xs text-white/35">{words(action.confidence)} confidence</span>
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-white">{action.action}</p>
                  <p className="mt-2 text-xs leading-5 text-white/45">{action.rationale}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-white/45">No action currently clears both the priority and evidence-confidence thresholds.</p>
          )}
        </Section>

        <Section title="Executive watchlist" subtitle="Directional signals that require corroboration before escalation">
          {watchlist.length ? (
            <div className="space-y-3">
              {watchlist.map((item) => (
                <article key={item.themeId} className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">{item.label}</h3>
                    <span className="text-xs text-amber-300/80">{words(item.confidence)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/55">{item.reason}</p>
                  <p className="mt-3 text-xs leading-5 text-white/35"><span className="font-semibold text-white/50">Escalation trigger:</span> {item.trigger}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/45">No directional themes require executive monitoring.</p>
          )}
        </Section>
      </div>

      <Section title="Evidence guardrails" subtitle="Coverage and limitations carried into the leadership interpretation">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-white/35">Directional themes</p>
            <p className="mt-2 text-2xl font-semibold text-white">{quality.directionalThemeCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            {warnings.length ? (
              <ul className="space-y-2 text-sm leading-6 text-amber-200/70">
                {warnings.map((warning) => <li key={warning}>• {warning}</li>)}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-emerald-300/70">No material data-quality warnings were identified for this snapshot.</p>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
