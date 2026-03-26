"use client";

import { useEffect, useRef, useState } from "react";
import { LogoHeader } from "@/components/left-panel/LogoHeader";
import { TickerCard } from "@/components/left-panel/TickerCard";
import { ActionPanel } from "@/components/layout/ActionPanel";
import { AlertHistoryList } from "@/components/alerts/AlertHistoryList";
import { useAlertsStore } from "@/stores/alerts";
import { usePricesMap } from "@/hooks/usePrices";
import { useWatchlistStore } from "@/stores/watchlist";
import { useQuickPasteStore } from "@/stores/quick-paste";
import { useFeedStore } from "@/stores/feed";

export function LeftPanel() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { unreadAlerts, markAllHistoryRead } = useAlertsStore();
  const livePrices = usePricesMap();
  const { items, isLoading, fetch: fetchWatchlist } = useWatchlistStore();
  const { open: openQuickPaste, newTickerSymbol } = useQuickPasteStore();
  const fetchFeed = useFeedStore((s) => s.fetch);

  const tickerListRef = useRef<HTMLDivElement>(null);

  // Fetch watchlist + feed on mount
  useEffect(() => {
    fetchWatchlist();
    fetchFeed();
  }, [fetchWatchlist, fetchFeed]);

  // Global Cmd+Shift+V shortcut to open Quick Paste
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === "v") {
        e.preventDefault();
        openQuickPaste();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openQuickPaste]);

  // Scroll to top when a new ticker is added
  useEffect(() => {
    if (newTickerSymbol && tickerListRef.current) {
      tickerListRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [newTickerSymbol]);

  return (
    <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      {/* Header */}
      <LogoHeader
        onBellClick={() => {
          setNotificationsOpen(true);
          markAllHistoryRead();
        }}
      />

      {/* Scrollable ticker list — margin-based spacing (required for entrance animation) */}
      <div
        id="ticker-list"
        ref={tickerListRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.1) transparent",
        }}
      >
        {/* Watchlist section label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-tertiary)",
            padding: "4px 4px 4px",
            marginBottom: 4,
          }}
        >
          Watchlist
        </div>

        {/* Loading state */}
        {isLoading && items.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              padding: "8px 4px",
              textAlign: "center",
            }}
          >
            Loading…
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              padding: "8px 4px",
              lineHeight: 1.5,
            }}
          >
            No tickers yet.
            <br />
            Use Quick Paste to add posts.
          </div>
        )}

        {/* Ticker cards — each with marginBottom for animation compatibility */}
        {items.map((item) => {
          const livePrice = livePrices[item.ticker];
          const isNew = item.ticker === newTickerSymbol;
          return (
            <TickerCard
              key={item.ticker}
              symbol={item.ticker}
              currentPrice={livePrice?.price ?? null}
              confirmationPrice={item.priceConfirmation}
              direction={item.direction}
              hasUnreadAlert={!!unreadAlerts[item.ticker]}
              isNew={isNew}
            />
          );
        })}
      </div>

      {/* Quick Paste button pinned at bottom */}
      <div
        style={{
          padding: 12,
          borderTop: "1px solid var(--border-default)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={openQuickPaste}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: "var(--radius-brand-md)",
            border: "none",
            background: "var(--accent-primary)",
            color: "var(--text-inverse)",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: "0.01em",
            transition: "background var(--duration-fast) var(--ease-default)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-primary-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--accent-primary)";
          }}
        >
          + Quick Paste
        </button>
      </div>
    </div>

    <ActionPanel
      isOpen={notificationsOpen}
      onClose={() => setNotificationsOpen(false)}
      title="Notifications"
      description="Price confirmation alerts"
    >
      <AlertHistoryList />
    </ActionPanel>
    </>
  );
}
