import { create } from "zustand";
import type {
  EnrichedContract,
  TradeInput,
  CustomTradeInput,
  SortMode,
  RiskTolerance,
} from "@/lib/options";

interface OptionsFinderState {
  // Selection
  selectedTicker: string | null;
  sortBy: SortMode;

  // Custom tickers (non-coach)
  customTickers: string[];
  customDrafts: Record<string, CustomTradeInput>;

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
  hydrateFromStorage: () => void;
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

// ── localStorage persistence for custom tickers ──────────────────────────────

const STORAGE_KEY = "options-finder-custom";

interface PersistedData {
  customTickers: string[];
  customDrafts: Record<string, CustomTradeInput>;
}

function loadPersisted(): PersistedData {
  if (typeof window === "undefined") return { customTickers: [], customDrafts: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { customTickers: [], customDrafts: {} };
    const data = JSON.parse(raw) as PersistedData;
    return {
      customTickers: data.customTickers ?? [],
      customDrafts: data.customDrafts ?? {},
    };
  } catch {
    return { customTickers: [], customDrafts: {} };
  }
}

function savePersisted(tickers: string[], drafts: Record<string, CustomTradeInput>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ customTickers: tickers, customDrafts: drafts })
    );
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

// Always start empty to match server render; hydrate from localStorage in useEffect
export const useOptionsFinderStore = create<OptionsFinderState>((set, get) => ({
  selectedTicker: null,
  sortBy: "score",
  customTickers: [],
  customDrafts: {},
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
    const newTickers = [...state.customTickers, upper];
    const newDrafts = { ...state.customDrafts, [upper]: draft };
    set({
      customTickers: newTickers,
      customDrafts: newDrafts,
      selectedTicker: upper,
    });
    savePersisted(newTickers, newDrafts);

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
    const newCustom = state.customTickers.filter((t) => t !== ticker);
    const newDrafts = { ...state.customDrafts };
    delete newDrafts[ticker];
    const newSelected =
      state.selectedTicker === ticker
        ? newCustom[0] ?? Object.keys(state.coachTrades)[0] ?? null
        : state.selectedTicker;
    set({
      customTickers: newCustom,
      customDrafts: newDrafts,
      selectedTicker: newSelected,
    });
    savePersisted(newCustom, newDrafts);
  },

  updateCustomDraft: (draft) => {
    set((s) => {
      const newDrafts = { ...s.customDrafts, [draft.ticker]: draft };
      savePersisted(s.customTickers, newDrafts);
      return { customDrafts: newDrafts };
    });
  },

  setCoachRiskTolerance: (ticker, risk) => {
    set((s) => {
      const newOverrides = { ...s.coachRiskOverrides, [ticker]: risk };
      // Also update the coachTrades object so currentTrade reflects the change
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

  hydrateFromStorage: () => {
    const persisted = loadPersisted();
    if (persisted.customTickers.length > 0) {
      set({
        customTickers: persisted.customTickers,
        customDrafts: persisted.customDrafts,
      });
    }
  },
}));
