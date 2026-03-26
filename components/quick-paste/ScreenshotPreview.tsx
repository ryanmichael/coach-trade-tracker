"use client";
import type { ScreenshotState } from "@/stores/quick-paste";

interface ScreenshotPreviewProps {
  screenshot: ScreenshotState;
  onRemove: () => void;
  minimized?: boolean;
}

export function ScreenshotPreview({ screenshot, onRemove, minimized }: ScreenshotPreviewProps) {
  const isAnalyzing = screenshot.status === "analyzing";
  const isDone = screenshot.status === "done";

  return (
    <div style={{ marginBottom: minimized ? 8 : 16, animation: "fadeInUp 300ms ease" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: minimized ? 0 : 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
            Chart
          </span>
          {minimized && isDone && screenshot.result?.ticker && (
            <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "'DM Mono', monospace" }}>
              {screenshot.result.ticker}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isDone && (
            <span style={{ fontSize: 11, color: "var(--semantic-positive)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Analyzed
            </span>
          )}
          {isAnalyzing && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Processing...</span>
          )}
          <button onClick={onRemove} aria-label="Remove screenshot" style={{
            background: "none", border: "none", padding: "0 2px",
            color: "var(--text-tertiary)", cursor: "pointer", fontSize: 13, lineHeight: 1,
          }}>✕</button>
        </div>
      </div>

      {/* Image preview container — hidden when minimized */}
      {!minimized && <div className="qp-ss">
        {/* Show the actual image if we have a dataUrl — data URLs require <img>, not next/image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshot.dataUrl}
          alt="Chart screenshot"
          style={{
            width: "100%",
            height: 200,
            objectFit: "contain",
            display: "block",
            opacity: isAnalyzing ? 0.35 : 1,
            filter: isAnalyzing ? "blur(2px)" : "none",
            transition: "opacity 0.6s ease, filter 0.6s ease",
          }}
        />

        {/* Frosted analysis overlay */}
        {isAnalyzing && (
          <div className="qp-ss-analyzing">
            <svg className="qp-spinner" width="28" height="28" viewBox="0 0 28 28" fill="none">
              {/* Track */}
              <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              {/* Arc — ~270° of the ring, gap at top */}
              <circle
                cx="14" cy="14" r="11"
                stroke="var(--accent-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="52 17"
                strokeDashoffset="0"
              />
            </svg>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Analyzing image...</span>
          </div>
        )}

        {/* Done summary bar */}
        {isDone && screenshot.result?.summary && (
          <div className="qp-ss-done">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--semantic-positive)" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{screenshot.result.summary}</span>
          </div>
        )}

        {/* Error state */}
        {screenshot.status === "error" && (
          <div className="qp-ss-done">
            <span style={{ fontSize: 12, color: "var(--semantic-negative)" }}>Analysis failed — try again</span>
          </div>
        )}

      </div>}
    </div>
  );
}
