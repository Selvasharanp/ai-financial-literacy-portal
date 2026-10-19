const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, required: true }, // e.g., Food, Rent, Entertainment
    date: { type: Date, default: Date.now },
    isVoice: { type: Boolean, default: false }, // Tracks if entered via voice
    isCredited: { type: Boolean, default: true }, // Tracks if income has been credited/received
    recurringPreference: { type: String, enum: ['essential', 'optional', 'unset'], default: 'unset' }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
