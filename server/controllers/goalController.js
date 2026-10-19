const Goal = require('../models/Goal');
const GoalTransfer = require('../models/GoalTransfer');
const { calculateAvailableBalance } = require('./transactionController');

// 1. Create a new Goal
exports.addGoal = async (req, res) => {
    try {
        const { targetName, name, targetAmount, deadline } = req.body;
        const goalTitle = (targetName || name || '').trim();
        const amount = Number(targetAmount);
        const parsedDeadline = deadline ? new Date(deadline) : null;
        if (!goalTitle || !Number.isFinite(amount) || amount <= 0 || (parsedDeadline && Number.isNaN(parsedDeadline.getTime()))) {
            return res.status(400).json({ error: 'Provide a goal name, positive target amount, and valid deadline.' });
        }
        const newGoal = new Goal({
            userId: req.user.id,
            targetName: goalTitle,
            targetAmount: amount,
            deadline: parsedDeadline || undefined
        });
        await newGoal.save();
        res.status(201).json(newGoal);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add goal' });
    }
};

// 2. Get all Goals for user
exports.getGoals = async (req, res) => {
    try {
        const goals = await Goal.find({ userId: req.user.id });
        res.json(goals);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch goals' });
    }
};

// 3. Update progress (Add money to goal)
exports.updateGoalProgress = async (req, res) => {
    try {
        const { amount } = req.body;
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive.' });
        }

        const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
        if (!goal) return res.status(404).json({ error: 'Goal not found' });

        goal.currentAmount += parsedAmount;
        if (goal.currentAmount >= goal.targetAmount) {
            goal.status = 'completed';
        }

        await goal.save();
        res.json(goal);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update goal' });
    }
};

// 4. Allocate Credited Income / Available Balance to Goal (Available Balance -> Goal)
exports.allocateToGoal = async (req, res) => {
    try {
        const { amount } = req.body;
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Allocation amount must be a positive number.' });
        }

        const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
        if (!goal) return res.status(404).json({ error: 'Goal not found.' });

        const availableBalance = await calculateAvailableBalance(req.user.id);
        if (parsedAmount > availableBalance) {
            return res.status(400).json({ error: 'Allocation amount cannot exceed available balance.' });
        }

        goal.currentAmount += parsedAmount;
        if (goal.currentAmount >= goal.targetAmount) {
            goal.status = 'completed';
        }
        await goal.save();

        const transfer = new GoalTransfer({
            userId: req.user.id,
            goalId: goal._id,
            type: 'allocation',
            amount: parsedAmount,
            date: new Date()
        });
        await transfer.save();

        res.json({ goal, transfer, availableBalance: availableBalance - parsedAmount });
    } catch (err) {
        console.error('Error allocating to goal:', err);
        res.status(500).json({ error: 'Failed to allocate funds to goal.' });
    }
};

// 5. Emergency Withdrawal from Goal (Goal -> Available Balance)
exports.emergencyWithdrawal = async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Withdrawal amount must be a positive number.' });
        }

        // Atomic check & decrement: guarantees no negative balances or race condition overdraws
        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id, currentAmount: { $gte: parsedAmount } },
            { $inc: { currentAmount: -parsedAmount } },
            { new: true }
        );

        if (!goal) {
            const existingGoal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
            if (!existingGoal) return res.status(404).json({ error: 'Goal pot not found.' });
            return res.status(400).json({ 
                error: `Withdrawal amount (₹${parsedAmount}) cannot exceed available goal balance (₹${existingGoal.currentAmount}).` 
            });
        }

        if (goal.currentAmount < goal.targetAmount && goal.status === 'completed') {
            goal.status = 'active';
            await goal.save();
        }

        const transfer = new GoalTransfer({
            userId: req.user.id,
            goalId: goal._id,
            type: 'emergency_withdrawal',
            amount: parsedAmount,
            reason: reason ? String(reason).trim() : 'Emergency withdraw to safe balance',
            date: new Date()
        });
        await transfer.save();

        const newAvailableBalance = await calculateAvailableBalance(req.user.id);

        res.json({ 
            goal, 
            transfer, 
            availableBalance: newAvailableBalance,
            msg: `Successfully withdrew ₹${parsedAmount} back to your Available Safe Balance.`
        });
    } catch (err) {
        console.error('Error in emergency withdrawal:', err);
        res.status(500).json({ error: 'Failed to process emergency withdrawal.' });
    }
};

// 6. Skip Allocation (Record reason & alternative expense without creating automatic expense transactions)
exports.skipAllocation = async (req, res) => {
    try {
        const { goalId, skipReason, alternativeExpense } = req.body;

        const transfer = new GoalTransfer({
            userId: req.user.id,
            goalId: goalId || undefined,
            type: 'skip_allocation',
            amount: 0,
            reason: skipReason ? String(skipReason).trim() : '',
            alternativeExpense: alternativeExpense ? String(alternativeExpense).trim() : '',
            date: new Date()
        });
        await transfer.save();

        res.json({ msg: 'Skip allocation recorded successfully.', transfer });
    } catch (err) {
        console.error('Error recording skip allocation:', err);
        res.status(500).json({ error: 'Failed to record skipped allocation.' });
    }
};

// 7. Get Monthly Goal Status (for salary credit workflow & carry-over logic)
exports.getMonthlyGoalStatus = async (req, res) => {
    try {
        const goal = await Goal.findOne({ userId: req.user.id, status: 'active' }).sort({ deadline: 1 });
        if (!goal) {
            return res.json({ hasActiveGoal: false });
        }

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Check if allocation was already made for current month
        const allocationThisMonth = await GoalTransfer.findOne({
            userId: req.user.id,
            type: 'allocation',
            date: { $gte: monthStart, $lt: nextMonthStart }
        });

        // Calculate skipped months count (number of skip_allocation transfers in past months)
        const pastSkipsCount = await GoalTransfer.countDocuments({
            userId: req.user.id,
            type: 'skip_allocation',
            date: { $lt: monthStart }
        });

        // Calculate base monthly allocation (e.g., target / 10 or remaining)
        const baseAllocation = Math.min(goal.targetAmount - goal.currentAmount, Math.round(goal.targetAmount * 0.1) || 1000);
        
        // Recommended allocation increases by baseAllocation for each skipped month
        const recommendedAllocation = Math.min(goal.targetAmount - goal.currentAmount, baseAllocation * (1 + pastSkipsCount));

        res.json({
            hasActiveGoal: true,
            goal: {
                id: goal._id,
                _id: goal._id,
                targetName: goal.targetName,
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                remaining: goal.targetAmount - goal.currentAmount
            },
            hasAllocatedThisMonth: Boolean(allocationThisMonth),
            pastSkipsCount,
            baseAllocation,
            recommendedAllocation
        });
    } catch (err) {
        console.error('Error fetching monthly goal status:', err);
        res.status(500).json({ error: 'Failed to fetch monthly goal status.' });
    }
};

// 8. Delete Goal
exports.deleteGoal = async (req, res) => {
    try {
        const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!goal) return res.status(404).json({ error: 'Goal not found' });
        res.json({ msg: 'Goal deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete goal' });
    }
};

