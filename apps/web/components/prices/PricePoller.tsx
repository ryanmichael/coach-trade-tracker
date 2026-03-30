"use client";
// Invisible component — polls /api/prices/batch, writes to the prices Zustand store,
// and evaluates confirmation alerts for watchlist items.
// Renders nothing. Mount it once at the page level.

import { useEffect, useCallback, useRef } from "react";
import { usePricesStore } from "@/stores/prices";
import { useWatchlistStore } from "@/stores/watchlist";
import { useAlertsStore } from "@/stores/alerts";
import { useMarketStatus } from "@/hooks/useMarketStatus";

const INTERVAL_OPEN_MS = 30_000; // 30s during market hours
const INTERVAL_EXTENDED_MS = 60_000; // 60s pre/after-market

interface PricePollerProps {
  tickers: string[];
}

export function PricePoller({ tickers }: PricePollerProps) {
  const { setPrices } = usePricesStore();
  const { status } = useMarketStatus();
  const tickersKey = tickers.slice().sort().join(",");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (tickers.length === 0) return;
    try {
      const res = await fetch(`/api/prices/batch?tickers=${tickersKey}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.prices) {
        setPrices(data.prices, data.fetchedAt ?? new Date().toISOString());

        // Evaluate confirmation alerts for each watchlist item
        const watchlistItems = useWatchlistStore.getState().items;

        for (const item of watchlistItems) {
          const priceData = data.prices[item.ticker];
          if (!priceData || priceData.price == null) continue;
          if (item.priceConfirmation == null) continue;

          const price: number = priceData.price;
          const confirmation: number = item.priceConfirmation;
          const isLong = item.direction !== "short";

          const confirmed = isLong
            ? price >= confirmation
            : price <= confirmation;

          if (!confirmed) continue;

          const alertKey = `${item.ticker}:confirmation`;

          // Re-read state fresh on each ticker — concurrent fetchAll calls both
          // capture a snapshot at the top and can both see firedAlerts as empty
          // before either one calls addFiredAlert. Reading inside the loop means
          // the second call sees the key that the first call synchronously added.
          const alertState = useAlertsStore.getState();
          if (alertState.firedAlerts.includes(alertKey)) continue;
          if (alertState.tickerAlerts[item.ticker]?.active) continue;

          alertState.addFiredAlert(alertKey);

          const dirLabel = isLong ? "above" : "below";
          const message = `${item.ticker} closed ${dirLabel} $${confirmation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — Coach's confirmation price reached.`;

          alertState.addToast({ type: "confirmation", ticker: item.ticker, message });
          alertState.setTickerAlert(item.ticker, { type: "confirmation", message, active: true });
        }
      }
    } catch {
      // Silently ignore — prices will just be stale
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey]);

  // Determine polling interval based on market status
  const pollInterval =
    status === "open"
      ? INTERVAL_OPEN_MS
      : status === "pre-market" || status === "after-hours"
        ? INTERVAL_EXTENDED_MS
        : null; // closed — no polling

  // Fetch immediately on mount + when tickers change
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Set up/tear down interval when market status or tickers change
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (pollInterval) {
      intervalRef.current = setInterval(fetchAll, pollInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll, pollInterval]);

  return null;
}
