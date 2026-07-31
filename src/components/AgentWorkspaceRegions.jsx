"use client";

const REGION_COPY = {
  conversation: {
    title: "Conversation",
    description:
      "Questions, clarifications, and current status remain in AskSocial.",
  },
  plan: {
    title: "Plan",
    description:
      "Visible workflow steps and approval checkpoints.",
  },
  evidence: {
    title: "Evidence",
    description:
      "Sources, claims, provenance, confidence, and limitations.",
  },
  deliverable: {
    title: "Deliverable",
    description:
      "The editable brief, table, map, or action list produced by the work.",
  },
};

function RegionCard({
  region,
  children,
}) {
  const copy =
    REGION_COPY[region];
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">
        {copy.title}
      </h3>
      <p className="mt-1 text-xs leading-5 text-white/40">
        {copy.description}
      </p>
      <div className="mt-4">
        {children}
      </div>
    </section>
  );
}

export default function AgentWorkspaceRegions({
  modeLabel,
  context,
  onContextChange,
  messageCount,
  evidenceCount,
  suggestedActions,
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-violet-500/15 bg-violet-500/[0.035] p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300/70">
            Active workstream
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {modeLabel}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {[
            ["product", "Product"],
            ["disease", "Disease"],
            ["geography", "Geography"],
            [
              "timePeriod",
              "Time period",
            ],
          ].map(([key, label]) => (
            <input
              key={key}
              value={
                context[key] || ""
              }
              onChange={(event) =>
                onContextChange({
                  ...context,
                  [key]:
                    event.target
                      .value,
                })
              }
              placeholder={label}
              aria-label={label}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25 sm:w-28"
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <RegionCard region="conversation">
          <p className="text-sm text-white/65">
            {messageCount} message
            {messageCount === 1
              ? ""
              : "s"}{" "}
            in this workstream
          </p>
        </RegionCard>
        <RegionCard region="plan">
          <ol className="space-y-1.5 text-xs text-white/55">
            <li>1. Understand request</li>
            <li>2. Retrieve permitted evidence</li>
            <li>3. Validate and request approval</li>
            <li>4. Produce deliverable</li>
          </ol>
        </RegionCard>
        <RegionCard region="evidence">
          <p className="text-sm text-white/65">
            {evidenceCount} evidence item
            {evidenceCount === 1
              ? ""
              : "s"}{" "}
            in context
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="text-xs text-violet-200/70"
            >
              View evidence
            </button>
            <button
              type="button"
              className="text-xs text-violet-200/70"
            >
              Why this answer?
            </button>
          </div>
        </RegionCard>
        <RegionCard region="deliverable">
          <p className="text-sm text-white/65">
            Draft will remain editable and retain its evidence history.
          </p>
          <div className="mt-3 flex gap-2 text-[11px] uppercase tracking-wide text-white/35">
            <span>DOCX</span>
            <span>PPTX</span>
            <span>XLSX</span>
            <span>PDF</span>
          </div>
        </RegionCard>
      </div>

      {suggestedActions.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <span className="text-xs text-white/35">
            Suggested workflows
          </span>
          {suggestedActions.map(
            (action) => (
              <span
                key={action.id}
                className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-white/55"
              >
                {action.label}
              </span>
            )
          )}
        </div>
      ) : null}
    </section>
  );
}
