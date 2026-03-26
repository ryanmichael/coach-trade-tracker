"use client";

import { useEffect, useRef, useState } from "react";
import { useAlertsStore, ALERT_META, type Toast } from "@/stores/alerts";
import { useIsMobile } from "@/hooks/useIsMobile";

const TOAST_DURATION_MS = 5_000;

// ── Icons ─────────────────────────────────────────────────────────────────────

const DismissIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

// ── Single toast item ─────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  isMobile: boolean;
}

function ToastItem({ toast, onDismiss, isMobile }: ToastItemProps) {
  const meta = ALERT_META[toast.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exiting, setExiting] = useState(false);

  const startTimer = () => {
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, TOAST_DURATION_MS);
  };

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  useEffect(() => {
    startTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterAnimation = isMobile
    ? "toastSlideUp var(--duration-slow) var(--ease-out) forwards"
    : "toastSlideInRight var(--duration-slow) var(--ease-out) forwards";
  const exitAnimation = isMobile
    ? "toastSlideDownOut var(--duration-normal) var(--ease-default) forwards"
    : "toastSlideOutRight var(--duration-normal) var(--ease-default) forwards";

  return (
    <div
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-brand-md)",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
        width: isMobile ? "100%" : 360,
        borderLeft: `3px solid ${meta.color}`,
        animation: exiting ? exitAnimation : enterAnimation,
        paddingRight: 4,
      }}
    >
      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          color: meta.color,
          marginLeft: 12,
          marginTop: 10,
        }}
      >
        {meta.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "10px 0 10px", minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: meta.color,
            marginBottom: 2,
          }}
        >
          {toast.ticker} · {meta.label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-primary)",
            lineHeight: 1.4,
          }}
        >
          {toast.message}
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          color: "var(--text-tertiary)",
          cursor: "pointer",
          padding: "10px 10px 10px 4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "color var(--duration-fast) var(--ease-default)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--text-tertiary)";
        }}
      >
        <DismissIcon />
      </button>
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const { toasts, dismissToast } = useAlertsStore();
  const isMobile = useIsMobile();

  if (toasts.length === 0) return null;

  const containerStyle: React.CSSProperties = isMobile
    ? {
        // Mobile: bottom full-width, newest at bottom
        position: "fixed",
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 950,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }
    : {
        // Desktop: top-right corner, slides from right
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 950,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "none",
      };

  return (
    <>
      <style>{`
        @keyframes toastSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastSlideDownOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(20px); }
        }
        @keyframes toastSlideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toastSlideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(24px); }
        }
      `}</style>

      <div style={containerStyle}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: "auto", width: isMobile ? "100%" : "auto" }}>
            <ToastItem
              toast={toast}
              onDismiss={dismissToast}
              isMobile={isMobile}
            />
          </div>
        ))}
      </div>
    </>
  );
}
