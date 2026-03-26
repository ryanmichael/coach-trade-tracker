"use client";
import { usePricesStore } from "@/stores/prices";
import type { PriceData } from "@/lib/polygon";

// Read-only access to the prices store — populated by PricePoller
export function usePrices(ticker: string): PriceData | null {
  return usePricesStore((s) => s.prices[ticker] ?? null);
}

export function usePricesMap(): Record<string, PriceData | null> {
  return usePricesStore((s) => s.prices);
}
