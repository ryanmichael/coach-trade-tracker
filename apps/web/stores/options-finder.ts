import { create } from "zustand";
import type {
  EnrichedContract,
  TradeInput,
  CustomTradeInput,
  SortMode,
  RiskTolerance,
} from "@/lib/options";

/** DB record shape from /api/custom-tickers */
interface CustomTickerRecord {
  id: string;
  ticker: string;
  direction: string | null;
  currentPrice: number | null;
  targetPrice: number | null;
  projectedDate: string | null;
  stopLoss: number | null;
  riskTolerance: string;
}

interface OptionsFinderState {
  // Selection
  selectedTicker: string | null;
  sortBy: SortMode;

  // Custom tickers (non-coach) — now backed by API
  customTickers: string[];
  customDrafts: Record<string, CustomTradeInput>;
  customTickerIds: Record<string, string>; // ticker -> DB record ID

  // Coach recs loaded from ParsedTrade records
  coachTrades: Record<string, TradeInput>;
  // Risk tolerance overrides for coach recs (keyed by ticker)
  coachRiskOverrides: Record<string, RiskTolerance>;

  // Contracts data
  contracts: EnrichedContract[];
  isLoading: boolean;
  error: string | null;
  totalRaw: number;
  totalFiltered: number;

  // Actions
  setSelectedTicker: (ticker: string | null) => void;
  setSortBy: (sort: SortMode) => void;
  setCoachTrades: (trades: Record<string, TradeInput>) => void;

  addCustomTicker: (ticker: string) => void;
  removeCustomTicker: (ticker: string) => void;
  updateCustomDraft: (draft: CustomTradeInput) => void;
  setCoachRiskTolerance: (ticker: string, risk: RiskTolerance) => void;

  setContracts: (
    contracts: EnrichedContract[],
    totalRaw: number,
    totalFiltered: number
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  hydrateFromApi: () => void;
}

function makeDefaultDraft(ticker: string): CustomTradeInput {
  return {
    ticker,
    direction: "LONG",
    currentPrice: 0,
    priceTargetHigh: 0,
    projectedDate: "",
    stopLoss: 0,
    coachNote: "",
    hasCoachRec: false,
    riskTolerance: "medium",
  };
}

/** Convert DB record to CustomTradeInput */
function recordToDraft(rec: CustomTickerRecord): CustomTradeInput {
  return {
    ticker: rec.ticker,
    direction: (rec.direction as "LONG" | "SHORT") ?? "LONG",
    currentPrice: rec.currentPrice ?? 0,
    priceTargetHigh: rec.targetPrice ?? 0,
    projectedDate: rec.projectedDate
      ? rec.projectedDate.split("T")[0]
      : "",
    stopLoss: rec.stopLoss ?? 0,
    coachNote: "",
    hasCoachRec: false,
    riskTolerance: (rec.riskTolerance as RiskTolerance) ?? "medium",
  };
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useOptionsFinderStore = create<OptionsFinderState>((set, get) => ({
  selectedTicker: null,
  sortBy: "score",
  customTickers: [],
  customDrafts: {},
  customTickerIds: {},
  coachTrades: {},
  coachRiskOverrides: {},
  contracts: [],
  isLoading: false,
  error: null,
  totalRaw: 0,
  totalFiltered: 0,

  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  setSortBy: (sortBy) => set({ sortBy }),
  setCoachTrades: (trades) => {
    const state = get();
    set({ coachTrades: trades });
    // Auto-select first coach ticker if nothing selected
    if (!state.selectedTicker && Object.keys(trades).length > 0) {
      set({ selectedTicker: Object.keys(trades)[0] });
    }
  },

  addCustomTicker: (ticker) => {
    const state = get();
    const upper = ticker.toUpperCase();
    // If it's already a coach rec, just select it
    if (state.coachTrades[upper]) {
      set({ selectedTicker: upper });
      return;
    }
    // If already in custom list, just select
    if (state.customTickers.includes(upper)) {
      set({ selectedTicker: upper });
      return;
    }
    const draft = makeDefaultDraft(upper);
    set({
      customTickers: [...state.customTickers, upper],
      customDrafts: { ...state.customDrafts, [upper]: draft },
      selectedTicker: upper,
    });

    // Persist to API
    fetch("/api/custom-tickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: upper }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ticker?.id) {
          set((s) => ({
            customTickerIds: { ...s.customTickerIds, [upper]: data.ticker.id },
          }));
        }
      })
      .catch(() => {});

    // Fetch live price in the background
    fetch(`/api/prices/${upper}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const price = data?.price?.price;
        if (price && price > 0) {
          const current = get().customDrafts[upper];
          if (current && current.currentPrice === 0) {
            get().updateCustomDraft({ ...current, currentPrice: price });
          }
        }
      })
      .catch(() => {});
  },

  removeCustomTicker: (ticker) => {
    const state = get();
    const dbId = state.customTickerIds[ticker];

    const newCustom = state.customTickers.filter((t) => t !== ticker);
    const newDrafts = { ...state.customDrafts };
    delete newDrafts[ticker];
    const newIds = { ...state.customTickerIds };
    delete newIds[ticker];
    const newSelected =
      state.selectedTicker === ticker
        ? newCustom[0] ?? Object.keys(state.coachTrades)[0] ?? null
        : state.selectedTicker;
    set({
      customTickers: newCustom,
      customDrafts: newDrafts,
      customTickerIds: newIds,
      selectedTicker: newSelected,
    });

    // Delete from API
    if (dbId) {
      fetch(`/api/custom-tickers/${dbId}`, { method: "DELETE" }).catch(() => {});
    }
  },

  updateCustomDraft: (draft) => {
    const state = get();
    const dbId = state.customTickerIds[draft.ticker];

    set((s) => ({
      customDrafts: { ...s.customDrafts, [draft.ticker]: draft },
    }));

    // Persist to API
    if (dbId) {
      fetch(`/api/custom-tickers/${dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: draft.direction,
          currentPrice: draft.currentPrice || null,
          targetPrice: draft.priceTargetHigh || null,
          projectedDate: draft.projectedDate || null,
          stopLoss: draft.stopLoss || null,
          riskTolerance: draft.riskTolerance,
        }),
      }).catch(() => {});
    }
  },

  setCoachRiskTolerance: (ticker, risk) => {
    set((s) => {
      const newOverrides = { ...s.coachRiskOverrides, [ticker]: risk };
      const trade = s.coachTrades[ticker];
      if (trade) {
        return {
          coachRiskOverrides: newOverrides,
          coachTrades: { ...s.coachTrades, [ticker]: { ...trade, riskTolerance: risk } },
        };
      }
      return { coachRiskOverrides: newOverrides };
    });
  },

  setContracts: (contracts, totalRaw, totalFiltered) =>
    set({ contracts, totalRaw, totalFiltered, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),

  hydrateFromApi: () => {
    fetch("/api/custom-tickers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const records: CustomTickerRecord[] = data?.tickers ?? [];
        if (records.length === 0) return;

        const tickers: string[] = [];
        const drafts: Record<string, CustomTradeInput> = {};
        const ids: Record<string, string> = {};

        for (const rec of records) {
          tickers.push(rec.ticker);
          drafts[rec.ticker] = recordToDraft(rec);
          ids[rec.ticker] = rec.id;
        }

        set({
          customTickers: tickers,
          customDrafts: drafts,
          customTickerIds: ids,
        });
      })
      .catch(() => {});
  },
}));
