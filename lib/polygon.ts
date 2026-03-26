// Polygon.io API client — REST price feeds
// Free tier: REST polling, 15-min delay during market hours
// Indices use "I:" prefix (e.g., RUT → I:RUT, SOX → I:SOX)

const BASE = "https://api.polygon.io";

// Tickers that are indices on Polygon (require I: prefix)
const INDEX_TICKERS: Record<string, string> = {
  RUT: "I:RUT",
  SOX: "I:SOX",
  SPX: "I:SPX",
  NDX: "I:NDX",
  DJI: "I:DJI",
  VIX: "I:VIX",
  COMP: "I:COMP",
};

// Crypto pairs — Polygon uses "X:" prefix (e.g., BTCUSD → X:BTCUSD)
const CRYPTO_PAIRS = new Set([
  "BTCUSD", "ETHUSD", "SOLUSD", "AVAXUSD", "BNBUSD",
  "XRPUSD", "ADAUSD", "DOGEUSD", "MATICUSD", "LINKUSD",
]);

function toPolygonTicker(ticker: string): string {
  const upper = ticker.toUpperCase();
  if (INDEX_TICKERS[upper]) return INDEX_TICKERS[upper];
  if (CRYPTO_PAIRS.has(upper)) return `X:${upper}`;
  return upper;
}

export interface PriceData {
  ticker: string;
  price: number; // current close / last trade
  open: number;
  high: number;
  low: number;
  change: number; // absolute change from prev close
  changePercent: number;
  timestamp: number; // unix ms
}

// Single ticker price — tries snapshot for stocks, falls back to prev-close aggs
export async function fetchPrice(ticker: string): Promise<PriceData | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey || apiKey === "your-polygon-key") return null;

  const polyTicker = toPolygonTicker(ticker);

  // Indices: use prev-close aggregates (snapshot endpoint is stocks-only)
  if (polyTicker.startsWith("I:")) {
    return fetchPrevClose(ticker, polyTicker, apiKey);
  }

  // Stocks: try the snapshot endpoint first
  try {
    const res = await fetch(
      `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${polyTicker}?apiKey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
    const data = await res.json();
    const snap = data.ticker;
    if (!snap) return null;

    // Prefer day close, fall back to last trade, then previous day close
    const price = snap.day?.c || snap.lastTrade?.p || snap.prevDay?.c || 0;
    // When using prevDay, todaysChange may be stale/zero — recalculate
    const change = snap.todaysChange ?? (snap.prevDay?.c ? price - snap.prevDay.c : 0);
    const changePercent = snap.todaysChangePerc ?? 0;

    return {
      ticker,
      price,
      open: snap.day?.o ?? snap.prevDay?.o ?? 0,
      high: snap.day?.h ?? snap.prevDay?.h ?? 0,
      low: snap.day?.l ?? snap.prevDay?.l ?? 0,
      change,
      changePercent,
      timestamp: snap.updated ?? Date.now(),
    };
  } catch {
    return fetchPrevClose(ticker, polyTicker, apiKey);
  }
}

async function fetchPrevClose(
  displayTicker: string,
  polyTicker: string,
  apiKey: string
): Promise<PriceData | null> {
  try {
    const res = await fetch(
      `${BASE}/v2/aggs/ticker/${polyTicker}/prev?adjusted=true&apiKey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return null;

    const change = r.c - r.o;
    const changePercent = r.o !== 0 ? (change / r.o) * 100 : 0;

    return {
      ticker: displayTicker,
      price: r.c,
      open: r.o,
      high: r.h,
      low: r.l,
      change,
      changePercent,
      timestamp: r.t,
    };
  } catch {
    return null;
  }
}

// ── Historical OHLC bars ───────────────────────────────────────────────────────

export interface OHLCBar {
  t: number; // unix ms timestamp (bar open)
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

/**
 * Fetch historical OHLC bars for a ticker.
 * Returns bars sorted oldest → newest, or null if unavailable.
 *
 * @param ticker  - Display ticker (e.g. "XLF", "SOX", "AAPL")
 * @param multiplier - Bar size multiplier (1, 4, etc.)
 * @param timespan   - "minute" | "hour" | "day" | "week"
 * @param from   - YYYY-MM-DD start date (inclusive)
 * @param to     - YYYY-MM-DD end date (inclusive)
 */
export async function fetchAggregates(
  ticker: string,
  multiplier: number,
  timespan: "minute" | "hour" | "day" | "week",
  from: string,
  to: string
): Promise<OHLCBar[] | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey || apiKey === "your-polygon-key") return null;

  const polyTicker = toPolygonTicker(ticker);

  try {
    const url = `${BASE}/v2/aggs/ticker/${polyTicker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[Polygon aggs] ${res.status} for ${polyTicker} ${multiplier}/${timespan} ${from}→${to}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data.results) || data.results.length === 0) return null;
    return data.results as OHLCBar[];
  } catch (err) {
    console.warn("[Polygon aggs] fetch error:", err);
    return null;
  }
}

// ── Ticker details (fund metadata, AUM) ──────────────────────────────────────

export interface TickerDetails {
  ticker: string;
  name: string;
  type: string;
  market: string;
  shareClassSharesOutstanding?: number;
  weightedSharesOutstanding?: number;
  marketCap?: number;
}

export async function fetchTickerDetails(
  ticker: string
): Promise<TickerDetails | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey || apiKey === "your-polygon-key") return null;

  try {
    const res = await fetch(
      `${BASE}/v3/reference/tickers/${ticker.toUpperCase()}?apiKey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.results;
    if (!r) return null;

    return {
      ticker: r.ticker,
      name: r.name,
      type: r.type,
      market: r.market,
      shareClassSharesOutstanding: r.share_class_shares_outstanding,
      weightedSharesOutstanding: r.weighted_shares_outstanding,
      marketCap: r.market_cap,
    };
  } catch {
    return null;
  }
}

// ── Delist monitor: volume decline check ─────────────────────────────────────

export interface VolumeCheckResult {
  signalLevel: "green" | "yellow" | "red";
  summary: string;
  rawData: { avg30d: number; avg90d: number; ratio: number } | null;
}

/**
 * Check for declining volume as early warning of fund distress.
 * - 30-day avg < 50% of 90-day avg → yellow (severe decline)
 * - 30-day avg < 75% of 90-day avg → yellow (moderate decline)
 */
export async function checkVolumeDecline(
  ticker: string
): Promise<VolumeCheckResult> {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const from90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const bars = await fetchAggregates(ticker, 1, "day", from90d, to);
  if (!bars || bars.length < 10) {
    return {
      signalLevel: "green",
      summary: `Insufficient volume data for ${ticker}`,
      rawData: null,
    };
  }

  // Split into recent 30-day and full 90-day
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const recent = bars.filter((b) => b.t >= thirtyDaysAgo);
  const older = bars;

  const avg30d =
    recent.length > 0
      ? recent.reduce((sum, b) => sum + b.v, 0) / recent.length
      : 0;
  const avg90d = older.reduce((sum, b) => sum + b.v, 0) / older.length;

  if (avg90d === 0) {
    return {
      signalLevel: "green",
      summary: `No volume history for ${ticker}`,
      rawData: null,
    };
  }

  const ratio = avg30d / avg90d;
  const rawData = {
    avg30d: Math.round(avg30d),
    avg90d: Math.round(avg90d),
    ratio: Math.round(ratio * 100) / 100,
  };

  if (ratio < 0.5) {
    return {
      signalLevel: "yellow",
      summary: `${ticker} volume dropped ${Math.round((1 - ratio) * 100)}% — 30d avg ${formatVolume(avg30d)} vs 90d avg ${formatVolume(avg90d)}`,
      rawData,
    };
  }

  if (ratio < 0.75) {
    return {
      signalLevel: "yellow",
      summary: `${ticker} volume declining — 30d avg ${formatVolume(avg30d)} vs 90d avg ${formatVolume(avg90d)}`,
      rawData,
    };
  }

  return {
    signalLevel: "green",
    summary: `${ticker} volume stable — 30d avg ${formatVolume(avg30d)}`,
    rawData,
  };
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

// Batch price fetch — parallel requests
export async function fetchPrices(
  tickers: string[]
): Promise<Record<string, PriceData | null>> {
  const entries = await Promise.all(
    tickers.map(async (t) => [t, await fetchPrice(t)] as const)
  );
  return Object.fromEntries(entries);
}

// ── Market status (server-side) ────────────────────────────────────────────────

export type MarketStatus = "open" | "pre-market" | "after-hours" | "closed";

export interface MarketStatusResult {
  status: MarketStatus;
  // ET hour:minute as string, e.g., "09:30"
  etTime: string;
  // ISO string of next market open, or null if market is open
  nextOpen: string | null;
}

export function getMarketStatus(): MarketStatusResult {
  const now = new Date();

  // Parse current ET time
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const weekday = etParts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(etParts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(etParts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const totalMinutes = hour * 60 + minute;
  const etTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const isWeekend = weekday === "Sat" || weekday === "Sun";

  // Minutes from midnight ET
  const MARKET_OPEN = 9 * 60 + 30; // 9:30 AM
  const MARKET_CLOSE = 16 * 60; // 4:00 PM
  const PREMARKET_START = 4 * 60; // 4:00 AM
  const AFTERHOURS_END = 20 * 60; // 8:00 PM

  if (!isWeekend) {
    if (totalMinutes >= MARKET_OPEN && totalMinutes < MARKET_CLOSE) {
      return { status: "open", etTime, nextOpen: null };
    }
    if (totalMinutes >= PREMARKET_START && totalMinutes < MARKET_OPEN) {
      return { status: "pre-market", etTime, nextOpen: null };
    }
    if (totalMinutes >= MARKET_CLOSE && totalMinutes < AFTERHOURS_END) {
      return { status: "after-hours", etTime, nextOpen: null };
    }
  }

  // Closed — compute next open
  const nextOpen = getNextMarketOpen(now, weekday, totalMinutes);
  return { status: "closed", etTime, nextOpen };
}

function getNextMarketOpen(
  now: Date,
  weekday: string,
  totalMinutesET: number
): string {
  // Find the next weekday at 9:30 AM ET
  const candidate = new Date(now);

  // If today is a weekday but market hasn't opened yet, next open is today at 9:30
  // Otherwise advance to tomorrow (or Monday if Friday/Saturday)
  const MARKET_OPEN = 9 * 60 + 30;
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (!isWeekend && totalMinutesET < MARKET_OPEN) {
    // Opens later today
  } else {
    // Advance days until we hit a weekday
    let daysToAdd = 1;
    const dayOfWeek = candidate.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 5) daysToAdd = 3; // Friday → Monday
    if (dayOfWeek === 6) daysToAdd = 2; // Saturday → Monday
    candidate.setDate(candidate.getDate() + daysToAdd);
  }

  // Set to 9:30 AM ET
  const nextOpenET = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(candidate);

  // Parse M/D/Y and construct ISO date
  const [m, d, y] = nextOpenET.split("/");
  // Return as a string the UI can display
  return `${y}-${m}-${d}T09:30:00`; // ET local time (not UTC)
}
