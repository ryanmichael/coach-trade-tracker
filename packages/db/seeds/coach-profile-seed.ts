import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:password@localhost:5432/coach_trade_tracker";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as any);

/**
 * Coach Profile seed — The Great Martis (@great_martis)
 *
 * Derived from direct observation of real posts (docs/training-coach-x-posts/).
 * All entries are source: "manual" with high confidence where observed directly.
 */
const profileEntries = [
  // ── Chart Platform & Style ──
  {
    key: "chart.platform",
    value: "TradingView",
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },
  // Primary diagonal lines (trendlines, channel walls) are BLUE
  {
    key: "chart.primary_line_color",
    value: "blue",
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },
  // Coach's written analysis text blocks on charts are RED italic
  {
    key: "chart.annotation_color",
    value: "red",
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },
  // Level labels (Critical support, Apex, First target, Breach) are BLUE
  {
    key: "chart.label_color",
    value: "blue",
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },
  // Key price zones highlighted with yellow/tan ovals
  {
    key: "chart.key_zone_style",
    value: "yellow_oval",
    source: "manual",
    confidence: 0.9,
    observationCount: 3,
  },
  // Danger zones use a pink/salmon highlighted box
  {
    key: "chart.danger_zone_style",
    value: "pink_highlighted_box",
    source: "manual",
    confidence: 0.9,
    observationCount: 2,
  },
  // Price target boxes use a light blue/gray bordered box with label "TARGET"
  {
    key: "chart.target_box_style",
    value: "light_blue_bordered_box",
    source: "manual",
    confidence: 0.9,
    observationCount: 2,
  },
  // Projected price movement shown with dashed diagonal projection lines
  {
    key: "chart.target_indicator",
    value: "dashed_projection_lines",
    source: "manual",
    confidence: 0.95,
    observationCount: 5,
  },
  // Support/resistance horizontal levels shown as blue dashed lines
  {
    key: "chart.support_resistance_style",
    value: "blue_dashed",
    source: "manual",
    confidence: 1.0,
    observationCount: 8,
  },
  // Uses Elliott Wave numbers 1-2-3-4-5 on charts (USOIL symmetrical triangle, NASDAQ)
  {
    key: "chart.uses_elliott_wave",
    value: true,
    source: "manual",
    confidence: 0.95,
    observationCount: 4,
  },
  // Uses ABC corrective wave labels (a, b, c) — visible on GOLD and SILVER charts
  {
    key: "chart.uses_abc_correction",
    value: true,
    source: "manual",
    confidence: 1.0,
    observationCount: 4,
  },
  // Embeds Wyckoff Distribution Schematic #1 as reference inset diagram
  {
    key: "chart.uses_wyckoff_inset",
    value: true,
    source: "manual",
    confidence: 1.0,
    observationCount: 2,
  },
  // TradingView chart background: light/cream for most, dark for crypto
  {
    key: "chart.background_style",
    value: "light_cream",
    source: "manual",
    confidence: 0.85,
    observationCount: 7,
  },
  // TradingView watermark text confirms identity: "great_martis created with TradingView.com"
  {
    key: "chart.watermark_text",
    value: "great_martis created with TradingView.com",
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },

  // ── Posting Style ──
  // Posts analysis in numbered series: "1. GOLD and SILVER", "2.", "3. SPX", etc.
  {
    key: "style.post_numbering",
    value: true,
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },
  // Charts are primary signal — text is brief context or analysis annotation on chart
  {
    key: "style.chart_primary",
    value: true,
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },
  // Signs posts: "Yours truly, The Great Martis." or "The Great Martis ✨"
  {
    key: "style.sign_off",
    value: "Yours truly, The Great Martis",
    source: "manual",
    confidence: 1.0,
    observationCount: 5,
  },
  // Recurring closing phrase used in analysis posts
  {
    key: "style.recurring_phrase",
    value: "Stay vigilant",
    source: "manual",
    confidence: 1.0,
    observationCount: 8,
  },
  // Publishes periodic text-heavy "Market Pulse Update" macroeconomic commentary posts
  {
    key: "style.market_pulse_updates",
    value: true,
    source: "manual",
    confidence: 1.0,
    observationCount: 3,
  },
  // Posts multi-asset subscriber analysis sessions covering 8-10 instruments at once
  {
    key: "style.multi_asset_sessions",
    value: true,
    source: "manual",
    confidence: 1.0,
    observationCount: 5,
  },
  // Writing tone: eloquent, confident, slightly theatrical ("Mona Lisa of technical analysis")
  {
    key: "style.tone",
    value: "eloquent_confident",
    source: "manual",
    confidence: 0.9,
    observationCount: 5,
  },

  // ── Methodology ──
  {
    key: "methodology.primary",
    value: "wyckoff",
    source: "manual",
    confidence: 1.0,
    observationCount: 8,
  },
  // Also uses Elliott Wave theory for wave counts (1-5 impulse + ABC corrections)
  {
    key: "methodology.secondary",
    value: "elliott_wave",
    source: "manual",
    confidence: 0.95,
    observationCount: 5,
  },
  // Uses classical technical analysis patterns (rising wedge, H&S, triangles, channels)
  {
    key: "methodology.tertiary",
    value: "classical_ta",
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },
  // Recommended book: Technical Analysis of Stock Trends (Edwards & Magee, 7th Edition)
  {
    key: "methodology.reference_book",
    value: "Technical Analysis of Stock Trends — Robert D. Edwards and John Magee, 7th Edition",
    source: "manual",
    confidence: 1.0,
    observationCount: 1,
  },

  // ── Directional Bias ──
  // Currently bearish on most equity indices
  {
    key: "bias.current",
    value: "bearish",
    source: "manual",
    confidence: 0.95,
    observationCount: 8,
  },
  // Bullish on precious metals (within ascending channels) and volatility instruments
  {
    key: "bias.exceptions",
    value: ["GOLD", "SILVER", "USOIL", "UVIX", "VIX"],
    source: "manual",
    confidence: 0.9,
    observationCount: 5,
  },
  // Covers: major US indices, commodities, crypto, bonds, volatility, global indices
  {
    key: "bias.instruments_covered",
    value: [
      "SPX", "DJI", "SOX", "QQQ", "NASDAQ",
      "GOLD", "SILVER", "USOIL",
      "BTCUSD",
      "VIX", "UVIX",
      "XLF",
      "DAX",
      "EU10Y", "US30Y",
      "RUT"
    ],
    source: "manual",
    confidence: 1.0,
    observationCount: 10,
  },
  // Bearish market plays via volatility ETFs (UVIX) rather than inverse equity ETFs
  {
    key: "bias.preferred_instruments",
    value: ["volatility_etfs", "commodities", "inverse_etfs"],
    source: "manual",
    confidence: 0.9,
    observationCount: 5,
  },

  // ── Terminology — Wyckoff (standard terms, uppercase) ──
  { key: "terminology.PSY", value: "Preliminary Supply", source: "manual", confidence: 1.0, observationCount: 3 },
  { key: "terminology.BC", value: "Buying Climax", source: "manual", confidence: 1.0, observationCount: 3 },
  { key: "terminology.AR", value: "Automatic Reaction", source: "manual", confidence: 1.0, observationCount: 3 },
  { key: "terminology.ST", value: "Secondary Test", source: "manual", confidence: 1.0, observationCount: 3 },
  { key: "terminology.SOW", value: "Sign of Weakness", source: "manual", confidence: 1.0, observationCount: 5 },
  { key: "terminology.LPSY", value: "Last Point of Supply", source: "manual", confidence: 1.0, observationCount: 5 },
  { key: "terminology.UTAD", value: "Upthrust After Distribution", source: "manual", confidence: 1.0, observationCount: 3 },
  { key: "terminology.UT", value: "Upthrust", source: "manual", confidence: 1.0, observationCount: 3 },
  { key: "terminology.PS", value: "Preliminary Support", source: "manual", confidence: 1.0, observationCount: 2 },
  { key: "terminology.SC", value: "Selling Climax", source: "manual", confidence: 1.0, observationCount: 2 },
  { key: "terminology.SOS", value: "Sign of Strength", source: "manual", confidence: 1.0, observationCount: 2 },
  { key: "terminology.LPS", value: "Last Point of Support", source: "manual", confidence: 1.0, observationCount: 2 },
  { key: "terminology.Spring", value: "Spring (bullish trap — price dips below support then reverses)", source: "manual", confidence: 1.0, observationCount: 2 },

  // ── Terminology — Coach-specific phrases ──
  {
    key: "terminology.critical_support",
    value: "A key support level that, if broken, signals a significant change in market structure",
    source: "manual",
    confidence: 1.0,
    observationCount: 6,
  },
  {
    key: "terminology.primary_trendline",
    value: "The main long-term diagonal support line connecting major swing lows",
    source: "manual",
    confidence: 1.0,
    observationCount: 5,
  },
  {
    key: "terminology.breach",
    value: "Price breaking below a critical support level — confirms breakdown and starts downward leg",
    source: "manual",
    confidence: 1.0,
    observationCount: 6,
  },
  {
    key: "terminology.first_target",
    value: "Initial downside price target after a breach — typically a previous major support or gap level",
    source: "manual",
    confidence: 1.0,
    observationCount: 4,
  },
  {
    key: "terminology.danger_zone",
    value: "A highlighted price range (pink box) where the probability of a severe sell-off (30-40% drawdown) rises dramatically. Midpoint acts as brief bounce magnet before decline resumes.",
    source: "manual",
    confidence: 1.0,
    observationCount: 2,
  },
  {
    key: "terminology.change_in_character",
    value: "Wyckoff-derived: a shift in price behavior (e.g., closing below key support) that signals a trend change — used for SPX at 6800",
    source: "manual",
    confidence: 1.0,
    observationCount: 2,
  },
  {
    key: "terminology.backtest",
    value: "Price returning to test a recently broken level from below — confirms the break. Example: SPX backtesting 6800 after breach",
    source: "manual",
    confidence: 1.0,
    observationCount: 2,
  },
  {
    key: "terminology.apex",
    value: "The top convergence point of a wedge or triangle pattern — price approaches here before breakout or breakdown",
    source: "manual",
    confidence: 1.0,
    observationCount: 3,
  },
  {
    key: "terminology.ABC",
    value: "Elliott Wave corrective pattern: Wave A (initial correction), Wave B (counter-move), Wave C (final leg completing the correction)",
    source: "manual",
    confidence: 1.0,
    observationCount: 3,
  },
  {
    key: "terminology.GAPS",
    value: "Unfilled price gaps from previous sessions — labeled on charts as potential support/resistance and fill targets",
    source: "manual",
    confidence: 1.0,
    observationCount: 2,
  },
  {
    key: "terminology.high_complacency",
    value: "VIX at abnormally low levels — signals the market is underestimating risk; typically precedes volatility spikes",
    source: "manual",
    confidence: 1.0,
    observationCount: 1,
  },
  {
    key: "terminology.trailing_stop",
    value: "Stop loss that moves with price — mentioned after a pattern plays out (e.g., USOIL symmetrical triangle): 'trailing stop is paramount now'",
    source: "manual",
    confidence: 1.0,
    observationCount: 1,
  },
  {
    key: "terminology.stay_vigilant",
    value: "Coach's recurring closing phrase — means: remain alert and disciplined, don't let down your guard",
    source: "manual",
    confidence: 1.0,
    observationCount: 8,
  },
  {
    key: "terminology.remain_vigilant",
    value: "Variant of 'Stay vigilant' — same meaning",
    source: "manual",
    confidence: 1.0,
    observationCount: 3,
  },
];

async function main() {
  console.log("Seeding Coach Profile — The Great Martis (@great_martis)...");

  for (const entry of profileEntries) {
    await prisma.coachProfile.upsert({
      where: { key: entry.key },
      update: {
        value: entry.value as any,
        source: entry.source,
        confidence: entry.confidence,
        observationCount: entry.observationCount ?? 1,
      },
      create: {
        key: entry.key,
        value: entry.value as any,
        source: entry.source,
        confidence: entry.confidence,
        observationCount: entry.observationCount ?? 1,
      },
    });
  }

  console.log(`✅ Coach Profile seeded: ${profileEntries.length} entries upserted`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
