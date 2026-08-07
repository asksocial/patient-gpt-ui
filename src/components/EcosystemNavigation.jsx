"use client";

import { useState } from "react";
import {
  buildEcosystemNavigation,
} from "../lib/intelligence-platform/navigation";

const COLLAPSIBLE_GROUPS = new Set([
  "intelligence",
  "modules",
  "modes",
  "workflows",
  "pv_compliance",
]);

function NavigationItem({
  item,
  active,
  onNavigate,
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onNavigate(item.id)
      }
      aria-current={
        active ? "page" : undefined
      }
      title={item.description}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
        active
          ? "bg-white text-black"
          : "text-white/65 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <span className="truncate">
        {item.label}
      </span>
      {item.kind === "module" ? (
        <span
          className={`ml-3 h-1.5 w-1.5 shrink-0 rounded-full ${
            active
              ? "bg-black/60"
              : "bg-emerald-400/70"
          }`}
          aria-label="Licensed"
        />
      ) : null}
    </button>
  );
}

export default function EcosystemNavigation({
  access,
  isAdmin,
  activeItem,
  onNavigate,
}) {
  const [expandedGroups, setExpandedGroups] =
    useState(() => new Set());
  const groups =
    buildEcosystemNavigation(
      access || {
        modules: [],
        agents: [],
      },
      { isAdmin }
    );

  return (
    <nav
      aria-label="Application"
      className="mt-6 space-y-5"
    >
      {groups.map((group) => (
        <section key={group.id}>
          {group.label &&
          COLLAPSIBLE_GROUPS.has(
            group.id
          ) ? (
            <button
              type="button"
              aria-expanded={
                expandedGroups.has(
                  group.id
                )
              }
              aria-controls={`navigation-group-${group.id}`}
              onClick={() => {
                setExpandedGroups(
                  (current) => {
                    const next = new Set(
                      current
                    );

                    if (
                      next.has(group.id)
                    ) {
                      next.delete(
                        group.id
                      );
                    } else {
                      next.add(group.id);
                    }

                    return next;
                  }
                );
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:bg-white/[0.06] hover:text-white"
            >
              <span>{group.label}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className={`h-4 w-4 shrink-0 transition-transform ${
                  expandedGroups.has(
                    group.id
                  )
                    ? "rotate-180"
                    : ""
                }`}
              >
                <path
                  d="m6 8 4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : group.label ? (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
              {group.label}
            </p>
          ) : null}
          <div
            id={`navigation-group-${group.id}`}
            className={`space-y-0.5 ${
              COLLAPSIBLE_GROUPS.has(
                group.id
              ) &&
              !expandedGroups.has(
                group.id
              )
                ? "hidden"
                : ""
            }`}
          >
            {group.items.map(
              (item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  active={
                    activeItem ===
                    item.id
                  }
                  onNavigate={
                    onNavigate
                  }
                />
              )
            )}
            {group.items.length === 0 ? (
              <p className="px-3 py-2 text-xs leading-5 text-white/30">
                No licensed access
              </p>
            ) : null}
          </div>
        </section>
      ))}
    </nav>
  );
}
