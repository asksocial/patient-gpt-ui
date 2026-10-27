"use client";

import ActionButton from "./ActionButton";

export default function BackButton({ onClick, label = "Back", ...props }) {
  return <ActionButton type="button" onClick={onClick} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/65 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" {...props}>
    <span aria-hidden="true">←</span>
    <span>{label}</span>
  </ActionButton>;
}
