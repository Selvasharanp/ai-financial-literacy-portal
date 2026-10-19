// server/controllers/locationBudgetController.js
// Handles Location-Based Budget Advisor endpoints

const { calculateLocationBudgetAdvice } = require('../services/locationBudgetService');
const OpenAI = require('openai');

const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

let openaiClient = null;
if (GROQ_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
    timeout: 10000,
    maxRetries: 1
  });
}

/**
 * Controller: POST /api/location-budget/advice
 */
exports.getAdvice = async (req, res) => {
  try {
    const { location, availableAmount, days, needs } = req.body;

    if (!location || typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({ error: 'Please enter a valid city, town, or PIN code.' });
    }

    const amt = Number(availableAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      return res.status(400).json({ error: 'Please enter a valid available amount in INR (₹).' });
    }

    const numDays = Number(days);
    if (!Number.isFinite(numDays) || numDays <= 0 || numDays > 60) {
      return res.status(400).json({ error: 'Please enter a valid period between 1 and 60 days.' });
    }

    // Deterministic computation in application code
    const advice = await calculateLocationBudgetAdvice({
      location: location.trim(),
      availableAmount: amt,
      days: numDays,
      needs: needs || {}
    });

    // Optional Grok enrichment for localized nuance (safe with fallback)
    if (openaiClient) {
      try {
        const prompt = [
          {
            role: 'system',
            content: `You are FinWise AI, a pragmatic financial advisor in India. Provide a concise, 2-sentence piece of local practical wisdom for someone managing a daily budget in ${advice.location} (${advice.region}). Mention specific transit or food norms (e.g. local messes, town buses, or metro passes). Do not calculate math or change numbers.`
          },
          {
            role: 'user',
            content: `Location: ${advice.location}, Days: ${numDays}, Available: ₹${amt}, Status: ${advice.status}`
          }
        ];
        const completion = await openaiClient.chat.completions.create({
          model: GROQ_MODEL,
          messages: prompt,
          max_tokens: 150
        });
        const aiNote = completion.choices?.[0]?.message?.content?.trim();
        if (aiNote) {
          advice.aiLocalInsight = aiNote;
        }
      } catch (aiErr) {
        console.warn('[LocationBudget] Grok contextual note skipped:', aiErr.message);
      }
    }

    return res.json(advice);
  } catch (err) {
    console.error('[LocationBudget] Controller error:', err);
    return res.status(500).json({ error: 'Unable to calculate location budget advice at this time.' });
  }
};

/**
 * Controller: POST /api/location-budget/detect
 * Reverse geocodes coordinates to a clean city name
 */
exports.detectLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    const endpoint = new URL('https://nominatim.openstreetmap.org/reverse');
    endpoint.searchParams.set('lat', String(lat));
    endpoint.searchParams.set('lon', String(lon));
    endpoint.searchParams.set('format', 'jsonv2');
    endpoint.searchParams.set('addressdetails', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(endpoint, {
      headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'FinWisePortal/1.0' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Reverse geocoder returned status ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || {};
    const city = address.city || address.town || address.village || address.suburb || address.county || address.state_district || address.state || 'Selected Location';
    const region = address.state || address.country || '';

    return res.json({
      location: city,
      region,
      formattedAddress: data.display_name || city
    });
  } catch (err) {
    console.warn('[LocationBudget] Reverse geocoding fallback:', err.message);
    // Graceful fallback response so the user isn't blocked
    return res.json({
      location: 'Current Location',
      region: '',
      fallback: true
    });
  }
};
