"use client";

import Tooltip from "./Tooltip";

export default function Badge({ children, tone = "default", tooltip }) {
  const styles = {
    default: "border-white/10 bg-white/5 text-white/70",
    emerging: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    partial: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    covered: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    cluster: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    noise: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    insight: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    country: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300",
    persona: "border-lime-500/20 bg-lime-500/10 text-lime-300",
    platform: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    action: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  };

  const pill = (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone] || styles.default}`}
    >
      {children}
    </span>
  );

  if (!tooltip) return pill;

  return (
    <Tooltip content={tooltip} delay={250} side="top" align="center">
      {pill}
    </Tooltip>
  );
}
