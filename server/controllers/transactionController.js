const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');

// @desc    Add new transaction
// @route   POST /api/transactions
exports.addTransaction = async (req, res) => {
    try {
        const { title, amount, type, category, date, isVoice, isCredited } = req.body;

        const parsedAmount = Number(amount);
        const parsedDate = date ? new Date(date) : null;
        if (!title?.trim() || !category?.trim() || !['income', 'expense'].includes(type) || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || (parsedDate && Number.isNaN(parsedDate.getTime()))) {
            return res.status(400).json({ error: 'Provide a description, positive amount, valid type, and category.' });
        }

        const transaction = new Transaction({
            userId: req.user.id, // Comes from auth middleware
            title: title.trim(),
            amount: parsedAmount,
            type,
            category: category.trim(),
            date: parsedDate || new Date(),
            isVoice: isVoice || false,
            isCredited: type === 'income' ? (isCredited !== undefined ? Boolean(isCredited) : true) : true
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
        console.error('Error adding transaction:', err);
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

// @desc    Toggle or set credit status of a pending income transaction
// @route   PATCH /api/transactions/:id/credit
exports.toggleCreditStatus = async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

        if (transaction.type !== 'income') {
            return res.status(400).json({ error: 'Only income transactions can have credit status toggled.' });
        }

        const newCreditStatus = req.body.isCredited !== undefined ? Boolean(req.body.isCredited) : true;
        transaction.isCredited = newCreditStatus;
        await transaction.save();

        res.json(transaction);
    } catch (err) {
        console.error('Error crediting transaction:', err);
        res.status(500).json({ error: 'Server error updating credit status' });
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

// @desc    Get Summary (Opening Balance, Available Balance, Total Income, Total Expenses, This Month Income, This Month Expenses)
// @route   GET /api/transactions/summary
exports.getTransactionSummary = async (req, res) => {
    try {
        const GoalTransfer = require('../models/GoalTransfer');
        const [transactions, user, goalTransfers] = await Promise.all([
            Transaction.find({ userId: req.user.id }),
            require('../models/User').findById(req.user.id).select('openingBalance openingBalanceDate monthToDateSpending monthToDateSpendingMonth'),
            GoalTransfer.find({ userId: req.user.id })
        ]);

        const openingBalance = user?.openingBalance || 0;
        const openingBalanceDate = user?.openingBalanceDate ? new Date(user.openingBalanceDate) : null;

        // Goal allocations and withdrawals
        const totalAllocatedToGoals = goalTransfers
            .filter(gt => gt.type === 'allocation')
            .reduce((acc, gt) => acc + (gt.amount || 0), 0);

        const totalWithdrawnFromGoals = goalTransfers
            .filter(gt => gt.type === 'emergency_withdrawal')
            .reduce((acc, gt) => acc + (gt.amount || 0), 0);

        // Total Credited Income (all time)
        const totalIncome = transactions
            .filter(t => t.type === 'income' && t.isCredited !== false)
            .reduce((acc, t) => acc + t.amount, 0);

        // Total Pending/Uncredited Income
        const uncreditedIncome = transactions
            .filter(t => t.type === 'income' && t.isCredited === false)
            .reduce((acc, t) => acc + t.amount, 0);

        // Total Expenses (all time)
        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);

        // Available Balance calculation with Opening Balance Protection & Goal Transfers:
        // Available Balance = openingBalance + creditedPostOpeningIncome - postOpeningExpenses - totalAllocatedToGoals + totalWithdrawnFromGoals
        let balance = openingBalance;

        if (openingBalanceDate && !isNaN(openingBalanceDate.getTime())) {
            const postOpeningIncome = transactions
                .filter(t => t.type === 'income' && t.isCredited !== false && new Date(t.date) >= openingBalanceDate)
                .reduce((acc, t) => acc + t.amount, 0);

            const postOpeningExpenses = transactions
                .filter(t => t.type === 'expense' && new Date(t.date) >= openingBalanceDate)
                .reduce((acc, t) => acc + t.amount, 0);

            balance = openingBalance + postOpeningIncome - postOpeningExpenses - totalAllocatedToGoals + totalWithdrawnFromGoals;
        } else {
            balance = openingBalance + totalIncome - totalExpenses - totalAllocatedToGoals + totalWithdrawnFromGoals;
        }

        // Current Calendar Month Range based on actual transaction dates
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
        const currentMonthKey = now.toISOString().slice(0, 7);

        // Include monthToDateSpending starting snapshot if it matches current calendar month
        const mtdSnapshot = (user?.monthToDateSpendingMonth === currentMonthKey) ? (user?.monthToDateSpending || 0) : 0;

        // Monthly income calculated strictly using transaction's actual date & credited status
        const thisMonthIncome = transactions
            .filter(t => t.type === 'income' && t.isCredited !== false && new Date(t.date) >= monthStart && new Date(t.date) < nextMonthStart)
            .reduce((acc, t) => acc + t.amount, 0);

        const thisMonthExpenses = mtdSnapshot + transactions
            .filter(t => t.type === 'expense' && new Date(t.date) >= monthStart && new Date(t.date) < nextMonthStart)
            .reduce((acc, t) => acc + t.amount, 0);

        // Active Goal summary
        const activeGoalDoc = await Goal.findOne({ userId: req.user.id, status: 'active' }).sort({ deadline: 1 });
        const activeGoal = activeGoalDoc ? {
            id: activeGoalDoc._id,
            targetName: activeGoalDoc.targetName,
            targetAmount: activeGoalDoc.targetAmount,
            currentAmount: activeGoalDoc.currentAmount,
            remaining: Math.max(0, activeGoalDoc.targetAmount - activeGoalDoc.currentAmount)
        } : null;

        // Dynamic date metrics
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysElapsed = Math.max(1, now.getDate());
        const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

        // Pending income items list for Dashboard banner notification
        const pendingIncomes = transactions
            .filter(t => t.type === 'income' && t.isCredited === false)
            .map(t => ({
                id: t._id,
                _id: t._id,
                title: t.title,
                amount: t.amount,
                category: t.category,
                date: t.date
            }));

        res.json({
            openingBalance,
            openingBalanceDate: user?.openingBalanceDate,
            totalIncome,
            uncreditedIncome,
            pendingIncomes,
            totalExpenses,
            balance,
            thisMonthIncome,
            thisMonthExpenses,
            thisMonthBalance: thisMonthIncome - thisMonthExpenses,
            activeGoal,
            dateMetrics: {
                currentDate: now.toISOString(),
                currentMonth: now.toLocaleString('default', { month: 'long' }),
                currentYear: now.getFullYear(),
                daysInMonth,
                daysElapsed,
                daysRemaining
            }
        });
    } catch (err) {
        console.error('Transaction summary error:', err);
        res.status(500).json({ error: 'Server Error calculating summary' });
    }
};

// @desc    Credit salary with goal allocation / skip workflow from Dashboard notification
// @route   POST /api/transactions/:id/credit-with-goal
exports.creditSalaryWithGoalWorkflow = async (req, res) => {
    try {
        const { allocateGoal, goalId, customAmount, skipReason, createNewGoal, newGoalData } = req.body;
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

        transaction.isCredited = true;
        await transaction.save();

        if (allocateGoal === false) {
            if (skipReason) {
                const GoalTransfer = require('../models/GoalTransfer');
                await new GoalTransfer({
                    userId: req.user.id,
                    goalId: goalId || undefined,
                    type: 'skip_allocation',
                    amount: 0,
                    reason: String(skipReason).trim(),
                    date: new Date()
                }).save();
            }
            return res.json({
                transaction,
                msg: 'Salary credited successfully! Full amount added to your Available Balance.'
            });
        }

        const Goal = require('../models/Goal');
        const GoalTransfer = require('../models/GoalTransfer');

        let goal = null;

        // If user requested creating a new goal directly from salary credit modal
        if (createNewGoal && newGoalData?.targetName && Number(newGoalData?.targetAmount) > 0) {
            const targetAmount = Number(newGoalData.targetAmount);
            goal = new Goal({
                userId: req.user.id,
                targetName: newGoalData.targetName.trim(),
                targetAmount: targetAmount,
                currentAmount: 0
            });
            await goal.save();
        } else if (goalId) {
            goal = await Goal.findOne({ _id: goalId, userId: req.user.id });
        } else {
            goal = await Goal.findOne({ userId: req.user.id, status: 'active' }).sort({ deadline: 1 });
        }

        if (!goal) {
            return res.json({
                transaction,
                msg: 'Salary credited successfully! Full amount added to your Available Balance.'
            });
        }

        // Check if allocation already made this calendar month (skip check if goal was newly created just now)
        if (!createNewGoal) {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            const existingAllocationThisMonth = await GoalTransfer.findOne({
                userId: req.user.id,
                type: 'allocation',
                date: { $gte: monthStart, $lt: nextMonthStart }
            });

            if (existingAllocationThisMonth) {
                return res.json({
                    transaction,
                    msg: `Salary marked as credited! Goal allocation for this month (${now.toLocaleString('default', { month: 'long' })}) was already completed previously.`
                });
            }
        }

        // Determine allocation amount
        const allocAmount = Number(customAmount) > 0 
            ? Number(customAmount) 
            : Math.min(goal.targetAmount - goal.currentAmount, Math.round(transaction.amount * 0.1) || 1000);

        const finalAmount = Math.max(0, allocAmount);

        if (finalAmount > 0) {
            goal.currentAmount += finalAmount;
            if (goal.currentAmount >= goal.targetAmount) {
                goal.status = 'completed';
            }
            await goal.save();

            await new GoalTransfer({
                userId: req.user.id,
                goalId: goal._id,
                type: 'allocation',
                amount: finalAmount,
                date: new Date()
            }).save();

            return res.json({
                transaction,
                goal,
                allocatedAmount: finalAmount,
                msg: `Salary credited successfully! ${createNewGoal ? `New goal "${goal.targetName}" created and ` : ''}₹${finalAmount.toLocaleString('en-IN')} allocated to your goal "${goal.targetName}" for this month.`
            });
        }

        return res.json({
            transaction,
            goal,
            msg: 'Salary credited successfully! Full amount added to your Available Balance.'
        });
    } catch (err) {
        console.error('Error crediting salary with goal:', err);
        res.status(500).json({ error: 'Failed to credit salary transaction.' });
    }
};

// @desc    Update an existing transaction owned by the signed-in user
// @route   PUT /api/transactions/:id
exports.updateTransaction = async (req, res) => {
    try {
        const { title, amount, type, category, date, isCredited } = req.body;
        const parsedAmount = Number(amount);
        const parsedDate = date ? new Date(date) : null;
        if (!title?.trim() || !category?.trim() || !['income', 'expense'].includes(type) || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || (parsedDate && Number.isNaN(parsedDate.getTime()))) {
            return res.status(400).json({ error: 'Provide a description, positive amount, valid type, category, and date.' });
        }

        const updateData = {
            title: title.trim(),
            amount: parsedAmount,
            type,
            category: category.trim(),
            date: parsedDate || undefined
        };

        if (type === 'income' && isCredited !== undefined) {
            updateData.isCredited = Boolean(isCredited);
        }

        const transaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            updateData,
            { new: true, runValidators: true }
        );
        if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
        res.json(transaction);
    } catch (err) {
        console.error('Transaction update error:', err.message);
        res.status(500).json({ error: 'Unable to update this transaction.' });
    }
};

// Helper function to calculate current available balance for a user
exports.calculateAvailableBalance = async (userId) => {
    const GoalTransfer = require('../models/GoalTransfer');
    const [transactions, user, goalTransfers] = await Promise.all([
        Transaction.find({ userId }),
        require('../models/User').findById(userId).select('openingBalance openingBalanceDate'),
        GoalTransfer.find({ userId })
    ]);

    const openingBalance = user?.openingBalance || 0;
    const openingBalanceDate = user?.openingBalanceDate ? new Date(user.openingBalanceDate) : null;

    const totalAllocatedToGoals = goalTransfers
        .filter(gt => gt.type === 'allocation')
        .reduce((acc, gt) => acc + (gt.amount || 0), 0);

    const totalWithdrawnFromGoals = goalTransfers
        .filter(gt => gt.type === 'emergency_withdrawal')
        .reduce((acc, gt) => acc + (gt.amount || 0), 0);

    let balance = openingBalance;
    if (openingBalanceDate && !isNaN(openingBalanceDate.getTime())) {
        const postOpeningIncome = transactions
            .filter(t => t.type === 'income' && t.isCredited !== false && new Date(t.date) >= openingBalanceDate)
            .reduce((acc, t) => acc + t.amount, 0);

        const postOpeningExpenses = transactions
            .filter(t => t.type === 'expense' && new Date(t.date) >= openingBalanceDate)
            .reduce((acc, t) => acc + t.amount, 0);

        balance = openingBalance + postOpeningIncome - postOpeningExpenses - totalAllocatedToGoals + totalWithdrawnFromGoals;
    } else {
        const totalIncome = transactions
            .filter(t => t.type === 'income' && t.isCredited !== false)
            .reduce((acc, t) => acc + t.amount, 0);
        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);
        balance = openingBalance + totalIncome - totalExpenses - totalAllocatedToGoals + totalWithdrawnFromGoals;
    }

    return balance;
};

// @desc    Confirm salary credit with direct balance, existing goal, or new goal allocation
// @route   POST /api/user/confirm-salary OR POST /api/transactions/confirm-salary
exports.confirmSalaryCredit = async (req, res) => {
    try {
        const { action, goalId, newGoalName, allocationAmount } = req.body;
        const User = require('../models/User');
        const Goal = require('../models/Goal');
        const GoalTransfer = require('../models/GoalTransfer');

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const now = new Date();
        const currentMonthKey = now.toISOString().slice(0, 7);

        // 1. DUPLICATE PREVENTION: Prevent multiple credits in the same salary period
        if (user.isCredited && user.lastCreditedMonth === currentMonthKey) {
            return res.json({
                msg: 'Salary for this month has already been credited.',
                alreadyCredited: true,
                isCredited: true
            });
        }

        const salaryAmount = user.income > 0 ? user.income : (Number(req.body.amount) || 0);
        if (salaryAmount <= 0) {
            return res.status(400).json({ error: 'Income / Salary amount must be greater than zero.' });
        }

        // Check if an uncredited Monthly Salary transaction exists from onboarding
        let incomeTx = await Transaction.findOne({
            userId: req.user.id,
            type: 'income',
            category: 'Salary',
            isCredited: false
        }).sort({ date: -1 });

        if (incomeTx) {
            incomeTx.isCredited = true;
            incomeTx.amount = salaryAmount;
            incomeTx.date = now;
            await incomeTx.save();
        } else {
            incomeTx = new Transaction({
                userId: req.user.id,
                title: 'Monthly Salary',
                amount: salaryAmount,
                type: 'income',
                category: 'Salary',
                isCredited: true,
                date: now
            });
            await incomeTx.save();
        }

        // Persist salary credited status on User model
        user.isCredited = true;
        user.lastCreditedMonth = currentMonthKey;
        await user.save();

        let allocated = 0;
        let goal = null;

        if (action === 'existing' && goalId) {
            goal = await Goal.findOne({ _id: goalId, userId: req.user.id });
            if (goal) {
                allocated = Math.min(salaryAmount, Math.max(0, Number(allocationAmount) || 0));
            }
        } else if (action === 'new' && newGoalName?.trim()) {
            allocated = Math.min(salaryAmount, Math.max(0, Number(allocationAmount) || 0));
            const goalTarget = Number(req.body.targetAmount || req.body.newGoalTargetAmount || 0);
            goal = new Goal({
                userId: req.user.id,
                targetName: newGoalName.trim(),
                targetAmount: goalTarget > 0 ? goalTarget : Math.max(allocated, 10000),
                currentAmount: 0
            });
            await goal.save();
        }

        if (goal && allocated > 0) {
            goal.currentAmount += allocated;
            if (goal.currentAmount >= goal.targetAmount) {
                goal.status = 'completed';
            }
            await goal.save();

            await new GoalTransfer({
                userId: req.user.id,
                goalId: goal._id,
                type: 'allocation',
                amount: allocated,
                date: now
            }).save();
        }

        res.json({
            msg: 'Salary credited successfully!',
            incomeTx,
            goal,
            allocatedAmount: allocated,
            remainingBalance: salaryAmount - allocated,
            isCredited: true
        });
    } catch (err) {
        console.error('Error in confirmSalaryCredit:', err);
        res.status(500).json({ error: 'Failed to confirm salary credit.' });
    }
};


