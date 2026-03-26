"use client";
import type { ImageAnalysisStatus } from "@/hooks/useQuickPaste";
import { ShimmerLoader } from "@/components/primitives";

interface ImageAnalysisBadgeProps {
  status: ImageAnalysisStatus;
  summary?: string;
  ticker?: string | null;
}

export function ImageAnalysisBadge({
  status,
  summary,
  ticker,
}: ImageAnalysisBadgeProps) {
  if (status === "analyzing" || status === "uploading") {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <ShimmerLoader width="120px" height="18px" rounded="var(--radius-brand-sm)" />
      </div>
    );
  }

  if (status === "done") {
    return (
      <div
        className="flex items-center gap-1 mt-1 px-2 py-0.5"
        style={{
          backgroundColor: "var(--semantic-positive-muted)",
          fontSize: "11px",
          color: "var(--semantic-positive)",
          borderRadius: "var(--radius-brand-sm)",
          letterSpacing: "0.02em",
          display: "inline-flex",
        }}
      >
        <span>✓</span>
        <span>
          {ticker ? `${ticker} · ` : ""}
          {summary?.slice(0, 40) ?? "Analyzed"}
        </span>
      </div>
    );
  }

  if (status === "no_data") {
    return (
      <div
        className="flex items-center gap-1 mt-1"
        style={{
          fontSize: "11px",
          color: "var(--text-tertiary)",
        }}
      >
        <span>⚠</span>
        <span>No trade data found</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex items-center gap-1 mt-1"
        style={{
          fontSize: "11px",
          color: "var(--semantic-negative)",
        }}
      >
        <span>✕</span>
        <span>Analysis failed</span>
      </div>
    );
  }

  return null;
}
