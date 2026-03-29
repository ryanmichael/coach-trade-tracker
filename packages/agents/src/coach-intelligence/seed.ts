/**
 * Coach Intelligence Bootstrap Seed
 *
 * Seeds CoachProfile and KnowledgeEntry tables with observed attributes of
 * the coach (@great_martis). Run once via POST /api/coach/profile/seed.
 * All writes are upserts — safe to re-run.
 */

import type { PrismaClient } from "@repo/db";
import { updateProfile } from "./coach-profile";
import { addEntry } from "./knowledge-base";

export async function seedCoachIntelligence(db: PrismaClient): Promise<{
  profileEntries: number;
  knowledgeEntries: number;
}> {
  // ── 1. Coach Profile ──────────────────────────────────────────────────────

  const profileSeeds: Array<[string, unknown]> = [
    // Directional bias
    ["bias.current", "bearish"],
    ["bias.preferred_instruments", ["inverse_etfs"]],

    // Chart style (TradingView, red annotations)
    ["chart.platform", "TradingView"],
    ["chart.annotation_color", "red"],
    ["chart.support_resistance_style", "blue_dashed"],
    ["chart.target_indicator", "red_arrows"],

    // Methodology
    ["methodology.primary", "wyckoff"],

    // Posting style
    ["style.chart_primary", true],   // charts are the primary signal
    ["style.post_numbering", true],  // coach numbers series: "1/", "2/", "3/"

    // Wyckoff terminology mappings (abbreviation → full name + meaning)
    ["terminology.PSY",    "Preliminary Supply — initial selling after an extended uptrend; volume increases"],
    ["terminology.BC",     "Buying Climax — high-volume surge to new highs; smart money sells into strength"],
    ["terminology.AR",     "Automatic Reaction — sharp decline after BC; marks lower boundary of distribution range"],
    ["terminology.ST",     "Secondary Test — price rallies back to BC area on low volume; confirms supply"],
    ["terminology.SOW",    "Sign of Weakness — break below support on high volume; confirms markdown is beginning"],
    ["terminology.LPSY",   "Last Point of Supply — weak, low-volume rally near the top; final short entry before markdown"],
    ["terminology.UTAD",   "Upthrust After Distribution — spike above resistance that quickly reverses; confirms distribution is complete"],
    ["terminology.UT",     "Upthrust — price temporarily breaks above resistance then falls back; bearish trap for late longs"],
    ["terminology.PS",     "Preliminary Support — initial buying after an extended downtrend"],
    ["terminology.SC",     "Selling Climax — panic selling at new lows on very high volume; smart money accumulates"],
    ["terminology.SOS",    "Sign of Strength — rally on increasing volume after spring; confirms accumulation"],
    ["terminology.LPS",    "Last Point of Support — pullback after SOS on low volume; final long entry before markup"],
    ["terminology.Spring", "Spring — dip below support that quickly reverses back above; bullish trap for late shorts"],
    ["terminology.PT",     "Price Target"],
    ["terminology.SL",     "Stop Loss"],
    ["terminology.SOX",    "PHLX Semiconductor Index — frequently discussed in bearish distribution context"],
  ];

  for (const [key, value] of profileSeeds) {
    await updateProfile(db, key, value, "manual");
  }

  // ── 2. Knowledge Base — Wyckoff Terms ────────────────────────────────────

  const wyckoffTerms = [
    { key: "wyckoff.PSY",    abbreviation: "PSY",    full_name: "Preliminary Supply",              phase: "distribution", bearish: true,  description: "Initial selling after an extended uptrend; volume increases, marks start of distribution" },
    { key: "wyckoff.BC",     abbreviation: "BC",     full_name: "Buying Climax",                   phase: "distribution", bearish: true,  description: "High-volume surge to new highs; smart money sells into retail strength" },
    { key: "wyckoff.AR",     abbreviation: "AR",     full_name: "Automatic Reaction",              phase: "distribution", bearish: true,  description: "Sharp decline after BC; establishes lower boundary of distribution range" },
    { key: "wyckoff.ST",     abbreviation: "ST",     full_name: "Secondary Test",                  phase: "distribution", bearish: true,  description: "Rally back to BC area on low volume; confirms supply is overwhelming demand" },
    { key: "wyckoff.SOW",    abbreviation: "SOW",    full_name: "Sign of Weakness",                phase: "distribution", bearish: true,  description: "Break below support/AR on high volume; markdown phase beginning" },
    { key: "wyckoff.LPSY",   abbreviation: "LPSY",   full_name: "Last Point of Supply",            phase: "distribution", bearish: true,  description: "Weak low-volume rally near distribution top; final short entry before markdown" },
    { key: "wyckoff.UTAD",   abbreviation: "UTAD",   full_name: "Upthrust After Distribution",     phase: "distribution", bearish: true,  description: "Spike above resistance that quickly reverses; distribution is complete, markdown imminent" },
    { key: "wyckoff.UT",     abbreviation: "UT",     full_name: "Upthrust",                        phase: "distribution", bearish: true,  description: "Price temporarily breaks above resistance then fails; bearish trap" },
    { key: "wyckoff.PS",     abbreviation: "PS",     full_name: "Preliminary Support",             phase: "accumulation", bearish: false, description: "Initial buying after extended downtrend; slows the decline" },
    { key: "wyckoff.SC",     abbreviation: "SC",     full_name: "Selling Climax",                  phase: "accumulation", bearish: false, description: "Panic selling at new lows on very high volume; smart money accumulates" },
    { key: "wyckoff.SOS",    abbreviation: "SOS",    full_name: "Sign of Strength",                phase: "accumulation", bearish: false, description: "Rally on increasing volume after spring; confirms accumulation is complete" },
    { key: "wyckoff.LPS",    abbreviation: "LPS",    full_name: "Last Point of Support",           phase: "accumulation", bearish: false, description: "Pullback after SOS on low volume; final long entry before markup" },
    { key: "wyckoff.Spring", abbreviation: "Spring", full_name: "Spring",                          phase: "accumulation", bearish: false, description: "Brief dip below support that quickly reverses; bullish trap for late shorts" },
  ];

  for (const term of wyckoffTerms) {
    await addEntry(db, "term", term.key, term, "seed");
  }

  // ── 3. Knowledge Base — Instruments ──────────────────────────────────────

  const instruments = [
    { key: "MAGS",  ticker: "MAGS",  name: "Roundhill Magnificent 7 ETF",             type: "etf",   description: "Tracks the Magnificent 7 mega-cap tech stocks" },
    { key: "SOX",   ticker: "SOX",   name: "PHLX Semiconductor Index",                type: "index", description: "Philadelphia Semiconductor Index; frequently discussed by Coach in bearish context", inverse_ticker: "SOXS" },
    { key: "SOXS",  ticker: "SOXS",  name: "Direxion Daily Semiconductor Bear 3x ETF", type: "etf",   description: "3x inverse leveraged ETF for SOX; Coach's preferred vehicle for bearish semiconductor setups", inverse_of: "SOX" },
    { key: "QQQ",   ticker: "QQQ",   name: "Invesco Nasdaq-100 ETF",                  type: "etf",   description: "Tracks Nasdaq-100; large-cap tech benchmark", inverse_ticker: "SQQQ" },
    { key: "SQQQ",  ticker: "SQQQ",  name: "ProShares UltraPro Short QQQ",            type: "etf",   description: "3x inverse leveraged ETF for QQQ", inverse_of: "QQQ" },
    { key: "SPY",   ticker: "SPY",   name: "SPDR S&P 500 ETF",                        type: "etf",   description: "Tracks the S&P 500" },
    { key: "RUT",   ticker: "RUT",   name: "Russell 2000 Index",                      type: "index", description: "Small-cap benchmark; often discussed for broad market direction" },
    { key: "IWM",   ticker: "IWM",   name: "iShares Russell 2000 ETF",                type: "etf",   description: "Tracks the Russell 2000 small-cap index" },
    { key: "VIX",   ticker: "VIX",   name: "CBOE Volatility Index",                   type: "index", description: "Market fear gauge; rising VIX signals market stress" },
    { key: "TLT",   ticker: "TLT",   name: "iShares 20+ Year Treasury Bond ETF",      type: "etf",   description: "Long-duration Treasury bonds; inverse relationship with yields" },
  ];

  for (const inst of instruments) {
    await addEntry(db, "instrument", inst.key, inst, "seed");
  }

  // ── 4. Knowledge Base — Inverse Relationships ─────────────────────────────

  const relationships = [
    {
      key: "rel.SOX.SOXS",
      type: "inverse", asset_a: "SOX", asset_b: "SOXS",
      description: "SOXS is the 3x inverse ETF for the SOX semiconductor index",
      coach_note: "Coach uses SOXS as the vehicle for bearish semiconductor trades instead of shorting SOX directly",
      leverage: 3,
    },
    {
      key: "rel.QQQ.SQQQ",
      type: "inverse", asset_a: "QQQ", asset_b: "SQQQ",
      description: "SQQQ is the 3x inverse ETF for QQQ (Nasdaq-100)",
      leverage: 3,
    },
  ];

  for (const rel of relationships) {
    await addEntry(db, "relationship", rel.key, rel, "seed");
  }

  // ── 5. Knowledge Base — Chart Elements ───────────────────────────────────

  const chartElements = [
    { key: "chart_el.horizontal_line", name: "horizontal_line",  description: "Drawn horizontal line at a specific price",        typical_meaning: ["support", "resistance", "target", "entry"] },
    { key: "chart_el.trendline",       name: "trendline",        description: "Diagonal line connecting price highs or lows",     typical_meaning: ["channel boundary", "breakout trigger"] },
    { key: "chart_el.dashed_line",     name: "dashed_line",      description: "Dashed horizontal or diagonal line",               typical_meaning: ["projected level", "target zone", "key support/resistance"] },
    { key: "chart_el.arrow",           name: "arrow",            description: "Directional arrow drawn on chart",                 typical_meaning: ["projected direction", "target price", "entry point"] },
    { key: "chart_el.circle_oval",     name: "circle_oval",      description: "Circle or oval highlighting a price area",         typical_meaning: ["significant zone", "pattern completion", "attention area"] },
    { key: "chart_el.inset_diagram",   name: "inset_diagram",    description: "Small reference chart embedded inside the main chart", typical_meaning: ["Wyckoff phase comparison", "pattern reference"] },
    { key: "chart_el.gap",             name: "gap",              description: "Price gap between candles with no trading",        typical_meaning: ["breakaway gap", "runaway gap", "exhaustion gap"] },
    { key: "chart_el.text_annotation", name: "text_annotation",  description: "Coach's handwritten or typed text on the chart",  typical_meaning: ["price label", "phase label", "instruction"] },
  ];

  for (const el of chartElements) {
    await addEntry(db, "chart_element", el.key, el, "seed");
  }

  // ── 6. Knowledge Base — Patterns ─────────────────────────────────────────

  const patterns = [
    { key: "pattern.wyckoff_distribution",   name: "Wyckoff Distribution",        direction: "bearish", reliability: 0.8, description: "Multi-phase topping structure: PSY→BC→AR→ST→SOW→LPSY→markdown" },
    { key: "pattern.wyckoff_accumulation",   name: "Wyckoff Accumulation",        direction: "bullish", reliability: 0.8, description: "Multi-phase bottoming structure: PS→SC→AR→ST→Spring→SOS→LPS→markup" },
    { key: "pattern.ascending_broadening",   name: "Ascending Broadening Pattern", direction: "bearish", reliability: 0.7, description: "Price makes higher highs and lower lows with expanding range; often precedes reversal" },
    { key: "pattern.head_and_shoulders",     name: "Head and Shoulders",           direction: "bearish", reliability: 0.75, description: "Three peaks with middle peak highest; neckline break confirms reversal" },
    { key: "pattern.double_top",             name: "Double Top",                   direction: "bearish", reliability: 0.7, description: "Two peaks at similar price level; confirms reversal on break below neckline" },
    { key: "pattern.double_bottom",          name: "Double Bottom",                direction: "bullish", reliability: 0.7, description: "Two troughs at similar price level; confirms reversal on break above neckline" },
    { key: "pattern.bull_flag",              name: "Bull Flag",                    direction: "bullish", reliability: 0.72, description: "Sharp rally followed by tight consolidation in a downward-sloping channel; continuation pattern" },
    { key: "pattern.bear_flag",              name: "Bear Flag",                    direction: "bearish", reliability: 0.72, description: "Sharp decline followed by tight consolidation in an upward-sloping channel; continuation pattern" },
    { key: "pattern.ascending_triangle",     name: "Ascending Triangle",           direction: "bullish", reliability: 0.68, description: "Flat resistance top with rising support; bullish breakout expected" },
    { key: "pattern.descending_triangle",    name: "Descending Triangle",          direction: "bearish", reliability: 0.68, description: "Flat support bottom with declining resistance; bearish breakdown expected" },
    { key: "pattern.symmetrical_triangle",   name: "Symmetrical Triangle",         direction: "neutral", reliability: 0.65, description: "Converging trendlines with no directional bias; breakout direction determines setup" },
    { key: "pattern.cup_and_handle",         name: "Cup and Handle",               direction: "bullish", reliability: 0.7, description: "U-shaped base followed by small pullback; bullish continuation" },
    { key: "pattern.rising_channel",         name: "Rising Channel",               direction: "neutral", reliability: 0.6, description: "Price trending up within parallel trendlines; watch for breakdown if support is critical" },
  ];

  for (const p of patterns) {
    await addEntry(db, "pattern", p.key, p, "seed");
  }

  // ── 7. Knowledge Base — Few-Shot Text Parse Examples ─────────────────────

  const textExamples = [
    {
      key: "example.text.wyckoff_distribution_full",
      type: "text_parse",
      post: "13. Magnificent 7 — MAGS showing Wyckoff Distribution Schematics. Currently in LPSY phase around $63. SOW in phase B confirmed. Gap fill target around $48-49. Significant downside projected once distribution completes.",
      expected: { ticker: "MAGS", direction: "short", priceTargetLow: 48, priceTargetHigh: 49, priceConfirmation: 63, confidence: 0.9 },
      reasoning: "LPSY = Last Point of Supply (bearish). SOW confirmed = Sign of Weakness, breakdown imminent. '$48-49' is the gap fill target below current price. '$63' is the LPSY level = confirmation/entry for short.",
    },
    {
      key: "example.text.wyckoff_sow_breakdown",
      type: "text_parse",
      post: "15. Semiconductor index — The semiconductor index (SOX) has topped. Ascending broadening pattern. Expect erratic behaviour/chop before it lets go...substantial downside exists once momentum picks up. Vigilance required. Target 3500.",
      expected: { ticker: "SOX", direction: "short", priceTargetHigh: 3500, confidence: 0.8 },
      reasoning: "Ascending broadening pattern = bearish reversal structure. 'Has topped' + 'substantial downside' = short setup. Target 3500 is well below current price. No explicit confirmation level given — derive from chart or leave null.",
    },
    {
      key: "example.text.inverse_etf_play",
      type: "text_parse",
      post: "15. Semiconductor index — As the semis let go THE SOXS will OBVIOUSLY MOVE MUCH Higher. Downtrend has been breached... all that is needed is momentum to pick up.",
      expected: { ticker: "SOXS", direction: "long", confidence: 0.75 },
      reasoning: "SOXS is a 3x inverse ETF for SOX. 'Will move much higher' + 'long' on an inverse ETF = Coach is bearish on semis, expressing it via SOXS long. Do NOT flip direction because SOXS is inverse — Coach is explicitly calling SOXS long.",
    },
    {
      key: "example.text.russell_trendline_watch",
      type: "text_parse",
      post: "14. Russell 2000 — As long as the trendline holds, it's safe. Otherwise, a breach changes the dynamics significantly. I cannot see it holding..majors have already breached or are near major breaches. Structure looks vulnerable..stay on guard.",
      expected: { ticker: "RUT", direction: "short", confidence: 0.65 },
      reasoning: "'Cannot see it holding' + 'structure looks vulnerable' = Coach expects breakdown. Even without explicit price levels, the bias is short. This is a 'watch for breakdown' post — no confirmation price given, direction inferred from text sentiment.",
    },
    {
      key: "example.text.numbered_series_update",
      type: "text_parse",
      post: "Mag 7 update — distribution pattern still intact. Watching for break below $62 support to confirm next leg down. Patience.",
      expected: { ticker: "MAGS", direction: "short", priceConfirmation: 62, confidence: 0.8 },
      reasoning: "'Break below $62 support to confirm' = $62 is the confirmation level for the short. The stock must close BELOW $62 to confirm entry. Prior posts established target around $48-49 — this update tightens the confirmation.",
    },
    {
      key: "example.text.pt_sl_explicit",
      type: "text_parse",
      post: "AAPL looking strong. PT $185-190. Confirmed above $172. Should hit by 3/20. SL $165.",
      expected: { ticker: "AAPL", direction: "long", priceTargetLow: 185, priceTargetHigh: 190, priceConfirmation: 172, projectedDate: "2026-03-20", stopLoss: 165, confidence: 0.95 },
      reasoning: "PT = price target. 'Confirmed above $172' = $172 is the confirmation level for long entry. SL = stop loss at $165. PT $185-190 = dual price target range above confirmation = long setup.",
    },
    {
      key: "example.text.market_commentary_no_trade",
      type: "text_parse",
      post: "Market looking shaky today. Be careful out there. Cash is a position.",
      expected: { trades: [], confidence: 0.0 },
      reasoning: "General market commentary with no ticker, no price target, no confirmation level. Return empty trades array. Do not invent a setup.",
    },
    {
      key: "example.text.soxs_wyckoff_context",
      type: "text_parse",
      post: "SOX — UTAD printed at 5600 last week. Now below BC level at 5200. SOW imminent. SOXS is the play.",
      expected: { ticker: "SOXS", direction: "long", priceConfirmation: 5200, confidence: 0.85 },
      reasoning: "UTAD = Upthrust After Distribution (final trap before markdown). 'Now below BC level' = price broke below key distribution level = very bearish for SOX. 'SOXS is the play' = Coach is expressing this as a SOXS long. Confirmation = breaking below BC at $5200 (SOX level, but SOXS is the vehicle).",
    },
  ];

  for (const ex of textExamples) {
    await addEntry(db, "example", ex.key, ex, "seed");
  }

  // ── 8. Knowledge Base — Few-Shot Vision/Chart Examples ────────────────────

  const visionExamples = [
    {
      key: "example.vision.support_breakdown_bearish",
      type: "vision_example",
      scenario: "TradingView chart with a red horizontal line labeled 'CRITICAL SUPPORT 7400' or 'KEY SUPPORT'. Current price candles are AT or BELOW that level (e.g., current price is 7317, labeled support is 7400).",
      expected_output: { direction: "bearish", price_levels: [{ value: 7400, type: "resistance", label: "broken support now resistance" }, { value: 7317, type: "entry" }] },
      reasoning: "Support broken from above = now acts as resistance. Price BELOW labeled support = bearish breakdown. The labeled level flips from support to resistance. This is a short setup, not a bounce opportunity.",
    },
    {
      key: "example.vision.lpsy_distribution_top",
      type: "vision_example",
      scenario: "Chart showing a flat trading range at the top of a rally (distribution). Price has been oscillating sideways near highs. A weak, low-volume rally attempts to reach the top of the range but fails. Wyckoff label 'LPSY' is written on the chart near this weak rally.",
      expected_output: { direction: "bearish", wyckoff_phase: "distribution", phase_label: "LPSY" },
      reasoning: "LPSY (Last Point of Supply) = final weak rally before markdown. Any price near the top of the distribution range where LPSY is labeled IS the confirmation/entry for the short. The markdown phase follows.",
    },
    {
      key: "example.vision.red_arrow_pointing_down",
      type: "vision_example",
      scenario: "TradingView chart with a bold red downward arrow drawn on it. The arrow starts at or near current price and points toward a lower price level. A horizontal level is marked below with a number (e.g., 48).",
      expected_output: { direction: "bearish", price_levels: [{ type: "target", label: "red arrow endpoint" }] },
      reasoning: "Red downward arrow = Coach's explicit projection of price direction. The endpoint of the arrow = the target. Current price = entry/confirmation area. Always classify downward arrows as bearish targets.",
    },
    {
      key: "example.vision.blue_dashed_target_zone",
      type: "vision_example",
      scenario: "TradingView chart with a cluster of 2-4 closely spaced horizontal blue dashed lines forming a band. The band is BELOW current price. A number (e.g., 3500) is written near the band.",
      expected_output: { direction: "bearish", price_levels: [{ value: 3500, type: "target", label: "blue dashed target zone" }] },
      reasoning: "Blue dashed line clusters = Coach's target zone. When BELOW current price = bearish target (short). When ABOVE current price = bullish target (long). Always look for an explicit number label near the band and use that as the value.",
    },
    {
      key: "example.vision.inset_wyckoff_schematic",
      type: "vision_example",
      scenario: "Chart has a small inset diagram in the corner showing the classic Wyckoff distribution or accumulation schematic (labeled phases: PSY, BC, AR, ST, SOW, LPSY, or PS, SC, AR, SOS, LPS). The main chart appears to match the current stage of that schematic.",
      expected_output: { has_wyckoff_reference: true },
      reasoning: "The inset is a REFERENCE DIAGRAM, not a second ticker. Do not extract price levels from it. Use it to understand which Wyckoff phase the main chart is in. If the main chart is at the LPSY stage of the inset schematic, the setup is bearish short.",
    },
    {
      key: "example.vision.ascending_broadening_bearish",
      type: "vision_example",
      scenario: "Chart with two diverging trendlines — lower trendline sloping up (higher lows), upper trendline also sloping up but at a steeper angle (higher highs). The pattern expands wider over time. Coach often labels this or draws it on semis/indices.",
      expected_output: { direction: "bearish", pattern: "ascending_broadening" },
      reasoning: "Ascending broadening formation = bearish reversal pattern. Despite appearing to make higher highs, the erratic expanding range signals distribution. Coach frequently identifies this on SOX and MAGS as a topping pattern. Direction = bearish.",
    },
  ];

  for (const ex of visionExamples) {
    await addEntry(db, "example", ex.key, ex, "seed");
  }

  return {
    profileEntries: profileSeeds.length,
    knowledgeEntries:
      wyckoffTerms.length +
      instruments.length +
      relationships.length +
      chartElements.length +
      patterns.length +
      textExamples.length +
      visionExamples.length,
  };
}
