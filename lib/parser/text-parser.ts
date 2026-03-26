import type { ParsedTradeData, TradeDirection } from "./types";

// Words that look like tickers but aren't
const TICKER_BLOCKLIST = new Set([
  "I", "A", "AT", "IT", "BE", "DO", "GO", "IN", "IS", "MY", "OR", "SO", "TO",
  "US", "WE", "AM", "BY", "ON", "UP", "PM", "ET", "PT", "SL", "MA", "EMA",
  "RSI", "ATH", "ALL", "CEO", "IPO", "ETF", "IMO", "FYI", "EOD", "EOM",
  "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER",
  "WAS", "ONE", "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HIS", "HOW",
  "MAN", "NEW", "NOW", "OLD", "SEE", "TWO", "WAY", "WHO", "ITS", "LET",
  "PUT", "SAY", "SHE", "TOO", "USE", "LONG", "SHORT", "BULL", "BEAR",
  "CALL", "PUTS", "STOP", "LOSS", "HIGH", "LOWS", "MOVE", "PLAY", "BACK",
  "LOOK", "GOOD", "NEXT", "WEEK", "EASY", "TIME", "THAN",
  // Wyckoff terms — not tickers
  "SOW", "LPSY", "UTAD", "BC", "ST", "SOS", "LPS", "UT", "AR", "PSY", "SC",
]);

function extractTickers(text: string): string[] {
  const tickers: string[] = [];
  const seen = new Set<string>();

  // $AAPL format — highest confidence
  const dollarPattern = /\$([A-Z]{1,5})\b/g;
  let m: RegExpExecArray | null;
  while ((m = dollarPattern.exec(text)) !== null) {
    const t = m[1];
    if (!TICKER_BLOCKLIST.has(t) && !seen.has(t)) {
      tickers.push(t);
      seen.add(t);
    }
  }

  // Company name → ticker mapping for common informal references
  const nameMap: Record<string, string> = {
    apple: "AAPL",
    tesla: "TSLA",
    nvidia: "NVDA",
    microsoft: "MSFT",
    google: "GOOGL",
    amazon: "AMZN",
    meta: "META",
    netflix: "NFLX",
    amd: "AMD",
    intel: "INTC",
    // Coach-specific informal references
    "mag 7": "MAGS",
    "magnificent 7": "MAGS",
    "russell 2000": "RUT",
    "russell": "RUT",
    "semiconductor index": "SOX",
    "semis": "SOX",
  };
  const lower = text.toLowerCase();
  for (const [name, ticker] of Object.entries(nameMap)) {
    if (lower.includes(name) && !seen.has(ticker)) {
      tickers.push(ticker);
      seen.add(ticker);
    }
  }

  // Standalone uppercase 2-5 letter words as last resort (only when no $-tickers)
  if (tickers.length === 0) {
    const upperPattern = /\b([A-Z]{2,5})\b/g;
    while ((m = upperPattern.exec(text)) !== null) {
      const t = m[1];
      if (!TICKER_BLOCKLIST.has(t) && !seen.has(t)) {
        tickers.push(t);
        seen.add(t);
      }
    }
  }

  return tickers;
}

function extractDirection(text: string): TradeDirection {
  const lower = text.toLowerCase();
  const bearishSignals =
    /\b(bearish|puts?|short(ing)?|sell|selling|drop|fall|falling|below|downside|reverse)\b/;
  const bullishSignals =
    /\b(bullish|calls?|long|buy|buying|rip|moon|upside|looking strong|confirmed above)\b/;
  if (bearishSignals.test(lower) && !bullishSignals.test(lower)) return "short";
  return "long";
}

interface PriceExtracts {
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceTargetPercent: number | null;
  priceConfirmation: number | null;
  stopLoss: number | null;
}

function extractPrices(text: string): PriceExtracts {
  let priceTargetLow: number | null = null;
  let priceTargetHigh: number | null = null;
  let priceTargetPercent: number | null = null;
  let priceConfirmation: number | null = null;
  let stopLoss: number | null = null;

  // Price target range: "PT $185-190", "PT: $185-$190", "target $185-190", "PT to $185-190"
  const ptRangePattern =
    /(?:PT|price\s*target|target)\s*(?:[:=]|to)?\s*\$?(\d+(?:\.\d+)?)\s*[-–]\s*\$?(\d+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null = ptRangePattern.exec(text);
  if (m) {
    priceTargetLow = parseFloat(m[1]);
    priceTargetHigh = parseFloat(m[2]);
  }

  // Single price target: "PT $190", "target $190", "looking at $190 easy", "PT to $190", "🎯 $190", "to $190"
  if (!priceTargetHigh) {
    const ptSinglePattern =
      /(?:PT|price\s*target|target|looking\s+(?:at|for)|🎯)\s*(?:[:=]|to)?\s*\$(\d+(?:\.\d+)?)\b(?!\s*[-–])/gi;
    m = ptSinglePattern.exec(text);
    if (m) priceTargetHigh = parseFloat(m[1]);
  }

  // Percent target: "15-20% upside", "see 10% from here"
  if (!priceTargetHigh) {
    const pctRangePattern =
      /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)%\s*(?:upside|gain|move)/gi;
    m = pctRangePattern.exec(text);
    if (m) {
      priceTargetPercent = (parseFloat(m[1]) + parseFloat(m[2])) / 2;
    } else {
      const pctSinglePattern = /(\d+(?:\.\d+)?)%\s*(?:upside|gain|move)/gi;
      m = pctSinglePattern.exec(text);
      if (m) priceTargetPercent = parseFloat(m[1]);
    }
  }

  // Price confirmation / entry
  const confirmPatterns: RegExp[] = [
    /confirmed?\s+(?:above|at|over)\s*\$?(\d+(?:\.\d+)?)/gi,
    /new\s+confirmation\s+at\s*\$?(\d+(?:\.\d+)?)/gi,
    /entry\s+(?:at|above|over)\s*\$?(\d+(?:\.\d+)?)/gi,
    /(?:buy|get\s+in)\s+(?:when\s+it\s+hits|above|over|at)\s*\$?(\d+(?:\.\d+)?)/gi,
    /(?:watch\s+for\s+)?break(?:out|s?)?\s+above\s*\$?(\d+(?:\.\d+)?)/gi,
  ];
  for (const pattern of confirmPatterns) {
    m = pattern.exec(text);
    if (m) {
      priceConfirmation = parseFloat(m[1]);
      break;
    }
  }

  // Stop loss
  const slPatterns: RegExp[] = [
    /\bSL\s*[:=]?\s*\$?(\d+(?:\.\d+)?)/gi,
    /stop\s+(?:loss\s+)?(?:at\s+)?\$?(\d+(?:\.\d+)?)/gi,
  ];
  for (const pattern of slPatterns) {
    m = pattern.exec(text);
    if (m) {
      stopLoss = parseFloat(m[1]);
      break;
    }
  }

  return {
    priceTargetLow,
    priceTargetHigh,
    priceTargetPercent,
    priceConfirmation,
    stopLoss,
  };
}

function extractDate(text: string): string | null {
  // Absolute: "3/20", "3/20/26", "3/20/2026"
  const mdPattern = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
  let m: RegExpExecArray | null = mdPattern.exec(text);
  if (m) {
    const month = parseInt(m[1]) - 1;
    const day = parseInt(m[2]);
    const rawYear = m[3];
    const year = rawYear
      ? rawYear.length === 2
        ? 2000 + parseInt(rawYear)
        : parseInt(rawYear)
      : new Date().getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }

  // "March 20", "Mar 20th", "March 20, 2026"
  const months =
    "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec";
  const monthNamePattern = new RegExp(
    `(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`,
    "gi"
  );
  m = monthNamePattern.exec(text);
  if (m) {
    const fullMonths = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
    ];
    const shortMonths = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    const mName = m[1].toLowerCase();
    let monthIdx = fullMonths.indexOf(mName);
    if (monthIdx === -1) monthIdx = shortMonths.indexOf(mName);
    if (monthIdx !== -1) {
      const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
      const d = new Date(year, monthIdx, parseInt(m[2]));
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
  }

  // Relative — return as human-readable string
  const relativePatterns: [RegExp, string | null][] = [
    [/\bend of (?:the )?month\b/i, "end of month"],
    [/\bby (?:end of )?(?:the )?week\b/i, "end of week"],
    [/\bnext week\b/i, "next week"],
    [/\bby (?:this |next )?friday\b/i, "by Friday"],
    [/\bthis week\b/i, "this week"],
    [/\bby end of (?:the )?day\b/i, "end of day"],
    [
      /\bby (?:this |next )?(?:monday|tuesday|wednesday|thursday|saturday|sunday)\b/i,
      null,
    ],
  ];
  for (const [pattern, label] of relativePatterns) {
    const rel = pattern.exec(text);
    if (rel) return label ?? rel[0];
  }

  return null;
}

function scoreConfidence(trade: Partial<ParsedTradeData>): number {
  if (!trade.ticker) return 0;

  const fields: [keyof ParsedTradeData, number][] = [
    ["priceTargetHigh", 0.25],
    ["priceConfirmation", 0.25],
    ["projectedDate", 0.15],
    ["stopLoss", 0.15],
    ["priceTargetLow", 0.10],
    ["priceTargetPercent", 0.10],
  ];

  let score = 0;
  let total = 0;
  for (const [field, weight] of fields) {
    total += weight;
    if (trade[field] !== null && trade[field] !== undefined) score += weight;
  }

  return Math.min(1, Math.max(0.2, score / total));
}

export function parseText(content: string): ParsedTradeData[] {
  const tickers = extractTickers(content);
  if (tickers.length === 0) return [];

  const direction = extractDirection(content);
  const prices = extractPrices(content);
  const projectedDate = extractDate(content);

  // Multi-ticker: try to assign per-ticker price targets
  if (tickers.length > 1) {
    return tickers.map((ticker) => {
      // Look for "TICKER PT $NNN" or "TICKER PT $NNN-$NNN" near this ticker
      const tickerPtPattern = new RegExp(
        `\\$?${ticker}\\s+PT\\s*[:=]?\\s*\\$?(\\d+(?:\\.\\d+)?)(?:\\s*[-–]\\s*\\$?(\\d+(?:\\.\\d+)?))?`,
        "gi"
      );
      const ptMatch = tickerPtPattern.exec(content);
      let tickerTargetLow = prices.priceTargetLow;
      let tickerTarget = prices.priceTargetHigh;
      if (ptMatch) {
        tickerTargetLow = parseFloat(ptMatch[1]);
        tickerTarget = ptMatch[2]
          ? parseFloat(ptMatch[2])
          : parseFloat(ptMatch[1]);
      }

      const trade: ParsedTradeData = {
        ticker,
        direction,
        priceTargetLow: tickerTargetLow,
        priceTargetHigh: tickerTarget,
        priceTargetPercent: prices.priceTargetPercent,
        priceConfirmation: prices.priceConfirmation,
        projectedDate,
        stopLoss: prices.stopLoss,
        supportLevel: null,
        resistanceLevel: null,
        sourceType: "text",
        rawExtract: content.slice(0, 200),
        confidence: 0,
      };
      trade.confidence = scoreConfidence(trade);
      return trade;
    });
  }

  const trade: ParsedTradeData = {
    ticker: tickers[0],
    direction,
    ...prices,
    projectedDate,
    supportLevel: null,
    resistanceLevel: null,
    sourceType: "text",
    rawExtract: content.slice(0, 200),
    confidence: 0,
  };
  trade.confidence = scoreConfidence(trade);
  return [trade];
}
