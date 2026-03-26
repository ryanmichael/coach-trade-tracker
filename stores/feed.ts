"use client";
import { create } from "zustand";
import type { ChartData } from "@repo/agents";
import type { MockPost } from "@/lib/mock-data";

// Raw shape returned by GET /api/feed
interface ApiFeedPost {
  id: string;
  content: string;
  postedAt: string;
  chartData: unknown;
  parsedTrades: {
    id: string;
    ticker: string;
    direction: string;
    priceTargetLow: number | null;
    priceTargetHigh: number | null;
    priceTargetPercent: number | null;
    priceConfirmation: number | null;
    projectedDate: string | null;
    confidence: number;
  }[];
}

function formatPriceTarget(t: ApiFeedPost["parsedTrades"][0]): string {
  if (t.priceTargetLow != null && t.priceTargetHigh != null) {
    return `$${t.priceTargetLow}–$${t.priceTargetHigh}`;
  }
  if (t.priceTargetHigh != null) return `$${t.priceTargetHigh}`;
  if (t.priceTargetLow != null) return `$${t.priceTargetLow}`;
  if (t.priceTargetPercent != null) {
    return `${t.priceTargetPercent > 0 ? "+" : ""}${t.priceTargetPercent}%`;
  }
  return "—";
}

function formatTargetPercent(t: ApiFeedPost["parsedTrades"][0]): string {
  if (t.priceTargetPercent != null) {
    const sign = t.priceTargetPercent > 0 ? "+" : "";
    return `${sign}${t.priceTargetPercent.toFixed(0)}%`;
  }
  const ref = t.priceConfirmation;
  const target = t.priceTargetHigh ?? t.priceTargetLow;
  if (ref && target) {
    const pct = ((target - ref) / ref) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
  }
  return "";
}

function formatProjectedDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function apiToFeedPost(raw: ApiFeedPost): MockPost {
  const trade = raw.parsedTrades[0];
  if (!trade) {
    return {
      id: raw.id,
      ticker: "?",
      content: raw.content,
      postedAt: raw.postedAt,
      priceTarget: "—",
      targetPercent: "",
      projectedDate: "—",
      confidence: 0,
      confirmationPrice: 0,
      direction: "long",
      chartData: raw.chartData as ChartData | undefined,
    };
  }
  return {
    id: raw.id,
    parsedTradeId: trade.id,
    ticker: trade.ticker,
    content: raw.content,
    postedAt: raw.postedAt,
    direction: (trade.direction ?? "long") as MockPost["direction"],
    priceTarget: formatPriceTarget(trade),
    targetPercent: formatTargetPercent(trade),
    projectedDate: formatProjectedDate(trade.projectedDate),
    confidence: trade.confidence,
    confirmationPrice: trade.priceConfirmation ?? 0,
    chartData: raw.chartData as ChartData | undefined,
  };
}

interface FeedStore {
  posts: MockPost[];
  isLoading: boolean;
  addPost: (post: MockPost) => void;
  removePost: (id: string) => void;
  fetch: () => Promise<void>;
}

export const useFeedStore = create<FeedStore>((set) => ({
  posts: [],
  isLoading: false,

  addPost: (post) => set((s) => ({ posts: [post, ...s.posts] })),
  removePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),

  fetch: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/feed");
      if (!res.ok) throw new Error("Feed fetch failed");
      const data: ApiFeedPost[] = await res.json();
      // Don't overwrite optimistic posts with empty server data
      if (data.length > 0) {
        set({ posts: data.map(apiToFeedPost), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.error("[feed store] fetch failed:", err);
      set({ isLoading: false });
    }
  },
}));
