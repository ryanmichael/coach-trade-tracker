// SEC EDGAR EFTS (full-text search) API integration
// Free, no API key needed. Requires User-Agent header per SEC policy.
// Searches for fund liquidation / closure filings (N-8F, 8-K).

const EDGAR_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index";
const USER_AGENT = "Coachtrack/1.0 (delist-monitor)";

export interface EdgarCheckResult {
  signalLevel: "green" | "yellow" | "red";
  summary: string;
  url: string | null;
  rawData: unknown;
}

/**
 * Search SEC EDGAR for liquidation/delisting filings related to a ticker.
 * N-8F = investment company deregistration (fund liquidation)
 * 8-K = material events (may include closure announcements)
 */
export async function checkSecEdgar(ticker: string): Promise<EdgarCheckResult> {
  const queries = [
    `"${ticker}" AND ("liquidation" OR "closure" OR "delisting" OR "termination")`,
    `"${ticker}" AND "N-8F"`,
  ];

  // Look back 90 days
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        dateRange: "custom",
        startdt: startDate,
        enddt: endDate,
        forms: "N-8F,8-K",
      });

      const res = await fetch(`${EDGAR_SEARCH_URL}?${params}`, {
        headers: { "User-Agent": USER_AGENT },
        cache: "no-store",
      });

      if (!res.ok) {
        console.warn(`[SEC EDGAR] HTTP ${res.status} for query: ${query}`);
        continue;
      }

      const data = await res.json();
      const hits = data.hits?.hits ?? data.hits ?? [];

      if (hits.length > 0) {
        const topHit = hits[0];
        const filingUrl = topHit._source?.file_url
          ? `https://www.sec.gov/Archives/${topHit._source.file_url}`
          : null;
        const formType = topHit._source?.form_type ?? "filing";
        const filedDate = topHit._source?.file_date ?? "unknown date";

        return {
          signalLevel: "red",
          summary: `SEC ${formType} filed ${filedDate} referencing ${ticker} liquidation/closure`,
          url: filingUrl,
          rawData: topHit._source ?? topHit,
        };
      }
    } catch (err) {
      console.warn(`[SEC EDGAR] Search error for "${query}":`, err);
    }
  }

  return {
    signalLevel: "green",
    summary: `No SEC liquidation filings found for ${ticker} in past 90 days`,
    url: null,
    rawData: null,
  };
}
