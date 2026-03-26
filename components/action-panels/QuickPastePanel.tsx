"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQuickPasteStore } from "@/stores/quick-paste";
import { useWatchlistStore } from "@/stores/watchlist";
import { useSelectionStore } from "@/stores/selection";
import { useAlertsStore } from "@/stores/alerts";
import { useFeedStore } from "@/stores/feed";
import { MadlibSentence } from "@/components/quick-paste/MadlibSentence";
import { ScreenshotPreview } from "@/components/quick-paste/ScreenshotPreview";
import { CollapsibleSection } from "@/components/quick-paste/CollapsibleSection";
import { ClarifyingQuestionsCard } from "@/components/quick-paste/ClarifyingQuestionsCard";
import type { ClarifyingQuestion } from "@/components/quick-paste/ClarifyingQuestionsCard";
import { TradeSummaryChart } from "@/components/charts/TradeSummaryChart";
import { ActionPanel } from "@/components/layout/ActionPanel";
import { ParseFeedbackPanel } from "@/components/action-panels/ParseFeedbackPanel";
import { parseText } from "@/lib/parser/text-parser";
import type { AnalysisResult } from "@/stores/quick-paste";

// ── Inline analysis service ─────────────────────────────────────────────────

function parseTextToResult(text: string): AnalysisResult | null {
  const trades = parseText(text);
  if (!trades.length) return null;
  const t = trades[0];
  return {
    ticker: t.ticker,
    direction: t.direction,
    priceTargetLow: t.priceTargetLow,
    priceTargetHigh: t.priceTargetHigh,
    priceConfirmation: t.priceConfirmation,
    stopLoss: t.stopLoss,
    support: t.supportLevel,
    resistance: t.resistanceLevel,
    projectedDate: t.projectedDate,
    postText: null,
    confidence: t.confidence,
    summary: "",
    sourceType: "text",
  };
}

interface ImageApiPriceLevel {
  type: "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown";
  value: number;
  label: string | null;
}

import type { ChartData } from "@repo/agents";

interface ImageApiResponse {
  ticker: string | null;
  direction: "bullish" | "bearish" | "neutral" | null;
  priceLevels?: ImageApiPriceLevel[];
  projectedDates?: string[];
  confidence?: number;
  summary?: string;
  postText?: string | null;
}

interface PanelOption {
  ticker: string | null;
}

async function detectPanels(imageBase64: string, mediaType: string): Promise<string[]> {
  const res = await fetch("/api/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mediaType, detect: true }),
  });
  if (!res.ok) return [];
  const body = await res.json() as { panel_count: number; tickers: string[] };
  // Use tickers array length — multiple tickers can appear on a single panel (overlaid)
  return body.tickers?.length > 1 ? body.tickers : [];
}

async function analyzeScreenshotViaAPI(
  dataUrl: string,
  focusTicker?: string
): Promise<{ result: AnalysisResult; chartData: ChartData | null }> {
  try {
    // data URL format: "data:<mediaType>;base64,<data>"
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("invalid_data_url");
    const [, mediaType, imageBase64] = match;

    const res = await fetch("/api/parse/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mediaType, ...(focusTicker ? { focusTicker } : {}) }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("[analyzeScreenshotViaAPI] API error:", res.status, errBody);
      throw new Error(`API error ${res.status}: ${errBody?.error ?? "unknown"}`);
    }
    const body = await res.json() as { analysis: ImageApiResponse; chartData: ChartData | null };
    const data = body.analysis;

    return {
      result: {
        ticker: data.ticker ?? null,
        direction: data.direction === "bearish" ? "short" : data.direction === "bullish" ? "long" : data.direction === "neutral" ? "watch" : null,
        priceTargetLow: (() => { const t = (data.priceLevels ?? []).filter((l: { type: string }) => l.type === "target").map((l: { value: number }) => l.value); return t.length ? Math.min(...t) : null; })(),
        priceTargetHigh: (() => { const t = (data.priceLevels ?? []).filter((l: { type: string }) => l.type === "target").map((l: { value: number }) => l.value); return t.length ? Math.max(...t) : null; })(),
        priceConfirmation: data.priceLevels?.find((l: { type: string }) => l.type === "entry")?.value ?? null,
        stopLoss: data.priceLevels?.find((l: { type: string }) => l.type === "stop_loss")?.value ?? null,
        support: data.priceLevels?.find((l: { type: string }) => l.type === "support")?.value ?? null,
        resistance: data.priceLevels?.find((l: { type: string }) => l.type === "resistance")?.value ?? null,
        projectedDate: data.projectedDates?.[0] ?? null,
        postText: data.postText ?? null,
        confidence: data.confidence ?? 0.5,
        summary: data.summary ?? "",
        sourceType: "image",
      },
      chartData: body.chartData ?? null,
    };
  } catch (err) {
    console.error("[analyzeScreenshotViaAPI] failed:", err);
    throw new Error("image_analysis_failed");
  }
}

function mergeResults(
  tr: AnalysisResult | null,
  ir: AnalysisResult | null
): { merged: Partial<AnalysisResult>; sources: Record<string, "text" | "image" | "combined" | null> } {
  const fields: (keyof AnalysisResult)[] = [
    "ticker", "direction", "priceTargetLow", "priceTargetHigh",
    "priceConfirmation", "stopLoss", "support", "resistance", "projectedDate",
  ];
  const merged: Partial<AnalysisResult> = {};
  const sources: Record<string, "text" | "image" | "combined" | null> = {};

  const tc = tr?.confidence ?? 0;
  const ic = ir?.confidence ?? 0;

  for (const f of fields) {
    const tv = tr?.[f] ?? null;
    const iv = ir?.[f] ?? null;

    // For direction AND ticker: prefer image when it has significantly higher confidence
    // (text parser defaults direction to "long" even when it can't determine it)
    if ((f === "direction" || f === "ticker") && iv != null && iv !== "" && ic > tc + 0.15) {
      (merged as Record<string, unknown>)[f] = iv;
      sources[f] = tv != null && tv !== "" ? "combined" : "image";
      continue;
    }

    if (tv != null && tv !== "") {
      (merged as Record<string, unknown>)[f] = tv;
      sources[f] = iv != null && iv !== "" ? "combined" : "text";
    } else if (iv != null && iv !== "") {
      (merged as Record<string, unknown>)[f] = iv;
      sources[f] = "image";
    } else {
      (merged as Record<string, unknown>)[f] = null;
      sources[f] = null;
    }
  }

  merged.confidence = Math.min(0.95, Math.max(tc, ic) + (tc > 0 && ic > 0 ? 0.05 : 0));
  return { merged, sources };
}

// ── Clipboard helper ────────────────────────────────────────────────────────

function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// ── Icons ───────────────────────────────────────────────────────────────────

const ClipboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" />
  </svg>
);

const DropzoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ display: "block", margin: "0 auto 4px" }}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

// ── Panel component ─────────────────────────────────────────────────────────

export function QuickPastePanel() {
  const store = useQuickPasteStore();
  const { items: watchlistItems, fetch: fetchWatchlist } = useWatchlistStore();
  const { setSelected } = useSelectionStore();
  const { addToast } = useAlertsStore();
  const { posts, addPost, fetch: fetchFeed } = useFeedStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState<{ sym: string; count: number } | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [questionsDismissed, setQuestionsDismissed] = useState(false);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const [panelOptions, setPanelOptions] = useState<PanelOption[] | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refineAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);


  // When panel opens with rawText already set (e.g. from Chrome extension Quick Paste),
  // immediately trigger a parse so fields populate without requiring a keystroke.
  useEffect(() => {
    if (store.isOpen && store.rawText && !store.textParsed) {
      const result = parseTextToResult(store.rawText);
      store.setTextParsed(result);
      if (result) {
        const { merged, sources } = mergeResults(result, null);
        store.applyMerged(merged, sources);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isOpen]);

  // When the extension sends images after opening the panel, process the first one
  useEffect(() => {
    if (store.isOpen && store.pendingImages.length > 0 && !store.screenshot) {
      const [first] = store.pendingImages;
      store.setPendingImages([]);
      handleProcessScreenshot(first);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.pendingImages]);

  // Clipboard paste — intercept images
  useEffect(() => {
    if (!store.isOpen) return;
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
      const imgItem = items.find((i) => i.type.startsWith("image/"));
      if (imgItem) {
        e.preventDefault();
        const blob = imgItem.getAsFile();
        if (blob) {
          const dataUrl = await readBlobAsDataURL(blob);
          handleProcessScreenshot(dataUrl);
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isOpen]);

  // Escape to close
  useEffect(() => {
    if (!store.isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isOpen]);

  const handleClose = useCallback(() => {
    store.close();
    setConfirmDuplicate(null);
    if (refineAbortRef.current) refineAbortRef.current.abort();
    setTimeout(() => {
      store.reset();
      setFeedback(null);
      setFeedbackPanelOpen(false);
      setFeedbackSent(false);
      setQuestionsDismissed(false);
      setAnsweredQuestionIds(new Set());
      setPanelOptions(null);
      setIsRefining(false);
    }, 360);
  }, [store]);

  const handleTextChange = useCallback(
    (text: string) => {
      store.setRawText(text);
      if (!text.trim()) {
        store.setTextParsed(null);
        store.setUrlDetected(false);
        return;
      }
      if (/^https?:\/\//i.test(text.trim())) {
        store.setUrlDetected(true);
        store.setTextParsed(null);
        return;
      }
      store.setUrlDetected(false);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const result = parseTextToResult(text);
        store.setTextParsed(result);
        if (result) {
          const ssResult = store.screenshot?.result ?? null;
          const { merged, sources } = mergeResults(result, ssResult);
          store.applyMerged(merged, sources);
        }

        // Auto-refine: if regex confidence < 0.7 and no images, call Claude fallback
        const confidence = result?.confidence ?? 0;
        const hasScreenshot = !!store.screenshot;
        if (confidence < 0.7 && !hasScreenshot && text.trim().length > 10) {
          // Cancel any in-flight refine request
          if (refineAbortRef.current) refineAbortRef.current.abort();
          const controller = new AbortController();
          refineAbortRef.current = controller;
          setIsRefining(true);

          fetch("/api/parse/refine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text, ticker: result?.ticker }),
            signal: controller.signal,
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (controller.signal.aborted) return;
              if (!data?.trades?.length) {
                // Both regex and Claude found no trades — show toast
                if (!result) {
                  addToast({
                    type: "newPost",
                    ticker: "",
                    message: "No trade data found — try adding a screenshot",
                  });
                }
                return;
              }
              const refined = data.trades[0];
              const refinedResult: AnalysisResult = {
                ticker: refined.ticker || result?.ticker || null,
                direction: refined.direction || result?.direction || null,
                priceTargetLow: refined.priceTargetLow ?? result?.priceTargetLow ?? null,
                priceTargetHigh: refined.priceTargetHigh ?? result?.priceTargetHigh ?? null,
                priceConfirmation: refined.priceConfirmation ?? result?.priceConfirmation ?? null,
                stopLoss: refined.stopLoss ?? result?.stopLoss ?? null,
                support: null,
                resistance: null,
                projectedDate: refined.projectedDate ?? result?.projectedDate ?? null,
                postText: null,
                confidence: Math.max(refined.confidence ?? 0.5, confidence),
                summary: "",
                sourceType: "text",
              };
              // Only apply if confidence improved
              if (refinedResult.confidence > confidence) {
                store.setTextParsed(refinedResult);
                const ssResult = store.screenshot?.result ?? null;
                const { merged, sources } = mergeResults(refinedResult, ssResult);
                store.applyMerged(merged, sources);
              }
            })
            .catch(() => {})
            .finally(() => setIsRefining(false));
        }
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.screenshot]
  );

  const handleProcessScreenshot = useCallback(
    async (dataUrl: string) => {
      store.setScreenshot({ dataUrl, status: "analyzing", result: null });
      store.setAnalyzing(true);
      setPanelOptions(null);
      try {
        // Step 1: cheap detection pass — are there multiple panels?
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) throw new Error("invalid_data_url");
        const [, mediaType, imageBase64] = match;
        const tickers = await detectPanels(imageBase64, mediaType);

        if (tickers.length > 1) {
          // Show picker — full analysis deferred until user picks
          store.setScreenshot({ dataUrl, status: "done", result: null });
          setPanelOptions(tickers.map((t) => ({ ticker: t, priceLevels: [], direction: null, confidence: 0, summary: "" })));
        } else {
          // Single chart — run full analysis immediately
          const { result, chartData } = await analyzeScreenshotViaAPI(dataUrl);
          store.setScreenshot({ dataUrl, status: "done", result });
          store.setChartData(chartData);
          if (result.postText && result.postText.length > 5) store.setOcrText(result.postText);
          const { merged, sources } = mergeResults(store.textParsed, result);
          store.applyMerged(merged, sources);
        }
      } catch {
        store.setScreenshot({ dataUrl, status: "error", result: null });
      } finally {
        store.setAnalyzing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.textParsed]
  );

  const handleSelectPanel = useCallback(
    async (ticker: string) => {
      const dataUrl = store.screenshot?.dataUrl;
      if (!dataUrl) return;
      setPanelOptions(null);
      store.setAnalyzing(true);
      store.setScreenshot({ dataUrl, status: "analyzing", result: null });
      try {
        const { result, chartData } = await analyzeScreenshotViaAPI(dataUrl, ticker);
        store.setScreenshot({ dataUrl, status: "done", result });
        store.setChartData(chartData);
        if (result.postText && result.postText.length > 5) store.setOcrText(result.postText);
        const { merged, sources } = mergeResults(store.textParsed, result);
        store.applyMerged(merged, sources);
      } catch {
        store.setScreenshot({ dataUrl, status: "error", result: null });
      } finally {
        store.setAnalyzing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.screenshot, store.textParsed]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) => /^image\//i.test(f.type));
      if (imageFiles.length && !store.screenshot) {
        readBlobAsDataURL(imageFiles[0]).then(handleProcessScreenshot);
      }
    },
    [store.screenshot, handleProcessScreenshot]
  );

  const handleRemoveScreenshot = useCallback(() => {
    store.setScreenshot(null);
    store.setOcrText(null);
    store.setAnalyzing(false);
    if (store.textParsed) {
      const { merged, sources } = mergeResults(store.textParsed, null);
      store.applyMerged(merged, sources);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.textParsed]);

  const handleSave = useCallback(async (force = false) => {
    const sym = (store.fields.ticker?.trim() || store.screenshot?.result?.ticker?.trim() || "").toUpperCase();
    if (!sym) return;

    // Duplicate detection — if ticker already has posts, ask before saving
    if (!force) {
      const existingCount = posts.filter((p) => p.ticker === sym).length;
      if (existingCount > 0) {
        setConfirmDuplicate({ sym, count: existingCount });
        return;
      }
    }

    setConfirmDuplicate(null);
    setIsSaving(true);
    try {
      // Build the ingest payload
      const ptLow = store.fields.priceTargetLow ? parseFloat(store.fields.priceTargetLow) : null;
      const ptHigh = store.fields.priceTargetHigh ? parseFloat(store.fields.priceTargetHigh) : null;
      const confirmation = store.fields.priceConfirmation ? parseFloat(store.fields.priceConfirmation) : null;

      const parsedTrade = {
        ticker: sym,
        direction: store.fields.direction,
        priceTargetLow: ptLow,
        priceTargetHigh: ptHigh,
        priceConfirmation: confirmation,
        stopLoss: store.fields.stopLoss ? parseFloat(store.fields.stopLoss) : null,
        supportLevel: store.fields.support ? parseFloat(store.fields.support) : null,
        resistanceLevel: store.fields.resistance ? parseFloat(store.fields.resistance) : null,
        projectedDate: store.fields.projectedDate || null,
        confidence: store.fields.confidence,
        sourceType: store.screenshot ? (store.textParsed ? "combined" : "image") : "text",
        rawExtract: (store.rawText || sym).slice(0, 200),
      };

      const buildIngestBody = (action: "feed_only" | "feed_watchlist") => ({
        content: store.rawText || `Coach's post for ${sym}`,
        chartData: store.chartData ?? null,
        action,
        parsedTrades: [parsedTrade],
      });

      // Add to local feed store immediately so TickerDetail shows it
      const targetStr = ptLow && ptHigh ? `$${ptLow}–${ptHigh}` : ptHigh ? `$${ptHigh}` : ptLow ? `$${ptLow}` : "—";
      const pctChange = confirmation && ptHigh
        ? (((ptHigh - confirmation) / confirmation) * 100 * (store.fields.direction === "short" ? -1 : 1)).toFixed(0) + "%"
        : "—";
      addPost({
        id: `paste_${Date.now()}`,
        ticker: sym,
        content: store.rawText || `Coach's post for ${sym}`,
        postedAt: new Date().toISOString(),
        priceTarget: targetStr,
        targetPercent: pctChange,
        projectedDate: store.fields.projectedDate || "—",
        confidence: store.fields.confidence,
        confirmationPrice: confirmation ?? 0,
        direction: store.fields.direction,
        chartData: store.chartData ?? undefined,
      });

      // Save ticker symbol for animation before resetting
      store.setSavedTicker(sym);

      // Check if already in watchlist
      const isNew = !watchlistItems.some((i) => i.ticker === sym);

      // Close panel with animation
      handleClose();

      // After panel has slid out, add the ticker to the list and animate
      if (isNew) {
        // Optimistically add to watchlist store so ticker card appears immediately
        const { addToWatchlistOptimistic } = useWatchlistStore.getState();
        addToWatchlistOptimistic({
          id: `optimistic_${Date.now()}`,
          ticker: sym,
          direction: (store.fields.direction ?? "long") as "long" | "short",
          priceConfirmation: confirmation,
          priceTargetHigh: ptHigh,
          priceTargetLow: ptLow,
          confidence: store.fields.confidence,
          status: "watching",
          latestPostId: null,
          latestPostAt: new Date().toISOString(),
        });

        setTimeout(async () => {
          // Single ingest call creates post + parsed trade + watchlist item atomically
          try {
            const res = await fetch("/api/feed/ingest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildIngestBody("feed_watchlist")),
            });
            // Only refresh from server if the save actually succeeded
            if (res.ok) {
              fetchWatchlist();
              fetchFeed();
            }
          } catch (err) {
            console.error("[QuickPaste] ingest failed:", err);
          }

          // Set the new ticker symbol for entrance animation in LeftPanel
          store.setNewTickerSymbol(sym);

          // Find the ticker list and scroll to top
          const tickerList = document.getElementById("ticker-list");
          if (tickerList) tickerList.scrollTo({ top: 0, behavior: "smooth" });

          // Auto-select after entrance settles
          setTimeout(() => {
            setSelected(sym);
          }, 1100);

          // Clear animation class
          setTimeout(() => {
            store.setNewTickerSymbol(null);
          }, 3200);
        }, 550);
      } else {
        // Existing ticker — add new post to feed only
        try {
          const res = await fetch("/api/feed/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildIngestBody("feed_only")),
          });
          if (res.ok) {
            fetchWatchlist();
            fetchFeed();
          }
        } catch (err) {
          console.error("[QuickPaste] ingest failed:", err);
        }
      }

      // Show save toast via alerts store
      addToast({
        type: "newPost",
        ticker: sym,
        message: `Added to feed · ${sym} saved`,
      });

      store.setSavedTicker(null);
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.fields, store.rawText, store.textParsed, watchlistItems, posts]);

  if (!store.isOpen) return null;

  const hasParsed = !!(store.fields.ticker || store.textParsed || store.screenshot?.result);
  const effectiveTicker = store.fields.ticker?.trim() || store.screenshot?.result?.ticker?.trim();
  const canSave = !!effectiveTicker && !store.analyzing && !isRefining;

  // Clarifying questions — shown after image analysis when fields are missing
  const clarifyingQuestions: ClarifyingQuestion[] = (() => {
    if (store.screenshot?.status !== "done" || store.analyzing || questionsDismissed) return [];
    const result = store.screenshot.result;
    if (!result) return [];
    const qs: ClarifyingQuestion[] = [];
    if (!store.fields.ticker?.trim() && !answeredQuestionIds.has("ticker")) {
      qs.push({ id: "ticker", field: "ticker", text: "Which ticker is this chart for?", type: "input", inputType: "text", placeholder: "e.g. AAPL, USOIL…" });
    }
    if ((result.direction === null || store.fields.direction === "watch") && !answeredQuestionIds.has("direction")) {
      qs.push({ id: "direction", field: "direction", text: "Is this a bullish, bearish, or keep-watch setup?", type: "chips", options: [{ label: "↑ Bullish", value: "long" }, { label: "↓ Bearish", value: "short" }, { label: "↔ Keep Watch", value: "watch" }] });
    }
    const isWatch = store.fields.direction === "watch";
    if (isWatch) {
      // Only ask for the resolution date — trendline levels come from image analysis
      // (users can't easily calculate trendline-at-date values manually; they edit in the madlib if needed)
      if (!store.fields.projectedDate && !answeredQuestionIds.has("watchDate")) {
        qs.push({ id: "watchDate", field: "projectedDate", text: "When does the pattern likely resolve? (e.g. 3/4 point, apex date)", type: "input", inputType: "text", placeholder: "e.g. Apr 1" });
      }
    } else {
      if (!store.fields.priceConfirmation && !answeredQuestionIds.has("confirmation")) {
        qs.push({ id: "confirmation", field: "priceConfirmation", text: "What's the entry or confirmation price?", type: "input", inputType: "number", placeholder: "e.g. 95.30" });
      }
      if (!store.fields.priceTargetHigh && !store.fields.priceTargetLow && !answeredQuestionIds.has("target")) {
        qs.push({ id: "target", field: "priceTargetHigh", text: "What's the price target?", type: "input", inputType: "number", placeholder: "e.g. 102.00" });
      }
    }
    return qs;
  })();

  const panelClass = isMobile
    ? `ap-mobile${store.isClosing ? " closing" : ""}`
    : `ap-desktop wide${store.isClosing ? " closing" : ""}`;

  return (
    <>
      {/* Overlay */}
      <div
        className={`ap-overlay${store.isClosing ? " closing" : ""}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={panelClass}>
        {isMobile && <div className="ap-handle" />}

        {/* Header */}
        <div className="ap-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
              <ClipboardIcon />
              Quick Paste
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              {isRefining ? "Refining with AI…" : store.rawText && !store.screenshot ? "Post loaded from extension" : "Drop or paste a screenshot"}
            </div>
          </div>
          <button className="ap-close" onClick={handleClose} aria-label="Close panel">
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          className="ap-body"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
        >
          {/* Screenshot preview */}
          {store.screenshot && (
            <ScreenshotPreview
              screenshot={store.screenshot}
              onRemove={handleRemoveScreenshot}
              minimized={!!(store.chartData && store.screenshot.status === "done")}
            />
          )}

          {/* Multi-panel picker — shown when image has 2+ charts */}
          {panelOptions && panelOptions.length > 1 && (
            <div style={{
              marginBottom: 16,
              padding: "14px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-brand-md)",
            }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 500 }}>
                Multiple charts detected — which one to analyze?
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {panelOptions.map((panel, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectPanel(panel.ticker ?? `Chart ${i + 1}`)}
                    style={{
                      padding: "6px 14px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-brand-sm)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: "pointer",
                      letterSpacing: "0.02em",
                      transition: "all 120ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-primary)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-primary)";
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-muted)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)";
                    }}
                  >
                    {panel.ticker ?? `Chart ${i + 1}`}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>
                {panelOptions.map((p, i) => p.ticker ?? `Chart ${i + 1}`).join(" · ")} detected
              </div>
            </div>
          )}

          {/* Chart preview — shown once chartData is available */}
          {store.chartData && store.screenshot?.status === "done" && (
            <div style={{
              marginBottom: 12,
              padding: "12px 16px 8px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-brand-md)",
            }}>
              <TradeSummaryChart
                data={store.chartData}
                direction={store.fields.direction}
                currentPrice={0}
              />
            </div>
          )}

          {/* OCR text — collapsible */}
          {store.screenshot && store.ocrText && (
            <div style={{ marginBottom: 12 }}>
              <CollapsibleSection
                label="Extracted Text"
                open={store.showOcr}
                onToggle={store.toggleShowOcr}
              >
                <div style={{
                  background: "var(--bg-base)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-brand-md)",
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  fontFamily: "'DM Mono', monospace",
                  maxHeight: 72,
                  overflowY: "auto",
                }}>
                  {store.ocrText}
                </div>
              </CollapsibleSection>
            </div>
          )}

          {/* Post text — shown when text was loaded externally (e.g. Chrome extension) */}
          {store.rawText && !store.screenshot && (
            <div style={{ marginBottom: 12 }}>
              <CollapsibleSection
                label="Post text"
                open={store.showText}
                onToggle={store.toggleShowText}
              >
                <div style={{
                  background: "var(--bg-base)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-brand-md)",
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  maxHeight: 120,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {store.rawText}
                </div>
              </CollapsibleSection>
            </div>
          )}

          {/* Drop zone — primary input, always visible when no screenshot */}
          {!store.screenshot && (
            <div
              className={`qp-dropzone${dragging ? " active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              style={{ minHeight: 160, marginBottom: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              <DropzoneIcon />
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Drop a screenshot or{" "}
                <span style={{ color: "var(--accent-primary)" }}>browse</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                ⌘V also works
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Clarifying questions — shown after image analysis when context is missing */}
          {clarifyingQuestions.length > 0 && (
            <ClarifyingQuestionsCard
              questions={clarifyingQuestions}
              onAnswer={(field, value) => {
                store.setField(field, value as string & number);
                setAnsweredQuestionIds((prev) => {
                  const answered = clarifyingQuestions.find((q) => q.field === field)?.id;
                  return answered ? new Set([...prev, answered]) : prev;
                });
              }}
              onDismiss={() => setQuestionsDismissed(true)}
            />
          )}

          {/* Madlib parsed data */}
          {(hasParsed || store.analyzing || isRefining) && (
            <div style={{ animation: "fadeInUp 300ms ease", position: "relative" }}>
              {isRefining && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(90deg, transparent 0%, rgba(124,124,255,0.06) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s ease infinite",
                  borderRadius: "var(--radius-brand-md)",
                  pointerEvents: "none",
                  zIndex: 1,
                }} />
              )}
              <MadlibSentence
                fields={store.fields}
                sources={store.sources}
                analyzing={store.analyzing || isRefining}
                editingField={store.editingField}
                onStartEdit={store.setEditingField}
                onEndEdit={() => store.setEditingField(null)}
                onFieldChange={(field, value) => store.setField(field, value)}
                onDirectionToggle={() => {
                  const next = store.fields.direction === "long" ? "short" : store.fields.direction === "short" ? "watch" : "long";
                  store.setField("direction", next);
                }}
              />
            </div>
          )}

          {/* Empty state */}
          {!hasParsed && !store.analyzing && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "24px 0",
              color: "var(--text-tertiary)", fontSize: 13, textAlign: "center",
            }}>
              Paste a post or drop a screenshot above
            </div>
          )}

          {/* Feedback */}
          {hasParsed && (
            <div style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              {feedbackSent ? (
                <div style={{ fontSize: 12, color: "var(--semantic-positive)", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                  Thanks — feedback sent
                </div>
              ) : (
                <>
                  {/* Thumbs up */}
                  <button
                    onClick={() => {
                      setFeedback("up");
                      fetch("/api/feedback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ feedbackText: "Looks right", correctionType: "positive" }),
                      }).catch(() => {});
                      setFeedbackSent(true);
                    }}
                    aria-label="Looks good"
                    style={{
                      background: feedback === "up" ? "var(--semantic-positive-muted)" : "none",
                      border: "1px solid",
                      borderColor: feedback === "up" ? "var(--semantic-positive)" : "var(--border-strong)",
                      borderRadius: "var(--radius-brand-sm)",
                      padding: "4px 8px",
                      cursor: "pointer",
                      color: feedback === "up" ? "var(--semantic-positive)" : "var(--text-tertiary)",
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 12, transition: "all 120ms",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                      <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                    </svg>
                    Looks right
                  </button>

                  {/* Thumbs down — opens feedback panel */}
                  <button
                    onClick={() => { setFeedback("down"); setFeedbackPanelOpen(true); }}
                    aria-label="Something's off"
                    style={{
                      background: feedback === "down" ? "var(--semantic-negative-muted)" : "none",
                      border: "1px solid",
                      borderColor: feedback === "down" ? "var(--semantic-negative)" : "var(--border-strong)",
                      borderRadius: "var(--radius-brand-sm)",
                      padding: "4px 8px",
                      cursor: "pointer",
                      color: feedback === "down" ? "var(--semantic-negative)" : "var(--text-tertiary)",
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 12, transition: "all 120ms",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
                      <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
                    </svg>
                    Something&apos;s off
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {confirmDuplicate ? (
          <div
            className="ap-footer"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              Update{" "}
              <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{confirmDuplicate.sym}</span>
              {" "}with this new post? The existing{" "}
              <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                {confirmDuplicate.count === 1 ? "post" : `${confirmDuplicate.count} posts`}
              </span>
              {" "}will move to history.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDuplicate(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="btn-primary"
                style={{ opacity: isSaving ? 0.35 : 1 }}
              >
                {isSaving ? "Saving…" : `Update ${confirmDuplicate.sym}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="ap-footer" style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => handleSave()}
              disabled={!canSave || isSaving}
              className="btn-primary"
              style={{
                opacity: !canSave || isSaving ? 0.35 : 1,
                cursor: !canSave || isSaving ? "default" : "pointer",
                minWidth: 80,
              }}
            >
              {isSaving ? "Saving…" : "Add"}
            </button>
          </div>
        )}
      </div>

      {/* Feedback panel — opens on thumbs down */}
      <ActionPanel
        isOpen={feedbackPanelOpen}
        onClose={() => { setFeedbackPanelOpen(false); setFeedback(null); }}
        title="What's wrong?"
        description="Flag the fields that were misread and optionally provide the correct values"
      >
        <ParseFeedbackPanel
          fields={store.fields}
          onCancel={() => { setFeedbackPanelOpen(false); setFeedback(null); }}
          onSubmit={({ feedbackText, fieldsCorrected, originalValues, correctedValues }) => {
            fetch("/api/feedback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                feedbackText,
                correctionType: "user_correction",
                fieldsCorrected,
                originalValues,
                correctedValues,
              }),
            }).catch(() => {});
            setFeedbackPanelOpen(false);
            setFeedbackSent(true);
          }}
        />
      </ActionPanel>

      {/* Panel/overlay keyframe styles */}
      <style>{`
        .ap-overlay {
          position: fixed; inset: 0; z-index: 900;
          background: var(--bg-overlay);
          animation: apFI var(--duration-normal) var(--ease-default);
        }
        .ap-overlay.closing { animation: apFO var(--duration-slow) var(--ease-default) forwards; }
        @keyframes apFI { from { opacity: 0 } to { opacity: 1 } }
        @keyframes apFO { from { opacity: 1 } to { opacity: 0 } }

        .ap-desktop {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 400px; max-width: 90vw; z-index: 901;
          background: var(--bg-surface);
          border-left: 1px solid var(--border-default);
          box-shadow: var(--shadow-lg);
          display: flex; flex-direction: column;
          animation: apSIR var(--duration-slow) var(--ease-out);
        }
        .ap-desktop.wide { width: 460px; max-width: 92vw; }
        .ap-desktop.closing { animation: apSOR var(--duration-slow) var(--ease-default) forwards; }
        @keyframes apSIR { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes apSOR { from { transform: translateX(0) } to { transform: translateX(100%) } }

        .ap-mobile {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 901;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-default);
          border-radius: var(--radius-brand-lg) var(--radius-brand-lg) 0 0;
          box-shadow: 0 -8px 30px rgba(0,0,0,0.5);
          display: flex; flex-direction: column;
          max-height: 85vh;
          animation: apSU var(--duration-slow) var(--ease-out);
        }
        .ap-mobile.closing { animation: apSD var(--duration-slow) var(--ease-default) forwards; }
        @keyframes apSU { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes apSD { from { transform: translateY(0) } to { transform: translateY(100%) } }

        .ap-handle {
          width: 32px; height: 4px; border-radius: 2px;
          background: var(--border-strong);
          margin: 8px auto 0; flex-shrink: 0;
        }
        .ap-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid var(--border-default);
          flex-shrink: 0;
        }
        .ap-body {
          flex: 1; overflow-y: auto; padding: 20px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .ap-body::-webkit-scrollbar { width: 4px; }
        .ap-body::-webkit-scrollbar-track { background: transparent; }
        .ap-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .ap-footer {
          padding: 12px 20px 16px;
          border-top: 1px solid var(--border-default);
          flex-shrink: 0;
        }
        .ap-close {
          background: none; border: none;
          color: var(--text-tertiary); cursor: pointer;
          font-size: 18px; padding: 4px;
          transition: color 120ms;
        }
        .ap-close:hover { color: var(--text-primary); }
      `}</style>
    </>
  );
}
