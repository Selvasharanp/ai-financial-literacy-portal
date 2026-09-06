const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');

// @desc    Add new transaction
// @route   POST /api/transactions
exports.addTransaction = async (req, res) => {
    try {
        const { title, amount, type, category, date, isVoice } = req.body;

        if (!title?.trim() || !category?.trim() || !['income', 'expense'].includes(type) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Provide a description, positive amount, valid type, and category.' });
        }

        const transaction = new Transaction({
            userId: req.user.id, // Comes from auth middleware
            title: title.trim(),
            amount: Number(amount),
            type,
            category: category.trim(),
            date: date ? new Date(date) : undefined,
            isVoice: isVoice || false
        });

        await transaction.save();
        if (type === 'expense' && category.trim().toLowerCase() === 'savings') {
            const goal = await Goal.findOne({ userId: req.user.id, status: 'active' }).sort({ deadline: 1 });
            if (goal) {
                goal.currentAmount = Math.min(goal.currentAmount + Number(amount), goal.targetAmount);
                if (goal.currentAmount >= goal.targetAmount) goal.status = 'completed';
                await goal.save();
            }
        }
        res.status(201).json(transaction);
    } catch (err) {
        res.status(500).json({ error: 'Server Error adding transaction' });
    }
};

// @desc    Get all transactions for a user
// @route   GET /api/transactions
exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id }).sort({ date: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: 'Server Error fetching transactions' });
    }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
exports.deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ msg: 'Transaction not found' });

        // Ensure user owns transaction
        if (transaction.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await transaction.deleteOne();
        res.json({ msg: 'Transaction removed' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error deleting transaction' });
    }
};

// @desc    Get Summary (Total Income, Total Expense, Balance)
// @route   GET /api/transactions/summary
exports.getTransactionSummary = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id });

        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + t.amount, 0);

        const expenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);

        res.json({
            totalIncome: income,
            totalExpenses: expenses,
            balance: income - expenses
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error calculating summary' });
    }
};
