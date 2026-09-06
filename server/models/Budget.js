const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    limit: { type: Number, required: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true }
});

module.exports = mongoose.model('Budget', BudgetSchema);