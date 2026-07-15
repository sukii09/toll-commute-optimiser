# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project

Vanilla HTML/CSS/JS static site — no build step, no package manager, no bundler. Three files do everything: `index.html`, `app.js`, `tolls.js`, `style.css`.

## Running locally

```bash
python3 -m http.server 8080
```

No npm, no node. Open http://localhost:8080, then configure a Google Maps API key through the ⚙ settings panel (stored in `localStorage`, never committed).

## No tests, no lint

There is no test suite, linter, or formatter configured. Manual browser testing is the only validation.

## Architecture — critical non-obvious points

- **Google Maps is loaded dynamically at runtime** (`app.js` `loadGoogleMaps()`), not via a `<script>` tag in `index.html`. The `<div id="maps-loader">` at the bottom of `index.html` is a placeholder comment, not a loader — the actual script tag is injected by JS.
- **Three separate route requests are fired** for each analysis (`requestRoutes` called up to 3 times with `Promise.allSettled`): default+alternatives, toll-free, and optionally via-point. This is intentional to surface the middle-priced option Google wouldn't normally return in a single call.
- **`computeAlternativeRoutes` and `intermediates` cannot be combined** in a single Routes API request — the via-point request explicitly sets `computeAlternativeRoutes: false`.
- **`TOLL_DATA` in `tolls.js` is reference/audit data only** — it is NOT used to calculate toll costs shown in the UI. All displayed toll prices come exclusively from Google's Routes API response (`travelAdvisory.tollInfo`). Do not add code that reads `TOLL_DATA` for route card pricing.
- **Toll pass is always `AU_LINKT`** with `emissionType: 'GASOLINE'` in every Routes API request.
- **`annualCost()` assumes one one-way trip × 5 days × 48 weeks** (not 52 — excludes ~4 weeks holiday).
- **Peak hours**: weekdays 06:00–08:59 and 16:00–18:59 only. Weekends are never peak.
- **Deduplication** matches routes by `route.description` string + duration within 60 seconds — not by polyline.
- Max 4 routes are rendered (map readability constraint), though more may be returned.

## Code style

- Plain ES2020+ (async/await, optional chaining, `?.`, nullish coalescing).
- No classes, no modules (`import`/`export`), no TypeScript. Everything is global scope.
- DOM IDs are the interface — functions query by `getElementById` / `querySelector` directly.
- Template literals for all HTML strings in JS (see `buildRouteCard`).
- CSS custom properties (vars) defined in `:root` — always use vars, never hardcode colours.
- Fonts: `Syne` (headings/numbers, `--font-head`) and `DM Mono` (body/UI, `--font-mono`).

## Toll data maintenance

When updating `tolls.js` prices, also update the reference table in `README.md` in the same commit. Prices:
- CityLink + West Gate Tunnel: quarterly (every 1 Jan, Apr, Jul, Oct)
- EastLink: annually (1 July)
