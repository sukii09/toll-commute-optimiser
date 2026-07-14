# CommuteOS - Melbourne Route Optimizer

CommuteOS compares Melbourne driving routes by time and estimated toll cost. It is designed for the useful middle option that navigation apps may not surface: a route that costs less than the fastest route but still saves meaningful time over the toll-free route.

## What it does

For each search, the app can request:

1. Google's standard route and alternatives.
2. A route that avoids tolls.
3. An optional route through a place chosen by the user, such as Melbourne CBD.

It removes near-duplicates, ranks the results by fastest, cheapest, or balanced, and shows the time-versus-toll trade-off for each option.

## Run it locally

### 1. Clone the repository

```bash
git clone https://github.com/sukii09/toll-commute-optimiser.git
cd toll-commute-optimiser
```

### 2. Configure Google Maps

In [Google Cloud Console](https://console.cloud.google.com):

1. Create or select a project and enable billing.
2. Enable **Maps JavaScript API** and **Places API**.
3. Create an API key.
4. Restrict the key to websites and add `http://localhost:8080/*` for local development.
5. Restrict API access to Maps JavaScript API and Places API.

The key is entered through the settings panel and stored in browser `localStorage`. It is not written to this repository.

### 3. Start a local server

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080), choose **configure**, and enter the browser key.

## Project structure

```text
toll-commute-optimiser/
├── index.html   - page structure and API-key settings
├── app.js       - Google Maps requests, route comparison, and UI logic
├── tolls.js     - current Melbourne toll fallback data
├── style.css    - responsive dark interface
└── README.md
```

## Toll data

The fallback prices were checked on 14 July 2026 against official operator tables.

| Road | Prices used | Validity | Official source |
|---|---|---|---|
| CityLink | Car account entry/exit prices; $12.64 trip cap | 1 Jul-30 Sep 2026 | [Linkt price table](https://www.linkt.com.au/content/dam/linkt/common/qpu/q1-july-26-27/citylink-toll-pricing-july-sept-2026.pdf) |
| West Gate Tunnel | $4.22 car toll; $6.75 inbound weekday AM-peak ramp toll | 1 Jul-30 Sep 2026 | [Linkt price table](https://www.linkt.com.au/content/dam/linkt/common/qpu/q1-july-26-27/citylink-toll-pricing-july-sept-2026.pdf) |
| EastLink | $8.05 car trip cap; $6.45 weekend/public-holiday cap | 1 Jul 2026-30 Jun 2027 | [EastLink price table](https://www.eastlink.com.au/assets/documents/eastlink-tolls-%28valid-1-jul-2026-until-30-jun-2027%29.pdf) |

CityLink and West Gate Tunnel prices are published quarterly. EastLink prices normally change on 1 July each year.

### Why the values are estimates

The current Google Maps Directions response provides road names in the step instructions but does not provide the exact toll entry and exit points used by this fallback calculator. `tolls.js` therefore matches known road names and chooses a representative account price or trip cap.

This is suitable for comparing route strategies, but it should not be presented as a final charge. A future version should use Google Routes API toll information and retain `tolls.js` only as a fallback.

## Known limitations

- Toll matching depends on road names appearing in Google's instructions.
- The fallback currently models passenger cars with an account, not every vehicle or payment method.
- The West Gate Tunnel AM-peak inbound ramp price cannot be selected reliably from road names alone.
- Annual figures assume one one-way trip per workday for 48 working weeks.
- The app still uses Google's deprecated `DirectionsService`; migration to Routes API is planned.
- The project is Melbourne-specific.

## Keeping prices current

Review the Linkt table every quarter and the EastLink table each July. Update the validity dates and values in `tolls.js`, then update the table above in the same commit.

## Deployment

This is a static site and can be hosted on GitHub Pages, Netlify, or Vercel. Before publishing, add the production domain to the API key's website restrictions. Never commit an unrestricted API key.
