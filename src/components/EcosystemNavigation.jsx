"use client";

import { useState } from "react";
import {
  buildEcosystemNavigation,
} from "../lib/intelligence-platform/navigation";

const DROPDOWN_GROUPS = new Set([
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
  compact = false,
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={
        active ? "page" : undefined
      }
      title={item.description}
      className={`flex items-center justify-between rounded-xl text-left text-sm transition ${
        compact
          ? "w-full px-3 py-2"
          : "shrink-0 px-3 py-2"
      } ${
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
  const [openGroup, setOpenGroup] =
    useState(null);
  const groups =
    buildEcosystemNavigation(
      access || {
        modules: [],
        agents: [],
      },
      { isAdmin }
    );
  const navigationGroups = [
    ...groups.filter((group) =>
      DROPDOWN_GROUPS.has(group.id)
    ),
    {
      id: "more",
      label: "More",
      items: groups
        .filter(
          (group) =>
            !DROPDOWN_GROUPS.has(
              group.id
            )
        )
        .flatMap(
          (group) => group.items
        ),
    },
  ];

  function navigate(itemId) {
    setOpenGroup(null);
    onNavigate(itemId);
  }

  return (
    <nav
      aria-label="Platform navigation"
      className="flex flex-wrap items-center gap-1"
    >
      {navigationGroups.map((group) => {
        const groupIsActive =
          group.items.some(
            (item) =>
              item.id === activeItem
          );

        const expanded =
          openGroup === group.id;

        return (
          <div
            key={group.id}
            className="relative"
          >
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`navigation-group-${group.id}`}
              onClick={() =>
                setOpenGroup(
                  expanded
                    ? null
                    : group.id
                )
              }
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                groupIsActive
                  ? "bg-white text-black"
                  : "text-white/65 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span>{group.label}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className={`h-4 w-4 shrink-0 transition-transform ${
                  expanded
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

            {expanded ? (
              <div
                id={`navigation-group-${group.id}`}
                className="absolute left-0 top-full z-50 mt-2 min-w-56 space-y-0.5 rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl shadow-black/60"
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
                        navigate
                      }
                      compact
                    />
                  )
                )}
                {group.items.length ===
                0 ? (
                  <p className="px-3 py-2 text-xs leading-5 text-white/30">
                    No licensed access
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
