const travelPlannerService = require('../services/travelPlannerService');
const TravelPlan = require('../models/TravelPlan');

/**
 * POST /api/travel-planner/generate
 * Generates a complete travel budget plan
 */
exports.generatePlan = async (req, res) => {
    try {
        const result = await travelPlannerService.generateTripPlan(req.body);
        return res.status(200).json(result);
    } catch (err) {
        console.error('[TravelPlannerController] Generate error:', err.message);
        return res.status(400).json({ error: err.message || 'Failed to generate travel plan' });
    }
};

/**
 * POST /api/travel-planner/recalculate
 * Deterministically recalculates amounts based on user option changes (transport, stay, activities, contingency)
 */
exports.recalculatePlan = async (req, res) => {
    try {
        const { planData, selectedOptions, inputs } = req.body;
        if (!planData || !inputs) {
            return res.status(400).json({ error: 'planData and inputs are required for recalculation.' });
        }

        const calculations = travelPlannerService.calculateTripPlanTotals(planData, selectedOptions, inputs);
        const suggestions = travelPlannerService.generateOptimizationSuggestions(
            planData,
            selectedOptions,
            calculations,
            inputs.totalBudget
        );

        return res.status(200).json({
            calculations,
            suggestions,
            selectedOptions
        });
    } catch (err) {
        console.error('[TravelPlannerController] Recalculate error:', err.message);
        return res.status(400).json({ error: err.message || 'Failed to recalculate travel plan' });
    }
};

/**
 * POST /api/travel-planner/save
 * Saves a plan to the authenticated user's account.
 * Idempotent: returns the existing plan if one with the same
 * origin/destination/dates already exists for this user.
 */
exports.savePlan = async (req, res) => {
    try {
        const {
            title,
            planData,
            selectedOptions,
            calculations,
            inputs
        } = req.body;

        if (!planData || !calculations || !inputs) {
            return res.status(400).json({ error: 'Incomplete plan payload. Cannot save.' });
        }

        const planTitle = title || `${inputs.destination} Trip (${inputs.durationDays} Days, ${inputs.numberOfTravellers} Pax)`;

        // ── Idempotency guard ──────────────────────────────────────────────
        // If the user already has a plan for the same trip (same origin,
        // destination, and travel dates), return the existing record instead
        // of inserting a duplicate.
        const existing = await TravelPlan.findOne({
            userId: req.user.id,
            origin: inputs.origin,
            destination: inputs.destination,
            departureDate: inputs.departureDate,
            returnDate: inputs.returnDate
        });

        if (existing) {
            return res.status(200).json({
                message: 'Travel plan already saved.',
                savedPlan: existing,
                alreadyExists: true
            });
        }
        // ──────────────────────────────────────────────────────────────────

        const savedPlan = new TravelPlan({
            userId: req.user.id,
            title: planTitle,
            origin: inputs.origin,
            destination: inputs.destination,
            departureDate: inputs.departureDate,
            returnDate: inputs.returnDate,
            durationDays: inputs.durationDays,
            numberOfTravellers: inputs.numberOfTravellers,
            totalBudget: inputs.totalBudget,
            travelStyle: inputs.travelStyle,
            preferredTransport: inputs.preferredTransport || 'any',
            accommodationType: inputs.accommodationType || 'any',
            interests: inputs.interests || [],
            planData,
            selectedOptions,
            calculations
        });

        await savedPlan.save();
        return res.status(201).json({
            message: 'Travel plan saved successfully.',
            savedPlan
        });
    } catch (err) {
        console.error('[TravelPlannerController] Save error:', err.message);
        return res.status(500).json({ error: 'Failed to save travel plan.' });
    }
};

/**
 * GET /api/travel-planner/saved
 * Retrieves all saved plans for the authenticated user
 */
exports.getSavedPlans = async (req, res) => {
    try {
        const plans = await TravelPlan.find({ userId: req.user.id })
            .select('title origin destination departureDate returnDate durationDays numberOfTravellers totalBudget calculations createdAt')
            .sort({ createdAt: -1 });

        return res.status(200).json({ plans });
    } catch (err) {
        console.error('[TravelPlannerController] Get saved error:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve saved travel plans.' });
    }
};

/**
 * GET /api/travel-planner/saved/:id
 * Retrieves a single saved plan by ID
 */
exports.getSavedPlanById = async (req, res) => {
    try {
        const plan = await TravelPlan.findOne({ _id: req.params.id, userId: req.user.id });
        if (!plan) {
            return res.status(404).json({ error: 'Travel plan not found.' });
        }

        return res.status(200).json({ plan });
    } catch (err) {
        console.error('[TravelPlannerController] Get by id error:', err.message);
        return res.status(500).json({ error: 'Failed to load travel plan.' });
    }
};

/**
 * DELETE /api/travel-planner/saved/:id
 * Deletes a saved plan
 */
exports.deleteSavedPlan = async (req, res) => {
    try {
        const plan = await TravelPlan.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!plan) {
            return res.status(404).json({ error: 'Travel plan not found or already deleted.' });
        }

        return res.status(200).json({ message: 'Travel plan deleted successfully.' });
    } catch (err) {
        console.error('[TravelPlannerController] Delete error:', err.message);
        return res.status(500).json({ error: 'Failed to delete travel plan.' });
    }
};
