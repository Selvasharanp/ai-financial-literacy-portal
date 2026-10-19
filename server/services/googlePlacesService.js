/**
 * Google Places API (New) Service
 * Endpoint: https://places.googleapis.com/v1/places:searchText
 * Uses server-side GOOGLE_MAPS_API_KEY from environment.
 * Never exposes the API key to frontend.
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ? process.env.GOOGLE_MAPS_API_KEY.trim() : '';
const PLACES_NEW_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const SEARCH_TIMEOUT_MS = 8000;

/**
 * Checks if Google Places API is configured
 */
function isPlacesConfigured() {
    return Boolean(GOOGLE_MAPS_API_KEY);
}

/**
 * Generic search using Google Places API (New) :searchText
 * @param {string} textQuery - Text search query (e.g. "hotels in Ooty")
 * @param {object} options - Options including maxResultCount, includedType
 * @returns {Promise<Array>} List of formatted place objects
 */
async function searchPlaces(textQuery, options = {}) {
    if (!isPlacesConfigured()) {
        console.warn('[GooglePlaces] GOOGLE_MAPS_API_KEY is not configured in server environment.');
        return [];
    }

    if (!textQuery || typeof textQuery !== 'string' || !textQuery.trim()) {
        return [];
    }

    const maxResultCount = Math.min(Math.max(1, options.maxResultCount || 5), 10);
    const bodyPayload = {
        textQuery: textQuery.trim(),
        maxResultCount
    };

    if (options.includedType) {
        bodyPayload.includedType = options.includedType;
    }

    const fieldMask = [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.types',
        'places.googleMapsUri',
        'places.websiteUri'
    ].join(',');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

        const response = await fetch(PLACES_NEW_SEARCH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`[GooglePlaces] API error (${response.status}): ${errText}`);
            return [];
        }

        const data = await response.json();
        const rawPlaces = data.places || [];

        return rawPlaces.map(p => ({
            placeId: p.id,
            name: p.displayName?.text || 'Local Venue',
            formattedAddress: p.formattedAddress || '',
            rating: typeof p.rating === 'number' ? p.rating : null,
            userRatingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
            priceLevel: p.priceLevel || null,
            types: Array.isArray(p.types) ? p.types : [],
            googleMapsUri: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text || textQuery)}`,
            websiteUri: p.websiteUri || null,
            verifiedPlace: true
        }));
    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn(`[GooglePlaces] Request timed out for query: "${textQuery}"`);
        } else {
            console.warn(`[GooglePlaces] Search failed for query: "${textQuery}":`, err.message);
        }
        return [];
    }
}

/**
 * Validates whether a place result is geographically relevant to destination.
 * Checks for destination token matches in address or name.
 */
function isGeographicallyRelevant(place, destination) {
    if (!destination || !place) return true;
    const destTokens = destination.toLowerCase().split(/[\s,]+/).filter(t => t.length > 2);
    if (destTokens.length === 0) return true;

    const targetText = `${place.name} ${place.formattedAddress}`.toLowerCase();
    // At least one significant token should match, or destination is part of country/region
    return destTokens.some(tok => targetText.includes(tok));
}

/**
 * Fetches real verified places for a given destination
 * @param {string} destination - Trip destination (e.g. "Ooty", "Goa", "Interlaken, Switzerland")
 * @param {string} travelStyle - "budget" | "balanced" | "comfortable"
 * @param {Array<string>} interests - e.g. ["Nature", "Food", "Heritage"]
 * @returns {Promise<object>} { hotels: [], attractions: [], restaurants: [], isConfigured: boolean }
 */
async function fetchDestinationPlaces(destination, travelStyle = 'balanced', interests = []) {
    if (!isPlacesConfigured() || !destination) {
        return {
            hotels: [],
            attractions: [],
            restaurants: [],
            isConfigured: isPlacesConfigured()
        };
    }

    const cleanDest = destination.trim();

    // Determine query terms based on travel style
    const hotelQuery = travelStyle === 'budget'
        ? `budget hotels guesthouses in ${cleanDest}`
        : travelStyle === 'comfortable'
            ? `resorts luxury hotels in ${cleanDest}`
            : `hotels in ${cleanDest}`;

    const interestClause = interests && interests.length > 0 ? interests.slice(0, 2).join(' ') + ' ' : '';
    const attractionQuery = `top ${interestClause}tourist attractions in ${cleanDest}`.trim();
    const restaurantQuery = `best restaurants cafes in ${cleanDest}`;

    try {
        // Execute parallel searches with bounded results
        const [rawHotels, rawAttractions, rawRestaurants] = await Promise.all([
            searchPlaces(hotelQuery, { maxResultCount: 4 }),
            searchPlaces(attractionQuery, { maxResultCount: 6 }),
            searchPlaces(restaurantQuery, { maxResultCount: 4 })
        ]);

        // Filter for geographic relevance where possible
        const hotels = rawHotels.filter(p => isGeographicallyRelevant(p, cleanDest));
        const attractions = rawAttractions.filter(p => isGeographicallyRelevant(p, cleanDest));
        const restaurants = rawRestaurants.filter(p => isGeographicallyRelevant(p, cleanDest));

        return {
            hotels: hotels.length > 0 ? hotels : rawHotels,
            attractions: attractions.length > 0 ? attractions : rawAttractions,
            restaurants: restaurants.length > 0 ? restaurants : rawRestaurants,
            isConfigured: true
        };
    } catch (err) {
        console.warn(`[GooglePlaces] Failed to fetch destination places for "${cleanDest}":`, err.message);
        return {
            hotels: [],
            attractions: [],
            restaurants: [],
            isConfigured: true
        };
    }
}

module.exports = {
    isPlacesConfigured,
    searchPlaces,
    fetchDestinationPlaces,
    isGeographicallyRelevant
};
