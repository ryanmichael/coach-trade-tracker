"use client";

import { useSelectionStore } from "@/stores/selection";
import { TickerDetail } from "@/components/right-panel/TickerDetail";
import { useEffect, useState } from "react";
import { useQuickPasteStore } from "@/stores/quick-paste";

// Shared panel style — position: absolute; inset: 0 makes this fully
// self-contained. No parent height chain needed for scroll to work.
const FILL: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export function RightPanel() {
  const { selected } = useSelectionStore();
  const openQuickPaste = useQuickPasteStore((s) => s.open);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!selected) {
    return (
      <div style={{ ...FILL, alignItems: "center", justifyContent: "center" }}>
        <button
          onClick={openQuickPaste}
          style={{
            width: 320,
            padding: "40px 32px",
            border: "1.5px dashed var(--border-strong)",
            borderRadius: "var(--radius-brand-md)",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            transition: "border-color 120ms ease, background 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-primary)";
            e.currentTarget.style.background = "rgba(124,124,255,0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <svg
            width="28" height="28" viewBox="0 0 24 24"
            fill="none" stroke="var(--text-tertiary)"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>
            Quick Paste a post
          </span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            ⌘⇧V or click to paste text or image
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes mobileSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .mobile-detail-enter {
          animation: mobileSlideIn var(--duration-slow) var(--ease-out);
        }
      `}</style>
      <div
        style={FILL}
        className={isMobile ? "mobile-detail-enter" : ""}
      >
        <TickerDetail ticker={selected} isMobile={isMobile} />
      </div>
    </>
  );
}
