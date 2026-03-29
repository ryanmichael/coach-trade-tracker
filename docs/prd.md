# PRD — Coachtrack

**Version:** 1.2 | **Date:** March 12, 2026

> Single-user trading dashboard. X Super Follows coach posts → structured trade data + real-time price alerts.
> Manual ingestion is primary (X API cannot access paywalled content).
> Design tokens/component patterns: see `docs/design-system.md`. Build order/critical rules: see `CLAUDE.md`.

---

## 1. Data Model (Prisma Schema)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ── Future multi-user support ──
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  watchlist     WatchlistItem[]
  activeTrades  ActiveTrade[]
  alerts        Alert[]
  preferences   UserPreference?
}

model UserPreference {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id])
  alertSound            Boolean  @default(true)
  alertBrowserPush      Boolean  @default(false)
  defaultView           String   @default("active") // "active" | "watchlist" | "feed"
  priceCheckIntervalSec Int      @default(30)
}

// ── Coach Feed ──
model CoachPost {
  id              String          @id @default(cuid())
  externalId      String?         @unique // X post ID if available
  content         String          // Raw post text
  mediaUrls       String[]        // Original image/video URLs if any
  imageStoragePaths String[]      // Local/S3 paths to stored images
  imageAnalysis   Json?           // Structured output from Claude Vision analysis per image
  hasImages       Boolean         @default(false)
  postedAt        DateTime        // When coach posted (user-estimated or parsed)
  ingestedAt      DateTime        @default(now())
  ingestionMethod String          @default("manual") // "manual_paste" | "manual_ocr" | "manual_share" | "automated"
  parsedTrades    ParsedTrade[]
  watchlistItems  WatchlistItem[]
  feedTags        FeedTag[]
  parseFeedback   ParseFeedback[]
}

// ── Parsed Trade Recommendations ──
model ParsedTrade {
  id                  String    @id @default(cuid())
  coachPostId         String
  coachPost           CoachPost @relation(fields: [coachPostId], references: [id])
  ticker              String    // e.g. "AAPL"
  direction           String    @default("long") // "long" | "short"
  priceTargetLow      Float?    // Low end of target range
  priceTargetHigh     Float?    // High end of target range
  priceTargetPercent  Float?    // Alternative: % change target
  priceConfirmation   Float?    // Price that confirms entry
  projectedDate       DateTime? // When coach expects target hit
  stopLoss            Float?    // Stop loss if mentioned
  supportLevel        Float?    // Support level extracted from chart images
  resistanceLevel     Float?    // Resistance level extracted from chart images
  confidence          Float     @default(0.0) // NLP parser confidence (0-1)
  sourceType          String    @default("text") // "text" | "image" | "combined"
  rawExtract          String    // The substring or image region that was parsed
  createdAt           DateTime  @default(now())
  watchlistItems      WatchlistItem[]
  activeTrades        ActiveTrade[]
  parseFeedback       ParseFeedback[]
}

// ── Watchlist ──
model WatchlistItem {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id])
  ticker          String
  parsedTradeId   String?
  parsedTrade     ParsedTrade? @relation(fields: [parsedTradeId], references: [id])
  coachPostId     String?
  coachPost       CoachPost?   @relation(fields: [coachPostId], references: [id])
  notes           String?
  addedAt         DateTime     @default(now())
  status          String       @default("watching") // "watching" | "promoted" | "removed"

  @@unique([userId, ticker])
}

// ── Active Trades ──
model ActiveTrade {
  id                    String       @id @default(cuid())
  userId                String
  user                  User         @relation(fields: [userId], references: [id])
  ticker                String
  parsedTradeId         String?
  parsedTrade           ParsedTrade? @relation(fields: [parsedTradeId], references: [id])
  entryPrice            Float?
  entryDate             DateTime?
  priceConfirmation     Float?
  priceTargetHigh       Float?
  priceTargetLow        Float?
  projectedDate         DateTime?
  stopLoss              Float?
  supportLevel          Float?
  resistanceLevel       Float?
  status                String       @default("pending") // "pending" | "confirmed" | "entered" | "closed"
  currentPrice          Float?
  currentPriceUpdatedAt DateTime?
  profitLoss            Float?
  closedAt              DateTime?
  closedPrice           Float?
  notes                 String?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  alerts                Alert[]
}

// ── Alerts ──
model Alert {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id])
  activeTradeId   String?
  activeTrade     ActiveTrade? @relation(fields: [activeTradeId], references: [id])
  ticker          String
  alertType       String       // "price_confirmation" | "target_reached" | "stop_loss" | "new_post"
  triggerPrice    Float?
  triggeredAt     DateTime?
  acknowledged    Boolean      @default(false)
  message         String
  createdAt       DateTime     @default(now())
}

// ── Feed Tagging ──
model FeedTag {
  id          String    @id @default(cuid())
  coachPostId String
  coachPost   CoachPost @relation(fields: [coachPostId], references: [id])
  tagType     String    // "watchlist" | "important" | "skip"
  ticker      String?
  createdAt   DateTime  @default(now())

  @@unique([coachPostId, tagType, ticker])
}

// ── Coach Intelligence Layer ──
model CoachProfile {
  id               String   @id @default(cuid())
  key              String   @unique // e.g., "terminology.SOW", "bias.direction", "chart.platform"
  value            Json
  source           String   @default("system_detected") // "system_detected" | "user_corrected" | "manual"
  confidence       Float    @default(0.5)
  lastUpdated      DateTime @updatedAt
  observationCount Int      @default(1)
}

model KnowledgeEntry {
  id        String   @id @default(cuid())
  category  String   // "pattern" | "instrument" | "term" | "chart_element" | "relationship"
  key       String   @unique
  data      Json
  source    String   @default("seed") // "seed" | "system_detected" | "user_added"
  validated Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ParseFeedback {
  id               String       @id @default(cuid())
  coachPostId      String
  coachPost        CoachPost    @relation(fields: [coachPostId], references: [id])
  parsedTradeId    String?
  parsedTrade      ParsedTrade? @relation(fields: [parsedTradeId], references: [id])
  feedbackText     String
  correctionType   String?      // "terminology" | "price_level" | "direction" | "pattern" | "missing_data"
  fieldsCorrected  String[]
  originalValues   Json?
  correctedValues  Json?
  processed        Boolean      @default(false)
  createdAt        DateTime     @default(now())
}
```

---

## 2. Agent Logic

### 2.1 Orchestrator
- Route: `POST /api/orchestrator/run` (cron or BullMQ trigger)
- State machine: `IDLE → INGESTING → PARSING → MONITORING → ALERTING → IDLE`
- Routes ingested posts through parser, registers tickers with price monitor, evaluates alerts on price updates
- Graceful degradation: dashboard stays functional if price API is down

### 2.2 Parser Pipeline

**Text pipeline (runs on paste, <100ms):**
1. Ticker extraction — regex + NLP (`$AAPL`, `AAPL`, "Apple stock")
2. Price target — "target $150", "PT: $200", "PT $185-190", "10-15% upside"
3. Confirmation price — "confirmed above $145", "entry at $140", "buy when it hits $138"
4. Date — relative ("by Friday", "next week") + absolute ("March 15th", "3/20")
5. Direction — long/short from: "calls", "puts", "bearish", "bullish", "short"
6. Stop loss — "stop at $130", "risk $5", "SL $128"
7. Confidence — 0-1 based on fields extracted + pattern match quality

**Image pipeline (async, Claude Vision API, 1-3s):**

Prompt template:
```
You are a trading chart analyst. Analyze this image from a day trading coach's post.
[Coach-specific context injected here by Coach Intelligence Agent]

Return ONLY valid JSON:
{
  "image_type": "stock_chart" | "annotated_chart" | "text_screenshot" | "other",
  "ticker": "string" | null,
  "price_levels": [
    { "value": number, "type": "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown", "label": "string" | null }
  ],
  "annotations": ["string"],
  "timeframe": "string" | null,
  "direction": "bullish" | "bearish" | "neutral" | null,
  "projected_dates": ["ISO date string"],
  "confidence": 0.0 to 1.0,
  "summary": "Brief description of what the chart shows"
}
```

**Claude API text fallback** (when confidence < 0.7 after merge):
```
You are a trading post parser. Extract structured trade data from this coach's post.
[Coach-specific context injected here]

Post: "{post_content}"

Return ONLY valid JSON:
{
  "trades": [{
    "ticker": "string",
    "direction": "long" | "short",
    "price_target_low": number | null,
    "price_target_high": number | null,
    "price_target_percent": number | null,
    "price_confirmation": number | null,
    "projected_date": "ISO date string" | null,
    "stop_loss": number | null,
    "confidence": 0.0 to 1.0,
    "raw_extract": "the substring you parsed this from"
  }]
}
```

**Merge strategy (text + image results):**
1. Text values take priority when both sources extract the same field
2. Image fills gaps when text parsing misses a field
3. Both sources agree → confidence score increases
4. Conflict → both values shown in UI with ⚠️ indicator; user picks one
5. `sourceType` tracks origin: `"text"` | `"image"` | `"combined"`

**Multi-ticker:** One post may produce multiple `ParsedTrade` records, all linked to the same `CoachPost`.

### 2.3 Coach Intelligence Agent

**Modules** (`packages/agents/src/coach-intelligence/`):
- `coach-profile.ts` — `loadProfile`, `updateProfile`, `getTerminology`, `getBias`, `getChartStyle`
- `knowledge-base.ts` — `search`, `getByKey`, `getByCategory`, `getInverseRelationships`, `addEntry`
- `context-builder.ts` — `buildParseContext()`, `buildVisionContext()` → plain-text blocks prepended to all Claude API calls
- `feedback-processor.ts` — `processFeedback(feedbackId)`, `classifyCorrection(text, original)`
- `vision-prompt.ts` — `getCoachVisionPrompt()` — dynamically injects current Coach Profile
- `index.ts` — exports all modules

**Context injection:** Before every parse, `buildParseContext()` assembles a "Coach decoder ring" (known terminology, directional bias, methodology, preferred instruments) prepended to the system prompt. `buildVisionContext()` replaces the generic Vision prompt with a Coach-aware version including chart style fingerprint (TradingView, red annotations, blue dashed support/resistance).

**Coach Profile bootstrap values:**
- `chart.platform = "TradingView"`
- `chart.annotation_color = "red"`
- `methodology.primary = "wyckoff"`
- `bias.current = "bearish"`
- `bias.preferred_instruments = ["inverse_etfs"]`
- Terminology: all Wyckoff terms mapped (see Knowledge Base seed below)

**Knowledge Base seed (50+ entries):**
- **Patterns:** Wyckoff distribution/accumulation phases, ascending broadening pattern, head and shoulders, double top/bottom, bull/bear flags, ascending/descending triangles, cup and handle
- **Instruments:** MAGS, SOX, SOXS (inverse of SOX), QQQ, SQQQ (inverse of QQQ), SPY, RUT, IWM, VIX, TLT — with inverse/correlation relationships
- **Wyckoff terms:** PSY, BC, AR, ST, SOW, LPSY, UTAD, UT, PS, SC, SOS, LPS, Spring
- **Chart elements:** horizontal_line, trendline, dashed_line, arrow, circle/oval, inset_diagram, gap

**Inverse ETF auto-detection:** After Vision identifies a ticker, query Knowledge Base for inverse relationships. If Coach's chart shows bearish SOX → auto-suggest SOXS long as secondary `ParsedTrade` (direction="long", mirrored price logic).

**Feedback pipeline** (runs async on `POST /api/feedback`):
1. Classify freeform text → `correctionType`, `fieldsCorrected`, `originalValues`, `correctedValues`
2. Update affected `ParsedTrade` with corrected values
3. Terminology corrections → update Coach Profile terminology map
4. Pattern/instrument corrections → update Knowledge Base entries
5. 3+ similar corrections of same type → log warning flagging prompt for refinement
6. Monthly tracking: corrected vs. uncorrected parse ratio by type

### 2.4 Price Monitor

**Direction-aware alert conditions:**
- Confirmation (long): `currentPrice >= activeTrade.priceConfirmation`
- Confirmation (short): `currentPrice <= activeTrade.priceConfirmation`
- Target (long): `currentPrice >= activeTrade.priceTargetHigh`
- Target (short): `currentPrice <= activeTrade.priceTargetLow`
- Stop loss (long): `currentPrice <= activeTrade.stopLoss`
- Stop loss (short): `currentPrice >= activeTrade.stopLoss`

**Proximity % for shorts:** `(priceConfirmation - currentPrice) / priceConfirmation * 100` — negative when price is above confirmation (not yet confirmed).

**Market hours (ET — user is in Dallas CT, account for UTC-5/UTC-6 offset):**
- Full-speed: 9:30 AM – 4:00 PM ET
- Reduced: 4:00 AM – 9:30 AM ET (pre-market) and 4:00 PM – 8:00 PM ET (after-hours)
- Pause: overnight and weekends

### 2.5 Notification Engine

**Alert priority (highest → lowest):**
1. Stop Loss Triggered (red, urgent sound)
2. Price Confirmation Reached (green, positive sound)
3. Price Target Reached (gold, celebration sound)
4. New Coach Post for tracked ticker (blue, subtle sound)

**Alert lifecycle:** `CREATED → TRIGGERED → DISPLAYED → ACKNOWLEDGED → ARCHIVED`

**v1 alert messages:**
- Confirmation: `"{TICKER} hit ${price} — Coach's confirmation price reached! Ready to enter."`
- Target: `"{TICKER} hit ${price} — Coach's price target reached! Consider taking profit."`
- Stop loss: `"{TICKER} dropped to ${price} — Stop loss level hit. Review position."`
- New post: `"Coach posted about {TICKER}"`

**v1 channels:** In-app toast (auto-dismiss 10s), browser tab title flash (`"🔔 {TICKER} Confirmed!"` alternates with app name every 2s until acknowledged), audio cue.

---

## 3. Feature Specifications

### 3.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│ [Logo] Coachtrack                              [X icon]  │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ All Posts│  TICKER  $XX.XX  [Confirmed ✓]     [trash]   │
│          │  N posts · Status                             │
│ ──────── │                                               │
│ WATCHLIST│  ┌─────────────────────────────────────────┐  │
│          │  │ Primary Card (latest post)              │  │
│ MAGS ... │  │ Chart + Metrics + Report footer         │  │
│ RUT  ... │  └─────────────────────────────────────────┘  │
│ SOX  ... │                                               │
│ SOXS ... │  Previous posts (N)                           │
│          │  ┌─ time · View · 🗑 ──────────────────────┐  │
├──────────┤  ┌─ time · View · 🗑 ──────────────────────┐  │
│[+QuickPaste]                                             │
└──────────┴───────────────────────────────────────────────┘
```

- Left panel: 290px fixed. Right panel: flex-1, scrollable.
- `selected` state: `"all"` → All Posts feed; ticker string → Ticker Detail view.
- **Mobile:** Left panel is full screen. Tapping a card slides right panel in as full takeover. "← Back" returns to left panel. Action panels become bottom sheets (max 85vh).

### 3.2 Left Panel

- **Logo Header:** Radar SVG (28×28) + "Coachtrack" (15px, 600) + X icon at far right (opens Coach's X feed in new tab)
- **All Posts card:** Title + total post count subtitle. No flag column. Selected: indigo border + accent-muted bg.
- **Ticker cards (unified watchlist + active):** "WATCHLIST" section label (11px, uppercase, tertiary). Each card: ticker (16px 600) + price (DM Mono 14px) + ONE proximity badge (Confirmed ✓ OR X.X% away).
  - **Alert flag column:** ONLY rendered when unread alert exists. Pulsing green, semantic-positive-muted bg. Card layout changes — not just visibility toggled.
  - Selected: accent-primary border + accent-muted bg, ticker text turns accent-primary.
- **Quick Paste button:** Full-width indigo, `"+ Quick Paste"`, pinned at bottom.

### 3.3 All Posts Feed (right panel, "all" selected)

- Posts in reverse chronological order, compact cards
- Each card: chart image placeholder (180px) + ticker + timestamp + ~80-char snippet
- **Smart Add Button** (mutually exclusive states):
  - `"+ Add to Watchlist"` — ticker NOT on watchlist
  - `"Update Watchlist"` — ticker IS on watchlist AND this post is NEWER than tracked post
  - `"✓ Added"` — this post is already tracked or a newer post is tracked (not clickable)
- Delete button (✕) on each card

### 3.4 Ticker Detail (right panel, ticker selected)

**Header:** Ticker + current price + proximity badge + post count + status subtitle + trash icon button (opens Delete panel)

**Inline alert:** Shown ONLY when ticker has unacknowledged alert. Dismissing clears both the inline alert AND the left panel flag.

**Primary Post Card (latest post):**
- Chart image placeholder (180px, bg-elevated)
- "Latest" label (11px uppercase, accent-primary) + timestamp
- Show/Hide toggle for raw post text
- "+ Update" button (opens Quick Paste for this ticker)
- **Metrics row:** 3 columns with border-subtle dividers: Target (price) | Date (projected) | Confidence (% + ✦ sparkle)
- **Report footer** (inside card): `"Analysis not right? **Report**"` link. After submit: `"✓ Feedback saved"` (semantic-positive, auto-clears 3s). Centered mobile, left-aligned desktop.

**Older posts:** "Previous posts (N)" section label. Each row: clock icon + timestamp + "View" (ghost, expands to show text) + trash. Tight 6px gap between rows.

### 3.5 Quick Paste

**Trigger:** `Cmd+Shift+V` (global), `"+ Quick Paste"` button, `"+ Update"` on Primary Post Card.

**Opens as action panel** — side panel desktop (400px, slides from right), bottom sheet mobile (max 85vh).

**Image constraints:** PNG/JPG/WEBP/GIF, 10MB max per image, up to 4 images per post. Drop zone, clipboard paste (`Cmd+V`), and file picker all supported.

**Image status indicators:**
- ⏳ `"Analyzing..."` — shimmer animation while Vision API processes
- ✅ `"Analyzed"` — with extracted summary (e.g., `"AAPL | $172 resistance | $190 target"`)
- ⚠️ `"No trade data found"` — image is decorative/irrelevant

**URL detection:** If pasted content looks like a URL, show: `"URLs can't be fetched — please paste the post text"`

**Source indicators on each field:** 📝 text | 📊 image | 🔗 both agree | ⚠️ conflict (show both values)

**Pre-population guarantee (non-negotiable):**
- `"Add to Feed + Watchlist"` (`Cmd+W`) → creates `WatchlistItem` linked to `ParsedTrade`; ParsedTrade carries: `priceTargetLow`, `priceTargetHigh`, `priceConfirmation`, `projectedDate`, `stopLoss`, `direction`, `supportLevel`, `resistanceLevel`
- `"Add to Feed + Active"` (`Cmd+A`) → creates `ActiveTrade` with pre-populated: `ticker`, `direction`, `priceConfirmation`, `priceTargetHigh`, `priceTargetLow`, `projectedDate`, `stopLoss`, `parsedTradeId`, `status: "pending"`

**Save actions:**
- `"Add to Feed"` (`Enter`) — saves CoachPost + ParsedTrades only
- `"Add to Feed + Watchlist"` (`Cmd+W`) — saves + creates pre-populated WatchlistItem
- `"Add to Feed + Active"` (`Cmd+A`) — saves + creates pre-populated ActiveTrade

**Post-save:** Panel closes, toast confirmation with 5-second undo window, feed updates via Supabase Realtime.

### 3.6 Alert System

- No persistent top banner. No global alert drawer. No `/alerts` page (v1).
- Flag icon on left panel ticker card ONLY when unread alert exists (column not rendered at all otherwise).
- Toast position: top-right desktop (slide from right), bottom mobile (slide up, full-width, stack newest at bottom). Structure: 3px colored left accent bar + icon + label + message + ✕. Auto-dismiss 10s.
- Configurable per-type toggles in settings.

### 3.7 Report Feedback

Report action panel content:
- Header: `"Report Issue"` / `"Help improve how the system interprets Coach's posts"`
- Body: textarea with placeholder, helper text about training
- Footer: Cancel + `"Submit Report"` (accent-primary, disabled until text entered)

### 3.8 Delete Action Panel

Delete action panel content:
- Header: `"Remove {TICKER} from Watchlist"` / `"This action can't be undone"`
- Body: red warning box with post count + what gets removed
- Footer: Cancel + `"Remove {TICKER}"` (semantic-negative bg, white text)

### 3.9 Settings (`/settings`)

- Alert preferences: toggle sound per alert type, volume control
- Default view preference
- Price check interval: 15s / 30s / 60s
- PIN/password change
- Polygon.io API key input
- Anthropic API key input
- Data export (JSON or CSV)
- Clear all data / reset

### 3.10 Keyboard Shortcuts

- `Cmd+Shift+V` — Open Quick Paste
- `Cmd+K` — Global search (command palette, Mercury-style)
- `Cmd+W` — (in Quick Paste) Add to Watchlist
- `Cmd+A` — (in Quick Paste) Add to Active
- Double-click price field — Edit inline
- Right-click trade card — Context menu: Mark Confirmed, Mark Entered, Close, Add Note, View Coach Posts

---

## 4. API Routes

### Feed

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/feed` | List coach posts (paginated, filterable by ticker/date/keyword) |
| `POST` | `/api/feed/ingest` | Manual ingestion (text + optional images as multipart/form-data) |
| `POST` | `/api/feed/ingest/bulk` | Bulk import (posts separated by blank lines or `---`) |
| `GET` | `/api/feed/[postId]` | Get single post with parsed trades and image analysis |
| `GET` | `/api/feed/latest/[ticker]` | Most recent post mentioning a ticker |

### Parsing

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/parse/preview` | Preview NLP parsing of text (live preview in Quick Paste) |
| `POST` | `/api/parse/image` | Analyze image via Claude Vision API |
| `POST` | `/api/parse/merge` | Merge text + image results into unified ParsedTrade data |
| `POST` | `/api/parse/refine` | Claude API text fallback for low-confidence parses |

### Watchlist

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/watchlist` | List watchlist items with latest coach post per ticker |
| `POST` | `/api/watchlist` | Add ticker to watchlist |
| `PATCH` | `/api/watchlist/[id]` | Update watchlist item |
| `DELETE` | `/api/watchlist/[id]` | Remove from watchlist |
| `POST` | `/api/watchlist/[id]/promote` | Move to active trades (pre-fills from parsed trade data) |

### Active Trades

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/trades` | List active trades with current prices |
| `POST` | `/api/trades` | Create active trade |
| `PATCH` | `/api/trades/[id]` | Update trade |
| `PATCH` | `/api/trades/[id]/status` | Transition status: pending → confirmed → entered → closed |
| `GET` | `/api/trades/history` | Get closed trade history |

### Alerts

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/alerts` | List alerts |
| `PATCH` | `/api/alerts/[id]/acknowledge` | Mark acknowledged |
| `POST` | `/api/alerts/acknowledge-all` | Acknowledge all unread |
| `GET` | `/api/alerts/unread-count` | Count of unacknowledged alerts |

### Prices & System

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/prices/[ticker]` | Current price for a ticker |
| `GET` | `/api/prices/batch` | Current prices for multiple tickers |
| `GET` | `/api/prices/history` | Historical price data |
| `GET` | `/api/health` | System health check (DB, price feed, job queue) |
| `GET` | `/api/market/status` | Market status: open / pre-market / after-hours / closed |

### Coach Intelligence

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/coach/profile` | All current Coach Profile entries |
| `PUT` | `/api/coach/profile/[key]` | Update a Coach Profile entry |
| `GET` | `/api/knowledge/search?q=` | Full-text search across Knowledge Base |
| `POST` | `/api/knowledge` | Add a Knowledge Base entry |
| `POST` | `/api/feedback` | Submit parse feedback (async processing) |
| `GET` | `/api/feedback/stats` | Correction pattern analytics |

---

## 5. Environment Variables

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...              # Prisma migrations (bypasses connection pooler)

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SUPABASE_STORAGE_BUCKET=coach-images     # Bucket for uploaded chart screenshots

POLYGON_API_KEY=your-polygon-key
ANTHROPIC_API_KEY=your-anthropic-key
REDIS_URL=redis://...

APP_PIN=hashed_pin_for_single_user_auth
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 6. Repository Structure

```
coach-trade-tracker/
├── docs/
│   ├── design-system.md              # Design tokens, typography, component patterns
│   └── handoffs/                     # Component handoff specs
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/login/page.tsx
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx          # Entire master-detail layout (single route)
│       │   ├── api/
│       │   │   ├── feed/route.ts + ingest/ + ingest/bulk/ + [postId]/ + latest/[ticker]/
│       │   │   ├── parse/preview/ + image/ + merge/ + refine/
│       │   │   ├── watchlist/route.ts + [id]/ + [id]/promote/
│       │   │   ├── trades/route.ts + [id]/ + [id]/status/ + history/
│       │   │   ├── alerts/route.ts + [id]/acknowledge/ + acknowledge-all/ + unread-count/
│       │   │   ├── prices/[ticker]/ + batch/ + history/
│       │   │   ├── market/status/
│       │   │   ├── coach/profile/ + profile/[key]/
│       │   │   ├── knowledge/search/ + knowledge/route.ts
│       │   │   ├── feedback/route.ts + stats/
│       │   │   ├── orchestrator/run/
│       │   │   └── health/
│       │   └── layout.tsx
│       ├── app/globals.css            # CSS custom properties (synced with design-system.md)
│       ├── components/
│       │   ├── ui/                    # shadcn/ui primitives
│       │   ├── primitives/
│       │   │   ├── PriceBadge.tsx
│       │   │   ├── ProximityBadge.tsx
│       │   │   ├── SmartAddButton.tsx
│       │   │   ├── ConfidenceBadge.tsx
│       │   │   ├── StatusChip.tsx
│       │   │   ├── SourceIndicator.tsx
│       │   │   ├── ProgressBar.tsx
│       │   │   ├── TickerBadge.tsx
│       │   │   └── ShimmerLoader.tsx
│       │   ├── layout/
│       │   │   ├── LeftPanel.tsx
│       │   │   ├── RightPanel.tsx
│       │   │   └── ActionPanel.tsx
│       │   ├── left-panel/
│       │   │   ├── LogoHeader.tsx
│       │   │   ├── AllPostsCard.tsx
│       │   │   └── TickerCard.tsx
│       │   ├── right-panel/
│       │   │   ├── AllPostsFeed.tsx
│       │   │   ├── TickerDetail.tsx
│       │   │   ├── PrimaryPostCard.tsx
│       │   │   ├── OlderPostRow.tsx
│       │   │   └── InlineAlert.tsx
│       │   ├── action-panels/
│       │   │   ├── ReportPanel.tsx
│       │   │   └── DeletePanel.tsx
│       │   ├── quick-paste/
│       │   │   ├── QuickPasteModal.tsx
│       │   │   ├── ParsePreview.tsx
│       │   │   ├── ImageDropZone.tsx
│       │   │   ├── ImageAnalysisBadge.tsx
│       │   │   ├── FieldSourceIndicator.tsx
│       │   │   └── ConflictResolver.tsx
│       │   └── alerts/
│       │       └── ToastContainer.tsx
│       ├── hooks/
│       │   ├── useQuickPaste.ts
│       │   ├── useWindowWidth.ts
│       │   ├── useIsMobile.ts
│       │   ├── useActionPanel.ts
│       │   ├── usePrices.ts
│       │   ├── useAlerts.ts
│       │   └── useMarketStatus.ts
│       ├── lib/
│       │   ├── db.ts                  # Prisma client singleton
│       │   ├── supabase/client.ts + server.ts
│       │   ├── polygon.ts
│       │   ├── utils.ts
│       │   └── constants.ts
│       └── stores/
│           ├── selection.ts           # selected ticker + mobileShowDetail
│           ├── watchlist.ts
│           ├── alerts.ts
│           ├── feed.ts
│           └── ui.ts
├── packages/
│   ├── agents/
│   │   ├── orchestrator.ts
│   │   ├── parser/
│   │   │   ├── index.ts
│   │   │   ├── regex-pipeline.ts
│   │   │   ├── image-analyzer.ts
│   │   │   ├── merge-strategy.ts
│   │   │   ├── claude-fallback.ts
│   │   │   ├── ticker-extractor.ts
│   │   │   ├── price-extractor.ts
│   │   │   ├── date-extractor.ts
│   │   │   └── confidence-scorer.ts
│   │   ├── coach-intelligence/
│   │   │   ├── coach-profile.ts
│   │   │   ├── knowledge-base.ts
│   │   │   ├── context-builder.ts
│   │   │   ├── feedback-processor.ts
│   │   │   ├── vision-prompt.ts
│   │   │   └── index.ts
│   │   ├── price-monitor.ts
│   │   ├── alert-evaluator.ts
│   │   └── notifier.ts
│   ├── db/prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── shared/
│       ├── types.ts                   # Single source of truth for all request/response shapes
│       ├── constants.ts
│       └── validators.ts              # Zod schemas
├── turbo.json
├── package.json
├── tsconfig.json
├── .env.local
└── docker-compose.yml                 # Local dev (Postgres + Redis)
```

---

## 7. Testing Priorities

1. **Parser fixtures** — `tests/parser/fixtures/` with 50+ examples (use Section 8 patterns). Include text-only, image-only, combined. Run on every commit.
2. **Pre-population integration tests** — For each path (Quick Paste → Watchlist, Quick Paste → Active, Watchlist → Active): verify every extracted field carries through with zero data loss.
3. **Alert evaluation** — Mock price feeds, verify direction-aware trigger conditions including boundary values.
4. **E2E (Playwright)** — Quick Paste flow: paste text + drop image → text parse instant → image analysis streams in → merged fields → `"+ Active"` → verify all fields on new ActiveTrade.

---

## 8. Example Coach Post Patterns (Parser Test Fixtures)

```
// Pattern 1: Full recommendation
"$AAPL looking strong. PT $185-190. Confirmed above $172. Should hit by 3/20. SL $165."
→ { ticker: "AAPL", direction: "long", targetLow: 185, targetHigh: 190, confirmation: 172, date: "2026-03-20", stopLoss: 165 }

// Pattern 2: Percentage target
"TSLA could see 15-20% upside from here. Watch for break above $895."
→ { ticker: "TSLA", direction: "long", targetPercent: [15,20], confirmation: 895 }

// Pattern 3: Short/bearish
"Bearish on $META. Puts looking good. Target $480. Confirmed below $510."
→ { ticker: "META", direction: "short", targetHigh: 480, confirmation: 510 }

// Pattern 4: Multiple tickers
"Watching $NVDA and $AMD. Both confirmed above their 50-day MAs. NVDA PT $300, AMD PT $170."
→ [
  { ticker: "NVDA", confirmation: null, targetHigh: 300 },
  { ticker: "AMD", confirmation: null, targetHigh: 170 }
]

// Pattern 5: Informal/conversational
"Apple is going to rip next week. I'm looking at $190 easy. Get in above $175."
→ { ticker: "AAPL", direction: "long", targetHigh: 190, confirmation: 175, date: "next week" }

// Pattern 6: Update to existing position
"AAPL update: raising PT to $195. New confirmation at $178. Still bullish."
→ { ticker: "AAPL", direction: "long", targetHigh: 195, confirmation: 178, isUpdate: true }

// Pattern 7: Non-trade post (market commentary)
"Market looking shaky today. Be careful out there. Cash is a position."
→ { trades: [] }

// Pattern 8: Emoji-heavy
"🚀 $NVDA to the moon! 🎯 $310 by end of month. Entry above $285 ✅"
→ { ticker: "NVDA", direction: "long", targetHigh: 310, confirmation: 285, date: "end of month" }

// Pattern 9: Text + Chart Image (combined)
Text: "$AAPL looking strong here"
Image: [Chart showing AAPL: horizontal line at $172 labeled "entry", $190 labeled "target", support at $168]
→ Text parse: { ticker: "AAPL", direction: "long", confidence: 0.3 }
→ Image parse: { ticker: "AAPL", confirmation: 172, targetHigh: 190, supportLevel: 168, confidence: 0.85 }
→ Merged: { ticker: "AAPL", direction: "long", confirmation: 172, targetHigh: 190, supportLevel: 168, sourceType: "combined", confidence: 0.88 }

// Pattern 10: Chart-only post
Text: "👀"
Image: [TSLA daily: ascending channel, resistance $920, support $875, current $891]
→ Text parse: { trades: [] }
→ Image parse: { ticker: "TSLA", resistanceLevel: 920, supportLevel: 875, direction: "bullish", confidence: 0.75 }
→ Merged: { ticker: "TSLA", resistanceLevel: 920, supportLevel: 875, direction: "long", sourceType: "image", confidence: 0.75 }

// Pattern 11: Multiple images
Text: "$AAPL and $NVDA setups for tomorrow"
Image 1: [AAPL chart with PT $190]
Image 2: [NVDA chart with entry at $285]
→ Creates TWO ParsedTrade records, each linked to its respective image

// Pattern 12: Annotated screenshot
Text: ""
Image: [TradingView chart with coach's drawn arrows: "BUY HERE →" at $172, "TARGET" at $190]
→ Image parse: { confirmation: 172, targetHigh: 190, direction: "bullish", confidence: 0.8 }
```
