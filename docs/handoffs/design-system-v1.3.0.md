# Coachtrack — Design System Update
## Version 1.2.0 → 1.3.0

**Date:** March 12, 2026

Apply these additions to `design-system.md`. All v1.2.0 patterns remain unchanged.

---

## New Component Pattern

### Trade Summary Chart

SVG line chart rendered from structured data. Replaces the chart placeholder in the Primary Post Card. Every chart follows the same visual language regardless of Coach's source screenshot.

- **Container:** Rendered inside the Primary Post Card's image area. No border or background of its own — inherits from the card.
- **SVG:** `viewBox="0 0 540 260"`, `width: 100%`, responsive.
- **Padding:** top: 20px, right: 60px (Y-axis labels), bottom: 30px (X-axis), left: 50px.

#### Visual Layers (back to front)

| Layer | Element | Color | Weight | Opacity | Notes |
|-------|---------|-------|--------|---------|-------|
| 1 | Y-axis grid | `rgba(255,255,255,0.04)` | 0.5px | — | 5–6 horizontal lines |
| 2 | Time window band | `--accent-primary` | fill | 4% | Full chart height, dashed vertical edges at 20% |
| 3 | Target zone fill | `--semantic-positive` | fill | 7% | Constrained to time window if present |
| 4a | Target lines | `--semantic-positive` | 0.5px | 40% | Dashed `4,4` |
| 4b | Confirmation line | `--semantic-warning` | 0.75px | 50% | Dashed `6,3` |
| 4c | Stop loss line | `--semantic-negative` | 0.75px | 45% | Dashed `3,3` |
| 5 | Price area fill | `--accent-primary` gradient | — | 12% → 0% | LinearGradient top to bottom |
| 6 | Price line | `--accent-primary` | 1.5px | 100% | Solid, round joins/caps |
| 7 | Projected line | `--accent-primary` | 1px | 35% | Dashed `4,4` |
| 8 | Current price dot | `--accent-primary` | 3.5px r | 100% | 2px `--bg-surface` stroke |
| 9 | Price badge | `--accent-primary` fill | — | 90% | DM Mono, `--text-inverse` text |
| 10 | Level labels | Same as line color | 9px | 100% | Weight 500, uppercase, 0.04em tracking |
| 11 | Time window pill | `--accent-primary` 12% fill | 9px | 100% | `--accent-primary-hover` text |
| 12 | Duration text | `--text-tertiary` | 9px | 100% | Centered below time band |
| 13 | Y-axis labels | `--text-tertiary` | DM Mono 10px | 100% | Right-aligned outside chart area |
| 14 | X-axis labels | `--text-tertiary` | DM Sans 10px | 100% | Center-aligned below chart |

#### Level Line Styles

| Level | Color Token | Stroke | Dash | Opacity | Label Position |
|-------|-------------|--------|------|---------|----------------|
| Target | `--semantic-positive` | 0.5px | `4,4` | 40% | Above line, left-aligned |
| Confirmation | `--semantic-warning` | 0.75px | `6,3` | 50% | Above line, left-aligned |
| Stop loss | `--semantic-negative` | 0.75px | `3,3` | 45% | Below line, left-aligned |

#### Time Window Overlay

Vertical band indicating the expected time range for the target price to be reached.

- **Band:** `--accent-primary` at 4% opacity, full chart height, rounded corners (3px)
- **Edge lines:** `--accent-primary` at 20% opacity, 0.5px, dashed `3,4`
- **Top pill:** Centered at top of band. `--accent-primary` 12% fill, 3px radius, 88px wide, 16px tall. Text: 9px, weight 500, `--accent-primary-hover` color.
- **Duration label:** Centered below the band at the X-axis. 9px, `--text-tertiary`.
- **Target zone intersection:** When both time window and target zone exist, the green target fill is constrained to the time window's X range, creating a highlighted "sweet spot" rectangle.

#### Legend

Rendered in HTML below the SVG (not inside SVG). Uses the existing chart footer pattern.

```html
<div class="chart-footer">
  <div class="legend-item"><div class="legend-dot" style="background:--accent-primary"></div>Price</div>
  <div class="legend-item"><div class="legend-line" style="border-color:--accent-primary"></div>Projected</div>
  <div class="legend-item"><div class="legend-dot" style="background:--semantic-positive"></div>Target zone</div>
  <div class="legend-item"><div class="legend-dot" style="background:--semantic-warning"></div>Confirmation</div>
  <div class="legend-item"><div class="legend-dot" style="background:--semantic-negative"></div>Stop</div>
</div>
```

Legend items are conditional — only show items that have data (e.g., omit "Stop" if no stop loss).

---

## Changelog Entry

| Version | Date | Changes |
|---------|------|---------|
| 1.3.0 | 2026-03-12 | Trade Summary Chart: SVG line chart component replacing chart placeholder in Primary Post Card. Layers spec (grid, time window, target zone, level lines, price line, projected path, current price dot). Time Window Overlay pattern (vertical band + pill + duration label + target zone intersection). Level Line Styles table (target/confirmation/stop with distinct dash patterns and colors). Legend pattern (HTML footer, conditional items). |
