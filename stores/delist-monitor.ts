import { create } from "zustand";

export type DelistStatus = "green" | "yellow" | "red";
export type DelistCheckSource = "sec_edgar" | "polygon_aum" | "polygon_volume" | "web_search" | "ai_analysis";

export interface DelistCheckResult {
  id: string;
  ticker: string;
  checkDate: string;
  source: DelistCheckSource;
  signalLevel: DelistStatus;
  summary: string;
  url: string | null;
}

export interface DelistTicker {
  id: string;
  ticker: string;
  status: DelistStatus;
  addedAt: string;
  updatedAt: string;
  notes: string | null;
  checkResults?: DelistCheckResult[];
}

interface DelistMonitorState {
  tickers: DelistTicker[];
  isLoading: boolean;
  isChecking: boolean;
  lastCheckedAt: string | null;
  error: string | null;

  fetch: () => Promise<void>;
  addTickers: (input: string) => Promise<{ added: string[]; duplicates: string[] }>;
  removeTicker: (id: string) => Promise<void>;
  runCheck: () => Promise<void>;
  fetchHistory: (id: string) => Promise<DelistCheckResult[]>;
}

export const useDelistMonitorStore = create<DelistMonitorState>((set, get) => ({
  tickers: [],
  isLoading: false,
  isChecking: false,
  lastCheckedAt: null,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/delist-monitor");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      set({ tickers: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },

  addTickers: async (input: string) => {
    try {
      const res = await fetch("/api/delist-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: input }),
      });
      if (!res.ok) throw new Error("Failed to add tickers");
      const data = await res.json();
      // Refetch the full list
      await get().fetch();
      return {
        added: data.added.map((t: DelistTicker) => t.ticker),
        duplicates: data.duplicates ?? [],
      };
    } catch {
      return { added: [], duplicates: [] };
    }
  },

  removeTicker: async (id: string) => {
    // Optimistic removal
    set((state) => ({
      tickers: state.tickers.filter((t) => t.id !== id),
    }));
    try {
      const res = await fetch(`/api/delist-monitor/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // Revert on failure
        await get().fetch();
      }
    } catch {
      await get().fetch();
    }
  },

  runCheck: async () => {
    set({ isChecking: true, error: null });
    try {
      const res = await fetch("/api/delist-monitor/check", { method: "POST" });
      if (!res.ok) throw new Error("Check failed");
      const data = await res.json();
      set({
        tickers: data.results,
        isChecking: false,
        lastCheckedAt: data.checkedAt,
      });
    } catch (err) {
      set({ isChecking: false, error: (err as Error).message });
    }
  },

  fetchHistory: async (id: string) => {
    try {
      const res = await fetch(`/api/delist-monitor/${id}/history`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },
}));
