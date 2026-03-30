import { create } from "zustand";
import { useAlertsStore } from "./alerts";

export interface WatchlistTicker {
  id: string;
  ticker: string;
  direction: "long" | "short";
  priceConfirmation: number | null;
  priceTargetHigh: number | null;
  priceTargetLow: number | null;
  confidence: number;
  status: string; // "watching" | "promoted" | "removed"
  latestPostId: string | null;
  latestPostAt: string | null; // ISO
}

interface WatchlistState {
  /** Full ticker items fetched from /api/watchlist */
  items: WatchlistTicker[];
  /** Simple map: ticker → coachPostId (for SmartAddButton state) */
  watchlist: Record<string, string>;
  isLoading: boolean;

  fetch: () => Promise<void>;
  addToWatchlist: (ticker: string, postId: string) => Promise<void>;
  addToWatchlistOptimistic: (item: WatchlistTicker) => void;
  removeFromWatchlist: (ticker: string) => void;
  setItems: (items: WatchlistTicker[]) => void;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  items: [],
  watchlist: {},
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) throw new Error("Failed to fetch watchlist");
      const data = await res.json();

      interface RawWatchlistItem {
        id: string;
        ticker: string;
        status: string;
        parsedTrade?: { direction?: string; priceConfirmation?: number; priceTargetHigh?: number; priceTargetLow?: number; confidence?: number } | null;
        coachPost?: { id?: string; postedAt?: string } | null;
      }

      // Shape each item into WatchlistTicker
      const items: WatchlistTicker[] = (data as RawWatchlistItem[]).map((item) => ({
        id: item.id,
        ticker: item.ticker,
        direction: (item.parsedTrade?.direction ?? "long") as "long" | "short",
        priceConfirmation: item.parsedTrade?.priceConfirmation ?? null,
        priceTargetHigh: item.parsedTrade?.priceTargetHigh ?? null,
        priceTargetLow: item.parsedTrade?.priceTargetLow ?? null,
        confidence: item.parsedTrade?.confidence ?? 0,
        status: item.status,
        latestPostId: item.coachPost?.id ?? null,
        latestPostAt: item.coachPost?.postedAt ?? null,
      }));

      // Rebuild the simple watchlist map (ticker → postId)
      const watchlist: Record<string, string> = {};
      for (const item of items) {
        if (item.latestPostId) watchlist[item.ticker] = item.latestPostId;
      }

      set({ items, watchlist, isLoading: false });
    } catch (err) {
      console.error("[watchlist store] fetch failed:", err);
      set({ isLoading: false });
    }
  },

  addToWatchlist: async (ticker, postId) => {
    // Optimistic: mark the ticker as tracked immediately (drives SmartAddButton state)
    set((state) => ({
      watchlist: { ...state.watchlist, [ticker]: postId },
    }));

    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, coachPostId: postId }),
      });
      // Only refresh from server if the write succeeded — don't overwrite optimistic data
      if (res.ok) {
        await get().fetch();
      }
    } catch (err) {
      console.error("[watchlist store] addToWatchlist failed:", err);
    }
  },

  addToWatchlistOptimistic: (item) => {
    set((state) => {
      // Don't add duplicate
      if (state.items.some((i) => i.ticker === item.ticker)) return state;
      const items = [item, ...state.items];
      const watchlist = { ...state.watchlist };
      if (item.latestPostId) watchlist[item.ticker] = item.latestPostId;
      return { items, watchlist };
    });
  },

  removeFromWatchlist: (ticker) => {
    // Clear persisted fired-alert key so a re-added ticker can trigger again
    useAlertsStore.getState().removeFiredAlert(`${ticker}:confirmation`);
    set((state) => {
      const watchlist = { ...state.watchlist };
      delete watchlist[ticker];
      return {
        items: state.items.filter((i) => i.ticker !== ticker),
        watchlist,
      };
    });
  },

  setItems: (items) => {
    const watchlist: Record<string, string> = {};
    for (const item of items) {
      if (item.latestPostId) watchlist[item.ticker] = item.latestPostId;
    }
    set({ items, watchlist });
  },
}));
