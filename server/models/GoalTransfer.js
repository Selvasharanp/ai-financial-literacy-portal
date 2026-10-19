const mongoose = require('mongoose');

const GoalTransferSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal' },
    type: { 
        type: String, 
        enum: ['allocation', 'emergency_withdrawal', 'skip_allocation'], 
        required: true 
    },
    amount: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    reason: { type: String, default: '' },
    alternativeExpense: { type: String, default: '' }
});

module.exports = mongoose.model('GoalTransfer', GoalTransferSchema);
