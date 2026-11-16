"use client";

import Tooltip from "./Tooltip";

export default function Badge({ children, tone = "default", tooltip }) {
  const emphasized = ["covered", "insight", "action"].includes(tone);
  const caution = ["emerging", "noise"].includes(tone);

  const pill = (
    <span
      data-tone={emphasized ? "active" : caution ? "caution" : "neutral"}
      className={`as-badge ${caution ? "as-badge-caution" : ""}`}
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
