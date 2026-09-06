const Goal = require('../models/Goal');

// 1. Create a new Goal
exports.addGoal = async (req, res) => {
    try {
        const { targetName, targetAmount, deadline } = req.body;
        const newGoal = new Goal({
            userId: req.user.id,
            targetName,
            targetAmount,
            deadline
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
        const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });

        if (!goal) return res.status(404).json({ msg: 'Goal not found' });
        
        if (Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be positive.' });
        goal.currentAmount += Number(amount);

        // Check if goal is reached
        if (goal.currentAmount >= goal.targetAmount) {
            goal.status = 'completed';
        }

        await goal.save();
        res.json(goal);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update goal' });
    }
};

// 4. Delete Goal
exports.deleteGoal = async (req, res) => {
    try {
        const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!goal) return res.status(404).json({ msg: 'Goal not found' });
        res.json({ msg: 'Goal deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete goal' });
    }
};
