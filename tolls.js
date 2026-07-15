// These published prices make the project's 2026 reference data easy to audit.
// Live route cards use Google's route-specific toll estimate instead.
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
