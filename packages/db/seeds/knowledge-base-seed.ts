import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:password@localhost:5432/coach_trade_tracker";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as any);

/**
 * Knowledge Base seed — coach-aware entries
 *
 * Covers patterns, instruments, Wyckoff terms, chart elements, and relationships
 * observed directly from @great_martis posts (docs/training-coach-x-posts/).
 */
const entries = [
  // ════════════════════════════════════════
  // PATTERNS
  // ════════════════════════════════════════

  {
    category: "pattern",
    key: "wyckoff_distribution",
    data: {
      name: "Wyckoff Distribution",
      direction: "bearish",
      description:
        "Institutional selling phase. Smart money distributes holdings to retail at high prices. Coach identifies these on major indices (DAX, SPX, SOX). Includes the classic Distribution Schematic #1 as a reference inset.",
      phases: ["PSY", "BC", "AR", "ST", "UT", "UTAD", "SOW", "LPSY"],
      coach_note:
        "Coach calls this 'the Mona Lisa of technical analysis' when playing out textbook. Embeds official Wyckoff Distribution Schematic #1 as an inset on the chart for comparison.",
      typical_target: "decline to next accumulation zone / measured move target",
      reliability: 0.78,
    },
  },
  {
    category: "pattern",
    key: "wyckoff_accumulation",
    data: {
      name: "Wyckoff Accumulation",
      direction: "bullish",
      description:
        "Institutional buying phase. Smart money accumulates at low prices before markup.",
      phases: ["PS", "SC", "AR", "ST", "Spring", "SOS", "LPS"],
      typical_target: "markup to resistance / next distribution zone",
      reliability: 0.78,
    },
  },
  {
    category: "pattern",
    key: "rising_wedge",
    data: {
      name: "Rising Wedge",
      direction: "bearish",
      description:
        "Price makes higher highs and higher lows converging upward toward an apex. Bearish reversal pattern — price typically breaks down through lower trendline. Coach labeled this explicitly on XLF (Financial ETF) charts.",
      coach_note:
        "Coach labels 'RISING WEDGE' in blue text on chart. Marks the Apex at the top. After breach, labels 'Critical support' below. Targets the base of the pattern (measured move).",
      confirmation: "breach of lower trendline below critical support",
      typical_target: "base of the wedge pattern — measured move down",
      reliability: 0.72,
    },
  },
  {
    category: "pattern",
    key: "head_and_shoulders",
    data: {
      name: "Head and Shoulders",
      direction: "bearish",
      description:
        "Three-peak reversal pattern: left shoulder, higher head, lower right shoulder. Neckline break confirms breakdown. Coach identified a 'slanting head and shoulders' forming on SOX semiconductors.",
      coach_note:
        "Coach uses blue labels: 'Left Shoulder', 'Head', 'Right Shoulder', 'CRITICAL SUPPORT' on the chart. 'Slanting' variant means the neckline is diagonal, not flat.",
      confirmation: "break below neckline / critical support",
      reliability: 0.72,
    },
  },
  {
    category: "pattern",
    key: "symmetrical_triangle",
    data: {
      name: "Symmetrical Triangle",
      direction: "neutral_to_bullish",
      description:
        "Converging trendlines with lower highs and higher lows. Breakout direction confirms bias. Coach tracked USOIL symmetrical triangle playing out, numbering the legs 1-2-3-4-5.",
      coach_note:
        "Coach numbers the legs (1, 2, 3, 4, 3/4) with a price level at the entry point (76.50 for USOIL). After breakout: 'trailing stop is paramount now.' Annotates the projected target with % gain.",
      confirmation: "breakout above resistance with volume",
      reliability: 0.68,
    },
  },
  {
    category: "pattern",
    key: "ascending_channel",
    data: {
      name: "Ascending Channel",
      direction: "bullish_with_correction_risk",
      description:
        "Price moving upward between two parallel diagonal trendlines. Coach uses this for GOLD and SILVER — bullish while inside channel, bearish if channel floor breaks.",
      coach_note:
        "Coach labels 'Ascending channel' in blue on chart. Watches channel floors closely. If floor breaks, 'ABC correction activates and primary trendlines will most likely come into play.' Also labels 'Support.' in blue.",
      confirmation: "hold above channel floor",
      invalidation: "break below channel floor",
      reliability: 0.7,
    },
  },
  {
    category: "pattern",
    key: "abc_correction",
    data: {
      name: "ABC Correction (Elliott Wave)",
      direction: "bearish_correction_within_uptrend",
      description:
        "Three-wave corrective pattern: Wave A (initial decline), Wave B (partial recovery), Wave C (final leg completing the correction). Coach applies this to GOLD and SILVER within their ascending channels.",
      coach_note:
        "Coach labels a, b, c on chart. The ABC pattern completion = a buying opportunity if price holds at C. Coach says 'ABC pattern is still in play and will only be invalidated if both precious metals break above their ascending channel.'",
      typical_target: "Wave C = 1.0x to 1.618x length of Wave A",
      reliability: 0.7,
    },
  },
  {
    category: "pattern",
    key: "bear_channel",
    data: {
      name: "Bear Channel / Bear Flag",
      direction: "bearish",
      description:
        "Price declining within a parallel channel, making lower highs and lower lows. Coach identified BTCUSD in a bear flag structure consolidating inside the bear channel.",
      coach_note:
        "Coach writes: 'BTC still consolidating inside the bear flag. Structure intact = high-prob downside continuation coming soon, not too distant. Shorting and waiting for the channel floor breach? That could be wise...lets confirmation filter out fakeouts.'",
      confirmation: "breach of channel floor",
      reliability: 0.68,
    },
  },
  {
    category: "pattern",
    key: "ascending_broadening_pattern",
    data: {
      name: "Ascending Broadening Pattern",
      direction: "bearish",
      description:
        "Price action expands with higher highs and lower lows forming a megaphone/broadening shape. Typically bearish reversal at upper resistance.",
      reliability: 0.65,
    },
  },
  {
    category: "pattern",
    key: "double_top",
    data: {
      name: "Double Top",
      direction: "bearish",
      description:
        "Two consecutive peaks at approximately the same price level. Neckline break confirms reversal.",
      reliability: 0.7,
    },
  },
  {
    category: "pattern",
    key: "double_bottom",
    data: {
      name: "Double Bottom",
      direction: "bullish",
      description:
        "Two consecutive troughs at approximately the same price level. Neckline break confirms reversal.",
      reliability: 0.7,
    },
  },
  {
    category: "pattern",
    key: "bull_flag",
    data: {
      name: "Bull Flag",
      direction: "bullish",
      description:
        "Continuation pattern. Sharp upward move (flagpole) followed by brief consolidation (flag) before resuming uptrend.",
      reliability: 0.68,
    },
  },
  {
    category: "pattern",
    key: "ascending_triangle",
    data: {
      name: "Ascending Triangle",
      direction: "bullish",
      description:
        "Flat resistance top with rising lows. Typically breaks out to the upside.",
      reliability: 0.65,
    },
  },
  {
    category: "pattern",
    key: "descending_triangle",
    data: {
      name: "Descending Triangle",
      direction: "bearish",
      description:
        "Flat support bottom with declining highs. Typically breaks down.",
      reliability: 0.65,
    },
  },
  {
    category: "pattern",
    key: "cup_and_handle",
    data: {
      name: "Cup and Handle",
      direction: "bullish",
      description:
        "U-shaped cup followed by a small downward drift (handle). Breakout above handle confirms continuation.",
      reliability: 0.67,
    },
  },
  {
    category: "pattern",
    key: "danger_zone",
    data: {
      name: "Danger Zone",
      direction: "bearish",
      description:
        "Coach's proprietary concept: a highlighted price range (shown as pink/salmon box on chart) where the probability of a sharp, severe sell-off (30-40% drawdowns) rises dramatically. Coach applied this to SPX (5700-6800 range) and NASDAQ (14k-22.2k range).",
      coach_note:
        "Coach writes: 'Once price drops into this danger zone, the odds of a sharp, severe sell-off rise dramatically — think 30-40% drawdowns becoming a real threat. What typically unfolds: the midpoint often acts as a quick magnet, providing a brief, deceptive pause or bounce before downward pressure intensifies.' Price levels: SPX danger zone 5700-6800, NASDAQ danger zone ~14k-22k.",
      key_levels: {
        SPX: { upper: 6800, lower: 5700, midpoint: 6250 },
        NASDAQ: { upper: 22200, lower: 14000 },
      },
      reliability: 0.8,
    },
  },

  // ════════════════════════════════════════
  // INSTRUMENTS
  // ════════════════════════════════════════

  // US Equity Indices
  {
    category: "instrument",
    key: "SPX",
    data: {
      name: "S&P 500 Index",
      ticker: "SPX",
      description:
        "US large-cap benchmark. Coach tracks this as a primary market indicator. Key levels: 6800 (critical support/resistance), 6540 (next level), 5700 (first target in danger zone), 5000 (5k level).",
      type: "index",
      etf_proxy: "SPY",
      coach_key_levels: {
        critical_support: 6800,
        next_level: 6540,
        danger_zone_floor: 5700,
        round_level: 5000,
      },
      coach_note:
        "Coach: 'On the precipice of closing below 6800...this would mark a significant change in character and structure.' Has labeled 'DANGER ZONE' between ~5700 and 6800 on chart.",
    },
  },
  {
    category: "instrument",
    key: "DJI",
    data: {
      name: "Dow Jones Industrial Average",
      ticker: "DJI",
      description:
        "US blue-chip index. Coach identifies primary trendline breach as concerning. First target: 45k.",
      type: "index",
      etf_proxy: "DIA",
      coach_key_levels: {
        critical_support: "primary trendline",
        first_target: 45000,
      },
      coach_note:
        "Coach: 'The major breach of the primary trendline is concerning. If price does NOT recapture it ASAP, it risks heading straight toward the first real target: 45k. Stay vigilant — no room for hope here.'",
    },
  },
  {
    category: "instrument",
    key: "SOX",
    data: {
      name: "PHLX Semiconductor Index",
      ticker: "SOX",
      description:
        "Philadelphia Semiconductor Index. Coach identified a potential slanting head and shoulders pattern forming. Key level: critical support at the neckline.",
      type: "index",
      inverse_ticker: "SOXS",
      etf_proxy: "SOXX",
      coach_note:
        "Coach: 'Holding major support. A slanting head and shoulders pattern might be forming. The next few days will be telling.' Labels: Left Shoulder, Head, Right Shoulder, CRITICAL SUPPORT.",
    },
  },
  {
    category: "instrument",
    key: "NASDAQ",
    data: {
      name: "Nasdaq Composite Index",
      ticker: "IXIC",
      description:
        "US tech-heavy index. Coach tracks alongside SPX. Key levels: 22.2k (recent high), 14k (danger zone lower), 18k (midpoint/bounce zone).",
      type: "index",
      etf_proxy: "QQQ",
      coach_key_levels: {
        recent_high: 22200,
        danger_zone_upper: 22200,
        danger_zone_lower: 14000,
      },
      coach_note:
        "Part of 'danger zone' analysis. Coach shows Elliott Wave 1-2-3-4-5 count. 'DANGER ZONE' labeled on chart from ~14k to 22.2k.",
    },
  },

  // ETFs
  {
    category: "instrument",
    key: "MAGS",
    data: {
      name: "Roundhill Magnificent Seven ETF",
      ticker: "MAGS",
      description: "ETF tracking the Magnificent Seven mega-cap tech stocks.",
      type: "etf",
      underlying: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"],
    },
  },
  {
    category: "instrument",
    key: "SOXS",
    data: {
      name: "Direxion Semiconductor Bear 3x",
      ticker: "SOXS",
      description:
        "3x leveraged inverse ETF tracking the PHLX Semiconductor Index. Profits when semiconductors decline.",
      type: "inverse_etf",
      leverage: -3,
      inverse_of: "SOX",
    },
  },
  {
    category: "instrument",
    key: "QQQ",
    data: {
      name: "Invesco QQQ Trust",
      ticker: "QQQ",
      description: "ETF tracking the Nasdaq-100 Index.",
      type: "etf",
      inverse_ticker: "SQQQ",
    },
  },
  {
    category: "instrument",
    key: "SQQQ",
    data: {
      name: "ProShares UltraPro Short QQQ",
      ticker: "SQQQ",
      description:
        "3x leveraged inverse ETF tracking the Nasdaq-100. Profits when QQQ declines.",
      type: "inverse_etf",
      leverage: -3,
      inverse_of: "QQQ",
    },
  },
  {
    category: "instrument",
    key: "SPY",
    data: {
      name: "SPDR S&P 500 ETF",
      ticker: "SPY",
      description: "ETF tracking the S&P 500 Index.",
      type: "etf",
      inverse_ticker: "SH",
      leveraged_inverse_ticker: "SPXU",
    },
  },
  {
    category: "instrument",
    key: "XLF",
    data: {
      name: "Financial Select Sector SPDR ETF",
      ticker: "XLF",
      description:
        "ETF tracking US financial sector (banks, insurance, financials). Coach identified a rising wedge pattern that breached to the downside. Key level: 50.72 (critical support / wedge floor).",
      type: "etf",
      coach_key_levels: {
        critical_support: 50.72,
        confirmation_breach: "below 50.72",
        target: "base of rising wedge pattern (~$42)",
        target_percent: -14.89,
        target_points: -7.53,
      },
      coach_note:
        "Coach: 'The rising wedge has breach to the downside... below 50.50 and the base of the pattern comes into play. Next week or so will be telling.' Labels yellow ovals at previous accumulation zones.",
    },
  },
  {
    category: "instrument",
    key: "RUT",
    data: {
      name: "Russell 2000 Index",
      ticker: "RUT",
      description: "Small-cap US stock index.",
      type: "index",
      etf_proxy: "IWM",
    },
  },
  {
    category: "instrument",
    key: "IWM",
    data: {
      name: "iShares Russell 2000 ETF",
      ticker: "IWM",
      description: "ETF tracking the Russell 2000 small-cap index.",
      type: "etf",
      tracks: "RUT",
    },
  },

  // Volatility
  {
    category: "instrument",
    key: "VIX",
    data: {
      name: "CBOE Volatility Index",
      ticker: "VIX",
      description:
        "Fear gauge measuring expected 30-day volatility of the S&P 500. Inverse correlation with equities. Coach tracks VIX alongside UVIX.",
      type: "index",
      inverse_correlation: "SPY",
      coach_key_levels: {
        complacency_level: "low (labeled 'High complacency' when VIX is low)",
        significant_break: 28,
        note: "Above 28 AND VOLATILITY increases substantially",
      },
      coach_note:
        "Coach shows VIX rising from 'High complacency' label. Blue dashed line at 28: 'Above 28 AND VOLATILITY increases substantially.' Ascending channel forming.",
    },
  },
  {
    category: "instrument",
    key: "UVIX",
    data: {
      name: "2x Long VIX Futures ETF",
      ticker: "UVIX",
      description:
        "2x leveraged long VIX futures ETF. Profits when volatility rises. Coach tracks UVIX as a hedge/bearish market play. Key: if UVIX remains above its breakout level, probability of heading toward Sept 2025 highs increases dramatically.",
      type: "leveraged_etf",
      leverage: 2,
      tracks: "VIX_futures",
      coach_note:
        "Coach: 'Significant break. As long as price remains above the [breakout level], the probability of heading towards Sept 2025 highs increases dramatically.' Shows dashed blue line at previous resistance level.",
    },
  },

  // Commodities
  {
    category: "instrument",
    key: "GOLD",
    data: {
      name: "Gold (Spot)",
      ticker: "GOLD",
      tradingview_ticker: "XAUUSD",
      description:
        "Precious metal. Coach is cautiously bullish on gold within its ascending channel. Key levels: 5420 (recent high/resistance), ~5200 support (ascending channel top). ABC correction pattern in play.",
      type: "commodity",
      coach_key_levels: {
        recent_high: 5420,
        ascending_channel_support: "primary trendline",
      },
      coach_note:
        "Coach: 'Watch those channels closely — as yields rise and the dollar index catches a bid, they'll put short-term pressure on gold and silver. If the channel floors on both metals let go, the ABC correction activates, and primary trendlines will most likely come into play. At the moment, both channels are holding up. Stay vigilant.'",
    },
  },
  {
    category: "instrument",
    key: "SILVER",
    data: {
      name: "Silver (Spot)",
      ticker: "SILVER",
      tradingview_ticker: "XAGUSD",
      description:
        "Precious metal. Coach tracks alongside GOLD. Key levels: resistance (~110-120), r2 level, 91 target (in ABC b wave), 77.50, 62 (ABC c wave target). ABC correction in play.",
      type: "commodity",
      coach_key_levels: {
        resistance: "~110 (labeled 'resistance' with dashed line)",
        r2: "secondary resistance",
        b_wave_target: 91,
        support: 77.5,
        c_wave_target: 62,
      },
      coach_note:
        "Silver chart shows abc labeling with r2 resistance zone. Same ABC pattern as GOLD but silver more volatile.",
    },
  },
  {
    category: "instrument",
    key: "USOIL",
    data: {
      name: "WTI Crude Oil",
      ticker: "USOIL",
      tradingview_ticker: "USOIL",
      description:
        "West Texas Intermediate crude oil. Coach tracked a symmetrical triangle breakout. Key level: 76.50 (breakout entry). Bullish bias on oil.",
      type: "commodity",
      coach_key_levels: {
        triangle_entry: 76.5,
        projected_target: "8.85 (+11.62%) from entry",
      },
      coach_note:
        "Coach: 'Symmetrical triangle playing out to perfection. Those that took the trade — congratulations! Trailing stop is paramount now.' Numbers 1-5 on triangle legs. USOIL on 45-min timeframe.",
    },
  },

  // Crypto
  {
    category: "instrument",
    key: "BTCUSD",
    data: {
      name: "Bitcoin / US Dollar",
      ticker: "BTCUSD",
      description:
        "Bitcoin. Coach bearish — identified bear flag / bear channel consolidation. Watching for channel floor breach to confirm downside continuation.",
      type: "crypto",
      coach_note:
        "Coach: 'BTC still consolidating inside the bear flag. Structure intact = high-prob downside continuation coming soon, not too distant. Shorting and waiting for the channel floor breach? That could be wise...lets confirmation filter out fakeouts.' Chart on Pepperstone/daily timeframe.",
    },
  },

  // Bonds / Yields
  {
    category: "instrument",
    key: "EU10Y",
    data: {
      name: "Euro 10 Year Government Bond Yield",
      ticker: "EU10Y",
      description:
        "European 10-year bond yield. Coach shows this at multi-year resistance level — breakout would signal major yield surge. Coach says 'something ominous is coming.'",
      type: "yield",
      coach_key_levels: {
        major_resistance: "~3.0-3.2%",
      },
    },
  },
  {
    category: "instrument",
    key: "US30Y",
    data: {
      name: "US 30 Year Treasury Bond Yield",
      ticker: "US30Y",
      description:
        "US 30-year bond yield. Coach shows Elliott Wave 1-2-3-4 count within ascending channel. Wave 5 target: apex of ascending channel. Key level: 5.15.",
      type: "yield",
      coach_key_levels: {
        current_resistance: 5.15,
        wave_5_apex: "ascending channel apex",
      },
      coach_note:
        "Coach labels ascending channel with wave count 1-2-3-4, projects wave 5 to the apex. 'When patterns like this appear, you start to worry. Something ominous is coming.'",
    },
  },
  {
    category: "instrument",
    key: "TLT",
    data: {
      name: "iShares 20+ Year Treasury Bond ETF",
      ticker: "TLT",
      description:
        "ETF tracking long-duration US Treasury bonds. Inverse relationship with interest rates.",
      type: "etf",
    },
  },

  // Global Indices
  {
    category: "instrument",
    key: "DAX",
    data: {
      name: "DAX Index",
      ticker: "DAX",
      description:
        "German stock index. Coach identified textbook Wyckoff Distribution schematic playing out — called it 'the Mona Lisa of technical analysis.' Key level: 24300.",
      type: "index",
      coach_key_levels: {
        distribution_peak: 24300,
        distribution_labels: ["PSY", "BC", "UT", "UTAD", "AR", "ST", "SOW", "LPSY"],
      },
      coach_note:
        "Coach: 'The Mona Lisa of technical analysis. Wyckoff schematics playing out in textbook fashion.' Labels PSY, BC, UT, UTAD phases on chart. Embeds official Wyckoff Distribution Schematic #1 as reference inset.",
    },
  },

  // ════════════════════════════════════════
  // WYCKOFF TERMS
  // ════════════════════════════════════════

  {
    category: "term",
    key: "wyckoff_PSY",
    data: {
      abbreviation: "PSY",
      full_name: "Preliminary Supply",
      phase: "distribution",
      description:
        "First significant selling near the top. Volume increases. Warns of potential distribution.",
      direction_signal: "bearish",
    },
  },
  {
    category: "term",
    key: "wyckoff_BC",
    data: {
      abbreviation: "BC",
      full_name: "Buying Climax",
      phase: "distribution",
      description:
        "High-volume surge to new highs. Public buys at the top. Smart money sells into strength.",
      direction_signal: "bearish_reversal",
    },
  },
  {
    category: "term",
    key: "wyckoff_AR",
    data: {
      abbreviation: "AR",
      full_name: "Automatic Reaction",
      phase: "distribution",
      description:
        "Sharp decline after BC as buying dries up. Establishes the lower boundary of the trading range.",
      direction_signal: "bearish",
    },
  },
  {
    category: "term",
    key: "wyckoff_ST",
    data: {
      abbreviation: "ST",
      full_name: "Secondary Test",
      phase: "distribution",
      description:
        "Price revisits BC area on lower volume/spread — confirms resistance.",
      direction_signal: "neutral_confirmation",
    },
  },
  {
    category: "term",
    key: "wyckoff_SOW",
    data: {
      abbreviation: "SOW",
      full_name: "Sign of Weakness",
      phase: "distribution",
      description:
        "Price breaks below support on high volume. Confirms distribution is complete and markdown begins.",
      direction_signal: "bearish_confirmation",
    },
  },
  {
    category: "term",
    key: "wyckoff_LPSY",
    data: {
      abbreviation: "LPSY",
      full_name: "Last Point of Supply",
      phase: "distribution",
      description:
        "Final rally attempt that fails at or below resistance. Last chance to short before markdown accelerates. Weak rally, low volume.",
      direction_signal: "bearish_entry",
    },
  },
  {
    category: "term",
    key: "wyckoff_UTAD",
    data: {
      abbreviation: "UTAD",
      full_name: "Upthrust After Distribution",
      phase: "distribution",
      description:
        "Price briefly breaks above resistance (shakes out weak longs) then reverses sharply back into range.",
      direction_signal: "bearish_trap",
    },
  },
  {
    category: "term",
    key: "wyckoff_UT",
    data: {
      abbreviation: "UT",
      full_name: "Upthrust",
      phase: "distribution",
      description:
        "Price pushes above resistance then reverses — a failed breakout. Bearish signal within distribution.",
      direction_signal: "bearish",
    },
  },
  {
    category: "term",
    key: "wyckoff_PS",
    data: {
      abbreviation: "PS",
      full_name: "Preliminary Support",
      phase: "accumulation",
      description:
        "First buying interest after a decline. Early sign of potential support.",
      direction_signal: "bullish_early",
    },
  },
  {
    category: "term",
    key: "wyckoff_SC",
    data: {
      abbreviation: "SC",
      full_name: "Selling Climax",
      phase: "accumulation",
      description:
        "High-volume panic selling at the bottom. Smart money absorbs supply.",
      direction_signal: "bullish_reversal",
    },
  },
  {
    category: "term",
    key: "wyckoff_SOS",
    data: {
      abbreviation: "SOS",
      full_name: "Sign of Strength",
      phase: "accumulation",
      description:
        "Price rallies above resistance on high volume. Confirms accumulation is complete and markup begins.",
      direction_signal: "bullish_confirmation",
    },
  },
  {
    category: "term",
    key: "wyckoff_LPS",
    data: {
      abbreviation: "LPS",
      full_name: "Last Point of Support",
      phase: "accumulation",
      description:
        "Final pullback after SOS that holds above support. Last entry before markup.",
      direction_signal: "bullish_entry",
    },
  },
  {
    category: "term",
    key: "wyckoff_Spring",
    data: {
      abbreviation: "Spring",
      full_name: "Spring",
      phase: "accumulation",
      description:
        "Price briefly breaks below support (shakes out weak hands) then reverses sharply back into range. Bullish trap.",
      direction_signal: "bullish_trap_reversal",
    },
  },

  // ════════════════════════════════════════
  // CHART ELEMENTS
  // ════════════════════════════════════════

  {
    category: "chart_element",
    key: "horizontal_line",
    data: {
      name: "Horizontal Line",
      description: "Flat line marking a specific price level.",
      typical_meaning: ["support", "resistance", "price_target", "entry"],
      coach_style: "blue dashed for key levels; blue solid for minor levels",
    },
  },
  {
    category: "chart_element",
    key: "primary_trendline",
    data: {
      name: "Primary Trendline",
      description:
        "The main long-term diagonal support line connecting major swing lows. Coach explicitly labels this 'Primary trendline' in blue on charts. A breach of this line is a major bearish signal.",
      typical_meaning: ["trend_boundary", "primary_support"],
      coach_style: "blue diagonal solid line",
      coach_note:
        "Coach labels 'Primary trendline' on most index charts (SPX, DJI, GOLD, SILVER). Breach = significant change in character.",
    },
  },
  {
    category: "chart_element",
    key: "channel_lines",
    data: {
      name: "Channel Lines",
      description:
        "Two parallel diagonal lines forming a price channel (ascending, descending, or horizontal). Coach uses blue lines for channels.",
      typical_meaning: ["trend_boundary", "channel_wall", "target_on_breach"],
      coach_style: "blue solid diagonal lines",
      coach_note:
        "Ascending channels on GOLD and SILVER. Bear channel on BTC. Breaking a channel floor = target is the base of the channel.",
    },
  },
  {
    category: "chart_element",
    key: "trendline",
    data: {
      name: "Trendline",
      description:
        "Diagonal line connecting swing highs (resistance) or swing lows (support).",
      typical_meaning: ["trend_boundary", "channel_wall"],
      coach_style: "blue solid diagonal line",
    },
  },
  {
    category: "chart_element",
    key: "dashed_line",
    data: {
      name: "Dashed Line",
      description:
        "Dashed/dotted line marking projected or expected key levels. Used for resistance zones and target projections.",
      typical_meaning: ["projected_target", "expected_support", "resistance_zone"],
      coach_style: "blue dashed horizontal",
    },
  },
  {
    category: "chart_element",
    key: "red_text_annotation",
    data: {
      name: "Red Text Annotation",
      description:
        "Coach writes analysis directly on charts in red italic text. This is the primary way Coach communicates the trade thesis within the chart. Always read every word of red text.",
      typical_meaning: ["trade_thesis", "key_insight", "action_required"],
      coach_style: "red italic text block, usually in lower portion of chart",
      coach_note:
        "Examples: 'On the precipice of closing below 6800...this would mark a significant change in character.' / 'The major breach of the primary trendline is concerning.' / 'Symmetrical triangle playing out to perfection.'",
    },
  },
  {
    category: "chart_element",
    key: "blue_label",
    data: {
      name: "Blue Label / Blue Text",
      description:
        "Blue text labels on charts marking specific price levels or pattern components. Coach uses these for: 'Critical support', 'Apex', 'Breach', 'First target', 'Rising Wedge', 'Ascending channel', 'Primary trendline', 'Left Shoulder', 'Head', 'Right Shoulder', wave counts (1,2,3,4,5), abc labels.",
      typical_meaning: ["level_label", "pattern_label", "wave_count"],
      coach_style: "blue text/labels",
    },
  },
  {
    category: "chart_element",
    key: "target_box",
    data: {
      name: "TARGET Box",
      description:
        "A labeled box (light blue/gray bordered) explicitly marking 'TARGET' with the price level and % change. Appears on XLF chart showing downside target.",
      typical_meaning: ["price_target", "downside_objective"],
      coach_style: "light bordered box with 'TARGET' label and price + % annotation",
      coach_note: "XLF: TARGET -7.53 (-14.89%) -753",
    },
  },
  {
    category: "chart_element",
    key: "yellow_oval",
    data: {
      name: "Yellow/Tan Oval",
      description:
        "A yellow or tan oval/circle highlighting a significant price zone or key accumulation/distribution area on the chart.",
      typical_meaning: ["key_zone", "accumulation_zone", "notable_pattern_area"],
      coach_style: "yellow/tan filled oval, semi-transparent",
      coach_note: "Visible on XLF chart highlighting previous consolidation zones.",
    },
  },
  {
    category: "chart_element",
    key: "pink_danger_zone_box",
    data: {
      name: "Pink/Salmon Danger Zone Box",
      description:
        "A pink/salmon highlighted rectangle explicitly labeled 'DANGER ZONE'. Marks a price range where sell-off probability is dramatically elevated.",
      typical_meaning: ["high_risk_zone", "bearish_target_zone"],
      coach_style: "pink/salmon semi-transparent filled rectangle with 'DANGER ZONE' text",
      coach_note: "Visible on SPX and NASDAQ charts. Contains price levels at top, middle, and bottom of zone.",
    },
  },
  {
    category: "chart_element",
    key: "dashed_projection_arrow",
    data: {
      name: "Dashed Projection Arrow",
      description:
        "Dashed diagonal line with arrowhead showing projected future price direction. Coach uses these to show expected price paths.",
      typical_meaning: ["projected_price_path", "expected_direction"],
      coach_style: "dashed line with arrow — upward (bullish) or downward (bearish)",
    },
  },
  {
    category: "chart_element",
    key: "inset_diagram",
    data: {
      name: "Inset Diagram / Schematic Reference",
      description:
        "Small reference chart or schematic embedded within the main chart. Coach uses the official Wyckoff Distribution Schematic #1 as an inset when a Wyckoff distribution is playing out on the main chart.",
      typical_meaning: ["pattern_reference", "wyckoff_schematic_comparison"],
      coach_note:
        "When you see a small box within the chart containing phase labels (BC, UT, UTAD, SOW, LPSY) — that's the Wyckoff Distribution Schematic #1 reference. Coach places it to show the current setup matches the classic schematic.",
    },
  },
  {
    category: "chart_element",
    key: "gap",
    data: {
      name: "Price Gap",
      description:
        "Unfilled price gap between sessions. Coach labels these 'GAPS' on SPX and NASDAQ charts — they act as support/resistance and potential fill targets.",
      typical_meaning: ["fill_target", "support", "resistance"],
      coach_note: "SPX chart shows 'GAPS' label with small rectangles marking gap zones.",
    },
  },
  {
    category: "chart_element",
    key: "elliott_wave_count",
    data: {
      name: "Elliott Wave Count (1-2-3-4-5)",
      description:
        "Numbers 1-5 on the chart marking Elliott Wave impulse legs. Coach uses these on triangles (USOIL: 1,2,3,4,5), index waves (NASDAQ: 1,2,3,4,5), and bond yields (US30Y: 1,2,3,4).",
      typical_meaning: ["wave_sequence", "pattern_completion", "next_leg_projection"],
      coach_note:
        "On triangles: numbers mark the converging legs. On uptrends: 1-5 marks the impulse wave count. After wave 5, expect completion/reversal or correction.",
    },
  },
  {
    category: "chart_element",
    key: "abc_wave_labels",
    data: {
      name: "ABC Corrective Wave Labels (a, b, c)",
      description:
        "Lowercase a, b, c labels marking Elliott Wave corrective sequences. Visible on GOLD and SILVER charts. 'c' is typically the final leg completing the correction.",
      typical_meaning: ["correction_progress", "abc_wave_position"],
      coach_note:
        "On GOLD: large 'c' label projected at the bottom right (future ABC c-wave target). On SILVER: similar with r2 resistance and b wave labels. ABC correction is invalidated if price breaks above the ascending channel.",
    },
  },

  // ════════════════════════════════════════
  // RELATIONSHIPS
  // ════════════════════════════════════════

  {
    category: "relationship",
    key: "SOX_SOXS_inverse",
    data: {
      type: "inverse",
      asset_a: "SOX",
      asset_b: "SOXS",
      description:
        "SOXS is a 3x leveraged inverse of the SOX semiconductor index. When SOX drops, SOXS rises ~3x.",
      coach_note:
        "Coach tracks SOX bearish setups (H&S forming). Bearish SOX = long SOXS trade.",
    },
  },
  {
    category: "relationship",
    key: "QQQ_SQQQ_inverse",
    data: {
      type: "inverse",
      asset_a: "QQQ",
      asset_b: "SQQQ",
      description:
        "SQQQ is a 3x leveraged inverse of QQQ (Nasdaq-100). When QQQ drops, SQQQ rises ~3x.",
      coach_note:
        "NASDAQ in danger zone = potential SQQQ long.",
    },
  },
  {
    category: "relationship",
    key: "SPY_VIX_inverse_correlation",
    data: {
      type: "inverse_correlation",
      asset_a: "SPY",
      asset_b: "VIX",
      description:
        "VIX (fear index) typically spikes when SPY/SPX declines. Inverse correlation ~0.7 to 0.85.",
      coach_note:
        "Coach tracks VIX and UVIX as bearish market confirmation. VIX breaking above 28 = substantial volatility increase.",
    },
  },
  {
    category: "relationship",
    key: "VIX_UVIX_leveraged",
    data: {
      type: "leveraged_proxy",
      asset_a: "VIX",
      asset_b: "UVIX",
      description:
        "UVIX is a 2x long VIX futures ETF. When VIX rises, UVIX rises ~2x.",
      coach_note:
        "Coach shows UVIX breaking above resistance with a large upward arrow. Bullish UVIX = bearish market outlook. UVIX breakout above prior level = probability of going to Sept 2025 highs increases dramatically.",
    },
  },
  {
    category: "relationship",
    key: "GOLD_SILVER_correlation",
    data: {
      type: "positive_correlation",
      asset_a: "GOLD",
      asset_b: "SILVER",
      description:
        "Gold and silver move together. Coach always covers them as a pair ('GOLD and SILVER'). Both have ABC corrections and ascending channels.",
      coach_note:
        "Coach publishes GOLD and SILVER as a single numbered post (e.g., '1. GOLD and SILVER', '8. GOLD and SILVER'). Same thesis applies to both, silver is more volatile.",
    },
  },
  {
    category: "relationship",
    key: "yields_gold_pressure",
    data: {
      type: "inverse_pressure",
      asset_a: "US10Y_yields",
      asset_b: "GOLD",
      description:
        "Rising yields and a stronger dollar put downward pressure on precious metals.",
      coach_note:
        "Coach: 'Watch those channels closely — as yields rise and the dollar index catches a bid, they'll put short-term pressure on gold and silver.'",
    },
  },
  {
    category: "relationship",
    key: "DXY_commodities_pressure",
    data: {
      type: "inverse_pressure",
      asset_a: "DXY",
      asset_b: "GOLD",
      description:
        "Stronger US dollar (DXY rising) puts pressure on gold and silver prices.",
      coach_note:
        "Coach: 'As the dollar index catches a bid, they'll put short-term pressure on gold and silver.'",
    },
  },
];

async function main() {
  console.log("Seeding Knowledge Base...");

  for (const entry of entries) {
    await prisma.knowledgeEntry.upsert({
      where: { key: entry.key },
      update: { data: entry.data as any, validated: false },
      create: {
        category: entry.category,
        key: entry.key,
        data: entry.data as any,
        source: "seed",
        validated: false,
      },
    });
  }

  console.log(`✅ Knowledge Base seeded: ${entries.length} entries upserted`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
