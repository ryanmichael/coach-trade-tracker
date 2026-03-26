"use client";

import { useSelectionStore } from "@/stores/selection";

interface AllPostsCardProps {
  postCount: number;
}

export function AllPostsCard({ postCount }: AllPostsCardProps) {
  const { selected, setSelected } = useSelectionStore();
  const isSelected = selected === "all";

  return (
    <div
      onClick={() => setSelected("all")}
      style={{
        borderRadius: "var(--radius-brand-md)",
        border: `1px solid ${isSelected ? "var(--accent-primary)" : "var(--border-default)"}`,
        background: isSelected ? "var(--accent-muted)" : "var(--bg-surface)",
        padding: "12px 14px",
        cursor: "pointer",
        userSelect: "none",
        transition: "background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "var(--bg-surface-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "var(--bg-surface)";
        }
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
        }}
      >
        All Posts
      </div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
        {postCount} posts from Coach
      </div>
    </div>
  );
}
