"use client";

import { useState, useEffect } from "react";

interface DelistSummary {
  yellowCount: number;
  redCount: number;
  loading: boolean;
}

/**
 * Lightweight hook for the dashboard badge.
 * Polls /api/delist-monitor/summary every 5 minutes.
 */
export function useDelistSummary(): DelistSummary {
  const [yellowCount, setYellowCount] = useState(0);
  const [redCount, setRedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      try {
        const res = await fetch("/api/delist-monitor/summary");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setYellowCount(data.yellowCount ?? 0);
          setRedCount(data.redCount ?? 0);
        }
      } catch {
        // Silently fail — badge just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSummary();
    const interval = setInterval(fetchSummary, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { yellowCount, redCount, loading };
}
