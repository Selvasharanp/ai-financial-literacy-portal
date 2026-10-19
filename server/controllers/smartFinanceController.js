const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const Scenario = require('../models/Scenario');
const Challenge = require('../models/Challenge');
const { analyzeTransactions } = require('../services/insightEngine');
const { simulate, recurring, summary, challengeProgress } = require('../services/smartFinance');

const userData = (userId) => Promise.all([Transaction.find({ userId }), Goal.find({ userId })]);
const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);

exports.runScenario = async (req, res) => {
    try {
        const { type, category, amount, percent } = req.body;
        const validType = ['reduce_category', 'save_more', 'one_time_expense'].includes(type);
        const validReduction = type === 'reduce_category' && category?.trim() && Number(percent) > 0 && Number(percent) <= 100;
        const validAmount = ['save_more', 'one_time_expense'].includes(type) && Number(amount) > 0;
        if (!validType || (!validReduction && !validAmount)) return res.status(400).json({ error: 'Provide a valid scenario.' });
        const [transactions, goals] = await userData(req.user.id);
        const input = { type, category: category?.trim(), amount: Number(amount), percent: Number(percent) };
        const result = simulate(transactions, goals, input);
        const saved = await Scenario.create({ userId: req.user.id, ...input, result });
        res.status(201).json({ id: saved._id, result });
    } catch (error) {
        console.error('Smart-finance scenario error:', error.message);
        res.status(500).json({ error: 'Unable to calculate scenario.' });
    }
};

exports.getScenarios = async (req, res) => {
    try { res.json(await Scenario.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(5)); }
    catch (error) { console.error('Scenario history error:', error.message); res.status(500).json({ error: 'Unable to load saved scenarios.' }); }
};

exports.getRecurring = async (req, res) => {
    try { const [transactions] = await userData(req.user.id); res.json(recurring(transactions)); }
    catch (error) { console.error('Recurring expense error:', error.message); res.status(500).json({ error: 'Unable to detect recurring expenses.' }); }
};

exports.setRecurringPreference = async (req, res) => {
    try {
        const { preference } = req.body;
        if (!['essential', 'optional', 'unset'].includes(preference)) return res.status(400).json({ error: 'Choose essential, optional, or unset.' });
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
        await Transaction.updateMany({ userId: req.user.id, title: transaction.title, type: 'expense' }, { recurringPreference: preference });
        res.json({ title: transaction.title, preference });
    } catch (error) { console.error('Recurring preference error:', error.message); res.status(500).json({ error: 'Unable to update preference.' }); }
};

exports.getMonthlySummary = async (req, res) => {
    try {
        const [transactions, goals] = await userData(req.user.id);
        const currentHealth = analyzeTransactions(transactions, goals).health;
        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
        const historicalTransactions = transactions.filter((item) => new Date(item.date) < cutoff);
        const previousHealth = historicalTransactions.length ? analyzeTransactions(historicalTransactions, goals, new Date(now.getFullYear(), now.getMonth() - 1, 1)).health : null;
        res.json(summary(transactions, goals, currentHealth, previousHealth, now));
    } catch (error) { console.error('Monthly summary error:', error.message); res.status(500).json({ error: 'Unable to create monthly summary.' }); }
};

exports.getChallenges = async (req, res) => {
    try {
        const [transactions] = await userData(req.user.id);
        const challenges = await Challenge.find({ userId: req.user.id }).sort({ startedAt: -1 });
        const progress = challenges.map((challenge) => challengeProgress(challenge, transactions));
        await Promise.all(progress.filter((item) => item.status === 'active' && new Date() >= new Date(item.endsAt) && item.onTrack).map((item) => Challenge.updateOne({ _id: item._id }, { status: 'completed' })));
        res.json(progress);
    } catch (error) { console.error('Challenge load error:', error.message); res.status(500).json({ error: 'Unable to load challenges.' }); }
};

exports.startChallenge = async (req, res) => {
    try {
        const { type } = req.body;
        if (!['spending_control', 'daily_budget', 'no_impulse_buy'].includes(type)) return res.status(400).json({ error: 'Choose a valid challenge.' });
        const [transactions] = await userData(req.user.id);
        const now = new Date();
        const monthExpenses = transactions.filter((item) => item.type === 'expense' && String(item.category || '').toLowerCase() !== 'savings' && new Date(item.date) >= new Date(now.getFullYear(), now.getMonth(), 1));
        if (type !== 'no_impulse_buy' && !monthExpenses.length) return res.status(400).json({ error: 'Log an expense first so we can set a real daily target.' });
        const target = type === 'no_impulse_buy' ? 0 : Math.round(sum(monthExpenses) / Math.max(1, now.getDate()));
        const endsAt = new Date(now); endsAt.setDate(endsAt.getDate() + 6);
        const challenge = await Challenge.create({ userId: req.user.id, type, target, endsAt });
        res.status(201).json(challengeProgress(challenge, transactions));
    } catch (error) { console.error('Challenge start error:', error.message); res.status(500).json({ error: 'Unable to start challenge.' }); }
};
