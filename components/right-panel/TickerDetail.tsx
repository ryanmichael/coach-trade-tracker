"use client";

import { useState } from "react";
import { InlineAlert } from "./InlineAlert";
import { PrimaryPostCard } from "./PrimaryPostCard";
import { OlderPostRow } from "./OlderPostRow";
import ProximityBadge from "@/components/primitives/ProximityBadge";
import { LivePrice } from "@/components/prices/LivePrice";
import { ActionPanel } from "@/components/layout/ActionPanel";
import { DeletePanel } from "@/components/action-panels/DeletePanel";
import { useSelectionStore } from "@/stores/selection";
import { usePrices } from "@/hooks/usePrices";
import { useFeedStore } from "@/stores/feed";
import { useWatchlistStore } from "@/stores/watchlist";
import { useQuickPasteStore } from "@/stores/quick-paste";
import type { MockPost } from "@/lib/mock-data";

const TrashIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const BackArrow = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

interface TickerDetailProps {
  ticker: string;
  isMobile: boolean;
}

export function TickerDetail({ ticker, isMobile }: TickerDetailProps) {
  const { setMobileShowDetail, setSelected } = useSelectionStore();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const livePrice = usePrices(ticker);
  const feedPosts = useFeedStore((s) => s.posts);
  const feedLoading = useFeedStore((s) => s.isLoading);
  const removePost = useFeedStore((s) => s.removePost);
  const watchlistItem = useWatchlistStore((s) => s.items.find((i) => i.ticker === ticker));
  const removeFromWatchlist = useWatchlistStore((s) => s.removeFromWatchlist);
  const openForTicker = useQuickPasteStore((s) => s.openForTicker);

  const posts = feedPosts.filter((p) => p.ticker === ticker) as MockPost[];
  const latestPost = posts[0];
  const olderPosts = posts.slice(1);

  const handleDelete = () => {
    setDeleteOpen(false);
    if (watchlistItem) {
      fetch(`/api/watchlist/${watchlistItem.id}`, { method: "DELETE" }).catch(console.error);
      removeFromWatchlist(ticker);
    }
    if (isMobile) setMobileShowDetail(false);
    setSelected(null);
  };

  if (!latestPost) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-tertiary)",
          fontSize: 14,
        }}
      >
        {feedLoading ? "Loading…" : `No posts found for ${ticker}`}
      </div>
    );
  }

  return (
    // Single scroll container fills the parent (FILL in RightPanel: position:absolute; inset:0).
    // Sticky header stays at top as content scrolls beneath it.
    // No flex/grid height chain needed — absolute positioning gives a definite size,
    // overflow-y:auto on that same element handles all scrolling.
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.1) transparent",
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            backgroundColor: "var(--bg-base)",
            padding: isMobile ? "16px 20px 12px" : "20px 32px 16px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* Mobile back button */}
            {isMobile && (
              <button
                onClick={() => setMobileShowDetail(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "none",
                  border: "none",
                  padding: "4px 0",
                  color: "var(--accent-primary)",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 8,
                  transition: "color var(--duration-fast) var(--ease-default)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--accent-primary-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--accent-primary)")
                }
              >
                <BackArrow />
                Back
              </button>
            )}

            {/* Ticker + price + proximity */}
            <div
              style={{
                fontSize: isMobile ? 18 : 20,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span>{ticker}</span>
              <LivePrice ticker={ticker} size={14} showChange={true} />
              {watchlistItem?.priceConfirmation != null && livePrice?.price != null && (
                <ProximityBadge
                  currentPrice={livePrice.price}
                  confirmationPrice={watchlistItem.priceConfirmation}
                  direction={watchlistItem.direction}
                />
              )}
            </div>

            {/* Subtitle */}
            <div
              style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}
            >
              {posts.length} post{posts.length !== 1 ? "s" : ""}
              {watchlistItem &&
                ` · ${watchlistItem.status === "promoted" ? "Active trade" : "Watching"}`}
            </div>
          </div>

          {/* Trash button */}
          <button
            title={`Remove ${ticker} from watchlist`}
            onClick={() => setDeleteOpen(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-brand-sm)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: isMobile ? 0 : 2,
              transition: "all var(--duration-fast) var(--ease-default)",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--semantic-negative-muted)";
              e.currentTarget.style.color = "var(--semantic-negative)";
              e.currentTarget.style.borderColor = "var(--semantic-negative)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.borderColor = "var(--border-default)";
            }}
          >
            <TrashIcon />
          </button>
        </div>

        {/* Content — flows naturally, scroll container handles overflow */}
        <div
          style={{
            padding: isMobile ? 16 : 32,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <InlineAlert ticker={ticker} />

          <PrimaryPostCard
            post={latestPost}
            currentPrice={livePrice?.price ?? 0}
            onUpdate={() => openForTicker(ticker)}
          />

          {olderPosts.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-tertiary)",
                  padding: "4px 0 8px",
                }}
              >
                Previous posts ({olderPosts.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {olderPosts.map((post) => (
                  <OlderPostRow
                    key={post.id}
                    post={post}
                    currentPrice={livePrice?.price ?? 0}
                    onDelete={() => {
                      removePost(post.id);
                      fetch(`/api/feed/${post.id}`, { method: "DELETE" }).catch(console.error);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ActionPanel
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Remove ${ticker} from Watchlist`}
        description="This action can't be undone"
      >
        <DeletePanel
          ticker={ticker}
          postCount={posts.length}
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      </ActionPanel>
    </>
  );
}
