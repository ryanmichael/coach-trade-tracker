# Claude Code Prompts — Coach Intelligence Layer

## Pre-requisite

Copy the spec into your project first:

```bash
cp coach-intelligence-layer-spec.md docs/coach-intelligence-layer-spec.md
```

---

## Prompt 1: Update PRD with Coach Intelligence Layer

```
Read these files completely before starting:
- docs/prd.md
- docs/coach-intelligence-layer-spec.md

Add the Coach Intelligence Layer to the PRD. This is a system that
sits between post ingestion and trade parsing, making the parser
smarter over time by maintaining structured knowledge about Coach's
style, terminology, chart patterns, and historical accuracy.

Changes to make:

1. SECTION 5 (Agent Architecture) — Add a new agent: Coach Intelligence Agent.
   Place it after Section 5.3 (NLP Parser Agent) as Section 5.4, and
   renumber the remaining agents. Use the agent definition from the
   "New Agent: Coach Intelligence Agent" section at the bottom of the spec.

2. SECTION 5.3 (NLP Parser Agent) — Update to note that the parser now
   receives enriched context from the Coach Intelligence Layer before
   every parse. The parser does NOT own the knowledge systems — it
   consumes context provided by the Coach Intelligence Agent.

3. SECTION 4.3 (Data Model) — Add three new Prisma models from the spec:
   - CoachProfile (key-value store for Coach's style, terminology, bias)
   - KnowledgeEntry (trading patterns, instruments, terms, chart elements)
   - ParseFeedback (correction records linked to CoachPost and ParsedTrade)
   Add the ParseFeedback relation to the existing CoachPost and
   ParsedTrade models.

4. SECTION 6 (Features) — In the Quick Paste / parsing section, add a
   subsection describing how the Coach Intelligence Layer enriches
   parsing:
   - Coach Profile context is loaded and injected into every text parse
     and image analysis prompt
   - Knowledge Base is queried when unknown terms or patterns are encountered
   - Image analysis uses a Coach-specific Vision prompt (not generic)
   - Multi-chart images are detected and parsed per-panel
   - Inverse ETF relationships are auto-detected (e.g., SOX bearish = SOXS bullish)

5. SECTION 6 — In the Report Feedback section (6.8 or wherever it was
   added), expand to describe the feedback pipeline:
   - Feedback is classified by type: terminology, price_level, direction,
     pattern, missing_data
   - Corrections route to Coach Profile and Knowledge Base updates
   - ParsedTrade records are updated with corrected values
   - After 3+ similar corrections, system flags for prompt refinement
   - Monthly accuracy tracking

6. SECTION 7 (API Routes) — Add new routes:
   - GET /api/coach/profile — returns current Coach Profile entries
   - PUT /api/coach/profile/[key] — update a profile entry
   - GET /api/knowledge/search?q= — search knowledge base
   - POST /api/knowledge — add knowledge entry
   - POST /api/feedback — submit parse feedback
   - GET /api/feedback/stats — correction pattern analytics

7. SECTION 10 (Milestones) — Add Coach Intelligence Layer phases:
   - Phase 1 (Week 1): Knowledge Base seed — 50+ TA patterns, major
     indices/ETFs, Wyckoff terminology, chart element dictionary
   - Phase 2 (Week 2): Coach Profile bootstrap — initial profile from
     analyzed posts, Coach-specific Vision prompt, context injection
   - Phase 3 (Week 3): Feedback pipeline — correction classifier,
     auto-update ParsedTrade, route to Profile and Knowledge Base
   - Phase 4 (Week 4+): Active learning — aggregate patterns, auto-refine
     prompts, accuracy reporting, confidence calibration

8. SECTION 13 (Build Order) — Insert Coach Intelligence Layer steps
   after the NLP Parser step:
   - Knowledge Base: schema + seed data + query API
   - Coach Profile: schema + bootstrap + context injection
   - Enhanced Image Analysis: Coach-specific Vision prompt
   - Feedback Pipeline: classification + routing + auto-correction
```

---

## Prompt 2: Add Prisma models and seed data

```
Read docs/prd.md (updated) and docs/coach-intelligence-layer-spec.md.

1. In packages/db/prisma/schema.prisma, add the three new models:

   CoachProfile:
   - id (cuid)
   - key (String, unique) — e.g., "terminology.SOW", "bias.direction"
   - value (Json)
   - source (String) — "system_detected" | "user_corrected" | "manual"
   - confidence (Float, default 0.5)
   - lastUpdated (DateTime, updatedAt)
   - observationCount (Int, default 1)

   KnowledgeEntry:
   - id (cuid)
   - category (String) — "pattern" | "instrument" | "term" | "chart_element" | "relationship"
   - key (String, unique)
   - data (Json)
   - source (String) — "seed" | "system_detected" | "user_added"
   - validated (Boolean, default false)
   - createdAt, updatedAt

   ParseFeedback:
   - id (cuid)
   - coachPostId (relation to CoachPost)
   - parsedTradeId (optional relation to ParsedTrade)
   - feedbackText (String)
   - correctionType (String, optional)
   - fieldsCorrected (String[])
   - originalValues (Json, optional)
   - correctedValues (Json, optional)
   - processed (Boolean, default false)
   - createdAt

   Also add a parseFeedback relation array to CoachPost and ParsedTrade.

2. Run the migration: npx prisma migrate dev --name add-coach-intelligence

3. Create a seed file at packages/db/seeds/knowledge-base-seed.ts with:

   Trading patterns (at least these):
   - wyckoff_distribution (bearish, phases, typical target)
   - wyckoff_accumulation (bullish, phases, typical target)
   - ascending_broadening_pattern (bearish, description)
   - head_and_shoulders (bearish, description)
   - double_top (bearish)
   - double_bottom (bullish)
   - bull_flag, bear_flag
   - ascending_triangle, descending_triangle
   - cup_and_handle

   Instruments:
   - MAGS (Roundhill Magnificent Seven ETF)
   - SOX (PHLX Semiconductor Index)
   - SOXS (Direxion Semiconductor Bear 3x, inverse_of: SOX)
   - SQQQ (ProShares UltraPro Short QQQ, inverse_of: QQQ)
   - QQQ (Invesco QQQ Trust)
   - SPY (SPDR S&P 500)
   - RUT (Russell 2000 Index)
   - IWM (iShares Russell 2000 ETF)
   - VIX (CBOE Volatility Index)
   - TLT (iShares 20+ Year Treasury Bond)

   Wyckoff terminology:
   - PSY (Preliminary Supply)
   - BC (Buying Climax)
   - AR (Automatic Reaction)
   - ST (Secondary Test)
   - SOW (Sign of Weakness)
   - LPSY (Last Point of Supply)
   - UTAD (Upthrust After Distribution)
   - UT (Upthrust)
   - PS (Preliminary Support)
   - SC (Selling Climax)
   - SOS (Sign of Strength)
   - LPS (Last Point of Support)
   - Spring

   Chart elements:
   - horizontal_line (support/resistance)
   - trendline (diagonal trend boundary)
   - dashed_line (projected/expected levels)
   - arrow (projected price movement)
   - circle/oval (significant zones)
   - inset_diagram (reference pattern comparison)
   - gap (price gap area)

   Relationships:
   - SOX/SOXS (inverse)
   - QQQ/SQQQ (inverse)
   - SPY/VIX (inverse correlation)

4. Create a seed script in package.json and run it:
   npx tsx packages/db/seeds/knowledge-base-seed.ts

5. Create an initial Coach Profile seed at
   packages/db/seeds/coach-profile-seed.ts with entries for:
   - chart.platform = "TradingView"
   - chart.annotation_color = "red"
   - chart.support_resistance_style = "blue_dashed"
   - chart.target_indicator = "red_arrows"
   - style.post_numbering = true (numbered series)
   - style.chart_primary = true (image is primary signal, not text)
   - methodology.primary = "wyckoff"
   - bias.current = "bearish"
   - bias.preferred_instruments = ["inverse_etfs"]
   - terminology.SOW = "Sign of Weakness"
   - terminology.LPSY = "Last Point of Supply"
   - terminology.bc = "Buying Climax"
   - terminology.ar = "Automatic Reaction"
   - terminology.ut = "Upthrust"
   - terminology.psy = "Preliminary Supply"
   - terminology.SOW_in_phase_B = "Sign of Weakness in distribution Phase B"

   Run this seed too.
```

---

## Prompt 3: Build the Coach Intelligence Agent

```
Read docs/coach-intelligence-layer-spec.md for the full design.

Build the Coach Intelligence Agent in packages/agents/src/coach-intelligence/:

1. coach-profile.ts
   - loadProfile(): fetch all CoachProfile entries, return as structured object
   - updateProfile(key, value, source): upsert a profile entry,
     increment observationCount
   - getTerminology(): return all terminology.* entries as a flat map
   - getBias(): return current directional bias and preferred instruments
   - getChartStyle(): return chart annotation patterns

2. knowledge-base.ts
   - search(query): full-text search across KnowledgeEntry records
   - getByKey(key): exact lookup
   - getByCategory(category): list entries by category
   - getInverseRelationships(ticker): find inverse/correlated instruments
   - addEntry(category, key, data, source): create new entry
   - validateEntry(key): mark as validated

3. context-builder.ts
   - buildParseContext(): loads Coach Profile + relevant Knowledge Base
     entries and returns a formatted string to inject into parse prompts.
     This is the "Coach decoder ring" — it tells the parser what to
     expect before it reads a new post.
   - buildVisionContext(): same but optimized for image analysis prompts,
     including chart style fingerprint and annotation patterns.
   - The output should be a plain text block that gets prepended to the
     system prompt for Claude API calls.

4. feedback-processor.ts
   - processFeedback(feedbackId): main pipeline
     a. Load the feedback record
     b. Call classifyCorrection() to determine correction type and
        extract corrected values (uses Claude API)
     c. If correctedValues exist, update the ParsedTrade
     d. Route terminology corrections to Coach Profile
     e. Route pattern/instrument corrections to Knowledge Base
     f. Check if 3+ similar corrections exist — if so, flag for
        prompt refinement (log a warning for now)
     g. Mark feedback as processed
   - classifyCorrection(feedbackText, originalValues): calls Claude
     to classify the freeform text into structured correction data.
     Returns { correctionType, fieldsCorrected, correctedValues,
     terminologyUpdates, knowledgeUpdates }

5. vision-prompt.ts
   - getCoachVisionPrompt(): returns the full Coach-specific Vision
     prompt from the spec. Dynamically injects current Coach Profile
     values (bias, terminology, chart style) into the prompt template.
   - This replaces the generic image analysis prompt in the NLP Parser.

6. index.ts — export all modules

Each module should:
- Use Prisma client from packages/db
- Have TypeScript interfaces for all data shapes
- Include JSDoc comments explaining the purpose
- Handle errors gracefully (missing profile entries, empty knowledge base)
```

---

## Prompt 4: Wire into existing parse pipeline

```
Read packages/agents/src/coach-intelligence/index.ts to understand
what's available.

Update the existing NLP Parser to use the Coach Intelligence Layer:

1. In the text parse function (wherever regex + Claude fallback lives):
   - Before calling Claude, call buildParseContext() to get the
     enriched context string
   - Prepend this context to the system prompt
   - This means Claude sees Coach's known terminology, style,
     and bias before it reads the post

2. In the image analysis function (wherever Claude Vision is called):
   - Replace the generic Vision prompt with getCoachVisionPrompt()
   - This gives Vision the Coach-specific chart style fingerprint
   - After Vision returns, post-process:
     a. Look up any identified tickers in the Knowledge Base
     b. Check for inverse relationships
     c. If an inverse is found, create a secondary ParsedTrade suggestion
     d. Apply Coach's historical accuracy to confidence scoring

3. In the merge function (where text + image results combine):
   - If Knowledge Base has a pattern entry matching what was identified,
     use its reliability rating to adjust confidence
   - If Coach Profile shows this matches a known pattern in Coach's style,
     boost confidence

4. Create the API routes:
   - GET /api/coach/profile — returns loadProfile()
   - PUT /api/coach/profile/[key] — calls updateProfile()
   - GET /api/knowledge/search?q= — calls search()
   - POST /api/knowledge — calls addEntry()
   - POST /api/feedback — stores ParseFeedback record, then calls
     processFeedback() asynchronously (don't block the response)
   - GET /api/feedback/stats — aggregate correction counts by type

5. Connect the Report UI:
   - The existing Report action panel already collects feedbackText
     and the postId
   - Update the submit handler to POST to /api/feedback with:
     { coachPostId, parsedTradeId (if available), feedbackText }
   - The backend handles classification and routing automatically
```

---

## Summary

Run these 4 prompts in order with /clear between each:

| Prompt | What it does | Time estimate |
|--------|-------------|---------------|
| 1 | Updates PRD with Coach Intelligence Layer | 5 min |
| 2 | Adds Prisma models + seeds knowledge base | 10 min |
| 3 | Builds the Coach Intelligence Agent modules | 15 min |
| 4 | Wires into existing parse pipeline + API routes | 10 min |

After all 4, the system will:
- Have a seeded Knowledge Base with 50+ trading patterns, instruments, and terms
- Have a bootstrapped Coach Profile with Coach's known style and terminology
- Inject Coach-specific context into every parse and image analysis
- Process Report feedback into structured corrections that update the Profile and Knowledge Base
- Auto-detect inverse ETF relationships
- Track correction patterns for future prompt refinement
