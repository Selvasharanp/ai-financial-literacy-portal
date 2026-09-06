const LiteracyContent = require('../models/LiteracyContent');
const Transaction = require('../models/Transaction');
const { analyzeTransactions } = require('../services/insightEngine');

const starterContent = [
    { title: 'Build a simple monthly budget', content: 'Assign every rupee a job: needs, savings, and flexible spending. Review it weekly.', category: 'general', tags: ['general'], difficulty: 'beginner' },
    { title: 'Tame food overspending', content: 'Set a weekly food cap, plan meals, and keep restaurant spending visible before you order.', category: 'food', tags: ['overspending-food'], difficulty: 'beginner' },
    { title: 'Make savings automatic', content: 'Move a fixed amount to savings on payday before spending on wants.', category: 'savings', tags: ['irregular-savings'], difficulty: 'beginner' },
    { title: 'Pause before impulse purchases', content: 'Use a 24-hour rule for non-essential purchases and compare the item with your savings goal.', category: 'shopping', tags: ['impulse-shopping'], difficulty: 'beginner' }
];

const contentOrStarter = async () => {
    const content = await LiteracyContent.find();
    return content.length ? content : starterContent;
};

// 1. Get All Content (Generic Feed)
exports.getAllContent = async (req, res) => {
    try {
        res.json(await contentOrStarter());
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch literacy content' });
    }
};

// 2. Get Personalized Recommendations
exports.getRecommendedContent = async (req, res) => {
    try {
        const userId = req.user.id;
        const transactions = await Transaction.find({ userId, type: 'expense' });
        const library = await contentOrStarter();
        const analysis = analyzeTransactions(transactions);

        if (!analysis.mistakeTags.length) {
            return res.json({ detectedIssue: transactions.length ? 'No spending mistakes detected yet' : 'Start with the essentials', recommendations: library.filter(item => item.difficulty === 'beginner').slice(0, 3) });
        }
        const recommendations = library.filter(item => item.tags?.some(tag => analysis.mistakeTags.includes(tag))).slice(0, 3);

        res.json({
            detectedIssue: analysis.alerts[0]?.title || 'Spending pattern detected',
            recommendations: recommendations.length ? recommendations : library.filter(item => item.difficulty === 'beginner').slice(0, 3)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
};

// 3. Add Content (For you to populate the DB via Postman)
exports.addContent = async (req, res) => {
    try {
        const newContent = new LiteracyContent(req.body);
        await newContent.save();
        res.status(201).json(newContent);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add content' });
    }
};
