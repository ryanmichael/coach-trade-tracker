import { create } from "zustand";
import type { PriceData } from "@/lib/polygon";

interface PricesState {
  prices: Record<string, PriceData | null>;
  fetchedAt: string | null;
  setPrices: (prices: Record<string, PriceData | null>, fetchedAt: string) => void;
  setPrice: (ticker: string, price: PriceData | null) => void;
}

export const usePricesStore = create<PricesState>((set) => ({
  prices: {},
  fetchedAt: null,

  setPrices: (prices, fetchedAt) =>
    set((state) => ({ prices: { ...state.prices, ...prices }, fetchedAt })),

  setPrice: (ticker, price) =>
    set((state) => ({
      prices: { ...state.prices, [ticker]: price },
    })),
}));
