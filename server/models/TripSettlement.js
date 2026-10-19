const mongoose = require('mongoose');

const TripSettlementSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fromParticipantId: { type: String, required: true },
    toParticipantId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    notes: { type: String, default: '' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TripSettlement', TripSettlementSchema);
