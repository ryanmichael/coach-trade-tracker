"use client";
import { useState, useRef, useCallback } from "react";
import type { ParsedTradeData, ImageAnalysisResult } from "@/lib/parser/types";
import { mergeResults } from "@/lib/parser/merge";

export type ImageAnalysisStatus =
  | "uploading"
  | "analyzing"
  | "done"
  | "error"
  | "no_data";

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  status: ImageAnalysisStatus;
  analysis: ImageAnalysisResult | null;
  errorMessage?: string;
}

export function useQuickPaste(onClose: () => void) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [textTrades, setTextTrades] = useState<ParsedTradeData[]>([]);
  const [mergedTrades, setMergedTrades] = useState<ParsedTradeData[]>([]);
  const [conflicts, setConflicts] = useState<
    Array<{
      field: string;
      textValue: number | string | null;
      imageValue: number | string | null;
    }>
  >([]);
  const [isParsingText, setIsParsingText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editOverrides, setEditOverrides] = useState<
    Record<number, Partial<ParsedTradeData>>
  >({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageAnalysisResultsRef = useRef<ImageAnalysisResult[]>([]);

  const runMerge = useCallback(
    (trades: ParsedTradeData[], imgResults: ImageAnalysisResult[]) => {
      const result = mergeResults(trades, imgResults);
      setMergedTrades(result.trades);
      setConflicts(result.conflicts);
    },
    []
  );

  const parseTextContent = useCallback(
    (content: string) => {
      if (!content.trim()) {
        setTextTrades([]);
        setMergedTrades([]);
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setIsParsingText(true);
        try {
          const res = await fetch("/api/parse/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
          const data = await res.json();
          const trades: ParsedTradeData[] = data.trades ?? [];
          setTextTrades(trades);
          runMerge(trades, imageAnalysisResultsRef.current);
        } finally {
          setIsParsingText(false);
        }
      }, 500);
    },
    [runMerge]
  );

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      parseTextContent(value);
    },
    [parseTextContent]
  );

  const analyzeImage = useCallback(
    async (img: UploadedImage) => {
      setImages((prev) =>
        prev.map((i) =>
          i.id === img.id ? { ...i, status: "analyzing" as const } : i
        )
      );

      try {
        const buffer = await img.file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mediaType = img.file.type || "image/jpeg";

        const res = await fetch("/api/parse/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        });

        if (!res.ok) throw new Error("Analysis failed");
        const data = await res.json();
        const analysis: ImageAnalysisResult = data.analysis;

        const hasData =
          analysis.priceLevels.length > 0 || analysis.ticker !== null;
        const status: ImageAnalysisStatus = hasData ? "done" : "no_data";

        setImages((prev) =>
          prev.map((i) =>
            i.id === img.id ? { ...i, status, analysis } : i
          )
        );

        // Update shared analysis results and re-merge
        imageAnalysisResultsRef.current = [
          ...imageAnalysisResultsRef.current.filter(
            (r) => r !== img.analysis
          ),
          analysis,
        ];
        setTextTrades((currentTrades) => {
          runMerge(currentTrades, imageAnalysisResultsRef.current);
          return currentTrades;
        });
      } catch {
        setImages((prev) =>
          prev.map((i) =>
            i.id === img.id
              ? { ...i, status: "error" as const, errorMessage: "Analysis failed" }
              : i
          )
        );
      }
    },
    [runMerge]
  );

  const addImages = useCallback(
    (files: File[]) => {
      const newImages: UploadedImage[] = files
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 4 - images.length)
        .map((file) => ({
          id: `${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
          status: "uploading" as ImageAnalysisStatus,
          analysis: null,
        }));

      setImages((prev) => [...prev, ...newImages]);
      newImages.forEach((img) => analyzeImage(img));
    },
    [images.length, analyzeImage]
  );

  const removeImage = useCallback(
    (id: string) => {
      setImages((prev) => {
        const img = prev.find((i) => i.id === id);
        if (img) URL.revokeObjectURL(img.previewUrl);
        const next = prev.filter((i) => i.id !== id);
        imageAnalysisResultsRef.current = next
          .filter((i) => i.analysis !== null)
          .map((i) => i.analysis as ImageAnalysisResult);
        runMerge(textTrades, imageAnalysisResultsRef.current);
        return next;
      });
    },
    [textTrades, runMerge]
  );

  const updateField = useCallback(
    (tradeIndex: number, field: keyof ParsedTradeData, value: unknown) => {
      setEditOverrides((prev) => ({
        ...prev,
        [tradeIndex]: { ...prev[tradeIndex], [field]: value },
      }));
    },
    []
  );

  const getEffectiveTrades = useCallback((): ParsedTradeData[] => {
    return mergedTrades.map((trade, idx) => ({
      ...trade,
      ...(editOverrides[idx] ?? {}),
    }));
  }, [mergedTrades, editOverrides]);

  const save = useCallback(
    async (
      action: "feed_only" | "feed_watchlist" | "feed_active"
    ): Promise<boolean> => {
      setIsSaving(true);
      try {
        const trades = getEffectiveTrades();
        const imageStoragePaths = images.map((i) => i.file.name);
        const imageAnalysisData = images
          .filter((i) => i.analysis !== null)
          .map((i) => i.analysis);

        const res = await fetch("/api/feed/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            imageStoragePaths,
            imageAnalysis:
              imageAnalysisData.length > 0 ? imageAnalysisData : null,
            ingestionMethod: "manual_paste",
            parsedTrades: trades,
            action,
          }),
        });

        if (!res.ok) throw new Error("Save failed");

        // Cleanup object URLs
        images.forEach((i) => URL.revokeObjectURL(i.previewUrl));

        onClose();
        return true;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [text, images, getEffectiveTrades, onClose]
  );

  const reset = useCallback(() => {
    setText("");
    setImages([]);
    setTextTrades([]);
    setMergedTrades([]);
    setConflicts([]);
    setEditOverrides({});
    setIsParsingText(false);
    imageAnalysisResultsRef.current = [];
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return {
    text,
    images,
    mergedTrades,
    conflicts,
    isParsingText,
    isSaving,
    handleTextChange,
    addImages,
    removeImage,
    updateField,
    getEffectiveTrades,
    save,
    reset,
  };
}
