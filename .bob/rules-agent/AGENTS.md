# Project Coding Rules (Non-Obvious Only)

- No build step — changes to `.js`/`.css`/`.html` take effect immediately on browser refresh; never add a compile step.
- All JS is global scope — new functions go directly in `app.js`, no IIFE, no modules.
- `TOLL_DATA` in `tolls.js` is audit-only — **never read it** to populate UI toll prices; those must come from `route.travelAdvisory.tollInfo` exclusively.
- When adding a new route request strategy, add it to the `requests` array in `analyse()` and give it a `strategy` string; `buildRouteCard()` uses `strategyLabels[r.strategy]` to render its badge — add the matching entry there.
- `computeAlternativeRoutes: true` and `intermediates` are mutually exclusive in the Routes API — never combine them in one `requestRoutes()` call.
- CSS colours must use the `:root` custom properties (e.g. `var(--accent)`, `var(--bg2)`). Do not hardcode hex values in new rules.
- The Google Maps script is injected dynamically by `loadGoogleMaps()`. Do not add a `<script src="maps.googleapis.com/...">` tag to `index.html`.
- `annualCost()` is defined in `tolls.js` but used in `app.js` — it is a shared global; do not redefine it.
