"use client";

import { useState, useEffect } from "react";
import type { OHLCBar } from "@/lib/polygon";

interface UsePriceHistoryResult {
  bars: OHLCBar[] | null;
  isLoading: boolean;
}

// Cache fetched histories in memory for the session — avoids re-fetching
// when switching between tickers and back.
const cache = new Map<string, OHLCBar[]>();

export function usePriceHistory(ticker: string): UsePriceHistoryResult {
  const [bars, setBars] = useState<OHLCBar[] | null>(
    () => cache.get(ticker) ?? null
  );
  const [isLoading, setIsLoading] = useState(() => !cache.has(ticker));

  useEffect(() => {
    if (!ticker) return;
    if (cache.has(ticker)) {
      setBars(cache.get(ticker)!);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`/api/prices/history/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((d: { bars: OHLCBar[] }) => {
        const result = Array.isArray(d.bars) && d.bars.length > 0 ? d.bars : null;
        if (result) cache.set(ticker, result);
        setBars(result);
        setIsLoading(false);
      })
      .catch(() => {
        setBars(null);
        setIsLoading(false);
      });
  }, [ticker]);

  return { bars, isLoading };
}
