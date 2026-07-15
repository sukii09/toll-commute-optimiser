# Best Value Route Feature — Implementation Plan

## Top-Level Overview

Add a **Best Value** preference option that answers: *"Is paying this toll worth the time I save?"*

The feature introduces:
1. A fourth preference pill — **Best Value** — alongside Fastest, Cheapest, and Balanced.
2. A **hourly time value input** (`$25/hr` default, `$0` valid, negative is an error) persisted to `localStorage` under the key `commute_hourly_value`.
3. A **two-pass process in `renderResults()`**: first build the full `routeData` array, then identify the baseline, then compute net values and ranking scores.
4. `netValue`, `annualNetValue`, `verdict`, and `isBaseline` stored directly on each `routeData` object; no extra `buildRouteCard` parameter needed.
5. A **value verdict** rendered on each route card: "Worth it", "Not worth it", "Break-even", or "Value unavailable".
6. A ranking function that sorts routes with known prices by highest net value; unknown-price routes fall back to duration sort with no financial recommendation.

All changes are purely additive client-side modifications to `index.html`, `app.js`, and `style.css`. `README.md` requires a short feature description update. No new APIs, frameworks, or build steps. `tolls.js` is not modified.

---

## Sub-Tasks

---

### Sub-Task 1 — Add the hourly value input to the UI

**Status:** `[ ] pending`

**Intent**
Introduce the `What is your time worth?` input field. It must appear in the input panel, be hidden until Best Value is active, satisfy accessibility requirements, and persist its value across sessions via `localStorage`.

**Expected Outcomes**
- A labelled numeric input (`id="hourly-value"`) sits below the preference pills row in `index.html`.
- It is visually hidden (`display:none`) when any other preference is selected and revealed (`display:flex`) when Best Value is active.
- The input has `type="number"`, `min="0"`, `step="0.50"`, and an accessible `<label for="hourly-value">`.
- Helper text is linked via `aria-describedby="hourly-value-hint"`.
- On page load, `app.js` reads `localStorage.getItem('commute_hourly_value')` and populates the field; if absent, defaults to `25`.
- On change, the value is written back to `localStorage.setItem('commute_hourly_value', value)` after validation.
- An inline `<span id="hourly-value-error">` (initially hidden) shows a validation error when a negative value is entered.

**Todo List**
1. In `index.html` after the `.pref-row` block (after line 71), add `<div id="hourly-value-row" style="display:none;">` containing:
   - `<label for="hourly-value" class="field-label">YOUR TIME VALUE (AUD/HR)</label>`
   - `<input id="hourly-value" class="field-input hourly-input" type="number" min="0" step="0.50" aria-describedby="hourly-value-hint" oninput="saveHourlyValue()">`
   - `<span id="hourly-value-hint" class="field-hint">Used to calculate whether a toll is worth the time saved</span>`
   - `<span id="hourly-value-error" class="field-error" style="display:none;">Value must be $0 or more</span>`
2. In `style.css`, add `.hourly-input` rule: `max-width: 110px`, matching existing `.field-input` style.
3. Add `.field-hint` rule: `font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem;`.
4. Add `.field-error` rule: `font-size: 0.75rem; color: var(--danger); margin-top: 0.25rem;`.
5. In `app.js`, add `function saveHourlyValue()` that:
   - Reads the raw input value.
   - If negative: shows `#hourly-value-error`, does not save to `localStorage`.
   - If empty or NaN: hides error, resets field to `25`, saves `25` to `localStorage`.
   - If `≥ 0`: hides error, saves the value to `localStorage.setItem('commute_hourly_value', value)`.
6. In `app.js` page-init (or top of `analyse()`), read `localStorage.getItem('commute_hourly_value')` and set `#hourly-value` field; fall back to `25` if absent.

**Relevant Context**
- Preference pills: [`index.html` lines 64-71](index.html:64)
- Existing `.field-input` / `.field-label` patterns: [`index.html` lines 28-60](index.html:28)
- CSS custom properties (colours, fonts): [`style.css` lines 8-23](style.css:8)
- `localStorage` pattern (API key): [`app.js` lines 14, 29](app.js:14)

---

### Sub-Task 2 — Add the "Best Value" preference pill and wire visibility

**Status:** `[ ] pending`

**Intent**
Add `data-pref="best-value"` as a fourth pill. Extend `setPref()` to: toggle `.active` on all pills, update `aria-pressed` on all pills, and show/hide `#hourly-value-row`. Does not alter existing pill behaviour.

**Expected Outcomes**
- A fourth pill `🏆 Best Value` (`data-pref="best-value"`) is present in `.pref-pills`.
- `setPref()` sets `aria-pressed="true"` on the active pill and `aria-pressed="false"` on all others — applied to all four pills including the three existing ones.
- `#hourly-value-row` becomes visible (`display:flex`) only when `currentPref === 'best-value'`.
- Switching away from Best Value hides the row again.
- Initial page load: row is hidden; `'cheapest'` is the active default.
- All four pills are `<button>` elements with `aria-pressed` managed by `setPref()`.

**Todo List**
1. In `index.html`, add `aria-pressed` attributes to all three existing pills (initial values: `fastest="false"`, `cheapest="true"`, `balanced="false"`).
2. Add the fourth pill after the Balanced button:
   `<button class="pref-pill" data-pref="best-value" aria-pressed="false" onclick="setPref('best-value')">🏆 Best Value</button>`
3. In `app.js` `setPref()` (lines 99-104), replace the body with:
   ```
   currentPref = p;
   document.querySelectorAll('.pref-pill').forEach(el => {
     const isActive = el.dataset.pref === p;
     el.classList.toggle('active', isActive);
     el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
   });
   const hvRow = document.getElementById('hourly-value-row');
   if (hvRow) hvRow.style.display = p === 'best-value' ? 'flex' : 'none';
   ```
4. No change to `currentPref` initialisation — `'cheapest'` remains the default.

**Relevant Context**
- Pill HTML: [`index.html` lines 66-70](index.html:66)
- `setPref()`: [`app.js` lines 99-104](app.js:99)
- `.pref-pill.active` CSS: [`style.css` line 128](style.css:128)

---

### Sub-Task 3 — Two-pass Best Value scoring in `renderResults()`

**Status:** `[ ] pending`

**Intent**
Restructure the scoring section of `renderResults()` into a clear two-pass pattern, and add `computeNetValue()`. The first pass builds `routeData`. The second pass — run only when `currentPref === 'best-value'` — identifies the baseline from the completed array, computes `netValue` / `annualNetValue` / `verdict` / `isBaseline`, and writes them onto each object before sorting.

**Baseline selection rule:**
1. Among routes where `Number.isFinite(tollCost)` is true, find the minimum `tollCost`.
2. If multiple routes share that minimum toll, the one with the shortest `durationMins` is the baseline.
3. If no route has a known price, `baseline = null`.

**Definitions:**
- **`minutesSaved`**: `baseline.durationMins − route.durationMins` (positive = this route is faster than baseline)
- **`additionalToll`**: `route.tollCost − baseline.tollCost` (positive = this route costs more in tolls)
- **`timeValueGained`**: `(minutesSaved / 60) × hourlyValue`
- **`netValue`**: `timeValueGained − additionalToll`
- **`annualNetValue`**: `netValue × 5 × 48` (240 one-way trips per year)
- **`verdict`**: `Math.abs(netValue) < 0.05` → `'break-even'`; `netValue > 0` → `'worth-it'`; else `'not-worth-it'`
- Routes where `tollCost` is not finite: `netValue = null`, `annualNetValue = null`, `verdict = 'unknown-price'`.
- The baseline route: `isBaseline = true`; still computes `netValue = 0`, `annualNetValue = 0`, `verdict = 'break-even'`; rendered as the baseline label (see Sub-Task 4).

**`hourlyValue` reading rules (applied at start of the second pass):**
- Parse `document.getElementById('hourly-value').value` as a float.
- If result is `NaN` or the field is empty: use `25` (and reset the field to `25`).
- If result is negative: block `analyse()` with a validation error before reaching this point (handled in Sub-Task 1's `saveHourlyValue()` guard).
- `0` is valid and produces `timeValueGained = 0`.
- Use `Number.isFinite()` throughout, not `isNaN`, to guard against `Infinity`.

**Best Value sorting (second pass, after net values are computed):**
- Known-price routes sorted by `netValue` descending.
- Unknown-price routes sorted by `durationMins` ascending, appended after all known-price routes.
- When all routes have unknown prices, sort purely by `durationMins` ascending.
- When all routes have unknown prices, `isBest` (the rank-1 card) does not show "BEST MATCH" badge (no financial basis).

**Pseudocode:**
```
// --- Pass 1: build routeData ---
routeData = routes.map(item => {
  ... existing fields: durationMins, distanceKm, tollCost, tollStatus, tollRoads, summary, strategy, isPeak, isWeekend ...
  // score set to null here; assigned in Pass 2 or fallback
  netValue = null; annualNetValue = null; verdict = null; isBaseline = false;
  return routeObject;
});

// --- Pass 2: best-value only ---
if currentPref === 'best-value':
  hourlyValue = parseFloat(input.value)
  if not Number.isFinite(hourlyValue) or hourlyValue < 0: hourlyValue = 25

  pricedRoutes = routeData.filter(r => Number.isFinite(r.tollCost))
  if pricedRoutes.length > 0:
    minToll = Math.min(...pricedRoutes.map(r => r.tollCost))
    baseline = pricedRoutes
      .filter(r => r.tollCost === minToll)
      .sort by durationMins ascending
      [0]
    baseline.isBaseline = true
  else:
    baseline = null

  for each r in routeData:
    if not Number.isFinite(r.tollCost):
      r.netValue = null; r.annualNetValue = null; r.verdict = 'unknown-price'
    else:
      minutesSaved = baseline.durationMins - r.durationMins
      additionalToll = r.tollCost - baseline.tollCost
      timeValueGained = (minutesSaved / 60) * hourlyValue
      r.netValue = timeValueGained - additionalToll
      r.annualNetValue = r.netValue * 5 * 48
      if Math.abs(r.netValue) < 0.05: r.verdict = 'break-even'
      else if r.netValue > 0:          r.verdict = 'worth-it'
      else:                            r.verdict = 'not-worth-it'
    r.score = Number.isFinite(r.netValue) ? r.netValue : -Infinity

  // unknown-price routes use duration as tiebreaker within their group
  routeData.sort((a, b) => {
    if a.score === b.score: return a.durationMins - b.durationMins  // unknown-price group
    return b.score - a.score
  })

// --- Existing scoring (unchanged) ---
else:
  for each r in routeData:
    if fastest:  r.score = -durationMins
    elif cheapest: r.score = -rankingToll
    else:        r.score = -(durationMins * 0.6 + rankingToll * 3)
  routeData.sort((a, b) => b.score - a.score)

topRoutes = routeData.slice(0, 4)
```

**`analyse()` validation guard (before calling `renderResults`):**
- Read `#hourly-value` when `currentPref === 'best-value'`.
- If value is negative: show `#hourly-value-error` and return early.

**Expected Outcomes**
- `computeNetValue()` is a standalone helper function in `app.js` (or the logic is inlined in the second pass — either is acceptable, inline is simpler given the project's no-modules convention).
- `renderResults()` performs Pass 1 (map), then conditionally Pass 2 (best-value enrichment), then sort, then `slice(0,4)`.
- All four `routeData` fields (`netValue`, `annualNetValue`, `verdict`, `isBaseline`) are present on every object after Pass 2; they remain `null` / `false` on non-best-value runs.
- Existing `fastest`, `cheapest`, `balanced` paths are not touched.

**Relevant Context**
- Scoring block to restructure: [`app.js` lines 240-278](app.js:240)
- `renderResults()` call site for `buildRouteCard`: [`app.js` line 293](app.js:293)
- `readGoogleToll()`: [`app.js` lines 218-232](app.js:218)
- `analyse()` validation pattern: [`app.js` lines 113-117](app.js:113)

---

### Sub-Task 4 — Render the value verdict on route cards

**Status:** `[ ] pending`

**Intent**
Extend `buildRouteCard()` to read `r.verdict`, `r.netValue`, `r.annualNetValue`, and `r.isBaseline` directly from the route object. No new parameter is added; verdict data is already on `r`. The verdict block sits below the trade-off line and only renders when `currentPref === 'best-value'`.

**Verdict display rules:**

| Condition | Rendered text | CSS modifier class |
|---|---|---|
| `r.isBaseline === true` | `◎ Lowest known toll (baseline)` | `value-verdict-baseline` |
| `r.verdict === 'worth-it'` | `✦ Worth it: +$X.XX/trip (≈ +$Y/year)` | `value-verdict-win` |
| `r.verdict === 'not-worth-it'` | `✗ Not worth it: −$X.XX/trip (≈ −$Y/year)` | `value-verdict-loss` |
| `r.verdict === 'break-even'` | `≈ Break-even` | `value-verdict-neutral` |
| `r.verdict === 'unknown-price'` | `— Value unavailable — toll price unknown` | `value-verdict-unknown` |
| `currentPref !== 'best-value'` | (nothing rendered) | — |

- `$X.XX` = `Math.abs(r.netValue).toFixed(2)`.
- `$Y` = `Math.abs(Math.round(r.annualNetValue)).toLocaleString()`.
- Sign in text is explicit (`+` / `−`) so the CSS colour is not the sole indicator (accessibility).
- The baseline route uses `isBaseline` as the primary display condition; its `verdict` will be `'break-even'` but the baseline label takes precedence.

**BEST MATCH badge logic:**
- When `currentPref === 'best-value'` and all routes have `verdict === 'unknown-price'`: do not render the `BEST MATCH` badge on any card (no financial basis for the claim).
- Otherwise the rank-1 card (`isBest === true`) still receives the `BEST MATCH` badge.
- Implement by passing a `showBestBadge` boolean: `isBest && !(currentPref === 'best-value' && allUnknown)` — computed in `renderResults()` before calling `buildRouteCard`.

**Expected Outcomes**
- `buildRouteCard(r, isBest, fastestMins, maxTollCost)` signature is unchanged.
- Inside the function, `currentPref` is read from the global (already accessible — it is a module-level global).
- A `<div class="value-verdict value-verdict-{modifier}">` block is appended after `.route-tradeoff` when `currentPref === 'best-value'`.
- The block is absent entirely when `currentPref !== 'best-value'`.

**Relevant Context**
- `buildRouteCard()` full template: [`app.js` lines 304-365](app.js:304)
- Call site in `renderResults()`: [`app.js` line 293](app.js:293)
- Existing `.route-tradeoff` / `.route-tradeoff-win` pattern: [`app.js` lines 324-331](app.js:324)

---

### Sub-Task 5 — Add CSS for value verdict styles

**Status:** `[ ] pending`

**Intent**
Add the `.value-verdict` family of CSS rules adjacent to the existing `.route-tradeoff` block. Use existing CSS custom properties exclusively.

**Expected Outcomes**
- `.value-verdict` base rule: same layout as `.route-tradeoff` — `padding-top: 0.6rem; margin-top: 0.6rem; border-top: 1px dashed var(--border); font-size: 0.8rem;`.
- `.value-verdict-win`: `color: var(--accent)` (green).
- `.value-verdict-loss`: `color: var(--danger)` (red).
- `.value-verdict-neutral`: `color: var(--muted)`.
- `.value-verdict-baseline`: `color: var(--accent2)` (blue).
- `.value-verdict-unknown`: `color: var(--muted); font-style: italic`.
- No new colour tokens required.
- Mobile: verdict block is block-level and full-width — no additional breakpoint rules needed.

**Relevant Context**
- Existing trade-off styles to place rules after: [`style.css` lines 231-241](style.css:231)
- CSS vars palette: [`style.css` lines 8-23](style.css:8)
- Mobile breakpoint (480px): [`style.css` line 249](style.css:249)

---

### Sub-Task 6 — Update README.md

**Status:** `[ ] pending`

**Intent**
Document the Best Value preference in `README.md` alongside the existing feature descriptions.

**Expected Outcomes**
- The feature list mentions Best Value and the hourly time-value input.
- A one-to-two sentence explanation of the net value formula is added.
- No change to the toll price table or architecture sections.

**Relevant Context**
- `README.md` feature paragraph: [`README.md` lines 3-13](README.md:3)

---

## Validation Steps

After implementing each sub-task, run:

```bash
node --check app.js
node --check tolls.js
```

These syntax checks are the only automated validation available in this project (no test suite, no linter). Manual browser testing is required for behaviour validation (see matrix below).

---

## Manual Testing Matrix

| Scenario | Expected result |
|---|---|
| Default load, no pref change | Hourly value row hidden; Cheapest pill active; `aria-pressed="true"` on Cheapest only |
| Click Best Value pill | Hourly value row appears; `aria-pressed="true"` on Best Value; input shows persisted or default `25` |
| Click Fastest / Cheapest / Balanced | Hourly value row hides; `aria-pressed` updates correctly on all four pills |
| Reload page after entering `40` for hourly value | Field restores to `40` (persisted via `localStorage`) |
| Enter `-5` in hourly value field | Validation error appears inline; `analyse()` blocked |
| Clear hourly value field (empty) | Field resets to `25`; no error shown; `25` saved to `localStorage` |
| Run analysis: Best Value + routes with known prices | Cards show verdict blocks; highest net value route ranked first; BEST MATCH badge on rank-1 |
| Run analysis: Best Value + `hourlyValue = 0` | Same-toll routes show Break-even; higher-toll routes show Not worth it regardless of time saved |
| Run analysis: Best Value + `hourlyValue = 0` + faster route with same toll | Break-even (time saving has no monetary value at $0/hr) |
| Run analysis: Best Value + all routes have unknown toll prices | All cards show "Value unavailable — toll price unknown"; no BEST MATCH badge rendered; sorted by duration |
| Run analysis: Best Value + two routes tied for lowest toll | Shorter-duration tied route becomes baseline; both tested correctly |
| Run analysis: Best Value + fastest route is most expensive | Verdict correctly shows Worth it / Not worth it based on whether `timeValueGained > additionalToll` |
| Run analysis: Best Value + only one route returned | Single card shows baseline label |
| Run analysis: Fastest / Cheapest / Balanced after Best Value | No verdict blocks shown on any card; behaviour identical to before feature was added |
| Route card: Worth it verdict | Shows `✦ Worth it: +$X.XX/trip (≈ +$Y/year)` in green |
| Route card: Not worth it verdict | Shows `✗ Not worth it: −$X.XX/trip (≈ −$Y/year)` in red |
| Route card: Baseline route | Shows `◎ Lowest known toll (baseline)` in blue |
| Route card: Break-even (non-baseline) | Shows `≈ Break-even` in muted colour |

---

## Acceptance Criteria

- [ ] Best Value pill appears as the fourth option in the preference row.
- [ ] All four preference pills have `aria-pressed` managed by `setPref()`.
- [ ] Hourly value input is hidden until Best Value is selected, then revealed.
- [ ] Hourly value persists across page reloads via `localStorage` key `commute_hourly_value`.
- [ ] Default hourly value is `$25`. Input accepts `$0`.
- [ ] Negative hourly value shows a validation error and blocks `analyse()`.
- [ ] Empty or NaN input resets silently to `$25`.
- [ ] `renderResults()` uses a two-pass pattern: build `routeData` fully, then identify baseline, then compute scores.
- [ ] Baseline is the lowest-toll route; ties broken by shortest duration.
- [ ] `netValue`, `annualNetValue`, `verdict`, `isBaseline` are stored on each `routeData` object.
- [ ] `annualNetValue = netValue × 5 × 48`.
- [ ] Routes with unknown toll prices are ranked after all known-price routes (sorted by duration within their group).
- [ ] When all routes have unknown prices, no BEST MATCH badge is shown and sort is by duration.
- [ ] Verdict format: `+$X.XX/trip (≈ +$Y/year)` for Worth it; `−$X.XX/trip (≈ −$Y/year)` for Not worth it.
- [ ] Two routes with identical toll cost but different durations are NOT automatically Break-even when `hourlyValue > 0`.
- [ ] At `hourlyValue = 0`, routes with the same toll as baseline are Break-even regardless of time difference.
- [ ] Fastest, Cheapest, Balanced preferences are fully unchanged in behaviour and appearance.
- [ ] No new network requests, APIs, backend, or frameworks introduced.
- [ ] `tolls.js` is not modified.
- [ ] `TOLL_DATA` is not read for any pricing calculation.
- [ ] `node --check app.js` and `node --check tolls.js` pass with no errors.

---

## Edge Cases Summary

| Case | Handling |
|---|---|
| No route has a known toll price | `baseline = null`; all verdicts → `'unknown-price'`; sort by duration; no BEST MATCH badge |
| `hourlyValue` input is empty or NaN | Reset field to `25`; use `25` for calculation |
| `hourlyValue = 0` | Valid; `timeValueGained = 0`; `netValue = -additionalToll`; higher-toll routes are Not worth it |
| `hourlyValue = 0`, same toll as baseline | `netValue = 0` → Break-even (regardless of duration difference) |
| `hourlyValue > 0`, same toll as baseline, faster route | `netValue = timeValueGained > 0` → Worth it (not auto Break-even) |
| Negative `hourlyValue` | Validation error shown; `analyse()` returns early |
| `hourlyValue = Infinity` | `Number.isFinite()` check catches this; resets to `25` |
| Toll-free route (`tollCost = 0`) | Valid baseline candidate if it is the minimum known price |
| Single route returned | Is always baseline; shows baseline label |
| Two routes tied for lowest toll | Shorter-duration one is baseline |
| `netValue` near zero (floating point) | `Math.abs(netValue) < 0.05` threshold absorbs rounding noise |
| `annualNetValue` for baseline | `0 × 5 × 48 = 0`; not displayed (baseline label shown instead) |

---

## Accessibility Requirements

- `#hourly-value` is associated with its label via `for`/`id`.
- Helper text is linked via `aria-describedby="hourly-value-hint"`.
- Error message `#hourly-value-error` is in the DOM at all times (shown/hidden with `display`); consider adding `role="alert"` so screen readers announce it on appearance.
- All four preference pills are `<button>` elements with `aria-pressed` managed by `setPref()`.
- Verdict text uses explicit `+` / `−` signs and full phrases — colour is not the sole indicator of meaning.
- Show/hide of `#hourly-value-row` uses `display` property, removing it from tab order when hidden.

---

## Mobile Behaviour

- Existing `.pref-row` uses `flex-wrap: wrap` — the fourth pill wraps naturally on narrow screens.
- `#hourly-value-row` uses `display:flex` with `align-items: center; gap: 0.5rem; flex-wrap: wrap` to stack gracefully on small screens.
- `.hourly-input` (`max-width: 110px`) keeps the number input compact.
- Verdict blocks are block-level — no additional mobile CSS needed.

---

## Risks and Rollback

| Risk | Mitigation |
|---|---|
| Floating-point imprecision in `netValue` | `Math.abs(netValue) < 0.05` threshold for Break-even |
| Google Routes API returns `tollCost = 0` on a tolled road | Route becomes baseline; labelled as such — no misleading financial claim |
| All-unknown-price result set shows BEST MATCH misleadingly | Guard: suppress BEST MATCH badge when `currentPref === 'best-value'` and all verdicts are `'unknown-price'` |
| `localStorage` key collision with existing `gmaps_api_key` | Separate key `commute_hourly_value` avoids any overlap |
| Two-pass restructure of `renderResults` introduces regression | Existing score branches are moved not changed; `node --check` catches syntax errors; manual test of all three legacy prefs required |

**Rollback approach:** All changes are additive. To revert: remove the `best-value` pill and `#hourly-value-row` from `index.html`; remove `saveHourlyValue()`, the second-pass block, and the `value-verdict` rendering from `app.js`; remove `.value-verdict*` and `.field-hint` / `.field-error` from `style.css`. No external config, APIs, or data files are affected.
