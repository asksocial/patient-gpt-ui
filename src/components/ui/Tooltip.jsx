"use client";

import { useEffect, useRef, useState } from "react";

export default function Tooltip({
  content,
  children,
  delay = 250,
  side = "top",
  align = "center",
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function showTooltip() {
    if (!content) return;

    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (openTimerRef.current) clearTimeout(openTimerRef.current);

    openTimerRef.current = setTimeout(() => {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    }, delay);
  }

  function hideTooltip() {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    setVisible(false);

    closeTimerRef.current = setTimeout(() => {
      setMounted(false);
    }, 160);
  }

  const sideClasses = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  const alignClasses = {
    center:
      side === "top" || side === "bottom"
        ? "left-1/2 -translate-x-1/2"
        : "",
    start: side === "top" || side === "bottom" ? "left-0" : "",
    end: side === "top" || side === "bottom" ? "right-0" : "",
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      {mounted && content ? (
        <span
          role="tooltip"
          className={[
            "pointer-events-none absolute z-[9999]",
            "w-56",
            "rounded-xl border border-white/10 bg-neutral-950 px-3 py-2",
            "text-left text-xs leading-5 text-white/85 shadow-2xl",
            "whitespace-normal break-words",
            "transition-all duration-150 ease-out",
            visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            sideClasses[side],
            alignClasses[align],
          ].join(" ")}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}