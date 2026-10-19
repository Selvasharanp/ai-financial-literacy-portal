const mongoose = require('mongoose');

module.exports = mongoose.model('Challenge', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['spending_control', 'daily_budget', 'no_impulse_buy'], required: true },
    startedAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    target: { type: Number, required: true },
    status: { type: String, enum: ['active', 'completed'], default: 'active' }
}));
