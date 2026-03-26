"use client";
import { useState, useEffect } from "react";
import type { MarketStatus } from "@/lib/polygon";

export interface MarketStatusResult {
  status: MarketStatus;
  etTime: string;
  nextOpen: string | null;
}

function computeMarketStatus(): MarketStatusResult {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const totalMinutes = hour * 60 + minute;
  const etTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const isWeekend = weekday === "Sat" || weekday === "Sun";

  const MARKET_OPEN = 9 * 60 + 30;
  const MARKET_CLOSE = 16 * 60;
  const PREMARKET_START = 4 * 60;
  const AFTERHOURS_END = 20 * 60;

  if (!isWeekend) {
    if (totalMinutes >= MARKET_OPEN && totalMinutes < MARKET_CLOSE) {
      return { status: "open", etTime, nextOpen: null };
    }
    if (totalMinutes >= PREMARKET_START && totalMinutes < MARKET_OPEN) {
      return { status: "pre-market", etTime, nextOpen: null };
    }
    if (totalMinutes >= MARKET_CLOSE && totalMinutes < AFTERHOURS_END) {
      return { status: "after-hours", etTime, nextOpen: null };
    }
  }

  return { status: "closed", etTime, nextOpen: null };
}

// Re-evaluates every minute so the status stays current
export function useMarketStatus(): MarketStatusResult {
  const [status, setStatus] = useState<MarketStatusResult>(() =>
    computeMarketStatus()
  );

  useEffect(() => {
    // Update on the next minute boundary
    const msUntilNextMinute =
      60_000 - (Date.now() % 60_000);

    const initial = setTimeout(() => {
      setStatus(computeMarketStatus());
      const interval = setInterval(() => {
        setStatus(computeMarketStatus());
      }, 60_000);
      return () => clearInterval(interval);
    }, msUntilNextMinute);

    return () => clearTimeout(initial);
  }, []);

  return status;
}
