const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { 
        type: String, 
        required: function() { 
            return !this.googleId || this.authProvider === 'local' || this.authProvider === 'both'; 
        } 
    },
    authProvider: { type: String, enum: ['local', 'google', 'both'], default: 'local' },
    googleId: { type: String, default: null },
    avatar: { type: String, default: '' },
    userType: { type: String, enum: ['Student', 'Working Professional'], default: 'Student' },
    openingBalance: { type: Number, default: 0 },
    openingBalanceDate: { type: Date, default: Date.now },
    income: { type: Number, default: 0 },
    isCredited: { type: Boolean, default: true },
    lastCreditedMonth: { type: String, default: '' }, // e.g. "2026-10"
    location: { type: String, default: 'Global' }, // For cost-of-living benchmarking
    locationRegion: { type: String, default: '' },
    locationSource: { type: String, enum: ['manual', 'geolocation'], default: 'manual' },
    monthToDateSpending: { type: Number, default: 0 },
    monthToDateSpendingMonth: { type: String, default: '' }, // e.g. "2026-10"
    hasCompletedOnboarding: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
