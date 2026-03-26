"use client";
import { useEffect } from "react";
import { useSelectionStore } from "@/stores/selection";
import { LeftPanel } from "@/components/layout/LeftPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import { ToastContainer } from "@/components/alerts/ToastContainer";
import { PricePoller } from "@/components/prices/PricePoller";
import { QuickPastePanel } from "@/components/action-panels/QuickPastePanel";
import { useWatchlistStore } from "@/stores/watchlist";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useQuickPasteStore } from "@/stores/quick-paste";

export default function DashboardPage() {
  const { mobileShowDetail } = useSelectionStore();
  const { items: watchlistItems } = useWatchlistStore();
  const isMobile = useIsMobile();
  const openWithText = useQuickPasteStore((s) => s.openWithText);
  const setPendingImages = useQuickPasteStore((s) => s.setPendingImages);

  // Auto-open Quick Paste when Chrome extension passes ?qp= in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get("qp");
    if (qp) {
      // URLSearchParams.get() already decodes the value — no need to call
      // decodeURIComponent again (doing so double-decodes and throws on bare % chars)
      openWithText(qp);
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Receive images from Chrome extension bridge (coachtrack-bridge.js).
  // Bridge uses postMessage with retries; we ack on first receipt to stop retries.
  useEffect(() => {
    let received = false;
    const handler = (e: MessageEvent) => {
      if (received) return;
      if (e.data?.type !== "COACHTRACK_QP_IMAGES") return;
      const images = e.data.images as string[];
      if (!Array.isArray(images) || !images.length) return;
      received = true;
      window.postMessage({ type: "COACHTRACK_QP_IMAGES_ACK" }, "*");
      setPendingImages(images);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SLIDE = "transform 350ms cubic-bezier(0, 0, 0.2, 1)";

  return (
    <div
      style={{
        display: "flex",
        position: "fixed",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {/* Left Panel */}
      <aside
        style={
          isMobile
            ? {
                position: "absolute",
                inset: 0,
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "var(--bg-surface)",
                borderRight: "1px solid var(--border-default)",
                transform: mobileShowDetail ? "translateX(-100%)" : "translateX(0)",
                transition: SLIDE,
              }
            : {
                position: "relative" as const,
                width: 290,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "hidden",
                backgroundColor: "var(--bg-surface)",
                borderRight: "1px solid var(--border-default)",
              }
        }
      >
        <LeftPanel />
      </aside>

      {/* Right Panel */}
      <main
        style={
          isMobile
            ? {
                position: "absolute" as const,
                inset: 0,
                zIndex: 1,
                backgroundColor: "var(--bg-base)",
                transform: mobileShowDetail ? "translateX(0)" : "translateX(100%)",
                transition: SLIDE,
              }
            : {
                flex: 1,
                minHeight: 0,
                position: "relative" as const,
                backgroundColor: "var(--bg-base)",
              }
        }
      >
        <RightPanel />
      </main>

      {/* Toast notifications — fixed position, rendered outside the panel layout */}
      <ToastContainer />

      {/* Price poller — invisible, polls Polygon and writes to prices store */}
      <PricePoller tickers={watchlistItems.map((i) => i.ticker)} />

      {/* Quick Paste panel — global, opened via button or Cmd+Shift+V */}
      <QuickPastePanel />
    </div>
  );
}
