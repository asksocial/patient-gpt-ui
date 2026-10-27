"use client";

import Tooltip from "./ui/Tooltip";

export default function RecommendedActions({ actions = [] }) {
  if (!actions.length) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Recommended Actions</h3>
        <p className="mt-1 text-sm text-white/45">Suggested next moves based on the strongest current signals</p>
      </div>
      <div className="space-y-3">
        {actions.map((action, idx) => (
          <div key={`${action}-${idx}`} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <Tooltip content="A practical next step derived from the strongest current signals." delay={250} side="top" align="center">
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  <span className="whitespace-nowrap">Action {idx + 1}</span>
                </span>
              </Tooltip>
              <p className="text-sm leading-6 text-white/75">{action}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
