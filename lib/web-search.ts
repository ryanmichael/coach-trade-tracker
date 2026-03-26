// Web search integration for delist monitoring
// Uses Google Custom Search JSON API if configured, otherwise returns neutral.
// Supplementary source — SEC EDGAR and Polygon are primary signals.

export interface WebSearchCheckResult {
  signalLevel: "green" | "yellow" | "red";
  summary: string;
  url: string | null;
  rawData: unknown;
}

const DELIST_KEYWORDS = [
  "delisting",
  "liquidation",
  "fund closure",
  "ceasing operations",
  "winding down",
  "termination",
  "reverse split", // often precedes delisting
];

/**
 * Search the web for ETF delist / liquidation news.
 * Uses Google Custom Search JSON API (GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX env vars).
 * Falls back to a no-op if not configured.
 */
export async function checkWebForDelistNews(
  ticker: string
): Promise<WebSearchCheckResult> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    return {
      signalLevel: "green",
      summary: `Web search not configured — skipping for ${ticker}`,
      url: null,
      rawData: null,
    };
  }

  const query = `${ticker} ETF delisting OR liquidation OR "fund closure"`;

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx,
      q: query,
      num: "5",
      dateRestrict: "m3", // last 3 months
    });

    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.warn(`[Web Search] HTTP ${res.status} for ${ticker}`);
      return {
        signalLevel: "green",
        summary: `Web search failed for ${ticker}`,
        url: null,
        rawData: null,
      };
    }

    const data = await res.json();
    const items = data.items ?? [];

    if (items.length === 0) {
      return {
        signalLevel: "green",
        summary: `No delist-related news found for ${ticker}`,
        url: null,
        rawData: null,
      };
    }

    // Score results by keyword matches
    let maxSignal: "green" | "yellow" | "red" = "green";
    let bestItem = items[0];

    for (const item of items) {
      const text = `${item.title} ${item.snippet}`.toLowerCase();
      const tickerInText = text.includes(ticker.toLowerCase());
      if (!tickerInText) continue;

      const redMatches = ["liquidation", "delisting", "ceasing operations", "winding down", "termination"];
      const yellowMatches = ["reverse split", "fund closure", "declining", "low volume", "at risk"];

      const hasRed = redMatches.some((kw) => text.includes(kw));
      const hasYellow = yellowMatches.some((kw) => text.includes(kw));

      if (hasRed && maxSignal !== "red") {
        maxSignal = "red";
        bestItem = item;
      } else if (hasYellow && maxSignal === "green") {
        maxSignal = "yellow";
        bestItem = item;
      }
    }

    return {
      signalLevel: maxSignal,
      summary:
        maxSignal === "green"
          ? `No concerning news for ${ticker}`
          : `${bestItem.title}`,
      url: bestItem.link ?? null,
      rawData: { totalResults: data.searchInformation?.totalResults, topItems: items.slice(0, 3).map((i: { title: string; link: string }) => ({ title: i.title, link: i.link })) },
    };
  } catch (err) {
    console.warn(`[Web Search] Error for ${ticker}:`, err);
    return {
      signalLevel: "green",
      summary: `Web search error for ${ticker}`,
      url: null,
      rawData: null,
    };
  }
}
