// These prices are a local fallback for Melbourne routes. They are useful for
// comparing options, but they are still estimates because Google does not tell
// us exactly which toll points a route passes through.
//
// Prices checked: 14 July 2026
// CityLink and West Gate Tunnel: 1 July to 30 September 2026
// EastLink: 1 July 2026 to 30 June 2027

const TOLL_DATA = {
  citylink: {
    name: 'CityLink',
    operator: 'Transurban / Linkt',
    source: 'https://www.linkt.com.au/content/dam/linkt/common/qpu/q1-july-26-27/citylink-toll-pricing-july-sept-2026.pdf',
    validUntil: '2026-09-30',
    tripCap: 12.64,
    routes: {
      // These are representative account prices from Linkt's entry/exit table.
      tullamarine: { label: 'Tullamarine Freeway to Bolte/West Gate', carAccount: 10.95 },
      bolte: { label: 'Bolte Bridge / West Gate connection', carAccount: 4.21 },
      domain: { label: 'Monash Freeway to Domain/West Gate', carAccount: 10.96 },
      burnley: { label: 'Burnley Tunnel to the south-east', carAccount: 7.58 },
      shortSection: { label: 'Short CityLink section', carAccount: 3.37 },
    },
  },

  eastlink: {
    name: 'EastLink',
    operator: 'ConnectEast',
    source: 'https://www.eastlink.com.au/assets/documents/eastlink-tolls-%28valid-1-jul-2026-until-30-jun-2027%29.pdf',
    validUntil: '2027-06-30',
    carTripCap: 8.05,
    weekendCarTripCap: 6.45,
  },

  westGateTunnel: {
    name: 'West Gate Tunnel',
    operator: 'Transurban / Linkt',
    source: 'https://www.linkt.com.au/content/dam/linkt/common/qpu/q1-july-26-27/citylink-toll-pricing-july-sept-2026.pdf',
    validUntil: '2026-09-30',
    carAccount: 4.22,
    inboundAmPeakRamp: 6.75,
  },

  // Keeping the M80 here makes it clear that detecting the road should not add
  // a toll. It is often the useful free alternative to CityLink.
  m80: {
    name: 'M80 Ring Road',
    carAccount: 0,
  },
};

function estimateTollCost(steps, dayOfWeek = null) {
  let total = 0;
  const roads = [];
  const stepText = steps
    .map(step => `${step.html_instructions || ''} ${step.maneuver || ''}`)
    .join(' ')
    .toLowerCase();

  const usesCityLink = ['citylink', 'bolte bridge', 'domain tunnel', 'burnley tunnel']
    .some(name => stepText.includes(name));

  if (usesCityLink) {
    const prices = TOLL_DATA.citylink.routes;
    const candidates = [];

    if (stepText.includes('tullamarine')) candidates.push(prices.tullamarine.carAccount);
    if (stepText.includes('bolte')) candidates.push(prices.bolte.carAccount);
    if (stepText.includes('domain')) candidates.push(prices.domain.carAccount);
    if (stepText.includes('burnley')) candidates.push(prices.burnley.carAccount);
    if (stepText.includes('monash')) candidates.push(prices.shortSection.carAccount);

    // The road names do not reveal exact entry and exit toll points. Using the
    // closest published end-to-end price is safer than adding overlapping trips.
    const cityLinkEstimate = candidates.length
      ? Math.min(Math.max(...candidates), TOLL_DATA.citylink.tripCap)
      : prices.shortSection.carAccount;

    total += cityLinkEstimate;
    roads.push('CityLink');
  }

  if (stepText.includes('eastlink')) {
    const isWeekend = ['saturday', 'sunday'].includes((dayOfWeek || '').toLowerCase());
    total += isWeekend
      ? TOLL_DATA.eastlink.weekendCarTripCap
      : TOLL_DATA.eastlink.carTripCap;
    roads.push('EastLink');
  }

  if (stepText.includes('west gate tunnel') || stepText.includes('westgate tunnel')) {
    total += TOLL_DATA.westGateTunnel.carAccount;
    roads.push('West Gate Tunnel');
  }

  return {
    total: Math.round(total * 100) / 100,
    roads,
    estimated: roads.length > 0,
  };
}

function checkPeak(timeStr, dayStr) {
  if (!timeStr) return false;
  const isWeekend = ['saturday', 'sunday'].includes((dayStr || '').toLowerCase());
  if (isWeekend) return false;
  const [hour] = timeStr.split(':').map(Number);
  return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
}

// This is one trip per workday, not a return commute.
function annualCost(oneWayCost) {
  return Math.round(oneWayCost * 5 * 48);
}
