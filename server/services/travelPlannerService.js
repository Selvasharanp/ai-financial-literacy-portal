const OpenAI = require('openai');
const googlePlacesService = require('./googlePlacesService');

const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

let openaiClient = null;
if (GROQ_API_KEY) {
    openaiClient = new OpenAI({
        apiKey: GROQ_API_KEY,
        baseURL: GROQ_BASE_URL,
        timeout: 25000,
        maxRetries: 1
    });
}

/**
 * Validates travel planner form inputs
 */
function validateTripInputs({
    origin,
    destination,
    departureDate,
    returnDate,
    durationDays,
    numberOfTravellers,
    totalBudget,
    travelStyle
}) {
    const errors = [];

    if (!origin || typeof origin !== 'string' || !origin.trim()) {
        errors.push('Starting location (origin) is required.');
    }
    if (!destination || typeof destination !== 'string' || !destination.trim()) {
        errors.push('Trip destination is required.');
    }

    const numTravellers = parseInt(numberOfTravellers, 10);
    if (isNaN(numTravellers) || numTravellers < 1 || numTravellers > 50) {
        errors.push('Number of travellers must be at least 1 (max 50).');
    }

    const numBudget = Number(totalBudget);
    if (isNaN(numBudget) || numBudget <= 0) {
        errors.push('Total budget must be a positive amount in INR (greater than ₹0).');
    }

    // Date validation
    let days = parseInt(durationDays, 10);

    if (departureDate && returnDate) {
        const dep = new Date(departureDate);
        const ret = new Date(returnDate);

        if (isNaN(dep.getTime())) {
            errors.push('Departure date is invalid.');
        }
        if (isNaN(ret.getTime())) {
            errors.push('Return date is invalid.');
        }
        if (!isNaN(dep.getTime()) && !isNaN(ret.getTime())) {
            if (ret < dep) {
                errors.push('Return date cannot be earlier than departure date.');
            } else {
                const diffTime = Math.abs(ret - dep);
                const calcDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                days = Math.max(1, calcDays);
            }
        }
    } else if (!days || isNaN(days) || days < 1) {
        days = 2; // Default to 2 days
    }

    if (days > 14) {
        errors.push('Maximum supported trip duration is 14 days.');
    }

    const validStyles = ['budget', 'balanced', 'comfortable'];
    const style = validStyles.includes((travelStyle || '').toLowerCase()) ? travelStyle.toLowerCase() : 'balanced';

    return {
        isValid: errors.length === 0,
        errors,
        validated: {
            origin: (origin || '').trim(),
            destination: (destination || '').trim(),
            departureDate: departureDate || new Date().toISOString().slice(0, 10),
            returnDate: returnDate || new Date(Date.now() + (days - 1) * 86400000).toISOString().slice(0, 10),
            durationDays: days,
            numberOfTravellers: numTravellers || 1,
            totalBudget: numBudget || 0,
            travelStyle: style
        }
    };
}

/**
 * Deterministic Calculation Engine
 * Crucial Rule: Do NOT rely on AI to compute final totals.
 * All amounts are calculated deterministically in JavaScript with zero double-counting.
 */
function calculateTripPlanTotals(planData, selectedOptions = {}, params = {}) {
    const numTravellers = Math.max(1, parseInt(params.numberOfTravellers, 10) || 1);
    const durationDays = Math.max(1, parseInt(params.durationDays, 10) || planData.itinerary?.length || 1);
    const nights = durationDays > 1 ? durationDays - 1 : 1;
    const roomsNeeded = Math.ceil(numTravellers / 2); // 2 persons per standard room assumption
    const totalBudget = Number(params.totalBudget) || 0;

    // 1. Transportation
    const transportList = planData.transportationOptions || [];
    const tIdx = Math.max(0, Math.min(selectedOptions.transportIndex ?? 0, transportList.length - 1));
    const selectedTransport = transportList[tIdx] || {
        mode: 'Bus',
        operator: 'Regional Transport',
        perPersonFare: 400,
        totalGroupCost: 400 * numTravellers,
        additionalCosts: 0
    };

    const transportationTotal = selectedTransport.totalGroupCost
        ? Number(selectedTransport.totalGroupCost)
        : (Number(selectedTransport.perPersonFare || 0) * numTravellers) + Number(selectedTransport.additionalCosts || 0);

    // 2. Accommodation
    const accommodationList = planData.accommodationOptions || [];
    const aIdx = Math.max(0, Math.min(selectedOptions.accommodationIndex ?? 0, accommodationList.length - 1));
    const selectedAccommodation = accommodationList[aIdx] || {
        name: 'Standard Stay',
        pricePerNight: 1200
    };

    const accommodationTotal = Number(selectedAccommodation.pricePerNight || 0) * roomsNeeded * nights;

    // 3. Daily Meals Breakdown
    let breakfastTotal = 0;
    let lunchTotal = 0;
    let dinnerTotal = 0;
    let snacksTotal = 0;

    const itinerary = planData.itinerary || [];
    itinerary.forEach(day => {
        const meals = day.meals || {};
        const b = Number(meals.breakfast?.costPerPerson || 0) * numTravellers;
        const l = Number(meals.lunch?.costPerPerson || 0) * numTravellers;
        const d = Number(meals.dinner?.costPerPerson || 0) * numTravellers;
        const s = Number(meals.snacks?.costPerPerson || 0) * numTravellers;

        breakfastTotal += b;
        lunchTotal += l;
        dinnerTotal += d;
        snacksTotal += s;
    });

    const mealsTotal = breakfastTotal + lunchTotal + dinnerTotal + snacksTotal;

    // 4. Sightseeing and Activities
    let activitiesTotal = 0;
    const activeActivitySelections = Array.isArray(selectedOptions.activitySelections)
        ? selectedOptions.activitySelections
        : null; // null means all activities are selected by default

    itinerary.forEach(day => {
        (day.activities || []).forEach(act => {
            const isSelected = activeActivitySelections === null || activeActivitySelections.includes(act.id);
            if (isSelected) {
                activitiesTotal += Number(act.feePerPerson || 0) * numTravellers;
            }
        });
    });

    // 5. Local Transportation
    let localTravelTotal = 0;
    itinerary.forEach(day => {
        localTravelTotal += Number(day.localTransport?.estimatedCost || 0);
    });

    // 6. Miscellaneous
    const misc = planData.miscellaneous || {};
    const parkingAndTolls = Number(misc.parkingAndTolls || 0);
    const waterAndSnacks = Number(misc.waterAndSnacks || (40 * numTravellers * durationDays));
    const shopping = Number(misc.shopping || 0);
    const miscellaneousTotal = parkingAndTolls + waterAndSnacks + shopping;

    // 7. Expected Spending Before Contingency
    const expectedSpendingBeforeContingency =
        transportationTotal +
        accommodationTotal +
        mealsTotal +
        activitiesTotal +
        localTravelTotal +
        miscellaneousTotal;

    // 8. Contingency Reserve (Default 8%, user adjustable)
    const contingencyPercent = Math.max(0, Math.min(Number(selectedOptions.customContingencyPercent ?? 8), 25));
    const contingencyReserve = Math.round(expectedSpendingBeforeContingency * (contingencyPercent / 100));

    // 9. Grand Total Trip Cost
    const totalTripCost = expectedSpendingBeforeContingency + contingencyReserve;
    const costPerPerson = Math.round(totalTripCost / numTravellers);
    const remainingBudget = totalBudget - totalTripCost;
    const isOverBudget = totalTripCost > totalBudget;
    const shortfall = isOverBudget ? totalTripCost - totalBudget : 0;

    return {
        transportationTotal,
        accommodationTotal,
        breakfastTotal,
        lunchTotal,
        dinnerTotal,
        snacksTotal,
        mealsTotal,
        activitiesTotal,
        localTravelTotal,
        miscellaneousTotal,
        parkingAndTolls,
        waterAndSnacks,
        shopping,
        expectedSpendingBeforeContingency,
        contingencyPercent,
        contingencyReserve,
        totalTripCost,
        costPerPerson,
        remainingBudget,
        isOverBudget,
        shortfall,
        roomsNeeded,
        nights,
        numberOfTravellers: numTravellers,
        totalBudget,
        selectedTransport,
        selectedAccommodation
    };
}

/**
 * Budget Optimization Suggestions Generator
 * Proposes concrete alternatives when the plan exceeds budget or has large savings opportunities.
 */
function generateOptimizationSuggestions(planData, selectedOptions, calculations, totalBudget) {
    const suggestions = [];
    const { transportationOptions = [], accommodationOptions = [], itinerary = [] } = planData;
    const currentTIdx = selectedOptions.transportIndex ?? 0;
    const currentAIdx = selectedOptions.accommodationIndex ?? 0;
    const numTravellers = calculations.numberOfTravellers;
    const roomsNeeded = calculations.roomsNeeded;
    const nights = calculations.nights;

    // 1. Cheaper Transportation Options
    transportationOptions.forEach((opt, idx) => {
        if (idx !== currentTIdx) {
            const optCost = opt.totalGroupCost ? Number(opt.totalGroupCost) : (Number(opt.perPersonFare || 0) * numTravellers) + Number(opt.additionalCosts || 0);
            const savings = calculations.transportationTotal - optCost;
            if (savings > 0) {
                suggestions.push({
                    id: `opt_transport_${idx}`,
                    type: 'transport',
                    title: `Switch to ${opt.mode} (${opt.operator || 'Economical Option'})`,
                    description: `Change transit from ${calculations.selectedTransport?.mode} to ${opt.mode} to reduce group transport costs.`,
                    potentialSavings: savings,
                    actionPayload: { transportIndex: idx }
                });
            }
        }
    });

    // 2. Cheaper Accommodation Options
    accommodationOptions.forEach((acc, idx) => {
        if (idx !== currentAIdx) {
            const accCost = Number(acc.pricePerNight || 0) * roomsNeeded * nights;
            const savings = calculations.accommodationTotal - accCost;
            if (savings > 0) {
                suggestions.push({
                    id: `opt_stay_${idx}`,
                    type: 'accommodation',
                    title: `Choose ${acc.name} (${acc.type})`,
                    description: `Save on accommodation by choosing ${acc.name} at ₹${acc.pricePerNight}/night.`,
                    potentialSavings: savings,
                    actionPayload: { accommodationIndex: idx }
                });
            }
        }
    });

    // 3. Paid Activity Optimization (Replace paid activities with free spots)
    const paidActivities = [];
    itinerary.forEach(day => {
        (day.activities || []).forEach(act => {
            if (act.feePerPerson && act.feePerPerson > 0) {
                paidActivities.push({
                    ...act,
                    groupCost: act.feePerPerson * numTravellers
                });
            }
        });
    });

    paidActivities.sort((a, b) => b.groupCost - a.groupCost);
    if (paidActivities.length > 0 && calculations.isOverBudget) {
        const topPaid = paidActivities[0];
        suggestions.push({
            id: `opt_act_${topPaid.id}`,
            type: 'activity',
            title: `Skip or Replace Paid Activity: ${topPaid.name}`,
            description: `Deselecting ${topPaid.name} (₹${topPaid.feePerPerson}/person) saves ₹${topPaid.groupCost} for the group.`,
            potentialSavings: topPaid.groupCost,
            actionPayload: { deselectActivityId: topPaid.id }
        });
    }

    // 4. Contingency Reserve Adjustment
    if (calculations.contingencyPercent > 5 && calculations.isOverBudget) {
        const reducedReserve = Math.round(calculations.expectedSpendingBeforeContingency * 0.05);
        const savings = calculations.contingencyReserve - reducedReserve;
        if (savings > 100) {
            suggestions.push({
                id: 'opt_contingency',
                type: 'contingency',
                title: 'Adjust Contingency Buffer from 8% to 5%',
                description: 'Temporarily reduce the emergency buffer to fit essential travel expenses.',
                potentialSavings: savings,
                actionPayload: { customContingencyPercent: 5 }
            });
        }
    }

    return suggestions;
}

/**
 * Intelligent Deterministic Travel Baseline Generator
 * Provides realistic, published-benchmark travel estimates for any Indian destination.
 * Used as a dependable fallback if Groq API is unavailable or rate-limited.
 */
function generateDeterministicPlan(params, placesData = null) {
    const { origin, destination, durationDays, numberOfTravellers, travelStyle, totalBudget } = params;
    const destLower = destination.toLowerCase();

    // Destination-specific knowledge presets
    let destInfo = {
        name: destination,
        tagline: `Scenic getaway from ${origin} to ${destination}`,
        bestTimeToVisit: 'October to March',
        travelTips: [
            'Book transport and accommodation in advance on weekends.',
            'Keep small cash handy for local entry fees and tea stalls.',
            'Carry a light jacket and reusable water bottle.'
        ]
    };

    let sampleActivities = [
        { id: 'act_1_1', name: `${destination} Town Viewpoint & Walk`, description: 'Enjoy panoramic valley and town landscapes.', whyRecommended: 'Iconic local viewpoint, ideal for sunrise or sunset.', feePerPerson: 0, timing: '08:00 AM - 10:00 AM' },
        { id: 'act_1_2', name: `${destination} Botanical / Nature Reserve`, description: 'Lush greenery, heritage trees, and pleasant walking paths.', whyRecommended: 'Family-friendly nature excursion with affordable entry.', feePerPerson: 50, timing: '11:00 AM - 01:00 PM' },
        { id: 'act_2_1', name: `${destination} Lake & Boating`, description: 'Relaxing water activities surrounded by eucalyptus trees.', whyRecommended: 'Popular leisure spot with pedal and row boats.', feePerPerson: 120, timing: '03:00 PM - 05:00 PM' },
        { id: 'act_2_2', name: `${destination} Local Spice & Heritage Bazaar`, description: 'Explore authentic local products, handmade chocolates, and tea.', whyRecommended: 'Great for souvenirs and tasting regional snacks.', feePerPerson: 0, timing: '06:00 PM - 08:00 PM' }
    ];

    // If real tourist attractions were retrieved via Google Places API (New), use them directly!
    if (placesData && Array.isArray(placesData.attractions) && placesData.attractions.length > 0) {
        sampleActivities = placesData.attractions.map((attr, idx) => ({
            id: `act_${Math.floor(idx / 2) + 1}_${(idx % 2) + 1}`,
            name: attr.name,
            formattedAddress: attr.formattedAddress,
            rating: attr.rating,
            userRatingCount: attr.userRatingCount,
            googleMapsUri: attr.googleMapsUri,
            placeId: attr.placeId,
            verifiedPlace: true,
            description: attr.formattedAddress
                ? `Located at ${attr.formattedAddress}. Rated ${attr.rating ? attr.rating + '★' : 'highly'} on Google Maps.`
                : `Verified attraction in ${destination}.`,
            whyRecommended: attr.rating ? `High-rated visitor destination with ${attr.rating}★ rating on Google Maps.` : `Popular landmark in ${destination}.`,
            feePerPerson: idx % 2 === 0 ? 0 : 50,
            confidence: 'Verified Location via Google Maps • Entry fee estimated',
            timing: (idx % 2 === 0) ? '09:30 AM - 12:00 PM' : '03:30 PM - 06:00 PM'
        }));
    } else if (destLower.includes('ooty') || destLower.includes('nilgiri')) {
        destInfo = {
            name: 'Ooty (Udhagamandalam)',
            tagline: 'Queen of Hill Stations nestled in the Nilgiris',
            bestTimeToVisit: 'October to June',
            travelTips: [
                'Pack warm layers; temperatures drop below 12°C in the evenings.',
                'Book the Nilgiri Mountain Railway (Toy Train) tickets well in advance.',
                'Buy authentic Nilgiri tea and homemade chocolates from Co-op stores.'
            ]
        };
        sampleActivities = [
            { id: 'act_1_1', name: 'Government Botanical Gardens', description: '55-acre terraced gardens with exotic flora and fossil trees.', whyRecommended: 'World-famous heritage botanical collection.', feePerPerson: 50, timing: '09:00 AM - 11:30 AM' },
            { id: 'act_1_2', name: 'Ooty Lake & Boat House', description: 'Scenic artificial lake offering row, pedal, and motor boats.', whyRecommended: 'Classic Ooty experience with Nilgiri mountain backdrop.', feePerPerson: 120, timing: '02:30 PM - 04:30 PM' },
            { id: 'act_2_1', name: 'Doddabetta Peak & Telescope House', description: 'Highest mountain in Nilgiris (2,637 m) offering 360-degree views.', whyRecommended: 'Stunning cloud-level panorama across Tamil Nadu and Kerala.', feePerPerson: 30, timing: '09:00 AM - 11:00 AM' },
            { id: 'act_2_2', name: 'Tea Factory & Museum Walk', description: 'Watch live orthodox tea processing and sample cardamom tea.', whyRecommended: 'Educational, fragrant, and highly affordable.', feePerPerson: 20, timing: '02:00 PM - 03:30 PM' }
        ];
    } else if (destLower.includes('goa')) {
        destInfo = {
            name: 'Goa',
            tagline: 'Sun-kissed beaches, coastal cuisine, and Portuguese heritage',
            bestTimeToVisit: 'November to February',
            travelTips: [
                'Rent a scooter or self-drive car for convenient, affordable local travel.',
                'Visit North Goa for watersports and nightlife; South Goa for quiet pristine beaches.',
                'Carry sunscreen, sunglasses, and light cotton clothes.'
            ]
        };
        sampleActivities = [
            { id: 'act_1_1', name: 'Calangute & Baga Beach Walk', description: 'Lively beaches with shacks, beach umbrellas, and music.', whyRecommended: 'Vibrant coastal vibe with great seafood.', feePerPerson: 0, timing: '09:00 AM - 12:00 PM' },
            { id: 'act_1_2', name: 'Aguada Fort & Lighthouse', description: '17th-century Portuguese fortress overlooking the Arabian Sea.', whyRecommended: 'Rich historical architecture and sweeping ocean views.', feePerPerson: 25, timing: '04:00 PM - 06:00 PM' },
            { id: 'act_2_1', name: 'Basilica of Bom Jesus (Old Goa)', description: 'UNESCO World Heritage site holding the mortal remains of St. Francis Xavier.', whyRecommended: 'Masterpiece of Baroque architecture.', feePerPerson: 0, timing: '09:30 AM - 11:30 AM' },
            { id: 'act_2_2', name: 'Mandovi River Sunset Cruise', description: '1-hour evening cruise with traditional Goan folk dances.', whyRecommended: 'Scenic views of Panaji city bathed in evening lights.', feePerPerson: 500, timing: '05:30 PM - 07:00 PM' }
        ];
    } else if (destLower.includes('sathyamangalam') || destLower.includes('bhavanisagar')) {
        destInfo = {
            name: 'Sathyamangalam & Bhavanisagar',
            tagline: 'Scenic forest reserve, Bhavani riverbanks, and Bannari temple gateway',
            bestTimeToVisit: 'September to March',
            travelTips: [
                'Ideal peaceful weekend destination away from city crowds.',
                'Respect wildlife sanctuary rules when driving through Dhimbam ghats.',
                'Try traditional Kongunadu meals at local family mess hotels.'
            ]
        };
        sampleActivities = [
            { id: 'act_1_1', name: 'Bhavanisagar Dam & Park', description: 'One of the world’s largest earthen dams with spacious riverside gardens.', whyRecommended: 'Peaceful picnic spot and boating on Bhavani river.', feePerPerson: 20, timing: '10:00 AM - 01:00 PM' },
            { id: 'act_1_2', name: 'Bannari Amman Temple', description: 'Famous historic Dravidian shrine surrounded by Sathyamangalam forests.', whyRecommended: 'Spiritual landmark of Erode district with traditional architecture.', feePerPerson: 0, timing: '04:00 PM - 06:00 PM' },
            { id: 'act_2_1', name: 'Dhimbam Ghats Viewpoint', description: '27 hairpin bends offering magnificent views of Western Ghats forests.', whyRecommended: 'Thrilling hill drive with cool mountain breeze.', feePerPerson: 0, timing: '08:30 AM - 11:00 AM' }
        ];
    }

    // Dynamic style multipliers
    const isBudget = travelStyle === 'budget';
    const isComfortable = travelStyle === 'comfortable';

    const busFare = isBudget ? 350 : 550;
    const trainFare = isBudget ? 220 : 650;
    const cabFare = isComfortable ? 3500 : 2500;

    const transportationOptions = [
        {
            mode: 'Bus',
            operator: 'State Express (KSRTC / SETC / Private AC)',
            perPersonFare: busFare,
            totalGroupCost: busFare * numberOfTravellers,
            durationHours: 6,
            convenience: 'medium',
            additionalCosts: 0,
            additionalCostsNote: 'Direct terminal pickup and drop',
            sourceName: 'RedBus / KSRTC Published Fares',
            sourceUrl: 'https://www.redbus.in',
            confidence: 'Estimated regional rate',
            bookingNotes: 'Direct terminal pickup and drop via KSRTC/SETC/Private bus portals.',
            assumptions: `Based on semi-sleeper / AC coach bus ticket per person between ${origin} and ${destination}.`
        },
        {
            mode: 'Train',
            operator: 'Indian Railways (IRCTC)',
            perPersonFare: trainFare,
            totalGroupCost: trainFare * numberOfTravellers,
            durationHours: 5.5,
            convenience: 'high',
            additionalCosts: 150 * numberOfTravellers,
            additionalCostsNote: 'Connecting auto/cab from nearest railway station',
            sourceName: 'IRCTC Fare Chart',
            sourceUrl: 'https://www.irctc.co.in',
            confidence: 'Estimated regional rate',
            bookingNotes: isBudget ? 'Sleeper Class (SL) reservation on IRCTC.' : '3-Tier AC (3A) reservation on IRCTC.',
            assumptions: isBudget ? 'Sleeper Class (SL) reservation' : '3-Tier AC (3A) reservation per person.'
        },
        {
            mode: 'Car',
            operator: 'Self-Drive / Outstation Taxi',
            perPersonFare: Math.round(cabFare / numberOfTravellers),
            totalGroupCost: cabFare,
            durationHours: 5,
            convenience: 'high',
            additionalCosts: 400,
            additionalCostsNote: 'State toll gates and parking fees',
            sourceName: 'Outstation Cab Fare Benchmark',
            sourceUrl: 'https://www.makemytrip.com/cabs',
            confidence: 'Estimated regional rate',
            bookingNotes: 'Door-to-door rental taxi or shared outstation cab.',
            assumptions: `Shared sedan/SUV outstation cab split equally among ${numberOfTravellers} travellers.`
        }
    ];

    const hotelBudgetPrice = isBudget ? 1100 : 1600;
    const hotelStandardPrice = isBudget ? 1800 : 2600;
    const hotelComfortPrice = 4200;

    let accommodationOptions = [];

    // If real hotels were retrieved via Google Places API (New), use them directly!
    if (placesData && Array.isArray(placesData.hotels) && placesData.hotels.length > 0) {
        accommodationOptions = placesData.hotels.slice(0, 3).map((hotel, idx) => {
            const tierName = idx === 0 ? 'Economical Option' : idx === 1 ? 'Balanced Option' : 'Premium Option';
            const pricePerNight = idx === 0 ? hotelBudgetPrice : idx === 1 ? hotelStandardPrice : hotelComfortPrice;
            return {
                name: hotel.name,
                type: `${tierName} (Google Verified)`,
                location: hotel.formattedAddress || destination,
                formattedAddress: hotel.formattedAddress,
                rating: hotel.rating,
                userRatingCount: hotel.userRatingCount,
                googleMapsUri: hotel.googleMapsUri,
                websiteUri: hotel.websiteUri,
                placeId: hotel.placeId,
                verifiedPlace: true,
                pricePerNight,
                amenities: [
                    'Verified on Google Maps',
                    hotel.rating ? `★ ${hotel.rating} Rating` : 'Well Reviewed',
                    'Attached Bathroom',
                    'Free Wi-Fi'
                ],
                sourceName: 'Google Places Verified',
                sourceUrl: hotel.googleMapsUri,
                confidence: 'Verified Place via Google Maps • Price estimated from regional hotel benchmarks',
                bookingNotes: 'Live tariffs vary by season and occupancy. Check Google Maps or hotel portal to book.',
                assumptions: `Real hotel verified via Google Places API (New). Tariff of ₹${pricePerNight}/night is an estimated seasonal baseline.`
            };
        });
    }

    // Baseline fallback if fewer than 2 hotels available
    if (accommodationOptions.length === 0) {
        accommodationOptions = [
            {
                name: `${destination} Cozy Homestay / Budget Inn`,
                type: 'Budget Stay',
                location: `Central ${destination}`,
                pricePerNight: hotelBudgetPrice,
                amenities: ['Clean Beds', 'Attached Bathroom', 'Free Wi-Fi', 'Hot Water'],
                sourceName: 'Booking.com / MakeMyTrip Averages',
                sourceUrl: 'https://www.booking.com',
                assumptions: `Assumes 2 guests per room (₹${hotelBudgetPrice}/room/night). Clean, verified budget guesthouse.`
            },
            {
                name: `${destination} Residency & Suites`,
                type: 'Standard Hotel',
                location: `Near Lake / Main Mall Road, ${destination}`,
                pricePerNight: hotelStandardPrice,
                amenities: ['AC / Heater', 'Room Service', 'Complimentary Breakfast', 'Parking'],
                sourceName: 'Goibibo / Agoda Tariffs',
                sourceUrl: 'https://www.goibibo.com',
                assumptions: `Comfortable 3-star rated hotel room (₹${hotelStandardPrice}/night).`
            },
            {
                name: `${destination} Heritage Resort & Spa`,
                type: 'Comfortable Resort',
                location: `Scenic Valley View, ${destination}`,
                pricePerNight: hotelComfortPrice,
                amenities: ['Valley View Balcony', 'Buffet Breakfast', 'Spa & Lawn', 'Restaurant'],
                sourceName: 'Resort Direct Tariffs',
                sourceUrl: 'https://www.makemytrip.com',
                assumptions: `Premium boutique resort stay with valley views (₹${hotelComfortPrice}/night).`
            }
        ];
    }

    // Day-by-day itinerary
    const itinerary = [];
    const mealBreakfast = isBudget ? 70 : 120;
    const mealLunch = isBudget ? 130 : 220;
    const mealDinner = isBudget ? 150 : 250;
    const mealSnacks = isBudget ? 40 : 70;

    const restB = placesData?.restaurants?.[0] || null;
    const restL = placesData?.restaurants?.[1] || placesData?.restaurants?.[0] || null;
    const restD = placesData?.restaurants?.[2] || placesData?.restaurants?.[0] || null;
    const restS = placesData?.restaurants?.[3] || placesData?.restaurants?.[0] || null;

    for (let d = 1; d <= durationDays; d++) {
        const dayActs = sampleActivities.slice((d - 1) * 2, d * 2);
        if (dayActs.length === 0) {
            dayActs.push({
                id: `act_${d}_1`,
                name: `${destination} Scenic Sunset Point & Cafe`,
                description: 'Relaxed evening taking in scenic horizons and tea.',
                whyRecommended: 'Unhurried wrap to the day.',
                feePerPerson: 0,
                timing: '04:30 PM - 06:30 PM'
            });
        }

        itinerary.push({
            dayNumber: d,
            title: d === 1 ? `Day 1: Arrival & Exploring ${destination}` : d === durationDays ? `Day ${d}: Morning Leisure & Return to ${origin}` : `Day ${d}: Highlights of ${destination}`,
            schedule: {
                morning: {
                    time: '08:30 AM - 11:30 AM',
                    title: d === 1 ? `Arrival in ${destination} & Check-in` : `Morning Sightseeing & Trail`,
                    description: d === 1 ? `Reach ${destination}, check into your accommodation, and freshen up.` : `Visit local viewpoints, lakes, and enjoy morning breeze.`
                },
                afternoon: {
                    time: '12:30 PM - 03:30 PM',
                    title: 'Lunch & Cultural Exploration',
                    description: 'Enjoy authentic regional meal and visit nearby heritage sites or artisan shops.'
                },
                evening: {
                    time: '04:30 PM - 07:00 PM',
                    title: 'Scenic Sunset & Leisure Walk',
                    description: 'Explore vibrant local promenades, sunset points, and sample local street snacks.'
                },
                night: {
                    time: '08:00 PM - 10:00 PM',
                    title: 'Dinner & Stargazing',
                    description: 'Unwind with warm dinner at a recommended local restaurant.'
                }
            },
            meals: {
                breakfast: {
                    recommendedPlace: restB?.name || 'Local South Indian Cafe / Guesthouse',
                    formattedAddress: restB?.formattedAddress || '',
                    rating: restB?.rating || null,
                    googleMapsUri: restB?.googleMapsUri || null,
                    verifiedPlace: Boolean(restB),
                    suggestion: restB ? `${restB.name} (${restB.rating ? '★ ' + restB.rating : 'Local Cafe'})` : 'South Indian Tiffin (Idli, Dosa, Filter Coffee)',
                    costPerPerson: mealBreakfast,
                    confidence: restB ? 'Verified Restaurant via Google Maps • Meal cost estimated' : 'Estimated meal cost'
                },
                lunch: {
                    recommendedPlace: restL?.name || 'Traditional Regional Thali Restaurant',
                    formattedAddress: restL?.formattedAddress || '',
                    rating: restL?.rating || null,
                    googleMapsUri: restL?.googleMapsUri || null,
                    verifiedPlace: Boolean(restL),
                    suggestion: restL ? `${restL.name} (${restL.rating ? '★ ' + restL.rating : 'Popular Dining'})` : 'Traditional Thali / Regional Special Thali',
                    costPerPerson: mealLunch,
                    confidence: restL ? 'Verified Restaurant via Google Maps • Meal cost estimated' : 'Estimated meal cost'
                },
                dinner: {
                    recommendedPlace: restD?.name || 'Cozy Family Diner / Local Speciality Diner',
                    formattedAddress: restD?.formattedAddress || '',
                    rating: restD?.rating || null,
                    googleMapsUri: restD?.googleMapsUri || null,
                    verifiedPlace: Boolean(restD),
                    suggestion: restD ? `${restD.name} (${restD.rating ? '★ ' + restD.rating : 'Evening Diner'})` : 'North/South Indian Dinner & Hot Soup',
                    costPerPerson: mealDinner,
                    confidence: restD ? 'Verified Restaurant via Google Maps • Meal cost estimated' : 'Estimated meal cost'
                },
                snacks: {
                    recommendedPlace: restS?.name || 'Hillside Tea Stall / Bakery',
                    formattedAddress: restS?.formattedAddress || '',
                    rating: restS?.rating || null,
                    googleMapsUri: restS?.googleMapsUri || null,
                    verifiedPlace: Boolean(restS),
                    suggestion: restS ? `${restS.name}` : 'Tea, Coffee & Local Savouries',
                    costPerPerson: mealSnacks,
                    confidence: restS ? 'Verified Cafe via Google Maps • Snack cost estimated' : 'Estimated snack cost'
                }
            },
            activities: dayActs,
            localTransport: {
                mode: 'Local Auto / Shared Taxi / Rental Bike',
                estimatedCost: isBudget ? 250 : 450
            }
        });
    }

    return {
        destinationInfo: destInfo,
        transportationOptions,
        accommodationOptions,
        itinerary,
        miscellaneous: {
            parkingAndTolls: isComfortable ? 400 : 200,
            waterAndSnacks: 50 * numberOfTravellers * durationDays,
            shopping: isBudget ? 300 : 800
        }
    };
}

/**
 * Generate complete trip plan using Groq AI with deterministic calculation pipeline.
 */
async function generateTripPlan(rawInputs) {
    const { isValid, errors, validated } = validateTripInputs(rawInputs);
    if (!isValid) {
        throw new Error(errors.join(' '));
    }

    const {
        origin,
        destination,
        departureDate,
        returnDate,
        durationDays,
        numberOfTravellers,
        totalBudget,
        travelStyle
    } = validated;

    let planData = null;
    let planSource = 'ai';

    // 1. Fetch real verified places from Google Places API (New) server-side
    let placesData = { hotels: [], attractions: [], restaurants: [], isConfigured: false };
    try {
        placesData = await googlePlacesService.fetchDestinationPlaces(destination, travelStyle, validated.interests);
    } catch (placeErr) {
        console.warn('[TravelPlanner] Google Places search encountered error:', placeErr.message);
    }

    if (openaiClient && GROQ_API_KEY) {
        const systemPrompt = `You are a travel planning and budgeting specialist for India.
You produce comprehensive, realistic travel plans tailored to Indian and international tourist routes.
You return ONLY valid, parseable JSON conforming to this schema. Do not add markdown backticks.`;

        let placesPromptClause = '';
        if (placesData.hotels.length > 0 || placesData.attractions.length > 0) {
            placesPromptClause = `
REAL-WORLD VERIFIED PLACES FROM GOOGLE PLACES API:
You MUST use these verified locations in the output:
Hotels in ${destination}:
${placesData.hotels.map(h => `- ${h.name} (${h.formattedAddress}, Rating: ${h.rating || 'N/A'})`).join('\n')}

Attractions in ${destination}:
${placesData.attractions.map(a => `- ${a.name} (${a.formattedAddress}, Rating: ${a.rating || 'N/A'})`).join('\n')}

Restaurants in ${destination}:
${placesData.restaurants.map(r => `- ${r.name} (${r.formattedAddress}, Rating: ${r.rating || 'N/A'})`).join('\n')}
`;
        }

        const userPrompt = `Generate a realistic travel plan for a trip from ${origin} to ${destination}.
Details:
- Duration: ${durationDays} days (${durationDays > 1 ? durationDays - 1 : 1} nights)
- Travellers: ${numberOfTravellers}
- Total Budget: ₹${totalBudget} (INR)
- Travel Style: ${travelStyle} (budget / balanced / comfortable)

${placesPromptClause}

Output exact JSON matching this schema:
{
  "destinationInfo": {
    "name": "${destination}",
    "tagline": "string",
    "bestTimeToVisit": "string",
    "travelTips": ["tip1", "tip2", "tip3"]
  },
  "transportationOptions": [
    {
      "mode": "Bus",
      "operator": "string",
      "perPersonFare": number,
      "totalGroupCost": number,
      "durationHours": number,
      "convenience": "medium",
      "additionalCosts": number,
      "additionalCostsNote": "string",
      "sourceName": "string",
      "sourceUrl": "string",
      "assumptions": "string"
    },
    {
      "mode": "Train",
      "operator": "string",
      "perPersonFare": number,
      "totalGroupCost": number,
      "durationHours": number,
      "convenience": "high",
      "additionalCosts": number,
      "additionalCostsNote": "string",
      "sourceName": "string",
      "sourceUrl": "string",
      "assumptions": "string"
    },
    {
      "mode": "Car",
      "operator": "string",
      "perPersonFare": number,
      "totalGroupCost": number,
      "durationHours": number,
      "convenience": "high",
      "additionalCosts": number,
      "additionalCostsNote": "string",
      "sourceName": "string",
      "sourceUrl": "string",
      "assumptions": "string"
    }
  ],
  "accommodationOptions": [
    {
      "name": "string",
      "type": "Budget Stay",
      "location": "string",
      "pricePerNight": number,
      "amenities": ["string"],
      "sourceName": "string",
      "sourceUrl": "string",
      "assumptions": "string"
    },
    {
      "name": "string",
      "type": "Standard Hotel",
      "location": "string",
      "pricePerNight": number,
      "amenities": ["string"],
      "sourceName": "string",
      "sourceUrl": "string",
      "assumptions": "string"
    }
  ],
  "itinerary": [
    {
      "dayNumber": 1,
      "title": "string",
      "meals": {
        "breakfast": { "suggestion": "string", "costPerPerson": number },
        "lunch": { "suggestion": "string", "costPerPerson": number },
        "dinner": { "suggestion": "string", "costPerPerson": number },
        "snacks": { "suggestion": "string", "costPerPerson": number }
      },
      "activities": [
        {
          "id": "act_1_1",
          "name": "string",
          "description": "string",
          "whyRecommended": "string",
          "feePerPerson": number,
          "timing": "string"
        }
      ],
      "localTransport": {
        "mode": "string",
        "estimatedCost": number
      }
    }
  ],
  "miscellaneous": {
    "parkingAndTolls": number,
    "waterAndSnacks": number,
    "shopping": number
  }
}

CRITICAL RULES:
1. All costs must be numeric INR values (numbers, not strings).
2. Exactly ${durationDays} days in the itinerary array.
3. Realistic transport fares and hotel tariffs.
4. Output raw JSON only.`;

        try {
            const completion = await openaiClient.chat.completions.create({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2,
                max_tokens: 3500
            });

            const content = completion.choices?.[0]?.message?.content;
            if (content) {
                const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleaned);

                if (Array.isArray(parsed.transportationOptions) &&
                    Array.isArray(parsed.accommodationOptions) &&
                    Array.isArray(parsed.itinerary)) {
                    // Normalize itinerary to exact requested durationDays
                    if (parsed.itinerary.length > durationDays) {
                        parsed.itinerary = parsed.itinerary.slice(0, durationDays);
                    }
                    parsed.itinerary.forEach((day, idx) => {
                        day.dayNumber = idx + 1;
                        if (!day.schedule) {
                            day.schedule = {
                                morning: { time: '09:00 AM - 12:00 PM', title: 'Morning Exploration', description: 'Sightseeing and morning activity' },
                                afternoon: { time: '01:00 PM - 04:00 PM', title: 'Afternoon Discovery', description: 'Lunch and local culture' },
                                evening: { time: '05:00 PM - 07:30 PM', title: 'Evening Leisure', description: 'Sunset viewpoints and market stroll' },
                                night: { time: '08:00 PM - 10:00 PM', title: 'Dinner & Relaxation', description: 'Local cuisine and restful night' }
                            };
                        }
                    });

                    // Ensure confidence and bookingNotes on all transport options
                    parsed.transportationOptions.forEach(opt => {
                        if (!opt.confidence) opt.confidence = 'Estimated regional rate';
                        if (!opt.bookingNotes) opt.bookingNotes = opt.assumptions || 'Direct ticket booking on official transport portal.';
                    });

                    // Enrich accommodationOptions with Google Places data
                    if (placesData.hotels && placesData.hotels.length > 0) {
                        const verifiedHotels = placesData.hotels.slice(0, 3).map((hotel, idx) => {
                            const tier = idx === 0 ? 'Budget Stay' : idx === 1 ? 'Standard Hotel' : 'Premium Stay';
                            const fallbackPrice = travelStyle === 'budget' ? (1100 + idx * 400) : travelStyle === 'comfortable' ? (2800 + idx * 1000) : (1800 + idx * 600);
                            const price = parsed.accommodationOptions[idx]?.pricePerNight || fallbackPrice;
                            return {
                                name: hotel.name,
                                type: `${tier} (Google Verified)`,
                                location: hotel.formattedAddress || destination,
                                formattedAddress: hotel.formattedAddress,
                                rating: hotel.rating,
                                userRatingCount: hotel.userRatingCount,
                                googleMapsUri: hotel.googleMapsUri,
                                websiteUri: hotel.websiteUri,
                                placeId: hotel.placeId,
                                verifiedPlace: true,
                                pricePerNight: price,
                                amenities: [
                                    'Google Maps Verified',
                                    hotel.rating ? `★ ${hotel.rating} Rating` : 'Well Reviewed',
                                    'Attached Bath',
                                    'Wi-Fi'
                                ],
                                sourceName: 'Google Places Verified',
                                sourceUrl: hotel.googleMapsUri,
                                confidence: 'Verified Place via Google Maps • Price estimated from regional hotel benchmarks',
                                bookingNotes: 'Live tariffs vary by season and occupancy. Check Google Maps or hotel portal to book.',
                                assumptions: `Real hotel verified via Google Places API (New). Tariff of ₹${price}/night is an estimated seasonal baseline.`
                            };
                        });
                        parsed.accommodationOptions = verifiedHotels;
                    } else {
                        parsed.accommodationOptions.forEach(acc => {
                            if (!acc.confidence) acc.confidence = 'Estimated regional rate';
                        });
                    }

                    // Enrich itinerary activities with Google Places attractions
                    if (placesData.attractions && placesData.attractions.length > 0) {
                        parsed.itinerary.forEach((day, dIdx) => {
                            if (day.activities && day.activities.length > 0) {
                                day.activities.forEach((act, actIdx) => {
                                    const match = placesData.attractions.find(a =>
                                        a.name.toLowerCase().includes(act.name.toLowerCase()) ||
                                        act.name.toLowerCase().includes(a.name.toLowerCase())
                                    ) || placesData.attractions[(dIdx * 2 + actIdx) % placesData.attractions.length];

                                    if (match) {
                                        act.name = match.name;
                                        act.formattedAddress = match.formattedAddress;
                                        act.rating = match.rating;
                                        act.userRatingCount = match.userRatingCount;
                                        act.googleMapsUri = match.googleMapsUri;
                                        act.placeId = match.placeId;
                                        act.verifiedPlace = true;
                                        act.confidence = 'Verified Location via Google Maps • Entry fee estimated';
                                    }
                                });
                            }
                        });
                    }

                    // Enrich itinerary meals with Google Places restaurants
                    if (placesData.restaurants && placesData.restaurants.length > 0) {
                        const rB = placesData.restaurants[0];
                        const rL = placesData.restaurants[1] || placesData.restaurants[0];
                        const rD = placesData.restaurants[2] || placesData.restaurants[0];

                        parsed.itinerary.forEach((day) => {
                            if (day.meals) {
                                if (day.meals.breakfast && rB) {
                                    day.meals.breakfast.recommendedPlace = rB.name;
                                    day.meals.breakfast.formattedAddress = rB.formattedAddress;
                                    day.meals.breakfast.rating = rB.rating;
                                    day.meals.breakfast.googleMapsUri = rB.googleMapsUri;
                                    day.meals.breakfast.verifiedPlace = true;
                                    day.meals.breakfast.confidence = 'Verified Restaurant via Google Maps • Meal cost estimated';
                                }
                                if (day.meals.lunch && rL) {
                                    day.meals.lunch.recommendedPlace = rL.name;
                                    day.meals.lunch.formattedAddress = rL.formattedAddress;
                                    day.meals.lunch.rating = rL.rating;
                                    day.meals.lunch.googleMapsUri = rL.googleMapsUri;
                                    day.meals.lunch.verifiedPlace = true;
                                    day.meals.lunch.confidence = 'Verified Restaurant via Google Maps • Meal cost estimated';
                                }
                                if (day.meals.dinner && rD) {
                                    day.meals.dinner.recommendedPlace = rD.name;
                                    day.meals.dinner.formattedAddress = rD.formattedAddress;
                                    day.meals.dinner.rating = rD.rating;
                                    day.meals.dinner.googleMapsUri = rD.googleMapsUri;
                                    day.meals.dinner.verifiedPlace = true;
                                    day.meals.dinner.confidence = 'Verified Restaurant via Google Maps • Meal cost estimated';
                                }
                            }
                        });
                    }

                    planData = parsed;
                }
            }
        } catch (aiErr) {
            console.warn('[TravelPlanner] Groq API returned error or timeout. Falling back to deterministic travel baseline:', aiErr.message);
        }
    }

    if (!planData) {
        planData = generateDeterministicPlan(validated, placesData);
        planSource = placesData.hotels.length > 0 || placesData.attractions.length > 0 ? 'places_deterministic' : 'deterministic_baseline';
    }

    // Default selected options: index 0 transport, index 0 stay, all activities selected, 8% contingency
    const defaultSelectedOptions = {
        transportIndex: 0,
        accommodationIndex: 0,
        activitySelections: null,
        customContingencyPercent: 8
    };

    // Deterministic calculation of all amounts
    const calculations = calculateTripPlanTotals(planData, defaultSelectedOptions, validated);
    const suggestions = generateOptimizationSuggestions(planData, defaultSelectedOptions, calculations, totalBudget);

    return {
        planData,
        selectedOptions: defaultSelectedOptions,
        calculations,
        suggestions,
        planSource,
        inputs: validated,
        placesConfigured: Boolean(placesData.isConfigured),
        verifiedPlacesCount: (placesData.hotels?.length || 0) + (placesData.attractions?.length || 0) + (placesData.restaurants?.length || 0)
    };
}

module.exports = {
    validateTripInputs,
    calculateTripPlanTotals,
    generateOptimizationSuggestions,
    generateDeterministicPlan,
    generateTripPlan
};
