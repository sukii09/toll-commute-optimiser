# Project Documentation Context (Non-Obvious Only)

- `tolls.js` looks like the pricing engine but is NOT used for displayed prices — it is purely reference/audit data with 2026 published operator tables. Real prices come from Google's API response.
- The `<div id="maps-loader">` at the bottom of `index.html` is a comment placeholder, not a functional loader — Maps is injected via `loadGoogleMaps()` in `app.js`.
- Three separate Google Routes API calls are made per search (not one) — this is the core design decision that enables finding the "middle" route navigation apps miss.
- `annualCost()` is defined in `tolls.js` but called from `app.js` — cross-file global coupling with no import.
- Peak hours are weekdays 06:00–08:59 and 16:00–18:59 (defined in `checkPeak()` in `tolls.js`); weekends are never peak regardless of time.
- The Autocomplete bounds are hard-coded to Melbourne (lat/lng box) — the app is intentionally Melbourne-only.
