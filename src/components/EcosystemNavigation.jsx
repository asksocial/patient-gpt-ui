"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  buildEcosystemNavigation,
} from "../lib/intelligence-platform/navigation";

const DROPDOWN_GROUPS = new Set([
  "intelligence",
  "modules",
  "workflows",
  "pv_compliance",
  "power_user",
]);

const NAVIGATION_PRESENTATION = {
  intelligence: {
    label: "Explore",
    description: "Themes, evidence, briefs, and connected intelligence",
  },
  modules: {
    label: "Analyze",
    description: "Apply a specialized analytical lens",
  },
  workflows: {
    label: "Monitor",
    description: "Track active, scheduled, and governed work",
  },
  pv_compliance: {
    label: "Verify",
    description: "Review safety signals with human oversight",
  },
  power_user: {
    label: "Manage",
    description: "Shared resources, governance, and administration",
  },
};

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
      className={`as-nav-item flex items-center justify-between rounded-xl text-left text-sm transition ${
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
      {item.kind === "module" && active ? (
        <span
          className="ml-3 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
          aria-label="Selected module"
        />
      ) : null}
    </button>
  );
}

export default function EcosystemNavigation({
  access,
  isAdmin,
  pvComplianceEnabled,
  activeItem,
  onNavigate,
}) {
  const [openGroup, setOpenGroup] =
    useState(null);
  const navigationRef = useRef(null);
  const groups =
    buildEcosystemNavigation(
      access || {
        modules: [],
        agents: [],
      },
      {
        isAdmin,
        pvComplianceEnabled,
      }
    );
  const navigationGroups =
    groups.filter((group) =>
      DROPDOWN_GROUPS.has(group.id)
    );

  function navigate(itemId) {
    setOpenGroup(null);
    onNavigate(itemId);
  }

  useEffect(() => {
    function closeOutsideNavigation(
      event
    ) {
      if (
        navigationRef.current &&
        !navigationRef.current.contains(
          event.target
        )
      ) {
        setOpenGroup(null);
      }
    }

    function closeWithEscape(event) {
      if (event.key === "Escape") {
        setOpenGroup(null);
      }
    }

    document.addEventListener(
      "mousedown",
      closeOutsideNavigation
    );
    document.addEventListener(
      "keydown",
      closeWithEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        closeOutsideNavigation
      );
      document.removeEventListener(
        "keydown",
        closeWithEscape
      );
    };
  }, []);

  return (
    <nav
      ref={navigationRef}
      aria-label="Platform navigation"
      className="as-platform-nav flex flex-wrap items-center gap-1"
    >
      <button
        type="button"
        onClick={() => navigate("ask")}
        aria-current={activeItem === "ask" ? "page" : undefined}
        className={`as-nav-trigger flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
          activeItem === "ask"
            ? "bg-white text-black"
            : "text-white/65 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <span className="as-nav-symbol" aria-hidden="true">✦</span>
        <span>Ask</span>
      </button>
      {navigationGroups.map((group) => {
        const presentation = NAVIGATION_PRESENTATION[group.id] || {
          label: group.label,
          description: group.description,
        };
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
              className={`as-nav-trigger flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                groupIsActive
                  ? "bg-white text-black"
                  : "text-white/65 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span>{presentation.label}</span>
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
                className="as-nav-menu absolute left-0 top-full z-50 mt-2 min-w-72 space-y-0.5 rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl shadow-black/60"
              >
                <div className="px-3 pb-2 pt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/55">
                    {presentation.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/35">
                    {presentation.description}
                  </p>
                </div>
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
