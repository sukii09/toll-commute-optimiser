# Project Architecture Rules (Non-Obvious Only)

- **Three-request pattern is load-bearing**: The single most important architectural decision is firing 3 `requestRoutes()` calls per analysis (standard+alternatives, toll-free, optional via-point) and merging with `Promise.allSettled`. Any feature touching route retrieval must preserve this.
- **Routes API constraint**: `computeAlternativeRoutes` and `intermediates` cannot coexist in one request — the via-point path is always a separate call with alternatives disabled.
- **Deduplication is by description+duration** (60 s window), not polyline — identical roads from different requests are merged here; any new route request type must pass through `dedupeRoutes()`.
- **Max 4 routes to the map** (`topRoutes = routeData.slice(0,4)`) — this is a deliberate UX constraint for map readability, not a bug.
- **`TOLL_DATA` / `annualCost` / `checkPeak` are shared globals** from `tolls.js`, loaded before `app.js` in `index.html`. Any architectural change that modularises files must keep this load order.
- **No server-side component** — the API key is a browser key stored in `localStorage`. There is no backend, proxy, or secrets store. Pricing must remain client-side only.
- **`buildDepartureTime` converts UI day+time to a real future Date** because the Routes API requires an actual timestamp, not a relative day — always pass a `Date` object to `requestRoutes`.
