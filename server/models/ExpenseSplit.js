const mongoose = require('mongoose');

const FriendSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    amountOwed: { type: Number, required: true, min: 0 }
}, { _id: false });

module.exports = mongoose.model('ExpenseSplit', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0.01 },
    splitMethod: { type: String, enum: ['equal', 'custom'], required: true },
    friends: { type: [FriendSchema], validate: [(friends) => friends.length > 0, 'Add at least one friend.'] },
    createdAt: { type: Date, default: Date.now }
}));
