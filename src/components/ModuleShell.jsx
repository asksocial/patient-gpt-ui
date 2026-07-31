"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  buildModuleExperience,
} from "../lib/intelligence-platform/moduleExperience";

function labelTab(tab) {
  return tab
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function ListCard({
  title,
  items,
  empty,
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        {title}
      </h3>
      <div className="mt-4 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={
                item.id || item
              }
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/70"
            >
              {item.name ||
                labelTab(item)}
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-white/35">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}

export default function ModuleShell({
  module,
  agents,
  workflows,
}) {
  const [activeTab, setActiveTab] =
    useState("overview");
  const experience = useMemo(
    () =>
      buildModuleExperience(
        module,
        agents,
        workflows
      ),
    [module, agents, workflows]
  );

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025] p-1.5">
        <div className="flex min-w-max gap-1">
          {experience.tabs.map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() =>
                  setActiveTab(tab)
                }
                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                  activeTab === tab
                    ? "bg-white text-black"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {labelTab(tab)}
              </button>
            )
          )}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <ListCard
            title="Capabilities"
            items={
              experience.module
                .capabilities
            }
            empty="No capabilities configured."
          />
          <ListCard
            title="Signals"
            items={
              experience.signalDefinitions
            }
            empty="Signal definitions will appear here."
          />
          <ListCard
            title="Licensed modes"
            items={
              experience.agents
            }
            empty="No specialized modes are licensed."
          />
        </div>
      ) : activeTab ===
        "signals" ? (
        <ListCard
          title="Signal definitions"
          items={
            experience.signalDefinitions
          }
          empty="No module signals are configured."
        />
      ) : activeTab ===
        "entities" ? (
        <ListCard
          title="Ontology extensions"
          items={
            experience.ontologyExtensions
          }
          empty="This module currently uses the shared ontology."
        />
      ) : activeTab ===
        "reports" ? (
        <ListCard
          title="Report templates"
          items={
            experience.reportTemplateIds
          }
          empty="No report templates are configured."
        />
      ) : activeTab ===
        "agents" ? (
        <ListCard
          title="Available Intelligence Modes"
          items={experience.agents}
          empty="No specialized modes are licensed."
        />
      ) : activeTab ===
        "data_sources" ? (
        <ListCard
          title="Permitted source types"
          items={
            experience.module
              .dataSourceTypes
          }
          empty="No source types are configured."
        />
      ) : activeTab ===
        "settings" ? (
        <ListCard
          title="Evaluation criteria"
          items={
            experience.evaluationCriteria
          }
          empty="No module evaluation criteria are configured."
        />
      ) : (
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-8">
          <h2 className="text-lg font-semibold text-white">
            {labelTab(activeTab)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/45">
            This shared module section is ready for governed {labelTab(
              activeTab
            ).toLowerCase()} content.
          </p>
        </section>
      )}
    </div>
  );
}
