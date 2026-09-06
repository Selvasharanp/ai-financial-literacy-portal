const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    location: { type: String, default: 'Global' }, // For cost-of-living benchmarking
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);