// server/services/locationBudgetService.js
// Location-Based Budget Advisor Service for FinWise AI
// Calculates deterministic budgets, local cost differences (e.g. Bengaluru vs Tenkasi),
// utilizes Google Places API for real venue retrieval, and reuses Grok for local explanations.

const { searchPlaces, isPlacesConfigured } = require('./googlePlacesService');

/**
 * Maintained Regional Living Cost Dataset for India
 * Tiers:
 * - Tier-1 Metros: Bengaluru, Mumbai, Delhi, Chennai, Hyderabad, Pune, Kolkata
 * - Tier-2 Urban Centers: Coimbatore, Madurai, Jaipur, Ahmedabad, Kochi, Trichy, Salem, etc.
 * - Tier-3 Towns & Rural: Tenkasi, Sathyamangalam, Pollachi, Tirunelveli, etc.
 */
const REGIONAL_CITY_BENCHMARKS = {
  // Tier 1 Metros
  'bengaluru': {
    name: 'Bengaluru',
    state: 'Karnataka',
    tier: 'Tier-1 Metro',
    costIndex: 1.25,
    dailyFoodCost: 380,       // ~₹90 breakfast, ₹140 lunch, ₹150 dinner (Darshini / budget mess)
    dailyTransportCost: 140,  // BMTC bus daily pass or Namma Metro commute
    dailyStayCost: 1400,      // Budget hotel/guesthouse (basic non-AC / hostel)
    dailyOtherBuffer: 120,    // Water, tea, printing, local incidentals
    costConfidence: 'high',
    dataSource: 'Karnataka Urban Metro Living Benchmark (FY 2024–25)'
  },
  'bangalore': {
    aliasOf: 'bengaluru'
  },
  'mumbai': {
    name: 'Mumbai',
    state: 'Maharashtra',
    tier: 'Tier-1 Metro',
    costIndex: 1.35,
    dailyFoodCost: 400,
    dailyTransportCost: 130,  // Local train + BEST bus
    dailyStayCost: 1600,
    dailyOtherBuffer: 140,
    costConfidence: 'high',
    dataSource: 'Mumbai Metropolitan Living Cost Benchmark'
  },
  'delhi': {
    name: 'Delhi',
    state: 'Delhi NCR',
    tier: 'Tier-1 Metro',
    costIndex: 1.20,
    dailyFoodCost: 350,
    dailyTransportCost: 120,  // Delhi Metro commute
    dailyStayCost: 1300,
    dailyOtherBuffer: 110,
    costConfidence: 'high',
    dataSource: 'Delhi NCR Urban Living Benchmark'
  },
  'chennai': {
    name: 'Chennai',
    state: 'Tamil Nadu',
    tier: 'Tier-1 Metro',
    costIndex: 1.05,
    dailyFoodCost: 290,
    dailyTransportCost: 100,  // MTC bus / Chennai Metro
    dailyStayCost: 1100,
    dailyOtherBuffer: 90,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Urban Metro Living Cost Index'
  },
  'hyderabad': {
    name: 'Hyderabad',
    state: 'Telangana',
    tier: 'Tier-1 Metro',
    costIndex: 1.05,
    dailyFoodCost: 290,
    dailyTransportCost: 100,
    dailyStayCost: 1100,
    dailyOtherBuffer: 90,
    costConfidence: 'high',
    dataSource: 'Telangana Urban Metro Benchmark'
  },
  'pune': {
    name: 'Pune',
    state: 'Maharashtra',
    tier: 'Tier-1',
    costIndex: 1.10,
    dailyFoodCost: 320,
    dailyTransportCost: 110,
    dailyStayCost: 1200,
    dailyOtherBuffer: 100,
    costConfidence: 'high',
    dataSource: 'Maharashtra Tier-1 Living Benchmark'
  },
  'kolkata': {
    name: 'Kolkata',
    state: 'West Bengal',
    tier: 'Tier-1 Metro',
    costIndex: 0.90,
    dailyFoodCost: 230,
    dailyTransportCost: 70,   // Metro & local tram/bus
    dailyStayCost: 950,
    dailyOtherBuffer: 70,
    costConfidence: 'high',
    dataSource: 'West Bengal Metro Benchmark'
  },

  // Tier 2 Urban Centers
  'coimbatore': {
    name: 'Coimbatore',
    state: 'Tamil Nadu',
    tier: 'Tier-2',
    costIndex: 0.85,
    dailyFoodCost: 220,
    dailyTransportCost: 70,
    dailyStayCost: 850,
    dailyOtherBuffer: 70,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Tier-2 Regional Benchmark'
  },
  'madurai': {
    name: 'Madurai',
    state: 'Tamil Nadu',
    tier: 'Tier-2',
    costIndex: 0.80,
    dailyFoodCost: 200,
    dailyTransportCost: 60,
    dailyStayCost: 800,
    dailyOtherBuffer: 60,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Tier-2 Regional Benchmark'
  },
  'jaipur': {
    name: 'Jaipur',
    state: 'Rajasthan',
    tier: 'Tier-2',
    costIndex: 0.85,
    dailyFoodCost: 220,
    dailyTransportCost: 70,
    dailyStayCost: 850,
    dailyOtherBuffer: 70,
    costConfidence: 'high',
    dataSource: 'Rajasthan Regional Benchmark'
  },
  'ahmedabad': {
    name: 'Ahmedabad',
    state: 'Gujarat',
    tier: 'Tier-2',
    costIndex: 0.90,
    dailyFoodCost: 240,
    dailyTransportCost: 75,
    dailyStayCost: 900,
    dailyOtherBuffer: 75,
    costConfidence: 'high',
    dataSource: 'Gujarat Regional Benchmark'
  },
  'kochi': {
    name: 'Kochi',
    state: 'Kerala',
    tier: 'Tier-2',
    costIndex: 0.90,
    dailyFoodCost: 240,
    dailyTransportCost: 75,
    dailyStayCost: 950,
    dailyOtherBuffer: 75,
    costConfidence: 'high',
    dataSource: 'Kerala Regional Benchmark'
  },
  'trichy': {
    name: 'Trichy',
    state: 'Tamil Nadu',
    tier: 'Tier-2',
    costIndex: 0.78,
    dailyFoodCost: 190,
    dailyTransportCost: 55,
    dailyStayCost: 750,
    dailyOtherBuffer: 60,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Tier-2 Benchmark'
  },
  'salem': {
    name: 'Salem',
    state: 'Tamil Nadu',
    tier: 'Tier-2',
    costIndex: 0.78,
    dailyFoodCost: 190,
    dailyTransportCost: 55,
    dailyStayCost: 750,
    dailyOtherBuffer: 60,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Tier-2 Benchmark'
  },

  // Tier 3 Towns & Rural Districts
  'tenkasi': {
    name: 'Tenkasi',
    state: 'Tamil Nadu',
    tier: 'Tier-3 Town',
    costIndex: 0.65,
    dailyFoodCost: 160,       // ₹40 tiffin, ₹70 lunch, ₹50 dinner
    dailyTransportCost: 45,   // Town bus / shared auto
    dailyStayCost: 650,       // Local lodge / room
    dailyOtherBuffer: 50,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Southern District Town Benchmark (Tenkasi / Tirunelveli)'
  },
  'sathyamangalam': {
    name: 'Sathyamangalam',
    state: 'Tamil Nadu',
    tier: 'Tier-3 Town',
    costIndex: 0.65,
    dailyFoodCost: 160,
    dailyTransportCost: 45,
    dailyStayCost: 650,
    dailyOtherBuffer: 50,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Western District Town Benchmark (Erode / Sathyamangalam)'
  },
  'tirunelveli': {
    name: 'Tirunelveli',
    state: 'Tamil Nadu',
    tier: 'Tier-3 Town',
    costIndex: 0.70,
    dailyFoodCost: 170,
    dailyTransportCost: 50,
    dailyStayCost: 700,
    dailyOtherBuffer: 55,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Southern District Benchmark'
  },
  'pollachi': {
    name: 'Pollachi',
    state: 'Tamil Nadu',
    tier: 'Tier-3 Town',
    costIndex: 0.65,
    dailyFoodCost: 160,
    dailyTransportCost: 45,
    dailyStayCost: 650,
    dailyOtherBuffer: 50,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Western District Town Benchmark'
  },
  'hosur': {
    name: 'Hosur',
    state: 'Tamil Nadu',
    tier: 'Tier-3 Town',
    costIndex: 0.75,
    dailyFoodCost: 180,
    dailyTransportCost: 55,
    dailyStayCost: 750,
    dailyOtherBuffer: 60,
    costConfidence: 'high',
    dataSource: 'Tamil Nadu Industrial Town Benchmark'
  },
  'ooty': {
    name: 'Ooty',
    state: 'Tamil Nadu',
    tier: 'Hill Station / Tourist',
    costIndex: 1.15,
    dailyFoodCost: 320,
    dailyTransportCost: 120,
    dailyStayCost: 1350,
    dailyOtherBuffer: 100,
    costConfidence: 'high',
    dataSource: 'Nilgiris District Benchmark'
  }
};

/**
 * PIN Code Prefix Map for Indian Regions
 */
const PIN_CODE_MAP = [
  { prefix: '560', city: 'bengaluru' },
  { prefix: '400', city: 'mumbai' },
  { prefix: '110', city: 'delhi' },
  { prefix: '600', city: 'chennai' },
  { prefix: '500', city: 'hyderabad' },
  { prefix: '700', city: 'kolkata' },
  { prefix: '411', city: 'pune' },
  { prefix: '627811', city: 'tenkasi' },
  { prefix: '627', city: 'tenkasi' },
  { prefix: '638401', city: 'sathyamangalam' },
  { prefix: '638', city: 'sathyamangalam' },
  { prefix: '641', city: 'coimbatore' },
  { prefix: '625', city: 'madurai' },
  { prefix: '620', city: 'trichy' },
  { prefix: '636', city: 'salem' },
  { prefix: '642', city: 'pollachi' },
  { prefix: '302', city: 'jaipur' },
  { prefix: '380', city: 'ahmedabad' },
  { prefix: '682', city: 'kochi' }
];

/**
 * Resolves location string or PIN code into benchmark data
 */
function resolveLocationBenchmark(rawLocation) {
  if (!rawLocation || typeof rawLocation !== 'string') {
    return {
      resolvedCity: 'Unknown',
      data: null,
      isSufficientData: false
    };
  }

  const clean = rawLocation.trim().toLowerCase();

  // 1. Direct match or alias
  if (REGIONAL_CITY_BENCHMARKS[clean]) {
    let entry = REGIONAL_CITY_BENCHMARKS[clean];
    if (entry.aliasOf) entry = REGIONAL_CITY_BENCHMARKS[entry.aliasOf];
    return {
      resolvedCity: entry.name,
      data: entry,
      isSufficientData: true
    };
  }

  // 2. Substring matching in known cities (e.g. "Bengaluru, Karnataka" or "Tenkasi district")
  for (const [key, entry] of Object.entries(REGIONAL_CITY_BENCHMARKS)) {
    if (entry.aliasOf) continue;
    if (clean.includes(key) || clean.includes(entry.name.toLowerCase())) {
      return {
        resolvedCity: entry.name,
        data: entry,
        isSufficientData: true
      };
    }
  }

  // 3. PIN code matching
  const pinMatch = clean.match(/\b\d{6}\b/);
  if (pinMatch) {
    const pin = pinMatch[0];
    const foundPin = PIN_CODE_MAP.find(p => pin.startsWith(p.prefix));
    if (foundPin && REGIONAL_CITY_BENCHMARKS[foundPin.city]) {
      const entry = REGIONAL_CITY_BENCHMARKS[foundPin.city];
      return {
        resolvedCity: `${entry.name} (PIN ${pin})`,
        data: entry,
        isSufficientData: true
      };
    }
  }

  // 4. Fallback / Insufficient Local Data
  // Capitalize raw location name cleanly
  const formattedName = rawLocation.trim().charAt(0).toUpperCase() + rawLocation.trim().slice(1);
  return {
    resolvedCity: formattedName,
    data: {
      name: formattedName,
      state: 'Regional India',
      tier: 'Non-Metro Baseline (Approximated)',
      costIndex: 0.75,
      dailyFoodCost: 200,
      dailyTransportCost: 60,
      dailyStayCost: 800,
      dailyOtherBuffer: 60,
      costConfidence: 'uncertain',
      dataSource: 'National Non-Metro Tier Baseline (Approximated due to unlisted location)'
    },
    isSufficientData: false
  };
}

/**
 * Generates three practical spending reduction recommendations without cutting basic needs
 */
function generateRecommendations(cityData, needs, budgetStatus, safeDailyLimit) {
  const recommendations = [];

  const isMetro = cityData.costIndex >= 1.0;
  const isTown = cityData.costIndex <= 0.75;

  if (isMetro) {
    recommendations.push(
      `Transportation: Use public bus or metro daily passes (BMTC/Metro/Local) instead of on-demand auto or cab rides to save ₹80–₹120 every day.`
    );
    recommendations.push(
      `Dining: Choose traditional local canteens, Darshinis, or tiffin centres for breakfast and meals rather than food-delivery apps, avoiding ₹150+ in delivery and packaging fees.`
    );
  } else if (isTown) {
    recommendations.push(
      `Local Travel: Central areas in ${cityData.name} are accessible by town bus or walking; keeping local transit under ₹30–₹45/day preserves your budget.`
    );
    recommendations.push(
      `Dining: Traditional mess meals and local tiffin centres offer wholesome food for ₹40–₹70/meal without metropolitan price premiums.`
    );
  } else {
    recommendations.push(
      `Transit: Opt for shared autos or city buses on primary arterial routes to keep transit costs within ₹50–₹70/day.`
    );
    recommendations.push(
      `Dining: Patronize local restaurants and mess establishments over chain cafes, saving ₹100–₹150 daily on meals.`
    );
  }

  if (needs.includeAccommodation) {
    recommendations.push(
      `Stay: Inquire directly at registered guesthouses, YMCAs, or verified budget lodges to negotiate non-peak rates, potentially saving ₹200–₹400/night.`
    );
  } else if (budgetStatus === 'insufficient') {
    recommendations.push(
      `Discretionary Cap: Temporarily eliminate optional shopping and entertainment to strictly protect your non-negotiable food and transit budget.`
    );
  } else {
    recommendations.push(
      `Emergency Buffer: Keep at least 8–10% of your available funds in a liquid account as an untouched emergency cushion for medical or transit exigencies.`
    );
  }

  return recommendations.slice(0, 3);
}

/**
 * Calculates deterministic budget advice for a given location, budget, and period.
 *
 * @param {object} params
 * @param {string} params.location - City, town, or PIN code
 * @param {number} params.availableAmount - Total ₹ available
 * @param {number} params.days - Number of days
 * @param {object} params.needs - { includeFood, includeTransport, includeAccommodation, otherDailyExpense }
 * @returns {Promise<object>}
 */
async function calculateLocationBudgetAdvice({
  location,
  availableAmount,
  days,
  needs = {}
}) {
  const amt = Number(availableAmount) || 0;
  const numDays = Math.max(1, Math.min(60, Number(days) || 1));
  const includeFood = needs.includeFood !== false;
  const includeTransport = needs.includeTransport !== false;
  const includeAccommodation = Boolean(needs.includeAccommodation);
  const otherDailyExpense = Math.max(0, Number(needs.otherDailyExpense) || 0);

  // 1. Resolve Location Benchmark
  const { resolvedCity, data: cityData, isSufficientData } = resolveLocationBenchmark(location);

  // 2. Cost calculations per day
  const dailyFood = includeFood ? cityData.dailyFoodCost : 0;
  const dailyTransport = includeTransport ? cityData.dailyTransportCost : 0;
  const dailyAccommodation = includeAccommodation ? cityData.dailyStayCost : 0;
  const dailyOther = otherDailyExpense;

  const essentialDailyCost = dailyFood + dailyTransport + dailyAccommodation + dailyOther;
  const totalEssentialCost = essentialDailyCost * numDays;

  // Emergency reserve: 8% of available amount or half-day essential cost
  const emergencyReserve = Math.round(Math.max(amt * 0.08, essentialDailyCost * 0.5));
  const totalRecommendedBudget = totalEssentialCost + emergencyReserve;

  // Safe daily spending limit from available money
  const safeDailyLimit = Math.max(0, Math.floor((amt - emergencyReserve) / numDays));

  // Determine Sufficiency Status
  let status = 'sufficient'; // 'sufficient' | 'tight' | 'insufficient' | 'uncertain'
  let surplusOrShortfall = 0;
  let statusMessage = '';

  if (!isSufficientData) {
    status = 'uncertain';
    surplusOrShortfall = amt - totalRecommendedBudget;
    statusMessage = `Local cost data for "${resolvedCity}" is limited. Estimates are based on a standard non-metro baseline; please verify with local residents or confirm your accommodation details.`;
  } else if (amt >= totalRecommendedBudget) {
    status = 'sufficient';
    surplusOrShortfall = amt - totalRecommendedBudget;
    statusMessage = `Your available budget of ₹${amt.toLocaleString('en-IN')} appears sufficient for ${numDays} day${numDays > 1 ? 's' : ''} in ${resolvedCity} with a comfortable emergency reserve.`;
  } else if (amt >= totalEssentialCost) {
    status = 'tight';
    surplusOrShortfall = amt - totalEssentialCost;
    statusMessage = `Your budget of ₹${amt.toLocaleString('en-IN')} covers basic essential needs in ${resolvedCity}, but leaves a narrow safety margin for unexpected emergencies.`;
  } else {
    status = 'insufficient';
    surplusOrShortfall = amt - totalEssentialCost; // negative shortfall
    statusMessage = `Your budget of ₹${amt.toLocaleString('en-IN')} falls short by ₹${Math.abs(surplusOrShortfall).toLocaleString('en-IN')} for essential needs across ${numDays} day${numDays > 1 ? 's' : ''} in ${resolvedCity}.`;
  }

  // 3. Category Breakdown with Explicit Sourcing Labels
  const breakdown = {
    food: {
      included: includeFood,
      daily: dailyFood,
      total: dailyFood * numDays,
      source: includeFood ? `Sourced from ${cityData.dataSource}` : 'Excluded by user (Not required)',
      statusLabel: includeFood ? 'Sourced Estimate' : 'Excluded'
    },
    transport: {
      included: includeTransport,
      daily: dailyTransport,
      total: dailyTransport * numDays,
      source: includeTransport ? `Sourced from ${cityData.tier} public transit benchmark` : 'Excluded by user (Not required)',
      statusLabel: includeTransport ? 'Sourced Estimate' : 'Excluded'
    },
    accommodation: {
      included: includeAccommodation,
      daily: dailyAccommodation,
      total: dailyAccommodation * numDays,
      source: includeAccommodation ? `Sourced budget guesthouse/lodge benchmark for ${cityData.name}` : 'Excluded by user (e.g. local resident / home stay)',
      statusLabel: includeAccommodation ? 'Sourced Estimate (Variable by season)' : 'Excluded'
    },
    other: {
      included: otherDailyExpense > 0,
      daily: dailyOther,
      total: dailyOther * numDays,
      source: otherDailyExpense > 0 ? 'User-specified planned daily expenses' : 'None specified',
      statusLabel: otherDailyExpense > 0 ? 'User Provided' : 'None'
    },
    emergencyReserve: {
      included: true,
      daily: Math.round(emergencyReserve / numDays),
      total: emergencyReserve,
      source: 'Calculated safety cushion (protects against sudden medical or transit emergencies)',
      statusLabel: 'Calculated Buffer'
    }
  };

  // 4. Generate 3 practical recommendations
  const recommendations = generateRecommendations(cityData, { includeFood, includeTransport, includeAccommodation }, status, safeDailyLimit);

  // 5. Query Google Places API for real verified venues if configured
  let nearbyPlaces = [];
  if (isPlacesConfigured()) {
    try {
      const placesToSearch = [];
      if (includeFood) {
        placesToSearch.push(searchPlaces(`popular budget restaurants mess cafes in ${resolvedCity}`, { maxResultCount: 2 }));
      }
      if (includeAccommodation) {
        placesToSearch.push(searchPlaces(`budget lodges hotels in ${resolvedCity}`, { maxResultCount: 2 }));
      }

      if (placesToSearch.length > 0) {
        const placeResults = await Promise.all(placesToSearch);
        nearbyPlaces = placeResults.flat().slice(0, 3).map(p => ({
          name: p.name,
          address: p.formattedAddress,
          rating: p.rating,
          mapsUrl: p.googleMapsUri,
          priceNote: p.types.some(t => t.includes('lodging') || t.includes('hotel'))
            ? 'Budget lodge (Tariffs subject to seasonal occupancy)'
            : 'Local dining (Estimated ~₹80–₹160/meal, verify in-store)',
          isVerifiedVenue: true
        }));
      }
    } catch (placeErr) {
      console.warn('[LocationBudgetService] Google Places fetch failed:', placeErr.message);
    }
  }

  // 6. Explanation
  const costIndexDiff = Math.round((cityData.costIndex - 1.0) * 100);
  const costComparisonText = costIndexDiff > 0
    ? `Costs in ${cityData.name} trend approximately ${costIndexDiff}% higher than the national median due to higher metropolitan dining and transit fares.`
    : costIndexDiff < 0
      ? `Costs in ${cityData.name} trend approximately ${Math.abs(costIndexDiff)}% lower than major metropolitan centers, making daily necessities and tiffin significantly more affordable.`
      : `Costs in ${cityData.name} are closely aligned with standard urban Indian benchmarks.`;

  return {
    location: resolvedCity,
    region: cityData.state,
    tier: cityData.tier,
    costIndex: cityData.costIndex,
    isSufficientData,
    status,
    statusMessage,
    availableAmount: amt,
    days: numDays,
    safeDailyLimit,
    essentialDailyCost,
    totalEssentialCost,
    emergencyReserve,
    totalRecommendedBudget,
    surplusOrShortfall,
    breakdown,
    recommendations,
    costComparisonText,
    estimationDetails: {
      dataSource: cityData.dataSource,
      confidence: cityData.costConfidence,
      costIndex: cityData.costIndex,
      isApproximated: !isSufficientData,
      disclaimer: 'Estimates are derived from regional benchmarks and verified location data. Exact room rates, taxi fares, and meal prices should be confirmed locally.'
    },
    nearbyPlaces
  };
}

module.exports = {
  calculateLocationBudgetAdvice,
  resolveLocationBenchmark,
  REGIONAL_CITY_BENCHMARKS
};
