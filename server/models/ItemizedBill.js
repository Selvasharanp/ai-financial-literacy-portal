const mongoose = require('mongoose');

const ItemizedBillItemSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    assignedTo: [{ type: String }] // Array of participant ID strings
}, { _id: false });

const MemberStatusSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participantId: { type: String, required: true },
    name: { type: String, default: '' },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed'],
        default: 'not_started'
    },
    lastUpdatedAt: { type: Date, default: Date.now }
}, { _id: false });

const ItemizedBillSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    creatorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, default: Date.now },
    mode: { type: String, enum: ['manual', 'collaborative'], default: 'manual' },
    status: { type: String, enum: ['draft', 'finalized'], default: 'draft', index: true },
    paidBy: { type: String, required: true },
    items: [ItemizedBillItemSchema],
    tax: { type: Number, default: 0, min: 0 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    extraCharges: { type: Number, default: 0, min: 0 },
    memberStatuses: [MemberStatusSchema],
    finalExpenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'TripExpense', default: null },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ItemizedBill', ItemizedBillSchema);
