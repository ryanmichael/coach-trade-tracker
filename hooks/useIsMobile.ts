"use client";

import { useState, useEffect } from "react";

/**
 * Reactive hook that returns true when the viewport is narrower than the
 * given breakpoint (default 768px). Uses matchMedia so it only fires when
 * the breakpoint is crossed, not on every pixel change.
 */
export function useIsMobile(breakpoint = 768): boolean {
  // Always start false to match SSR — corrected in useEffect after hydration.
  // Initializing from window.innerWidth here causes a server/client mismatch
  // because SSR returns false but the client can return true, triggering a
  // React hydration error that leaves the page blank.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
