"use client";
import { create } from "zustand";
import type { ChartData } from "@/lib/agents/chart-visualization/types";

export interface AnalysisResult {
  ticker: string | null;
  direction: "long" | "short" | "watch" | null;
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceConfirmation: number | null;
  stopLoss: number | null;
  support: number | null;
  resistance: number | null;
  projectedDate: string | null;
  postText: string | null;
  confidence: number;
  summary: string;
  sourceType: "text" | "image" | "combined";
}

export interface ParsedFields {
  ticker: string;
  direction: "long" | "short" | "watch";
  priceTargetLow: string;
  priceTargetHigh: string;
  priceConfirmation: string;
  stopLoss: string;
  projectedDate: string;
  support: string;
  resistance: string;
  confidence: number;
}

export interface ScreenshotState {
  dataUrl: string;
  status: "analyzing" | "done" | "error";
  result: AnalysisResult | null;
}

const DEFAULT_FIELDS: ParsedFields = {
  ticker: "",
  direction: "long",
  priceTargetLow: "",
  priceTargetHigh: "",
  priceConfirmation: "",
  stopLoss: "",
  projectedDate: "",
  support: "",
  resistance: "",
  confidence: 0,
};

interface QuickPasteStore {
  // Panel state
  isOpen: boolean;
  isClosing: boolean;

  // Inputs
  rawText: string;
  screenshot: ScreenshotState | null;
  ocrText: string | null;
  urlDetected: boolean;

  // Parse results
  textParsed: AnalysisResult | null;
  analyzing: boolean;
  fields: ParsedFields;
  sources: Record<string, "text" | "image" | "combined" | null>;

  // UI
  editingField: string | null;
  showText: boolean;
  showOcr: boolean;

  // Chart visualization
  chartData: ChartData | null;

  // Post-save
  newTickerSymbol: string | null;
  savedTicker: string | null;

  // Extension-injected images pending analysis
  pendingImages: string[];

  // Actions
  open: () => void;
  openWithText: (text: string) => void;
  openForTicker: (ticker: string) => void;
  close: () => void;
  reset: () => void;
  setRawText: (text: string) => void;
  setTextParsed: (result: AnalysisResult | null) => void;
  setScreenshot: (ss: ScreenshotState | null) => void;
  setOcrText: (text: string | null) => void;
  setAnalyzing: (v: boolean) => void;
  setUrlDetected: (v: boolean) => void;
  applyMerged: (merged: Partial<AnalysisResult>, sources: Record<string, "text" | "image" | "combined" | null>) => void;
  setChartData: (data: ChartData | null) => void;
  setField: (field: keyof ParsedFields, value: string | number) => void;
  setEditingField: (field: string | null) => void;
  toggleShowText: () => void;
  toggleShowOcr: () => void;
  setNewTickerSymbol: (sym: string | null) => void;
  setSavedTicker: (sym: string | null) => void;
  setPendingImages: (images: string[]) => void;
}

export const useQuickPasteStore = create<QuickPasteStore>((set) => ({
  isOpen: false,
  isClosing: false,
  rawText: "",
  screenshot: null,
  ocrText: null,
  urlDetected: false,
  textParsed: null,
  analyzing: false,
  fields: { ...DEFAULT_FIELDS },
  sources: {},
  editingField: null,
  showText: false,
  showOcr: false,
  chartData: null,
  newTickerSymbol: null,
  savedTicker: null,
  pendingImages: [],

  open: () => set({ isOpen: true, isClosing: false }),
  openWithText: (text) => set({ isOpen: true, isClosing: false, rawText: text, showText: true }),
  openForTicker: (ticker) => set((s) => ({
    isOpen: true,
    isClosing: false,
    fields: { ...s.fields, ticker: ticker.toUpperCase() },
  })),
  close: () => {
    set({ isClosing: true });
    setTimeout(() => {
      set((s) => {
        if (s.isClosing) return { isOpen: false, isClosing: false };
        return {};
      });
    }, 360);
  },
  reset: () =>
    set({
      rawText: "",
      screenshot: null,
      ocrText: null,
      urlDetected: false,
      textParsed: null,
      analyzing: false,
      fields: { ...DEFAULT_FIELDS },
      sources: {},
      editingField: null,
      showText: false,
      showOcr: false,
      chartData: null,
      pendingImages: [],
    }),

  setRawText: (text) => set({ rawText: text }),
  setTextParsed: (result) => set({ textParsed: result }),
  setScreenshot: (ss) => set({ screenshot: ss }),
  setOcrText: (text) => set({ ocrText: text }),
  setAnalyzing: (v) => set({ analyzing: v }),
  setUrlDetected: (v) => set({ urlDetected: v }),

  applyMerged: (merged, sources) =>
    set((state) => ({
      fields: {
        ...state.fields,
        ticker: merged.ticker != null ? String(merged.ticker) : state.fields.ticker,
        direction: merged.direction ?? state.fields.direction,
        priceTargetLow:
          merged.priceTargetLow != null ? String(merged.priceTargetLow) : state.fields.priceTargetLow,
        priceTargetHigh:
          merged.priceTargetHigh != null ? String(merged.priceTargetHigh) : state.fields.priceTargetHigh,
        priceConfirmation:
          merged.priceConfirmation != null ? String(merged.priceConfirmation) : state.fields.priceConfirmation,
        stopLoss: merged.stopLoss != null ? String(merged.stopLoss) : state.fields.stopLoss,
        support: merged.support != null ? String(merged.support) : state.fields.support,
        resistance: merged.resistance != null ? String(merged.resistance) : state.fields.resistance,
        projectedDate: merged.projectedDate ?? state.fields.projectedDate,
        confidence: merged.confidence ?? state.fields.confidence,
      },
      sources: { ...state.sources, ...sources },
    })),

  setChartData: (data) => set({ chartData: data }),

  setField: (field, value) =>
    set((state) => ({
      fields: { ...state.fields, [field]: value },
    })),

  setEditingField: (field) => set({ editingField: field }),
  toggleShowText: () => set((s) => ({ showText: !s.showText })),
  toggleShowOcr: () => set((s) => ({ showOcr: !s.showOcr })),
  setNewTickerSymbol: (sym) => set({ newTickerSymbol: sym }),
  setSavedTicker: (sym) => set({ savedTicker: sym }),
  setPendingImages: (images) => set({ pendingImages: images }),
}));
