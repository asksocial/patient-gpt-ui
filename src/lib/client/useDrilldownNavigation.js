"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// Keep the previous screen's reading position and initiating control at each level.
export default function useDrilldownNavigation(screen, context) {
  const history = useRef([]);
  const restore = useRef(null);

  useEffect(() => {
    history.current = [];
    restore.current = null;
  }, [context]);

  useLayoutEffect(() => {
    const previous = restore.current;
    if (!previous) return;
    restore.current = null;
    window.scrollTo({ top: previous.scrollY, behavior: "instant" });
    if (previous.focus?.isConnected) previous.focus.focus({ preventScroll: true });
  }, [screen]);

  function forward(navigate, scrollToTop = false) {
    history.current.push({ scrollY: window.scrollY, focus: document.activeElement });
    if (scrollToTop) restore.current = { scrollY: 0 };
    return navigate();
  }

  function back(navigate) {
    restore.current = history.current.pop() || null;
    return navigate();
  }

  return { forward, back };
}
