const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true }
}, { _id: false });

const TripSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    collaborativeMode: { type: Boolean, default: false }, // true = multi-user shared trip
    participants: {
        type: [ParticipantSchema],
        validate: [arr => arr.length >= 1, 'A trip must have at least 1 participant.']
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trip', TripSchema);
