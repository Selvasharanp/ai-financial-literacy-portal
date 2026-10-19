const mongoose = require('mongoose');

const TripExpenseSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the User who recorded this expense
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // explicit recorder (same as userId but labelled)
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    paidBy: { type: String, required: true }, // Participant ID string
    sharedWith: {
        type: [String],
        validate: [arr => arr.length > 0, 'Must be shared with at least 1 participant.']
    },
    splitType: { type: String, enum: ['equal', 'custom', 'itemized'], default: 'equal' },
    participantShares: [{
        participantId: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 }
    }],
    itemizedBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemizedBill', default: null },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TripExpense', TripExpenseSchema);
