"use client";

export default function ExpansionCatalog({
  packaging,
}) {
  const available =
    packaging?.availableToAdd ||
    [];

  if (!packaging) {
    return (
      <div className="text-sm text-white/40">
        Loading available modules…
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
          Available to add
        </p>
        <h2 className="mt-3 text-xl font-semibold text-white">
          Expand your intelligence environment
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/50">
          These modules can be activated in the same AskSocial
          environment. Restricted module content remains hidden until
          your organization is entitled.
        </p>
      </div>

      {available.length ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {available.map(
            (module) => (
              <article
                key={
                  module.moduleId
                }
                className="rounded-2xl border border-white/10 bg-black/30 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">
                      {module.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      {module.value}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Available
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    Compatible modes
                  </p>
                  <p className="mt-2 text-sm text-white/60">
                    {module
                      .compatibleModes
                      .map(
                        (mode) =>
                          mode.name
                      )
                      .join(", ") ||
                      "Module workflows"}
                  </p>
                </div>
              </article>
            )
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-200/80">
          Every module in this environment is active.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-sm font-semibold text-white">
          Activation continuity
        </h3>
        <ul className="mt-3 grid gap-2 text-sm text-white/50 md:grid-cols-2">
          {(packaging
            ?.activationGuarantees ||
            []).map(
            (guarantee) => (
              <li
                key={guarantee}
                className="flex gap-2"
              >
                <span className="text-emerald-300">
                  ✓
                </span>
                <span>
                  {guarantee}
                </span>
              </li>
            )
          )}
        </ul>
      </div>
    </section>
  );
}
