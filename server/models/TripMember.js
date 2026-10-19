const mongoose = require('mongoose');

const TripMemberSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Matches the string id in Trip.participants[]
    participantId: { type: String, required: true },
    role: { type: String, enum: ['creator', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
});

// Compound unique index: one membership per user per trip
TripMemberSchema.index({ tripId: 1, userId: 1 }, { unique: true });
TripMemberSchema.index({ userId: 1 }); // Fast lookup of all trips a user belongs to

module.exports = mongoose.model('TripMember', TripMemberSchema);
