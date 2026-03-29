# Claude Code Handoff — Coach Trade Tracker

## What's In This Package

```
CLAUDE.md                       ← Claude Code reads this automatically every session
.env.example                    ← Environment variables template
docker-compose.yml              ← Local Postgres + Redis for development
docs/
  prd.md                        ← Full PRD (1,900 lines) — architecture, schema, agents, features, milestones
  design-system.md              ← Mercury Dark Mode design tokens, typography, component patterns
  handoffs/
    TEMPLATE.md                 ← Template for component handoff specs from design sessions
```

## Setup Instructions

### Step 1: Create the project

```bash
# Create a new directory and initialize
mkdir coach-trade-tracker && cd coach-trade-tracker

# Copy all handoff files into the project root
# (CLAUDE.md, .env.example, docker-compose.yml, docs/)
```

### Step 2: Start local services

```bash
docker compose up -d
```

This starts Postgres (port 5432) and Redis (port 6379) for local development.

### Step 3: Set up environment

```bash
cp .env.example .env.local
```

Fill in your keys:
- **Supabase**: Create a project at supabase.com, get URL + keys
- **Polygon.io**: Sign up for free tier at polygon.io, get API key
- **Anthropic**: Get API key from console.anthropic.com (for Claude Vision image analysis + text parsing fallback)

### Step 4: Start Claude Code

```bash
claude
```

Claude Code will automatically read `CLAUDE.md` and discover the `@docs/prd.md` and `@docs/design-system.md` references. Give it the first task:

### Step 5: First prompt to Claude Code

```
Read @docs/prd.md and @docs/design-system.md completely.

Then scaffold the project following the Build Order in CLAUDE.md:

1. Initialize a Turborepo monorepo with a Next.js 14 app (TypeScript, Tailwind, App Router)
2. Set up Prisma with the full schema from PRD Section 4.3
3. Create globals.css with all CSS custom properties from design-system.md
4. Install DM Sans and DM Mono from Google Fonts
5. Install and configure shadcn/ui (dark theme)
6. Create the directory structure from PRD Section 12

Don't build any features yet — just the scaffold.
```

### Step 6: Build features incrementally

After scaffolding, work through the build order one step at a time:

```
Build the primitive components: PriceBadge, StatusChip, TickerBadge,
ShimmerLoader, ConfidenceMeter, SourceIndicator.

Follow the component patterns in design-system.md. Use the semantic
tokens — no hardcoded colors. DM Mono for all prices/numbers.
```

Then:

```
Build the Quick Paste modal — this is the #1 feature.
See PRD Section 5.2 for the ingestion flow and Section 6.5 for
the full feature spec including image drop zone.

Start with text parsing only (regex pipeline from Section 5.3).
Use mock data for the UI, wire up /api/parse/preview for live parsing.
```

Continue through the build order in `CLAUDE.md`, one step per session.

## How the Design Workflow Works

You'll iterate on UI design in **regular Claude chat** (claude.ai) using React artifacts, then hand finished designs to **Claude Code** for production builds.

### Designing in Claude Chat

When starting a design session, paste this context into Claude chat:

```
I'm designing components for Coach Trade Tracker. Here's the design system:

[paste contents of docs/design-system.md]

Build a React artifact prototype for [component name].
Use DM Sans + DM Mono fonts, Tailwind CSS, shadcn/ui, Lucide icons.
Use CSS custom properties from the design system (include them in an
inline <style> block). Use mock data that matches the Prisma schema shapes.
```

### Handing off designs to Claude Code

When a prototype is approved:

1. Copy `docs/handoffs/TEMPLATE.md` to `docs/handoffs/NNN-component-name.md`
2. Fill in the spec (props, states, interactions, tokens used)
3. In Claude Code, run:

```
Read the handoff spec at docs/handoffs/NNN-component-name.md
and build it. Follow design-system.md for all tokens and patterns.
Replace mock data with real API calls to the routes in the PRD.
If the spec introduces new tokens, update design-system.md first.
```

## Tips for Working with Claude Code on This Project

1. **One feature per session.** Clear context between unrelated tasks with `/clear`.
2. **Scaffold first, features second.** Get the project structure and types right before building UI.
3. **Test the parser early.** Create `tests/parser/fixtures/` with real coach post examples. Run `npm run test:parser` after every parser change.
4. **Verify pre-population.** After building Quick Paste → Watchlist/Active flows, manually test: paste post → click "+Active" → verify every field transferred.
5. **Use plan mode for architecture.** Press `Shift+Tab` twice before complex tasks (schema changes, new agent logic) so Claude researches before writing.
6. **Keep design-system.md current.** Every time you add a token or change a pattern in a design session, update the file before the next Claude Code session.
