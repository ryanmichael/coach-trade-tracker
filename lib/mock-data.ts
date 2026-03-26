// Feed post type + utilities — used by feed store and right-panel components

import type { ChartData } from "@/lib/agents/chart-visualization/types";

export type PostDirection = "long" | "short" | "watch";

export interface MockPost {
  id: string;
  parsedTradeId?: string; // ID of the primary ParsedTrade (for feedback linking)
  ticker: string;
  content: string;
  postedAt: string; // ISO
  priceTarget: string;
  targetPercent: string;
  projectedDate: string;
  confidence: number;
  confirmationPrice: number;
  direction: PostDirection;
  chartData?: ChartData;
}

export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
