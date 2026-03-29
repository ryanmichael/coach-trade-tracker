import { useState, useEffect } from "react";

const MOCK_DATA = {
  posts: [
    {
      id: "p1", ticker: "MAGS",
      content: "13. Magnificent 7 — MAGS showing Wyckoff Distribution Schematics. Currently in LPSY phase around $63. SOW in phase B confirmed. Gap fill target around $48-49. Significant downside projected once distribution completes.",
      postedAt: "2026-03-05T14:42:00Z",
      priceTarget: "$48–49", targetPercent: "-22%",
      projectedDate: "Q2 2026", confidence: 0.84, confirmationPrice: 62.0,
      direction: "short",
    },
    {
      id: "p2", ticker: "RUT",
      content: "14. Russell 2000 — As long as the trendline holds, it's safe. Otherwise, a breach changes the dynamics significantly. I cannot see it holding..majors have already breached or are near major breaches. Structure looks vulnerable..stay on guard.",
      postedAt: "2026-03-05T14:42:00Z",
      priceTarget: "$2,200", targetPercent: "-12%",
      projectedDate: "Q2 2026", confidence: 0.72, confirmationPrice: 2450.0,
      direction: "short",
    },
    {
      id: "p3", ticker: "SOX",
      content: "15. Semiconductor index — The semiconductor index (SOX) has topped. Ascending broadening pattern. Expect erratic behaviour/chop before it lets go...substantial downside exists once momentum picks up. Vigilance required. Target 3500.",
      postedAt: "2026-03-05T14:43:00Z",
      priceTarget: "3,500", targetPercent: "-30%",
      projectedDate: "2026", confidence: 0.78, confirmationPrice: 4800.0,
      direction: "short",
    },
    {
      id: "p4", ticker: "SOXS",
      content: "15. Semiconductor index — As the semis let go THE SOXS will OBVIOUSLY MOVE MUCH Higher. Downtrend has been breached... all that is needed is momentum to pick up.",
      postedAt: "2026-03-05T14:43:00Z",
      priceTarget: "$65+", targetPercent: "+70%",
      projectedDate: "2026", confidence: 0.76, confirmationPrice: 40.0,
      direction: "long",
    },
    {
      id: "p5", ticker: "MAGS",
      content: "Mag 7 update — distribution pattern still intact. Watching for break below $62 support to confirm next leg down. Patience.",
      postedAt: "2026-03-03T10:15:00Z",
      priceTarget: "$48–49", targetPercent: "-22%",
      projectedDate: "Q2 2026", confidence: 0.79, confirmationPrice: 62.0,
      direction: "short",
    },
    {
      id: "p6", ticker: "SOX",
      content: "Semis looking heavy. Broadening top pattern forming. Mentioned this yesterday — watching for momentum shift.",
      postedAt: "2026-03-04T09:30:00Z",
      priceTarget: "3,500", targetPercent: "-30%",
      projectedDate: "2026", confidence: 0.71, confirmationPrice: 4800.0,
      direction: "short",
    },
  ],
  tickers: [
    { symbol: "MAGS", currentPrice: 62.85, confirmationPrice: 62.0, confidence: 0.84, status: "active", direction: "short" },
    { symbol: "RUT", currentPrice: 2485.0, confirmationPrice: 2450.0, confidence: 0.72, status: "watching", direction: "short" },
    { symbol: "SOX", currentPrice: 4920.0, confirmationPrice: 4800.0, confidence: 0.78, status: "watching", direction: "short" },
    { symbol: "SOXS", currentPrice: 38.50, confirmationPrice: 40.0, confidence: 0.76, status: "watching", direction: "long" },
  ],
};

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getConfidenceColor(c) {
  if (c >= 0.85) return "var(--semantic-positive)";
  if (c >= 0.7) return "var(--semantic-warning)";
  return "var(--text-tertiary)";
}
function getConfidenceBg(c) {
  if (c >= 0.85) return "var(--semantic-positive-muted)";
  if (c >= 0.7) return "var(--semantic-warning-muted)";
  return "var(--bg-elevated)";
}

function isConfirmed(current, confirmation, direction) {
  if (direction === "short") return current <= confirmation;
  return current >= confirmation;
}

function getProximityPct(current, confirmation, direction) {
  if (direction === "short") {
    if (current <= confirmation) return 0;
    return ((current - confirmation) / confirmation * 100);
  }
  if (current >= confirmation) return 0;
  return ((confirmation - current) / confirmation * 100);
}

function getProximityColor(current, confirmation, direction) {
  if (isConfirmed(current, confirmation, direction)) return "var(--semantic-positive)";
  const pct = getProximityPct(current, confirmation, direction);
  if (pct <= 2) return "#8ED4A8";
  if (pct <= 5) return "var(--semantic-warning)";
  return "var(--semantic-negative)";
}
function getProximityBg(current, confirmation, direction) {
  if (isConfirmed(current, confirmation, direction)) return "var(--semantic-positive-muted)";
  const pct = getProximityPct(current, confirmation, direction);
  if (pct <= 2) return "rgba(142,212,168,0.12)";
  if (pct <= 5) return "var(--semantic-warning-muted)";
  return "var(--semantic-negative-muted)";
}

const ALERT_TYPES = {
  confirmation: { label: "Price Confirmed", color: "var(--semantic-positive)", bg: "var(--semantic-positive-muted)", icon: "✓" },
  target: { label: "Target Reached", color: "var(--semantic-warning)", bg: "var(--semantic-warning-muted)", icon: "🎯" },
  stopLoss: { label: "Stop Loss Hit", color: "var(--semantic-negative)", bg: "var(--semantic-negative-muted)", icon: "⚠" },
  newPost: { label: "New Post", color: "var(--semantic-info)", bg: "var(--semantic-info-muted)", icon: "💬" },
};

const FlagIcon = ({ color = "var(--accent-primary)", size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const SparkleIcon = ({ color = "currentColor", size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" />
  </svg>
);

export default function Dashboard() {
  // ── All hooks grouped at top ──
  const [selected, setSelected] = useState("all");
  const [expandedPosts, setExpandedPosts] = useState({});
  const [watchlist, setWatchlist] = useState({
    MAGS: "p5",   // older post tracked — p1 will show "Update"
    SOX: "p6",    // older post tracked — p3 will show "Update"
  });
  const [toasts, setToasts] = useState([]);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [reportOpen, setReportOpen] = useState({});
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({});
  const [tickerAlerts, setTickerAlerts] = useState({
    MAGS: { type: "confirmation", message: "MAGS dropped below $62.00 — Coach's confirmation price reached! Distribution pattern confirmed.", active: true },
  });
  const [unreadAlerts, setUnreadAlerts] = useState({ MAGS: true });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isMobile = windowWidth < 768;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setToasts([{ id: "t1", type: "confirmation", ticker: "MAGS", message: "MAGS dropped below $62.00 — Coach's confirmation price reached!", time: "Just now" }]);
    }, 2000);
    const t2 = setTimeout(() => {
      setToasts(prev => [...prev, { id: "t2", type: "newPost", ticker: "SOX", message: "Coach posted a new update about SOX", time: "Just now" }]);
    }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── Functions ──
  const getAddState = (post) => {
    const trackedId = watchlist[post.ticker];
    if (!trackedId) return "add";
    if (post.id === trackedId) return "added";
    const trackedPost = MOCK_DATA.posts.find(p => p.id === trackedId);
    if (trackedPost && new Date(post.postedAt) > new Date(trackedPost.postedAt)) return "update";
    return "added";
  };
  const addToWatchlist = (post) => setWatchlist(prev => ({ ...prev, [post.ticker]: post.id }));
  const handleSelect = (val) => { setSelected(val); if (isMobile) setMobileShowDetail(true); };
  const handleMobileBack = () => setMobileShowDetail(false);
  const handleSelectTicker = (symbol) => handleSelect(symbol);
  const toggleExpand = (id) => setExpandedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  const dismissTickerAlert = (symbol) => {
    setTickerAlerts(prev => ({ ...prev, [symbol]: { ...prev[symbol], active: false } }));
    setUnreadAlerts(prev => ({ ...prev, [symbol]: false }));
  };
  const reportPostId = Object.keys(reportOpen).find(k => reportOpen[k]);
  const closeReport = () => { setReportOpen({}); setFeedbackText(""); };
  const submitFeedback = (postId) => {
    setFeedbackSubmitted(prev => ({ ...prev, [postId]: true }));
    closeReport();
    setTimeout(() => setFeedbackSubmitted(prev => ({ ...prev, [postId]: false })), 3000);
  };
  const confirmDelete = () => { setDeleteConfirmOpen(false); if (isMobile) setMobileShowDetail(false); setSelected("all"); };

  const filteredPosts = selected === "all"
    ? MOCK_DATA.posts
    : MOCK_DATA.posts.filter(p => p.ticker === selected);

  const selectedTicker = MOCK_DATA.tickers.find(t => t.symbol === selected);
  const activeAlert = selected !== "all" && tickerAlerts[selected]?.active ? tickerAlerts[selected] : null;

  return (
    <div style={{
      display: "flex", height: "100vh",
      background: "var(--bg-base)", color: "var(--text-primary)",
      fontFamily: "'DM Sans', sans-serif", position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400&family=DM+Sans:wght@400;500;600&display=swap');
        :root {
          --bg-base: #111113; --bg-surface: #18181B; --bg-surface-hover: #1F1F23;
          --bg-elevated: #26262B; --bg-overlay: rgba(0,0,0,0.6);
          --text-primary: #ECECEF; --text-secondary: #A0A0AB;
          --text-tertiary: #63636E; --text-inverse: #111113;
          --border-default: rgba(255,255,255,0.08); --border-subtle: rgba(255,255,255,0.04);
          --border-strong: rgba(255,255,255,0.15); --border-focus: #7C7CFF;
          --accent-primary: #7C7CFF; --accent-primary-hover: #9B9BFF;
          --accent-muted: rgba(124,124,255,0.12);
          --semantic-positive: #3FCF8E; --semantic-negative: #F06E6E;
          --semantic-warning: #F0B85F; --semantic-info: #6EB0F0;
          --semantic-positive-muted: rgba(63,207,142,0.12);
          --semantic-negative-muted: rgba(240,110,110,0.12);
          --semantic-warning-muted: rgba(240,184,95,0.12);
          --semantic-info-muted: rgba(110,176,240,0.12);
          --shadow-sm: 0 1px 2px rgba(0,0,0,0.3); --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
          --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
          --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px;
          --duration-fast: 120ms; --duration-normal: 200ms; --duration-slow: 350ms;
          --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .left-card {
          display: flex; align-items: stretch;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          cursor: pointer; user-select: none;
          transition: background var(--duration-fast) var(--ease-default),
                      border-color var(--duration-fast) var(--ease-default);
          overflow: hidden;
        }
        .left-card:hover { background: var(--bg-surface-hover); }
        .left-card.selected {
          border-color: var(--accent-primary);
          background: var(--accent-muted);
        }

        .card-flag {
          width: 28px; min-width: 28px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          border-right: 1px solid var(--border-subtle);
          transition: background var(--duration-fast) var(--ease-default);
        }

        .card-content {
          flex: 1; padding: 12px 14px; min-width: 0;
        }

        .post-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color var(--duration-fast) var(--ease-default);
        }
        .post-card:hover { border-color: var(--border-strong); }

        .action-btn {
          width: 32px; height: 32px; border-radius: var(--radius-sm);
          border: 1px solid var(--border-default); background: var(--bg-elevated);
          color: var(--text-secondary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; transition: all var(--duration-fast) var(--ease-default);
        }
        .action-btn:hover {
          background: var(--bg-surface-hover); color: var(--text-primary);
          border-color: var(--border-strong);
        }

        .show-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: var(--radius-sm);
          border: none; background: transparent; color: var(--text-tertiary);
          font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: color var(--duration-fast) var(--ease-default);
        }
        .show-btn:hover { color: var(--text-secondary); }

        .sparkle-btn {
          display: inline-flex; align-items: center; gap: 4px;
          background: none; border: none; padding: 2px;
          cursor: pointer; border-radius: var(--radius-sm);
          transition: all var(--duration-fast) var(--ease-default);
          opacity: 0.6;
        }
        .sparkle-btn:hover {
          opacity: 1;
          background: var(--accent-muted);
        }

        /* ── Reusable Action Panel (desktop: side panel, mobile: bottom sheet) ── */
        .action-panel-overlay {
          position: fixed; inset: 0; z-index: 900;
          background: var(--bg-overlay);
          animation: overlayFadeIn var(--duration-normal) var(--ease-default);
        }
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Desktop: right side panel */
        .action-panel-desktop {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 400px; max-width: 90vw; z-index: 901;
          background: var(--bg-surface);
          border-left: 1px solid var(--border-default);
          box-shadow: var(--shadow-lg);
          display: flex; flex-direction: column;
          animation: panelSlideInRight var(--duration-slow) var(--ease-default);
        }
        @keyframes panelSlideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        /* Mobile: bottom sheet */
        .action-panel-mobile {
          position: fixed; left: 0; right: 0; bottom: 0;
          z-index: 901;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-default);
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          box-shadow: 0 -8px 30px rgba(0,0,0,0.5);
          display: flex; flex-direction: column;
          max-height: 85vh;
          animation: panelSlideUp var(--duration-slow) var(--ease-default);
        }
        @keyframes panelSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .panel-handle {
          width: 32px; height: 4px; border-radius: 2px;
          background: var(--border-strong);
          margin: 8px auto 0;
          flex-shrink: 0;
        }

        .panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid var(--border-default);
          flex-shrink: 0;
        }

        .panel-body {
          flex: 1; overflow-y: auto; padding: 20px;
        }

        .panel-footer {
          padding: 12px 20px 16px;
          border-top: 1px solid var(--border-default);
          flex-shrink: 0;
        }

        .mobile-detail-enter {
          animation: mobileSlideIn var(--duration-slow) var(--ease-default);
        }
        @keyframes mobileSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .back-btn {
          display: inline-flex; align-items: center; gap: 4px;
          background: none; border: none; padding: 4px 0;
          color: var(--accent-primary); cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
          transition: color var(--duration-fast) var(--ease-default);
        }
        .back-btn:hover { color: var(--accent-primary-hover); }

        .chart-placeholder {
          width: 100%; height: 180px;
          background: var(--bg-elevated);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-tertiary); font-size: 13px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .meta-row { display: flex; }
        .meta-item { flex: 1; padding: 0 16px; border-right: 1px solid var(--border-default); }
        .meta-item:last-child { border-right: none; }
        .meta-label {
          font-size: 11px; font-weight: 500; letter-spacing: 0.04em;
          text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 2px;
        }
        .meta-value { font-family: 'DM Mono', monospace; font-size: 14px; color: var(--text-primary); }

        .expand-text {
          padding: 12px 20px 16px; font-size: 13px; line-height: 1.6;
          color: var(--text-secondary); background: var(--bg-base);
          border-top: 1px solid var(--border-subtle);
        }

        /* Inline alert in right panel */
        .inline-alert {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; border-radius: var(--radius-md);
          border: 1px solid; animation: alertFadeIn var(--duration-normal) var(--ease-default);
        }
        @keyframes alertFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Toast */
        .toast-container {
          position: fixed; top: 16px; right: 16px;
          display: flex; flex-direction: column; gap: 8px;
          z-index: 1000; pointer-events: none;
        }
        .toast {
          pointer-events: auto;
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 16px; background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
          min-width: 340px; max-width: 400px;
          animation: toastIn var(--duration-slow) var(--ease-default);
        }
        @keyframes toastIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        /* Flag pulse for unread alerts */
        .flag-alert { animation: flagPulse 2s ease-in-out infinite; }
        @keyframes flagPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .scrollbar-hide::-webkit-scrollbar { width: 4px; }
        .scrollbar-hide::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-hide::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        @media (max-width: 767px) {
          .meta-row {
            flex-direction: column !important;
            gap: 8px;
          }
          .meta-item, .meta-item-flaggable {
            border-right: none !important;
            padding: 0 !important;
            border-bottom: 1px solid var(--border-subtle);
            padding-bottom: 8px !important;
          }
          .meta-item:last-child {
            border-bottom: none;
            padding-bottom: 0 !important;
          }
          .chart-placeholder {
            height: 150px !important;
          }
          .toast-container {
            left: 16px !important;
            right: 16px !important;
            top: auto !important;
            bottom: 16px !important;
            flex-direction: column-reverse !important;
          }
          .toast {
            min-width: unset !important;
            max-width: unset !important;
            animation: toastInMobile var(--duration-slow) var(--ease-default) !important;
          }
        }
        @keyframes toastInMobile {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* ── LEFT PANEL ── */}
      {(!isMobile || !mobileShowDetail) && (
      <div style={{
        width: isMobile ? "100%" : 290,
        minWidth: isMobile ? "100%" : 290,
        borderRight: isMobile ? "none" : "1px solid var(--border-default)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Logo mark — radar-inspired */}
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: "#7C7CFF",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                {/* Concentric arcs — radar rings */}
                <circle cx="4" cy="18" r="6" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
                <circle cx="4" cy="18" r="11" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" />
                <circle cx="4" cy="18" r="16" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" fill="none" />
                {/* Sweep line */}
                <line x1="4" y1="18" x2="18" y2="4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" />
                {/* Blip */}
                <circle cx="13" cy="9" r="2" fill="#fff" opacity="0.9" />
              </svg>
            </div>
            <span style={{
              fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}>Coachtrack</span>
          </div>
          {/* X feed link */}
          <a
            href="https://x.com/great_martis/superfollows"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 6,
              color: "#3A3A42",
              transition: "color 120ms ease, background 120ms ease",
              textDecoration: "none",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#63636E"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#3A3A42"; e.currentTarget.style.background = "transparent"; }}
            title="Open Coach's X feed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>

        <div className="scrollbar-hide" style={{
          flex: 1, overflowY: "auto", padding: 12,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {/* All Posts — no flag */}
          <div
            className={`left-card ${selected === "all" ? "selected" : ""}`}
            onClick={() => handleSelect("all")}
            style={{ display: "block" }}
          >
            <div style={{ padding: "12px 14px" }}>
              <div style={{
                fontSize: 14, fontWeight: 500,
                color: selected === "all" ? "var(--accent-primary)" : "var(--text-primary)",
              }}>All Posts</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                {MOCK_DATA.posts.length} posts from Coach
              </div>
            </div>
          </div>

          <div style={{
            fontSize: 11, fontWeight: 500, textTransform: "uppercase",
            letterSpacing: "0.06em", color: "var(--text-tertiary)", padding: "12px 4px 4px",
          }}>Watchlist</div>

          {MOCK_DATA.tickers.map(t => {
            const confirmed = isConfirmed(t.currentPrice, t.confirmationPrice, t.direction);
            const proxPct = getProximityPct(t.currentPrice, t.confirmationPrice, t.direction);
            const proxColor = getProximityColor(t.currentPrice, t.confirmationPrice, t.direction);
            const proxBg = getProximityBg(t.currentPrice, t.confirmationPrice, t.direction);
            const hasUnread = unreadAlerts[t.symbol];
            const isSelected = selected === t.symbol;

            return (
              <div
                key={t.symbol}
                className={`left-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectTicker(t.symbol)}
                style={hasUnread ? {} : { display: "block" }}
              >
                {/* Flag — ONLY when there's an unread alert */}
                {hasUnread && (
                  <div
                    className="card-flag flag-alert"
                    style={{ background: "var(--semantic-positive-muted)" }}
                  >
                    <FlagIcon color="var(--semantic-positive)" size={13} />
                  </div>
                )}

                <div style={hasUnread ? { flex: 1, padding: "12px 14px", minWidth: 0 } : { padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{
                      fontSize: 16, fontWeight: 600,
                      color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
                      letterSpacing: "0.02em",
                    }}>{t.symbol}</span>

                    {/* Confirmed OR proximity — never both */}
                    {confirmed ? (
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--semantic-positive-muted)",
                        color: "var(--semantic-positive)",
                        letterSpacing: "0.01em",
                      }}>Confirmed ✓</span>
                    ) : (
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11, fontWeight: 400, padding: "2px 7px",
                        borderRadius: "var(--radius-sm)",
                        background: proxBg, color: proxColor,
                      }}>{proxPct.toFixed(1)}% away</span>
                    )}
                  </div>

                  <div style={{
                    display: "flex", alignItems: "baseline", justifyContent: "space-between",
                    marginTop: 6,
                  }}>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 14,
                      color: "var(--text-primary)",
                    }}>${t.currentPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid var(--border-default)" }}>
          <button style={{
            width: "100%", padding: "10px 0", borderRadius: "var(--radius-md)",
            border: "none", background: "var(--accent-primary)", color: "var(--text-inverse)",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
            cursor: "pointer", letterSpacing: "0.01em",
            transition: "background var(--duration-fast) var(--ease-default)",
          }}
          onMouseEnter={e => e.target.style.background = "var(--accent-primary-hover)"}
          onMouseLeave={e => e.target.style.background = "var(--accent-primary)"}
          >+ Quick Paste</button>
        </div>
      </div>
      )}

      {/* ── RIGHT PANEL ── */}
      {(!isMobile || mobileShowDetail) && (
      <div className={isMobile ? "mobile-detail-enter" : ""} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? "16px 20px 12px" : "20px 32px 16px",
          borderBottom: "1px solid var(--border-default)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            {/* Mobile back button */}
            {isMobile && (
              <button className="back-btn" onClick={handleMobileBack} style={{ marginBottom: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
          <div style={{
            fontSize: isMobile ? 18 : 20, fontWeight: 500, letterSpacing: "-0.02em",
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            {selected === "all" ? "All Posts" : selected}
            {selected !== "all" && selectedTicker && (
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 400,
                color: "var(--text-secondary)",
              }}>${selectedTicker.currentPrice.toFixed(2)}</span>
            )}
            {selected !== "all" && selectedTicker && (() => {
              const conf = isConfirmed(selectedTicker.currentPrice, selectedTicker.confirmationPrice, selectedTicker.direction);
              if (conf) return (
                <span style={{
                  fontSize: 12, fontWeight: 500, padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--semantic-positive-muted)",
                  color: "var(--semantic-positive)",
                }}>Confirmed ✓</span>
              );
              const pct = getProximityPct(selectedTicker.currentPrice, selectedTicker.confirmationPrice, selectedTicker.direction);
              const col = getProximityColor(selectedTicker.currentPrice, selectedTicker.confirmationPrice, selectedTicker.direction);
              const bg = getProximityBg(selectedTicker.currentPrice, selectedTicker.confirmationPrice, selectedTicker.direction);
              return (
                <span style={{
                  fontSize: 12, fontWeight: 500, padding: "2px 8px",
                  borderRadius: "var(--radius-sm)", background: bg, color: col,
                }}>{pct.toFixed(1)}% away</span>
              );
            })()}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
            {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
            {selected !== "all" && selectedTicker && ` · ${selectedTicker.status === "active" ? "Active trade" : "Watching"}`}
          </div>
          </div>

          {/* Trash button — only when viewing a specific ticker */}
          {selected !== "all" && (
            <button
              className="action-btn"
              title="Remove from watchlist"
              onClick={() => setDeleteConfirmOpen(true)}
              style={{ marginTop: 2 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="scrollbar-hide" style={{
          flex: 1, overflowY: "auto", padding: isMobile ? 16 : 32,
          display: "flex", flexDirection: "column", gap: 24,
        }}>

          {/* ── INLINE ALERT (only when this ticker has an active alert) ── */}
          {activeAlert && (
            <div className="inline-alert" style={{
              borderColor: ALERT_TYPES[activeAlert.type].color,
              background: ALERT_TYPES[activeAlert.type].bg,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "var(--radius-sm)",
                background: "rgba(0,0,0,0.15)",
                color: ALERT_TYPES[activeAlert.type].color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 600, flexShrink: 0,
              }}>{ALERT_TYPES[activeAlert.type].icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 500, textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: ALERT_TYPES[activeAlert.type].color, marginBottom: 2,
                }}>{ALERT_TYPES[activeAlert.type].label}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4 }}>
                  {activeAlert.message}
                </div>
              </div>
              <button
                onClick={() => dismissTickerAlert(selected)}
                style={{
                  padding: "5px 12px", borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(0,0,0,0.15)", color: "var(--text-primary)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", flexShrink: 0,
                }}
              >Dismiss</button>
            </div>
          )}

          {/* ── POST CARDS ── */}
          {selected === "all" ? (
            /* ALL POSTS VIEW */
            filteredPosts.map(function(post) {
              var addState = getAddState(post);
              var snippet = post.content.substring(0, 80) + "...";
              return (
                <div key={post.id} style={{ background: "#18181B", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{post.ticker}</div>
                  <div style={{ fontSize: 12, color: "#63636E", marginBottom: 8 }}>{formatTime(post.postedAt)}</div>
                  <div style={{ fontSize: 13, color: "#A0A0AB", marginBottom: 12, lineHeight: 1.5 }}>{snippet}</div>
                  <div>
                    {addState === "add" && (
                      <button onClick={function() { addToWatchlist(post); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#ECECEF", fontSize: 12, cursor: "pointer" }}>+ Add to Watchlist</button>
                    )}
                    {addState === "update" && (
                      <button onClick={function() { addToWatchlist(post); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #7C7CFF", background: "rgba(124,124,255,0.12)", color: "#7C7CFF", fontSize: 12, cursor: "pointer" }}>Update Watchlist</button>
                    )}
                    {addState === "added" && (
                      <span style={{ padding: "6px 12px", borderRadius: 6, background: "rgba(63,207,142,0.12)", color: "#3FCF8E", fontSize: 12 }}>Added</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            /* TICKER VIEW — latest post is hero, older posts are subtle */
            (() => {
              const latestPost = filteredPosts[0];
              const olderPosts = filteredPosts.slice(1);
              if (!latestPost) return null;
              return (
                <>
                  {/* ── PRIMARY POST + REPORT (wrapped to control spacing) ── */}
                  <div>
                  <div className="post-card">
                    <div className="chart-placeholder">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 15l4-4 3 3 4-4 7 7" />
                      </svg>
                      <span style={{ marginLeft: 8 }}>Technical chart from X post</span>
                    </div>
                    <div style={{ padding: isMobile ? "12px 16px 0" : "16px 20px 0" }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 12, flexWrap: "wrap", gap: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 500, textTransform: "uppercase",
                            letterSpacing: "0.04em", color: "var(--accent-primary)",
                          }}>Latest</span>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                            {formatTime(latestPost.postedAt)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button className="show-btn" onClick={() => toggleExpand(latestPost.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                            {expandedPosts[latestPost.id] ? "Hide" : "Show"}
                          </button>
                          <div style={{ width: 1, height: 16, background: "var(--border-default)", margin: "0 4px" }} />
                          {/* Update button — paste new post for this ticker */}
                          <button
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "5px 10px", borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border-strong)",
                              background: "transparent", color: "var(--text-secondary)",
                              fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                              cursor: "pointer",
                              transition: "all var(--duration-fast) var(--ease-default)",
                            }}
                            onMouseEnter={e => { e.target.style.color = "var(--text-primary)"; e.target.style.borderColor = "var(--accent-primary)"; }}
                            onMouseLeave={e => { e.target.style.color = "var(--text-secondary)"; e.target.style.borderColor = "var(--border-strong)"; }}
                            title="Paste a new Coach post for this ticker"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            Update
                          </button>
                        </div>
                      </div>
                      <div className="meta-row">
                        <div className="meta-item" style={{ paddingLeft: 0 }}>
                          <div className="meta-label">Target</div>
                          <div className="meta-value">
                            {latestPost.priceTarget}{" "}
                            <span style={{ color: "var(--semantic-positive)", fontSize: 12 }}>({latestPost.targetPercent})</span>
                          </div>
                        </div>
                        <div className="meta-item">
                          <div className="meta-label">Date</div>
                          <div className="meta-value">{latestPost.projectedDate}</div>
                        </div>
                        <div className="meta-item">
                          <div className="meta-label">Confidence</div>
                          <div className="meta-value" style={{ display: "flex", alignItems: "center", gap: 6, color: getConfidenceColor(latestPost.confidence) }}>
                            {Math.round(latestPost.confidence * 100)}%
                            <button className="sparkle-btn" title="View AI analysis" style={{ color: getConfidenceColor(latestPost.confidence) }}>
                              <SparkleIcon size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Report link — card footer */}
                      <div style={{
                        borderTop: "1px solid var(--border-subtle)",
                        padding: "5px 20px 5px",
                        marginTop: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: isMobile ? "center" : "flex-start",
                      }}>
                        {feedbackSubmitted[latestPost.id] ? (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 6,
                            fontSize: 12, color: "var(--semantic-positive)",
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            Feedback saved
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                            Analysis not right?{" "}
                            <button
                              onClick={() => setReportOpen(prev => ({ ...prev, [latestPost.id]: true }))}
                              style={{
                                background: "none", border: "none", padding: 0,
                                color: "var(--accent-primary)", cursor: "pointer",
                                fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                                textDecoration: "none",
                                transition: "color var(--duration-fast) var(--ease-default)",
                              }}
                              onMouseEnter={e => e.target.style.color = "var(--accent-primary-hover)"}
                              onMouseLeave={e => e.target.style.color = "var(--accent-primary)"}
                            >Report</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {expandedPosts[latestPost.id] && (
                      <div className="expand-text">{latestPost.content}</div>
                    )}
                  </div>

                  </div>

                  {/* ── OLDER POSTS (subtle, collapsible) ── */}
                  {olderPosts.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: 11, fontWeight: 500, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: "var(--text-tertiary)",
                        padding: "4px 0 8px",
                      }}>
                        Previous posts ({olderPosts.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {olderPosts.map(post => (
                          <div key={post.id} style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-md)",
                            overflow: "hidden",
                            transition: "border-color var(--duration-fast) var(--ease-default)",
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-default)"}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}
                          >
                            <div style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 14px",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                  {formatTime(post.postedAt)}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <button
                                  className="show-btn"
                                  onClick={() => toggleExpand(post.id)}
                                  style={{ fontSize: 12 }}
                                >
                                  {expandedPosts[post.id] ? "Hide" : "View"}
                                </button>
                                <button
                                  onClick={() => {}}
                                  style={{
                                    background: "transparent", border: "none",
                                    color: "var(--text-tertiary)", cursor: "pointer",
                                    padding: 4, display: "flex", alignItems: "center",
                                    transition: "color var(--duration-fast) var(--ease-default)",
                                  }}
                                  onMouseEnter={e => e.target.style.color = "var(--semantic-negative)"}
                                  onMouseLeave={e => e.target.style.color = "var(--text-tertiary)"}
                                  title="Delete post"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {expandedPosts[post.id] && (
                              <div style={{
                                padding: "0 14px 12px",
                                fontSize: 13, lineHeight: 1.6,
                                color: "var(--text-secondary)",
                                borderTop: "1px solid var(--border-subtle)",
                                paddingTop: 10,
                              }}>
                                {post.content}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      </div>
      )}

      {/* ── TOASTS ── */}
      <div className="toast-container">
        {toasts.map(toast => {
          const at = ALERT_TYPES[toast.type];
          return (
            <div key={toast.id} className="toast">
              <div style={{
                width: 3, height: 36, borderRadius: 2, flexShrink: 0,
                background: at.color, marginTop: 2,
              }} />
              <div style={{
                width: 28, height: 28, borderRadius: "var(--radius-sm)",
                background: at.bg, color: at.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>{at.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 500, textTransform: "uppercase",
                    letterSpacing: "0.04em", color: at.color,
                  }}>{at.label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>· {toast.time}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4 }}>
                  {toast.message}
                </div>
              </div>
              <button onClick={() => dismissToast(toast.id)} style={{
                background: "transparent", border: "none", color: "var(--text-tertiary)",
                cursor: "pointer", fontSize: 14, padding: 4, flexShrink: 0,
              }}>✕</button>
            </div>
          );
        })}
      </div>

      {/* ── ACTION PANEL — Report Issue (reusable pattern) ── */}
      {/* Desktop: side panel from right. Mobile: bottom sheet. */}
      {reportPostId && (
        <>
          <div className="action-panel-overlay" onClick={closeReport} />
          <div className={isMobile ? "action-panel-mobile" : "action-panel-desktop"}>
            {/* Mobile drag handle */}
            {isMobile && <div className="panel-handle" />}

            {/* Header */}
            <div className="panel-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
                  Report Issue
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                  Help improve how the system interprets Coach's posts
                </div>
              </div>
              <button
                onClick={closeReport}
                style={{
                  background: "none", border: "none", color: "var(--text-tertiary)",
                  cursor: "pointer", fontSize: 18, padding: 4,
                }}
              >✕</button>
            </div>

            {/* Body */}
            <div className="panel-body">
              <div style={{ marginBottom: 16 }}>
                <div className="meta-label" style={{ marginBottom: 6 }}>What did the system get wrong?</div>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder='e.g., "Target should be $190 not $185" or "This was a short position, not long" or "The date was end of March, not mid-March"'
                  style={{
                    width: "100%", minHeight: 100, maxHeight: 200, resize: "vertical",
                    background: "var(--bg-input)", border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-md)", padding: "10px 12px",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                    color: "var(--text-primary)", lineHeight: 1.6, outline: "none",
                    transition: "border-color var(--duration-fast) var(--ease-default)",
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--border-focus)"}
                  onBlur={e => e.target.style.borderColor = "var(--border-strong)"}
                  autoFocus
                />
              </div>

              <div style={{
                fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5,
              }}>
                Your feedback is stored alongside the original post and used to train the parser.
                Over time, this makes the system more accurate at interpreting Coach's style.
              </div>
            </div>

            {/* Footer */}
            <div className="panel-footer" style={{
              display: "flex", gap: 8, justifyContent: "flex-end",
            }}>
              <button
                onClick={closeReport}
                style={{
                  padding: "8px 16px", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)", background: "transparent",
                  color: "var(--text-secondary)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  cursor: "pointer",
                  transition: "all var(--duration-fast) var(--ease-default)",
                }}
              >Cancel</button>
              <button
                onClick={() => submitFeedback(reportPostId)}
                disabled={!feedbackText.trim()}
                style={{
                  padding: "8px 20px", borderRadius: "var(--radius-md)", border: "none",
                  background: feedbackText.trim() ? "var(--accent-primary)" : "var(--bg-elevated)",
                  color: feedbackText.trim() ? "var(--text-inverse)" : "var(--text-tertiary)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  cursor: feedbackText.trim() ? "pointer" : "default",
                  transition: "all var(--duration-fast) var(--ease-default)",
                }}
              >Submit Report</button>
            </div>
          </div>
        </>
      )}

      {/* ── ACTION PANEL — Delete Confirmation (same reusable pattern) ── */}
      {deleteConfirmOpen && selected !== "all" && (
        <>
          <div className="action-panel-overlay" onClick={() => setDeleteConfirmOpen(false)} />
          <div className={isMobile ? "action-panel-mobile" : "action-panel-desktop"}>
            {isMobile && <div className="panel-handle" />}

            <div className="panel-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
                  Remove {selected} from Watchlist
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                  This action can't be undone
                </div>
              </div>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                style={{
                  background: "none", border: "none", color: "var(--text-tertiary)",
                  cursor: "pointer", fontSize: 18, padding: 4,
                }}
              >✕</button>
            </div>

            <div className="panel-body">
              <div style={{
                background: "var(--semantic-negative-muted)",
                border: "1px solid rgba(240,110,110,0.2)",
                borderRadius: "var(--radius-md)",
                padding: 16,
                marginBottom: 16,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--semantic-negative)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--semantic-negative)" }}>
                    You're about to remove {selected}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  This will remove <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{selected}</strong> from
                  your watchlist and delete all {filteredPosts.length} associated Coach post{filteredPosts.length !== 1 ? "s" : ""}.
                  Any parsed trade data, alerts, and feedback for this ticker will also be removed.
                </div>
              </div>
            </div>

            <div className="panel-footer" style={{
              display: "flex", gap: 8, justifyContent: "flex-end",
            }}>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                style={{
                  padding: "8px 16px", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)", background: "transparent",
                  color: "var(--text-secondary)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  cursor: "pointer",
                  transition: "all var(--duration-fast) var(--ease-default)",
                }}
              >Cancel</button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: "8px 20px", borderRadius: "var(--radius-md)", border: "none",
                  background: "var(--semantic-negative)",
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  cursor: "pointer",
                  transition: "all var(--duration-fast) var(--ease-default)",
                }}
              >Remove {selected}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
