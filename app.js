// CommuteOS compares routes that Google may find through different strategies.
// Travel times come from Google Maps; toll figures are local 2026 estimates.

let map = null;
let directionsService = null;
let directionsRenderers = [];
let currentPref = 'cheapest';
let mapsLoaded = false;
let autocompleteOrigin = null;
let autocompleteDestination = null;

// Keep the browser key between visits so it never has to be added to this repo.
function getApiKey() {
  return localStorage.getItem('gmaps_api_key') || '';
}

function showConfig() {
  document.getElementById('api-key-input').value = getApiKey();
  document.getElementById('config-modal').style.display = 'flex';
}

function closeConfig() {
  document.getElementById('config-modal').style.display = 'none';
}

function saveConfig() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) { alert('Enter a valid API key'); return; }
  localStorage.setItem('gmaps_api_key', key);
  location.reload();
}

function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (mapsLoaded) { resolve(); return; }

    // Google calls this global function for authentication failures rather than
    // rejecting the script request, so surface a useful message in the page.
    window.gm_authFailure = () => {
      mapsLoaded = false;
      showError('Google Maps rejected this API key. Check billing, API access, and website restrictions in Google Cloud.');
      reject(new Error('Google Maps authentication failed'));
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=onMapsReady`;
    script.onerror = reject;
    document.body.appendChild(script);
    window.onMapsReady = () => { mapsLoaded = true; resolve(); };
  });
}

async function init() {
  const key = getApiKey();
  if (key) {
    document.getElementById('api-hint').style.display = 'none';
    try {
      await loadGoogleMaps(key);
      initMap();
      initAutocomplete();
    } catch(e) {
      const message = e.message === 'Google Maps authentication failed'
        ? 'Google Maps rejected this API key. Check billing, API access, and website restrictions in Google Cloud.'
        : 'Failed to load Google Maps. Check your API key and internet connection.';
      showError(message);
    }
  } else {
    document.getElementById('api-hint').style.display = 'block';
  }
}

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: -37.8136, lng: 144.9631 }, // Melbourne CBD
    zoom: 11,
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: true,
  });
  directionsService = new google.maps.DirectionsService();
}

function initAutocomplete() {
  const melbourneBounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(-38.5, 144.4),
    new google.maps.LatLng(-37.2, 145.6)
  );
  const opts = { bounds: melbourneBounds, componentRestrictions: { country: 'au' } };
  autocompleteOrigin = new google.maps.places.Autocomplete(document.getElementById('origin'), opts);
  autocompleteDestination = new google.maps.places.Autocomplete(document.getElementById('destination'), opts);
  new google.maps.places.Autocomplete(document.getElementById('via-point'), opts);
}

// Changing preference affects how the next set of routes is ranked.
function setPref(p) {
  currentPref = p;
  document.querySelectorAll('.pref-pill').forEach(el => {
    el.classList.toggle('active', el.dataset.pref === p);
  });
}

async function analyse() {
  const origin = document.getElementById('origin').value.trim();
  const destination = document.getElementById('destination').value.trim();
  const departTime = document.getElementById('depart-time').value;
  const departDay = document.getElementById('depart-day').value;
  const viaPoint = document.getElementById('via-point').value.trim();

  if (!origin || !destination) { showError('Enter both origin and destination.'); return; }

  const key = getApiKey();
  if (!key) { showError('Add your Google Maps API key first (click ⚙ below).'); return; }
  if (!mapsLoaded) { showError('Google Maps is still loading — wait a moment and try again.'); return; }

  hideError();
  setLoading(true);

  // Google needs a real future date, not just the weekday and time shown in the form.
  const deptDateTime = buildDepartureTime(departTime, departDay);

  // A single Google request tends to favour speed. Asking in three different
  // ways gives us a better chance of finding the useful middle-priced route.
  try {
    const requests = [
      requestRoutes(origin, destination, deptDateTime, { provideRouteAlternatives: true }),
      requestRoutes(origin, destination, deptDateTime, { avoidTolls: true }),
    ];
    if (viaPoint) {
      requests.push(requestRoutes(origin, destination, deptDateTime, { waypoint: viaPoint }));
    }

    const settled = await Promise.allSettled(requests);
    let allRoutes = [];
    settled.forEach(r => {
      if (r.status === 'fulfilled' && r.value) allRoutes = allRoutes.concat(r.value);
    });

    if (allRoutes.length === 0) {
      showError('No routes found between these locations.');
      setLoading(false);
      return;
    }

    // Different requests can return the same road, so only show it once.
    allRoutes = dedupeRoutes(allRoutes);

    renderResults(allRoutes, departTime, departDay);
  } catch (e) {
    showError('Route request failed: ' + (e.message || 'unknown error'));
    setLoading(false);
  }
}

function dedupeRoutes(routes) {
  const seen = [];
  return routes.filter(route => {
    const duration = summarizeRoute(route).durationSecs;
    const key = route.summary;
    const dup = seen.find(s => s.key === key && Math.abs(s.duration - duration) < 60);
    if (dup) return false;
    seen.push({ key, duration });
    return true;
  });
}

function buildDepartureTime(timeStr, dayStr) {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = new Date();
  const targetDay = days.indexOf(dayStr);
  const diff = (targetDay - today.getDay() + 7) % 7;
  const date = new Date(today);
  date.setDate(today.getDate() + (diff === 0 ? 0 : diff));
  const [h, m] = timeStr.split(':').map(Number);
  date.setHours(h, m, 0, 0);

  // If today's selected time has already passed, use the same day next week.
  if (date <= today) date.setDate(date.getDate() + 7);
  return date;
}

function summarizeRoute(route) {
  const legs = route.legs || [];
  return {
    durationSecs: legs.reduce((sum, leg) => sum + (leg.duration_in_traffic || leg.duration).value, 0),
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distance.value, 0),
    steps: legs.flatMap(leg => leg.steps || []),
    startAddress: legs[0]?.start_address || '',
    endAddress: legs[legs.length - 1]?.end_address || '',
  };
}

function requestRoutes(origin, destination, departureTime, opts = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime,
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      },
      region: 'au',
    };

    if (opts.provideRouteAlternatives) request.provideRouteAlternatives = true;
    if (opts.avoidTolls) {
      request.avoidTolls = true;
      // Google handles toll avoidance more consistently as a single-route request.
      request.provideRouteAlternatives = false;
    }
    if (opts.waypoint) {
      request.waypoints = [{ location: opts.waypoint, stopover: true }];
      request.provideRouteAlternatives = false;
      request.optimizeWaypoints = false;
    }

    directionsService.route(request, (result, status) => {
      if (status === 'OK') {
        // Remember how we found the route so the result card can explain it.
        const tag = opts.avoidTolls ? 'toll-free' : opts.waypoint ? 'via-point' : 'default';
        result.routes.forEach(r => r._strategy = tag);
        resolve(result.routes);
      } else if (status === 'ZERO_RESULTS') {
        resolve([]);
      } else {
        reject(new Error(status));
      }
    });
  });
}

function renderResults(routes, departTime, departDay) {
  setLoading(false);

  const isPeak = checkPeak(departTime, departDay);
  const isWeekend = ['saturday','sunday'].includes(departDay.toLowerCase());

  const routeData = routes.map((route, idx) => {
    const routeSummary = summarizeRoute(route);
    const steps = routeSummary.steps;

    const durationMins = Math.round(routeSummary.durationSecs / 60);
    const distanceKm = (routeSummary.distanceMeters / 1000).toFixed(1);
    const tollResult = estimateTollCost(steps, departDay);
    const tollCost = tollResult.total;
    const tollRoads = tollResult.roads;

    const summary = route.summary || `Route ${idx + 1}`;
    const strategy = route._strategy || 'default';

    // Balanced gives time a little more weight without ignoring a large toll gap.
    let score;
    if (currentPref === 'fastest') score = -durationMins;
    else if (currentPref === 'cheapest') score = -tollCost;
    else score = -(durationMins * 0.6 + tollCost * 3); // balanced

    return {
      idx,
      route,
      summary,
      strategy,
      durationMins,
      distanceKm,
      tollCost,
      tollRoads,
      isPeak,
      isWeekend,
      score,
      startAddress: routeSummary.startAddress,
      endAddress: routeSummary.endAddress,
      steps,
    };
  });

  routeData.sort((a, b) => b.score - a.score);

  // More than four overlapping routes becomes difficult to compare on the map.
  const topRoutes = routeData.slice(0, 4);

  const maxTime = Math.max(...topRoutes.map(r => r.durationMins));
  const minTime = Math.min(...topRoutes.map(r => r.durationMins));
  const maxToll = Math.max(...topRoutes.map(r => r.tollCost));
  const minToll = Math.min(...topRoutes.map(r => r.tollCost));

  document.getElementById('sum-save').textContent = (maxTime - minTime) + ' min';
  document.getElementById('sum-toll-diff').textContent = '$' + (maxToll - minToll).toFixed(2);
  document.getElementById('sum-annual').textContent = '$' + annualCost(maxToll - minToll).toLocaleString();
  document.getElementById('sum-peak').textContent = isWeekend ? 'Weekend' : isPeak ? '🔴 Peak' : '🟢 Off-peak';

  const list = document.getElementById('route-list');
  list.innerHTML = topRoutes.map((r, i) => buildRouteCard(r, i === 0, minTime, maxToll)).join('');

  renderMapRoutes(topRoutes);

  renderTip(topRoutes, isPeak, isWeekend);

  document.getElementById('results').style.display = 'block';
  document.getElementById('map-section').style.display = 'block';
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}

function buildRouteCard(r, isBest, fastestMins, maxTollCost) {
  const annualToll = annualCost(r.tollCost);
  const tollLabel = r.tollCost === 0 ? '<span class="toll-free">TOLL FREE</span>' : `$${r.tollCost.toFixed(2)} <span class="toll-roads">(${r.tollRoads.join(', ') || 'estimated'} estimate)</span>`;
  const peakLabel = r.isPeak ? '<span class="badge badge-peak">Peak hours</span>' : r.isWeekend ? '<span class="badge badge-offpeak">Weekend</span>' : '<span class="badge badge-offpeak">Off-peak</span>';

  const strategyLabels = {
    'default':   '<span class="badge badge-strategy">Standard route</span>',
    'toll-free': '<span class="badge badge-strategy-cheap">Avoids tolls</span>',
    'via-point': '<span class="badge badge-strategy-custom">Via your point</span>',
  };
  const strategyLabel = strategyLabels[r.strategy] || '';

  // This is the question behind the app: is the extra time worth the toll saved?
  const extraMins = r.durationMins - fastestMins;
  const tollSavedVsMax = maxTollCost - r.tollCost;
  let tradeoff = '';
  if (extraMins > 0 && tollSavedVsMax > 0.01) {
    tradeoff = `<div class="route-tradeoff">⇄ ${extraMins} min slower than the fastest route, saves $${tollSavedVsMax.toFixed(2)} in tolls</div>`;
  } else if (extraMins === 0 && tollSavedVsMax > 0.01) {
    tradeoff = `<div class="route-tradeoff route-tradeoff-win">✦ Same travel time, saves $${tollSavedVsMax.toFixed(2)} in tolls</div>`;
  } else if (extraMins < 0) {
    tradeoff = `<div class="route-tradeoff route-tradeoff-win">⚡ ${Math.abs(extraMins)} min faster than other options</div>`;
  }

  return `
    <div class="route-card ${isBest ? 'route-best' : ''}">
      ${isBest ? '<div class="best-badge">BEST MATCH</div>' : ''}
      <div class="route-card-header">
        <div>
          <div class="route-name">${r.summary}</div>
          ${strategyLabel}
        </div>
        ${peakLabel}
      </div>
      <div class="route-stats">
        <div class="route-stat">
          <div class="stat-num">${r.durationMins}</div>
          <div class="stat-lbl">minutes</div>
        </div>
        <div class="route-stat">
          <div class="stat-num">${r.distanceKm}</div>
          <div class="stat-lbl">km</div>
        </div>
        <div class="route-stat">
          <div class="stat-num">${r.tollCost === 0 ? '$0' : '$' + r.tollCost.toFixed(2)}</div>
          <div class="stat-lbl">toll today</div>
        </div>
        <div class="route-stat">
          <div class="stat-num">$${annualToll.toLocaleString()}</div>
          <div class="stat-lbl">annual toll</div>
        </div>
      </div>
      <div class="route-toll-detail">${tollLabel}</div>
      ${tradeoff}
    </div>
  `;
}

function renderMapRoutes(routeData) {
  // Remove the previous search before drawing the new choices.
  directionsRenderers.forEach(r => r.setMap(null));
  directionsRenderers = [];

  const colors = ['#4ade80', '#60a5fa', '#f59e0b', '#f87171'];

  // Reuse Google's response instead of paying for another route request.
  routeData.forEach((rd, i) => {
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: i > 0,
      polylineOptions: {
        strokeColor: colors[i] || '#888',
        strokeWeight: i === 0 ? 5 : 3,
        strokeOpacity: i === 0 ? 0.9 : 0.5,
      },
      preserveViewport: i > 0,
    });

    renderer.setDirections({
      routes: [rd.route],
      request: {
        origin: rd.startAddress,
        destination: rd.endAddress,
        travelMode: google.maps.TravelMode.DRIVING,
      },
    });

    directionsRenderers.push(renderer);
  });
}

function renderTip(routeData, isPeak, isWeekend) {
  const best = routeData[0];
  const tips = [];

  // Lead with the useful trade-off instead of a generic traffic observation.
  const maxToll = Math.max(...routeData.map(r => r.tollCost));
  const cheapestRoute = routeData.reduce((min, r) => r.tollCost < min.tollCost ? r : min, routeData[0]);
  const tollGap = maxToll - cheapestRoute.tollCost;
  const timeGap = cheapestRoute.durationMins - Math.min(...routeData.map(r => r.durationMins));
  if (tollGap > 2 && cheapestRoute !== routeData[0]) {
    tips.push(`The "${cheapestRoute.summary}" route costs $${tollGap.toFixed(2)} less in tolls for ${timeGap} extra minutes — that's $${annualCost(tollGap).toLocaleString()}/year if you take it every workday.`);
  }
  if (isPeak && !isWeekend) {
    tips.push('You\'re leaving during peak hours. Even 15–20 minutes earlier can cut 10+ minutes off your trip on most Melbourne routes.');
  }
  if (routeData.length > 1) {
    const topRouteGap = Math.abs(routeData[0].durationMins - routeData[1].durationMins);
    if (topRouteGap <= 5) {
      tips.push(`The top 2 routes are within ${topRouteGap} min of each other — compare the toll before choosing.`);
    }
  }
  if (best.tollCost > 0) {
    tips.push('Tolls are estimates based on current 2026 account prices; exact entry and exit points can change the final charge.');
  }

  document.getElementById('tip-text').textContent = tips[0] || 'Try different departure times to find your sweet spot.';
  document.getElementById('tip-box').style.display = 'block';
}

// Small UI helpers keep error and loading behaviour consistent.
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() { document.getElementById('error-msg').style.display = 'none'; }

function setLoading(on) {
  const btn = document.querySelector('.analyse-btn');
  btn.disabled = on;
  btn.querySelector('.btn-text').textContent = on ? 'ANALYSING...' : 'ANALYSE ROUTE';
}

// A quieter map keeps the coloured route lines easy to read.
const mapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8899aa' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a5c' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1020' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
];

window.addEventListener('DOMContentLoaded', init);
