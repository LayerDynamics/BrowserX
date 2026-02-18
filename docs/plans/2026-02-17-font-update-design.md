# Font Update Design — Space Grotesk + Manrope + Fira Code

**Date:** 2026-02-17
**Scope:** `doc-site/` — Astro/Starlight documentation site

## Goal

Replace the current Syne + DM Sans + JetBrains Mono font stack with a more modern, cohesive set that reads like leading dev-tool doc sites (Vercel, Linear, Stripe).

## Font Stack

| Role     | Old           | New           | License |
|----------|---------------|---------------|---------|
| Headings | Syne          | Space Grotesk | OFL 1.1 |
| Body     | DM Sans       | Manrope       | OFL 1.1 |
| Mono     | JetBrains Mono| Fira Code     | OFL 1.1 |

All three fonts are available on Google Fonts with no licensing restrictions.

## Changes Required

### `doc-site/astro.config.mjs`
- Replace the Google Fonts `<link>` `href` with a new URL loading:
  - `Space+Grotesk:wght@400;500;600;700`
  - `Manrope:wght@300;400;500;600`
  - `Fira+Code:wght@400;500;600`

### `doc-site/src/styles/global.css`
- `--sl-font` → `'Manrope', system-ui, sans-serif`
- `--sl-font-mono` → `'Fira Code', 'Fira Mono', monospace`
- All `font-family: 'Syne'` → `'Space Grotesk'`
- All `font-family: 'DM Sans'` → `'Manrope'`
- All `font-family: 'JetBrains Mono'` → `'Fira Code'`
- Heading `letter-spacing`: `-0.02em` → `-0.01em` (Space Grotesk needs less tracking than Syne)
- Site title `letter-spacing`: `-0.03em` → `-0.02em`
- Body `letter-spacing`: no change (Manrope reads well at default)

## Non-Goals

- No color changes
- No layout changes
- No font-size changes
- No changes to any component outside `global.css` and `astro.config.mjs`
