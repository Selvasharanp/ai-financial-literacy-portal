const mongoose = require('mongoose');

const TravelPlanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    origin: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    departureDate: { type: String, required: true },
    returnDate: { type: String, required: true },
    durationDays: { type: Number, required: true, min: 1 },
    numberOfTravellers: { type: Number, required: true, min: 1 },
    totalBudget: { type: Number, required: true, min: 0 },
    travelStyle: {
        type: String,
        enum: ['budget', 'balanced', 'comfortable'],
        default: 'balanced'
    },
    preferredTransport: { type: String, default: 'any' },
    accommodationType: { type: String, default: 'any' },
    interests: [{ type: String }],
    
    // Complete structured plan returned by AI/generator
    planData: { type: mongoose.Schema.Types.Mixed, required: true },
    
    // User-selected options for live recalculation
    selectedOptions: {
        transportIndex: { type: Number, default: 0 },
        accommodationIndex: { type: Number, default: 0 },
        activitySelections: [{ type: String }], // array of selected activity IDs
        customContingencyPercent: { type: Number, default: 8 }
    },
    
    // Deterministically calculated totals
    calculations: {
        transportationTotal: { type: Number, required: true },
        accommodationTotal: { type: Number, required: true },
        breakfastTotal: { type: Number, required: true },
        lunchTotal: { type: Number, required: true },
        dinnerTotal: { type: Number, required: true },
        mealsTotal: { type: Number, required: true },
        activitiesTotal: { type: Number, required: true },
        localTravelTotal: { type: Number, required: true },
        miscellaneousTotal: { type: Number, required: true },
        contingencyReserve: { type: Number, required: true },
        totalTripCost: { type: Number, required: true },
        costPerPerson: { type: Number, required: true },
        remainingBudget: { type: Number, required: true },
        isOverBudget: { type: Boolean, default: false },
        shortfall: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TravelPlan', TravelPlanSchema);
