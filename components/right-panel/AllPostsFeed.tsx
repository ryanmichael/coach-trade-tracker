"use client";

import { useState, useMemo } from "react";
import SmartAddButton from "@/components/primitives/SmartAddButton";
import { ActionPanel } from "@/components/layout/ActionPanel";
import { DeletePanel } from "@/components/action-panels/DeletePanel";
import { useWatchlistStore } from "@/stores/watchlist";
import { useFeedStore } from "@/stores/feed";
import { formatRelativeTime, type MockPost } from "@/lib/mock-data";

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms ease" }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

function getSmartAddState(
  post: MockPost,
  watchlist: Record<string, string>,
  allPosts: MockPost[]
): "add" | "update" | "added" {
  const trackedId = watchlist[post.ticker];
  if (!trackedId) return "add";
  if (post.id === trackedId) return "added";
  const trackedPost = allPosts.find((p) => p.id === trackedId);
  if (trackedPost && new Date(post.postedAt) > new Date(trackedPost.postedAt)) return "update";
  return "added";
}

export function AllPostsFeed() {
  const { watchlist, addToWatchlist } = useWatchlistStore();
  const { posts, isLoading, removePost } = useFeedStore();
  const [pendingDelete, setPendingDelete] = useState<MockPost | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Group posts by ticker, sorted by most recent post per group
  const groups = useMemo(() => {
    const map = new Map<string, MockPost[]>();
    for (const post of posts) {
      const group = map.get(post.ticker) ?? [];
      group.push(post);
      map.set(post.ticker, group);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) =>
        new Date(b[0].postedAt).getTime() - new Date(a[0].postedAt).getTime()
      )
      .map(([ticker, tickerPosts]) => ({
        ticker,
        posts: [...tickerPosts].sort(
          (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
        ),
      }));
  }, [posts]);

  const toggleGroup = (ticker: string) =>
    setCollapsed((s) => ({ ...s, [ticker]: !s[ticker] }));

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const post = pendingDelete;
    setPendingDelete(null);
    removePost(post.id);
    fetch(`/api/feed/${post.id}`, { method: "DELETE" }).catch(console.error);
  };

  if (isLoading && posts.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "32px 0", textAlign: "center" }}>
        Loading…
      </div>
    );
  }

  if (!isLoading && posts.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "32px 0", textAlign: "center", lineHeight: 1.6 }}>
        No posts yet.
        <br />
        Use Quick Paste to add Coach&apos;s posts.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {groups.map(({ ticker, posts: tickerPosts }) => {
          const isOpen = collapsed[ticker] !== true; // default open
          return (
            <div key={ticker}>
              {/* ── Ticker group header ── */}
              <button
                onClick={() => toggleGroup(ticker)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 4px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: isOpen ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {ticker}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {tickerPosts.length} {tickerPosts.length === 1 ? "post" : "posts"}
                </span>
                <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>
                  <ChevronIcon open={isOpen} />
                </span>
              </button>

              {/* ── Posts in this group ── */}
              {isOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {tickerPosts.map((post) => {
                    const addState = getSmartAddState(post, watchlist, posts);
                    const snippet =
                      post.content.length > 80 ? post.content.substring(0, 80) + "…" : post.content;

                    return (
                      <div
                        key={post.id}
                        style={{
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "var(--radius-brand-md)",
                          overflow: "hidden",
                          transition: "border-color var(--duration-fast) var(--ease-default)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
                      >
                        <div style={{ padding: "10px 14px" }}>
                          {/* Timestamp row */}
                          <div style={{ marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                              {formatRelativeTime(post.postedAt)}
                            </span>
                          </div>

                          {/* Snippet */}
                          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                            {snippet}
                          </p>

                          {/* Button row */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <SmartAddButton
                              state={addState}
                              onAdd={() => addToWatchlist(post.ticker, post.id)}
                            />
                            <button
                              title="Delete post"
                              onClick={() => setPendingDelete(post)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-tertiary)",
                                cursor: "pointer",
                                padding: 4,
                                display: "flex",
                                alignItems: "center",
                                borderRadius: "var(--radius-brand-sm)",
                                transition: "color var(--duration-fast) var(--ease-default)",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--semantic-negative)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ActionPanel
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete post"
        description={`Remove this ${pendingDelete?.ticker ?? ""} post from your feed`}
      >
        <DeletePanel
          ticker={pendingDelete?.ticker ?? ""}
          postCount={1}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      </ActionPanel>
    </>
  );
}
