"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@/hooks/useUser";

interface MarketStatus {
  status: "open" | "pre-market" | "after-hours" | "closed";
  etTime: string;
}

const STATUS_CONFIG: Record<
  MarketStatus["status"],
  { label: string; color: string; dotColor: string }
> = {
  open: {
    label: "Market Open",
    color: "var(--semantic-positive)",
    dotColor: "var(--semantic-positive)",
  },
  "pre-market": {
    label: "Pre-Market",
    color: "var(--semantic-warning)",
    dotColor: "var(--semantic-warning)",
  },
  "after-hours": {
    label: "After Hours",
    color: "var(--semantic-warning)",
    dotColor: "var(--semantic-warning)",
  },
  closed: {
    label: "Market Closed",
    color: "var(--text-tertiary)",
    dotColor: "var(--text-tertiary)",
  },
};

export function PageHeader({ status }: { status?: string }) {
  const [market, setMarket] = useState<MarketStatus | null>(null);
  const { user, signOut } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/market/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status) setMarket(d);
      })
      .catch(() => {});

    // Refresh every 60s
    const id = setInterval(() => {
      fetch("/api/market/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.status) setMarket(d);
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const cfg = market ? STATUS_CONFIG[market.status] : null;
  const isStale = market && market.status !== "open";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent-primary)",
              boxShadow: "0 0 8px rgba(124,124,255,0.4)",
            }}
          />
          <h1
            style={{
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Options Finder
          </h1>
        </div>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 12,
            color: "var(--text-tertiary)",
            margin: "6px 0 0 18px",
          }}
        >
          Forward-priced ROI with scenario analysis
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Market status */}
        {cfg && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              fontWeight: 500,
              color: cfg.color,
              background: "var(--bg-surface-hover)",
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: cfg.dotColor,
                flexShrink: 0,
                ...(market?.status === "open"
                  ? { boxShadow: `0 0 6px ${cfg.dotColor}` }
                  : {}),
              }}
            />
            {cfg.label}
            {isStale && (
              <span
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 9,
                  marginLeft: 2,
                }}
              >
                · prices may be stale
              </span>
            )}
          </div>
        )}

        {/* Loading status */}
        {status && (
          <div
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 10,
              color: "var(--text-tertiary)",
              background: "var(--bg-surface-hover)",
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
            }}
          >
            <span style={{ color: "var(--semantic-positive)" }}>●</span>
            {" " + status}
          </div>
        )}

        {/* User menu */}
        {user && (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 12,
                color: "var(--text-secondary)",
                background: "var(--bg-surface-hover)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                padding: "5px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {user.email.split("@")[0]}
              <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  minWidth: 180,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  boxShadow: "var(--shadow-md)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--border-default)",
                  }}
                >
                  {user.email}
                </div>
                {user.isAdmin && (
                  <a
                    href="/admin"
                    style={{
                      display: "block",
                      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                      fontSize: 13,
                      color: "var(--text-primary)",
                      padding: "8px 12px",
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--bg-surface-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    Manage invites
                  </a>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                    fontSize: 13,
                    color: "var(--text-primary)",
                    background: "none",
                    border: "none",
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--bg-surface-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
