"use client";

import {
  useEffect,
  useState,
} from "react";

function GovernanceList({
  title,
  items,
  renderItem,
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/55">
        {title}
      </h2>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            key={item.id || item.routeId}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/70"
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function GovernanceCenter() {
  const [governance, setGovernance] =
    useState(null);
  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        const response =
          await fetch(
            "/api/governance/summary"
          );
        const data =
          await response.json();
        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data.error ||
              "Failed to load governance."
          );
        }
        setGovernance(
          data.governance
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load governance."
        );
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
        {error}
      </div>
    );
  }
  if (!governance) {
    return (
      <div className="text-sm text-white/40">
        Loading governance controls…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(
          governance.controls
        ).map(([key, enabled]) => (
          <div
            key={key}
            className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4"
          >
            <p className="text-sm font-medium text-white">
              {key
                .replace(
                  /([A-Z])/g,
                  " $1"
                )
                .replace(/^./, (value) =>
                  value.toUpperCase()
                )}
            </p>
            <p className="mt-1 text-xs text-emerald-300/70">
              {enabled
                ? "Enforced"
                : "Not configured"}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <GovernanceList
          title="Approved model routes"
          items={
            governance.approvedModels
          }
          renderItem={(item) => (
            <>
              <span className="font-medium text-white">
                {item.routeId}
              </span>
              <span className="ml-2 text-white/40">
                {item.primaryModelId}
              </span>
            </>
          )}
        />
        <GovernanceList
          title="Enabled capabilities"
          items={
            governance.enabledAgents
          }
          renderItem={(item) =>
            item.name
          }
        />
        <GovernanceList
          title="Prompt versions"
          items={governance.prompts}
          renderItem={(item) => (
            <>
              {item.id}
              <span className="ml-2 text-white/35">
                v{item.version}
              </span>
            </>
          )}
        />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/55">
          Measurement and evaluations
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            "platform",
            "module",
            "agent",
          ].map((layer) => {
            const metrics =
              governance.measurement
                ?.metricCatalog
                ?.filter(
                  (metric) =>
                    metric.layer ===
                    layer
                ) || [];
            return (
              <div
                key={layer}
                className="rounded-xl border border-white/10 bg-black/30 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/70">
                  {layer}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {metrics.length}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  governed metrics
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-white/40">
          Evaluation suites run when models, prompts, retrieval,
          ontologies, or source-processing logic change.
        </p>
      </section>
    </div>
  );
}
