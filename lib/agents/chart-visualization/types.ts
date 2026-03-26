/**
 * Chart Visualization Agent — Type Definitions
 *
 * ChartGeometry: raw output from the Vision shape-extraction pass.
 * ChartData: processed, renderable data stored on CoachPost.chartData and
 *   consumed by the TradeSummaryChart component.
 */

// ── Vision output ─────────────────────────────────────────────────────────────

export interface ChartGeometry {
  /** 15–25 normalized Y-values (0=chart bottom, 1=chart top). Smoothed trajectory. */
  priceShape: number[];
  /** Upper channel boundary (same normalization), null if no channel visible. */
  channelUpper: number[] | null;
  /** Lower channel boundary, null if no channel visible. */
  channelLower: number[] | null;
  /**
   * Actual price at the BOTTOM of the visible y-axis (corresponds to normalized 0.0).
   * Read from the chart's y-axis labels. Null if no price labels visible.
   */
  yAxisMin: number | null;
  /**
   * Actual price at the TOP of the visible y-axis (corresponds to normalized 1.0).
   * Read from the chart's y-axis labels. Null if no price labels visible.
   */
  yAxisMax: number | null;
  /** Dominant chart pattern identified by Vision. */
  pattern:
    | "ascending_channel"
    | "descending_channel"
    | "broadening_top"
    | "distribution"
    | "accumulation"
    | "head_and_shoulders"
    | "double_top"
    | "double_bottom"
    | "flag"
    | "triangle"
    | "range"
    | "step_down"
    | null;
  /** Chart granularity. */
  timeframe: "daily" | "4H" | "1H" | "weekly" | null;
  /** X-axis date range visible on the chart. */
  dateRange: { start: string; end: string } | null;
  /** Agent's best estimate of when price will reach the target zone. */
  projectedTimeframe: {
    earliest: string; // ISO date
    latest: string;   // ISO date
    label: string;    // human-readable, e.g. "~3–4 weeks"
  } | null;
  /** 0–1 confidence in the shape extraction. Below 0.5 → levels-only fallback. */
  confidence: number;
  /**
   * Step-down specific geometry — extracted only when pattern is "step_down".
   * Values are actual dollar prices read from the Y-axis.
   */
  stepDownData?: {
    /** Diagonal resistance trendline price at the LEFT edge of the chart. */
    diagonalStart: number;
    /** Diagonal resistance trendline price at the RIGHT edge of the chart. */
    diagonalEnd: number;
    /**
     * Horizontal consolidation zones ordered from highest (oldest) to lowest (most recent).
     * Each zone's upper/lower are actual dollar prices.
     */
    zones: Array<{ upper: number; lower: number }>;
  } | null;
  /**
   * Triangle specific geometry — extracted only when pattern is "triangle".
   * All price values are actual dollar prices read from the Y-axis.
   */
  triangleData?: {
    /** Triangle variant. */
    subtype: "symmetrical" | "ascending" | "descending";
    /** Upper trendline (connects swing highs). */
    upperTrendline: { startPrice: number; endPrice: number };
    /** Lower trendline (connects swing lows). */
    lowerTrendline: { startPrice: number; endPrice: number };
    /**
     * Alternating swing highs/lows that define the triangle, ordered chronologically.
     * xFraction is 0.0 = chart left, 1.0 = chart right.
     */
    swingPoints: Array<{ xFraction: number; price: number; type: "high" | "low" }>;
    /** Price where upper and lower trendlines converge. */
    apexPrice: number;
    /** X-position of the apex (0.0–1.0+). May exceed 1.0 if apex is projected beyond chart. */
    apexXFraction: number;
  } | null;
}

// ── Pattern-specific key points ───────────────────────────────────────────────

export interface DoubleTopBottomKeyPoints {
  /**
   * Price of the two equal peaks (double top) or troughs (double bottom).
   * This is the repeated level that defines the pattern.
   */
  doubleLevel: number;
  /**
   * For double top: the valley price between the two peaks.
   * For double bottom: the peak price between the two troughs (the neckline to break).
   */
  neckline: number;
  /** Measured-move target after breakdown (top) or breakout (bottom). */
  target: number | null;
  /** "forming" = second peak/trough not yet confirmed; "broken" = neckline breached. */
  currentPhase: "forming" | "broken";
}

export interface ChannelKeyPoints {
  /** Upper channel boundary price at the right edge (current time). */
  upper: number;
  /** Lower channel boundary price at the right edge (current time). */
  lower: number;
  /** Channel slope direction. */
  slope: "ascending" | "descending";
  /**
   * Price target after the channel break.
   * Ascending channel break → target below lower bound.
   * Descending channel break → target above upper bound.
   */
  target: number | null;
  /** "intact" = price still inside channel; "broken" = channel has been breached. */
  currentPhase: "intact" | "broken";
}

export interface HeadAndShouldersKeyPoints {
  /** Left shoulder peak price. */
  leftShoulderHigh: number;
  /** Head peak price — the highest point of the pattern. */
  headHigh: number;
  /** Right shoulder peak price — typically lower than or equal to left shoulder. */
  rightShoulderHigh: number;
  /** Neckline level — connects the two troughs between shoulder and head. */
  neckline: number;
  /** Measured-move price target below neckline. Null if not extractable. */
  target: number | null;
  /**
   * "forming"   = right shoulder still developing, neckline intact.
   * "breakdown" = neckline broken, price below neckline.
   * "backtest"  = broken below neckline, now retesting it from below (last short entry signal).
   */
  currentPhase: "forming" | "breakdown" | "backtest";
}

export interface WyckoffKeyPoints {
  /** Top of the trading range — Buying Climax level. */
  bc: number;
  /** Bottom of the trading range — Automatic Reaction level. */
  ar: number;
  /** Upthrust level — may slightly exceed BC. Null if not extracted. */
  ut: number | null;
  /** Last Point of Supply — final lower high before breakdown. */
  lpsy: number | null;
  /** Sign of Weakness / breakdown confirmation level. */
  sow: number | null;
  /** Whether price has broken down below AR yet. */
  currentPhase: "distribution" | "breakdown";
}

export interface StepDownKeyPoints {
  /**
   * Overall descending resistance trendline — price at the left edge (chart start).
   * This is the high point the trendline originates from.
   */
  resistanceStart: number;
  /**
   * Overall descending resistance trendline — price at the right edge (chart end / projected).
   * The trendline descends from resistanceStart to resistanceEnd across the chart.
   */
  resistanceEnd: number;
  /**
   * Consolidation steps ordered from highest (oldest/broken) to lowest (most recent/active).
   * Minimum 2 steps. The last entry is the currently active step.
   */
  steps: Array<{
    /** Upper boundary of this horizontal consolidation zone. */
    upper: number;
    /** Lower boundary of this horizontal consolidation zone (the breakdown confirmation level). */
    lower: number;
    /** "broken" = price already broke down from this step; "active" = currently consolidating. */
    phase: "active" | "broken";
  }>;
  /** Price target after the next breakdown — typically one step-height below the active step's lower. */
  target: number | null;
  /** "consolidating" = price oscillating inside the active step; "breaking_down" = currently in a sharp inter-step drop. */
  currentPhase: "consolidating" | "breaking_down";
}

export interface TriangleKeyPoints {
  /** Triangle variant. */
  subtype: "symmetrical" | "ascending" | "descending";
  /** Upper trendline start price (left edge, earliest swing high). */
  upperStart: number;
  /** Upper trendline end price (at apex or right edge). */
  upperEnd: number;
  /** Lower trendline start price (left edge, earliest swing low). */
  lowerStart: number;
  /** Lower trendline end price (at apex or right edge). */
  lowerEnd: number;
  /**
   * Swing points ordered chronologically (alternating highs and lows).
   * Each point has a normalized x-position (0-1 across chart width) and a price.
   */
  swingPoints: Array<{ x: number; price: number; type: "high" | "low" }>;
  /** Price where the two trendlines converge. */
  apexPrice: number;
  /** Approximate x-position of the apex (0-1 normalized, may exceed 1.0 if projected). */
  apexX: number;
  /** Measured-move target after breakout. */
  target: number | null;
  /** Expected breakout direction. Null for symmetrical pre-breakout. */
  expectedBreakout: "up" | "down" | null;
  /** Current state: forming (inside triangle), or broken in a direction. */
  currentPhase: "forming" | "broken_up" | "broken_down";
}

export interface BroadeningTopKeyPoints {
  /**
   * Upper trendline right endpoint — the 5th swing high / current distribution zone.
   * This is where the ascending upper boundary is right now.
   */
  upperEnd: number;
  /**
   * Lower trendline right endpoint — the 4th swing low / most recent trough.
   * Breaking below this (or its extension) confirms the breakdown.
   */
  lowerEnd: number;
  /** Measured-move price target after the pattern breaks down. */
  target: number | null;
  /** "forming" = price still oscillating inside the megaphone; "breakdown" = broken below lower trendline. */
  currentPhase: "forming" | "breakdown";
}

// ── Renderable chart data ─────────────────────────────────────────────────────

export interface ChartData {
  /**
   * 15–25 real price values representing the historical price trajectory.
   * These are absolute prices (not normalized) in the same currency as the trade.
   */
  prices: number[];

  /**
   * 4–8 price values extending the trajectory toward the target.
   * Connects smoothly from prices[prices.length - 1].
   */
  projected: number[];

  /** Y-axis lower bound (absolute price). Chart area bottom. */
  yMin: number;

  /** Y-axis upper bound (absolute price). Chart area top. */
  yMax: number;

  /** Low end of price target range, null if not available. */
  targetLow: number | null;

  /** High end of price target range, null if not available. */
  targetHigh: number | null;

  /** Price confirmation level, null if not available. */
  confirmation: number | null;

  /** Stop loss level, null if not set. */
  stopLoss: number | null;

  /** Month labels for X-axis, e.g. ["Jan", "Feb", "Mar", "Apr"]. */
  months: string[];

  /**
   * Time window overlay — the expected date range for the target to be reached.
   * startIdx and endIdx are indices into the combined prices + projected array.
   * Null if projectedTimeframe was not extracted.
   */
  timeWindow: {
    startIdx: number;
    endIdx: number;
    label: string;    // e.g. "Target window"
    duration: string; // e.g. "~3–4 weeks" or "Q2 2026"
  } | null;

  /** Upper channel boundary as absolute prices, scaled to match prices length. */
  channelUpper: number[] | null;

  /** Lower channel boundary as absolute prices. */
  channelLower: number[] | null;

  /**
   * Canonical chart pattern template to use for rendering.
   * When set, a pattern-specific component replaces the generic line chart.
   * Null = generic line chart.
   */
  patternType?: "distribution" | "head_and_shoulders" | "ascending_channel" | "descending_channel" | "double_top" | "double_bottom" | "flag" | "broadening_top" | "step_down" | "triangle" | null;

  /**
   * Wyckoff key price levels — populated when patternType is "distribution".
   * Drives the WyckoffDistributionChart template renderer.
   */
  wyckoffKeyPoints?: WyckoffKeyPoints | null;

  /**
   * Head & Shoulders key levels — populated when patternType is "head_and_shoulders".
   */
  headAndShouldersKeyPoints?: HeadAndShouldersKeyPoints | null;

  /**
   * Channel key levels — populated when patternType is "ascending_channel" or "descending_channel".
   */
  channelKeyPoints?: ChannelKeyPoints | null;

  /**
   * Double top / double bottom key levels — populated when patternType is "double_top" or "double_bottom".
   */
  doubleTopBottomKeyPoints?: DoubleTopBottomKeyPoints | null;

  /**
   * Broadening top (megaphone) key levels — populated when patternType is "broadening_top".
   */
  broadeningTopKeyPoints?: BroadeningTopKeyPoints | null;

  /**
   * Step-down key levels — populated when patternType is "step_down".
   * Describes the diagonal resistance line and the stair-step consolidation zones.
   */
  stepDownKeyPoints?: StepDownKeyPoints | null;

  /**
   * Triangle key levels — populated when patternType is "triangle".
   * Describes converging trendlines, swing points, and apex.
   */
  triangleKeyPoints?: TriangleKeyPoints | null;
}
