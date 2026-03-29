/**
 * Context Builder module
 * Assembles the "Coach decoder ring" — a plain-text block injected into the
 * system prompt for every Claude API call (text parse and Vision analysis).
 *
 * This is what makes the parser Coach-aware: it loads the current Coach Profile
 * and relevant Knowledge Base entries, then formats them into a structured
 * context block that tells Claude what to expect before reading a post.
 */

import type { PrismaClient } from "@repo/db";
import { loadProfile } from "./coach-profile";
import { getByCategory } from "./knowledge-base";
import { getThesisContext } from "./thesis-processor";

/**
 * Build the text parse context — the "Coach decoder ring".
 *
 * Prepend the returned string to the system prompt for all Claude text
 * parsing calls. Tells Claude: who Coach is, Coach's known terminology,
 * methodology, directional bias, and style hints.
 */
export async function buildParseContext(db: PrismaClient): Promise<string> {
  const [profile, terms, instruments, examples, learnedRules, thesisEntries] = await Promise.all([
    loadProfile(db),
    getByCategory(db, "term"),
    getByCategory(db, "instrument"),
    getByCategory(db, "example"),
    db.coachProfile.findMany({
      where: { key: { startsWith: "prompt.rule." } },
      orderBy: { key: "asc" },
    }),
    getThesisContext(db),
  ]);

  const lines: string[] = [
    "=== COACH CONTEXT — read before parsing ===",
    "",
    "You are parsing posts from a professional day trading coach who has a paid subscriber following.",
    "",
  ];

  // Methodology
  const method = profile.methodology.primary;
  lines.push(`METHODOLOGY: Coach primarily uses ${method.toUpperCase()} analysis.`);
  if (method.toLowerCase() === "wyckoff") {
    lines.push(
      "Coach identifies Wyckoff distribution and accumulation phases in charts.",
      "Coach is skilled at spotting institutional activity and phase transitions.",
      "Coach's analysis is heavily chart-based — images are often the primary signal."
    );
  }

  // Directional bias
  lines.push(
    "",
    `CURRENT BIAS: ${profile.bias.current.toUpperCase()}`,
    `Coach currently favors ${profile.bias.current} setups.`
  );
  if (profile.bias.preferredInstruments.length > 0) {
    lines.push(
      `Preferred instruments: ${profile.bias.preferredInstruments.join(", ")}.`
    );
    if (profile.bias.preferredInstruments.includes("inverse_etfs")) {
      lines.push(
        "Coach frequently uses inverse/leveraged ETFs (e.g., SOXS, SQQQ) for bearish positions " +
          "rather than direct short selling."
      );
    }
  }

  // Thesis context — Coach's documented worldview, newest per topic
  if (thesisEntries.length > 0) {
    lines.push("", "COACH'S DOCUMENTED THESIS (written by Coach, highest confidence — treat as ground truth):");
    for (const entry of thesisEntries) {
      const dateStr = entry.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      // Mark time-sensitive topics with "as of" to help Claude weight recency
      // Market entries are time-sensitive — annotate with recency
      const timeLabel = entry.topic === "market" ? ` (as of ${dateStr})` : "";
      lines.push(`  [${entry.topicLabel}${timeLabel}]: ${entry.summary}`);
    }
  }

  // Terminology map
  if (Object.keys(profile.terminology).length > 0) {
    lines.push("", "COACH TERMINOLOGY (abbreviations and their meanings):");
    for (const [abbr, meaning] of Object.entries(profile.terminology)) {
      lines.push(`  ${abbr} = ${meaning}`);
    }
  }

  // Wyckoff phase reference from knowledge base
  const wyckoffTerms = terms.filter((t) => {
    const data = t.data as Record<string, unknown>;
    return data.phase === "distribution" || data.phase === "accumulation";
  });
  if (wyckoffTerms.length > 0) {
    lines.push("", "WYCKOFF PHASE REFERENCE (phases Coach identifies in charts):");
    for (const term of wyckoffTerms) {
      const data = term.data as Record<string, unknown>;
      lines.push(
        `  ${data.abbreviation} (${data.full_name}): ${data.description}`
      );
    }
  }

  // Known instruments
  const tickerList = instruments
    .map((i) => {
      const data = i.data as Record<string, unknown>;
      return `${data.ticker} (${data.name})`;
    })
    .join(", ");
  if (tickerList) {
    lines.push("", `KNOWN INSTRUMENTS Coach trades: ${tickerList}`);
  }

  // Style hints
  lines.push(
    "",
    "PARSING RULES:",
    "- Coach posts numbered series (e.g., '13.', '14.', '1/', '2/'). The number is a series label, not a price.",
    "- Chart images are the PRIMARY signal — text is often brief context or a series update only.",
    "- 'Confirmed above X' / 'entry above X' / 'watch for break above X' → X is the confirmation level for a LONG.",
    "- 'Confirmed below X' / 'break below X to confirm' → X is the confirmation level for a SHORT.",
    "- Coach's short setups are expressed as inverse ETF longs (SOXS, SQQQ) — do NOT flip direction.",
    "- SOW, LPSY, UTAD, BC, ST in a distribution context → bearish signals, short setup.",
    "- SOS, LPS, Spring in an accumulation context → bullish signals, long setup.",
    "- 'PT' = price target. 'SL' / 'stop' = stop loss. 'CL' = confirmation level.",
    "- If no ticker is explicit, infer from Wyckoff context (e.g., 'semis' → SOX, 'Mag 7' → MAGS).",
    "- General commentary ('be careful', 'cash is a position') with no specific setup → return empty trades.",
  );

  // Learned rules from user corrections (prompt.rule.*.rule_* entries only)
  const ruleEntries = learnedRules.filter(
    (e) => e.key.match(/^prompt\.rule\.[^.]+\.rule_\d+$/)
  );
  if (ruleEntries.length > 0) {
    lines.push(
      "",
      "LEARNED RULES (hardened from user corrections — treat as high-priority constraints):"
    );
    for (const entry of ruleEntries) {
      lines.push(`  - ${String(entry.value)}`);
    }
  }

  // Few-shot text parse examples
  const textExamples = examples.filter((e) => {
    const d = e.data as Record<string, unknown>;
    return d.type === "text_parse";
  });

  if (textExamples.length > 0) {
    lines.push(
      "",
      "FEW-SHOT EXAMPLES — Coach post patterns with correct parse outputs:",
      "(Use these as ground truth for interpreting similar posts)",
      ""
    );
    for (const ex of textExamples) {
      const d = ex.data as Record<string, unknown>;
      lines.push(
        `POST: "${d.post}"`,
        `→ PARSE: ${JSON.stringify(d.expected)}`,
        `→ WHY: ${d.reasoning}`,
        ""
      );
    }
  }

  lines.push("=== END COACH CONTEXT ===");

  return lines.join("\n");
}

/**
 * Build prior-series context for a specific ticker.
 *
 * Fetches the most recent ParsedTrade for this ticker and formats it as a
 * "PRIOR SETUP" block to inject into the system prompt. Tells Claude what
 * Coach previously established for this ticker so update posts can be
 * interpreted correctly (inherited levels, raised targets, new confirmations).
 *
 * Returns an empty string if no prior trade exists for the ticker.
 */
export async function buildSeriesContext(db: PrismaClient, ticker: string): Promise<string> {
  const prior = await db.parsedTrade.findFirst({
    where: { ticker: ticker.toUpperCase() },
    orderBy: { createdAt: "desc" },
    include: {
      coachPost: {
        select: { content: true, postedAt: true },
      },
    },
  });

  if (!prior) return "";

  const postedAt = prior.coachPost?.postedAt
    ? new Date(prior.coachPost.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "unknown date";

  const snippet = prior.coachPost?.content
    ? prior.coachPost.content.slice(0, 120) + (prior.coachPost.content.length > 120 ? "…" : "")
    : "";

  const lines: string[] = [
    `=== PRIOR SETUP CONTEXT FOR ${ticker.toUpperCase()} ===`,
    "",
    `Coach's most recent ${ticker.toUpperCase()} post (${postedAt}):`,
    snippet ? `  "${snippet}"` : "",
    "",
    "Previously established trade data:",
  ];

  lines.push(`  direction:    ${prior.direction}`);
  if (prior.priceConfirmation != null)  lines.push(`  confirmation: $${prior.priceConfirmation}`);
  if (prior.priceTargetHigh != null)    lines.push(`  target high:  $${prior.priceTargetHigh}`);
  if (prior.priceTargetLow != null)     lines.push(`  target low:   $${prior.priceTargetLow}`);
  if (prior.priceTargetPercent != null) lines.push(`  target %:     ${prior.priceTargetPercent}%`);
  if (prior.stopLoss != null)           lines.push(`  stop loss:    $${prior.stopLoss}`);
  if (prior.supportLevel != null)       lines.push(`  support:      $${prior.supportLevel}`);
  if (prior.resistanceLevel != null)    lines.push(`  resistance:   $${prior.resistanceLevel}`);
  if (prior.projectedDate != null)      lines.push(`  projected by: ${new Date(prior.projectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);

  lines.push(
    "",
    "INHERITANCE RULES:",
    "- If the new post CONFIRMS or UPDATES a field → use the new value",
    "- If the new post says 'still watching', 'target unchanged', or simply doesn't mention a field → return null for that field (the ingest layer will inherit from prior)",
    "- If the new post explicitly CHANGES a value ('raising PT to X', 'new confirmation at Y') → use the new value",
    "- Direction: only override if the new post explicitly changes the trade direction",
    "",
    `=== END PRIOR CONTEXT FOR ${ticker.toUpperCase()} ===`,
    ""
  );

  return lines.join("\n");
}

/**
 * Build the Vision analysis context — a chart style fingerprint block.
 *
 * Prepend the returned string to the Vision prompt for all Claude image
 * analysis calls. Tells Claude Vision: Coach's chart platform, annotation
 * colors, what specific visual elements to look for, and Wyckoff pattern signatures.
 */
export async function buildVisionContext(db: PrismaClient): Promise<string> {
  const [profile, chartElements, examples, learnedRules] = await Promise.all([
    loadProfile(db),
    getByCategory(db, "chart_element"),
    getByCategory(db, "example"),
    db.coachProfile.findMany({
      where: { key: { startsWith: "prompt.rule." } },
      orderBy: { key: "asc" },
    }),
  ]);

  const { chartStyle, methodology, bias } = profile;

  const lines: string[] = [
    "=== COACH CHART STYLE FINGERPRINT ===",
    "",
    `Chart platform: ${chartStyle.platform}`,
    `Primary annotation color: ${chartStyle.annotationColor} — used for targets, entries, and key price levels`,
    `Support/Resistance lines: ${chartStyle.supportResistanceStyle} lines`,
    `Target indicators: ${chartStyle.targetIndicator}`,
    "",
    `Coach's methodology: ${methodology.primary.toUpperCase()}`,
    `Coach's general bias: ${bias.current.toUpperCase()} (use as tiebreaker only — always determine direction from what THIS chart visually shows first)`,
    "",
    "WHAT TO LOOK FOR IN COACH'S CHARTS:",
    `- ${chartStyle.annotationColor.charAt(0).toUpperCase() + chartStyle.annotationColor.slice(1)} horizontal lines = price targets or entry/confirmation levels`,
    `- Blue dashed lines = key price zones. In a bullish setup, a blue dashed band above current price = "target". In a bearish setup, a blue dashed band below current price = "target". Otherwise "support" or "resistance".`,
    `- Pink/red shaded rectangle = intermediate resistance zone. In a bullish setup where price is below this zone, classify as "target" (near-term target to break through). Extract as a SEPARATE level from any blue dashed zones at different price levels.`,
    `- IMPORTANT: When a chart has multiple distinct colored zones (e.g., one pink zone at 102 AND one blue zone at 116), return them as separate entries in price_levels — one for each zone.`,
    `- ${chartStyle.targetIndicator.replace(/_/g, " ")} = projected price movement direction`,
    "- Circled or oval-highlighted areas = significant price zones or pattern completion points",
    "- Inset diagrams = reference patterns (often Wyckoff phase comparisons for context)",
    "- Text written directly on the chart = Coach's own annotations (read every character)",
    "",
  ];

  // Wyckoff-specific guidance
  if (methodology.primary.toLowerCase() === "wyckoff") {
    lines.push(
      "WYCKOFF PATTERNS TO IDENTIFY IN THE CHART:",
      "- Distribution ranges: flat trading zone after a rally, decreasing volume over time",
      "- Accumulation ranges: flat trading zone after a decline",
      "- Upthrusts (UT): price spike ABOVE resistance that reverses back quickly = bearish trap",
      "- Upthrust After Distribution (UTAD): similar but later in distribution = confirms markdown imminent",
      "- Springs: price dip BELOW support that reverses back quickly = bullish trap",
      "- Signs of Weakness (SOW): break below support on high volume = markdown confirmed",
      "- Last Point of Supply (LPSY): weak, low-volume rally near the top = final short entry",
      "- BC (Buying Climax): high-volume surge to new highs = smart money selling into strength",
      ""
    );
  }

  // Chart element reference
  if (chartElements.length > 0) {
    lines.push("ANNOTATION TYPE REFERENCE:");
    for (const el of chartElements) {
      const data = el.data as Record<string, unknown>;
      const meanings = Array.isArray(data.typical_meaning)
        ? (data.typical_meaning as string[]).join(", ")
        : "";
      lines.push(
        `  ${data.name}: ${data.description}${meanings ? ` [typically indicates: ${meanings}]` : ""}`
      );
    }
    lines.push("");
  }

  // Coach-specific annotation vocabulary
  lines.push(
    "COACH ANNOTATION VOCABULARY (how Coach marks up TradingView charts):",
    "  Red rightward arrow → projected price target direction (endpoint = target level)",
    "  Red downward arrow → projected decline target (endpoint = short target)",
    "  Red horizontal line → key level (entry, confirmation, or target depending on position vs current price)",
    "  Blue dashed horizontal lines (cluster) → target zone (above price = long target; below = short target)",
    "  Pink/red shaded rectangle → intermediate resistance or near-term target zone",
    "  Blue solid horizontal line → major support or resistance level",
    "  Text 'BREAK HERE' or 'ENTRY' near a level → confirmation/entry price",
    "  Text 'TARGET' or 'PT' near a level → price target",
    "  Text 'SUPPORT' or 'CRITICAL SUPPORT' near a level → key support (if price is BELOW this, it's broken support = now resistance)",
    "  Wyckoff labels (BC, AR, ST, SOW, LPSY, UTAD, SC, SOS, LPS, Spring) written on chart body → phase markers, not price levels",
    "  Small inset diagram in corner → Wyckoff reference schematic (ignore for price extraction; use for phase context only)",
    "  Numbered callout (e.g., '1.', '2.') → Coach's annotation sequence, not a price",
    ""
  );

  lines.push(
    "MULTI-PANEL HANDLING:",
    "If the chart image shows multiple side-by-side panels or inset comparison charts,",
    "analyze each panel independently and return separate price level sets,",
    "each clearly tagged with the panel's ticker or context.",
    ""
  );

  // Learned rules from user corrections — inject direction/pattern rules into Vision too
  const visionRuleEntries = learnedRules.filter((e) => {
    // Include direction, pattern, and price_level rules (most relevant to Vision)
    return (
      e.key.match(/^prompt\.rule\.(direction|pattern|price_level)\.rule_\d+$/)
    );
  });
  if (visionRuleEntries.length > 0) {
    lines.push(
      "LEARNED RULES (hardened from user corrections — treat as high-priority constraints):"
    );
    for (const entry of visionRuleEntries) {
      lines.push(`  - ${String(entry.value)}`);
    }
    lines.push("");
  }

  // Few-shot vision examples
  const visionExamples = examples.filter((e) => {
    const d = e.data as Record<string, unknown>;
    return d.type === "vision_example";
  });

  if (visionExamples.length > 0) {
    lines.push(
      "FEW-SHOT CHART EXAMPLES — scenario descriptions with correct interpretations:",
      "(Apply these patterns when you see matching chart structures)",
      ""
    );
    for (const ex of visionExamples) {
      const d = ex.data as Record<string, unknown>;
      lines.push(
        `SCENARIO: ${d.scenario}`,
        `→ INTERPRET AS: ${JSON.stringify(d.expected_output)}`,
        `→ REASONING: ${d.reasoning}`,
        ""
      );
    }
  }

  lines.push("=== END CHART FINGERPRINT ===");

  return lines.join("\n");
}
